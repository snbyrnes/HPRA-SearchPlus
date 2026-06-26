/**
 * HPRA SearchPlus — data pipeline
 * ---------------------------------
 * Downloads the authorised + withdrawn HPRA human medicine XML lists, parses
 * them into a single compact JSON the browser can load directly (no 31 MB of
 * XML + in-browser DOMParser), and diffs against the previous build to produce
 * a "what changed" feed.
 *
 * Outputs (committed by CI):
 *   data/products.json   — { datePublished, counts, products: [...] }
 *   data/changes.json    — daily delta vs the previous products.json
 *
 * Usage:
 *   node scripts/build-data.mjs          # download fresh XML from HPRA
 *   node scripts/build-data.mjs --local  # parse existing data/*.xml instead
 *
 * Dependency-free: relies only on Node 22 built-ins (fetch, fs).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');

const SOURCES = {
  authorised: {
    url: 'https://assets.hpra.ie/products/xml/latestHumanlist.xml',
    local: join(DATA, 'latestHumanlist.xml'),
  },
  withdrawn: {
    url: 'https://assets.hpra.ie/products/xml/withdrawnHumanlist.xml',
    local: join(DATA, 'withdrawnHumanlist.xml'),
  },
};

const USE_LOCAL = process.argv.includes('--local');

// ── XML helpers ────────────────────────────────────────────────────
function decodeEntities(s) {
  return s
    .replace(/\r\n?/g, '\n') // XML line-ending normalization (matches DOMParser textContent)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&'); // must run last
}

// Single tag's text (handles xsi:nil self-closing form).
function tag(block, name) {
  const re = new RegExp(`<${name}\\b[^>]*?(?:/>|>([\\s\\S]*?)</${name}>)`);
  const m = block.match(re);
  if (!m) return '';
  if (/xsi:nil="true"/.test(m[0])) return '';
  return decodeEntities((m[1] || '').trim());
}

// Repeated child tags (e.g. <ATC>, <ActiveSubstance>, <Status>).
function tags(block, name) {
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(block))) {
    const t = decodeEntities(m[1].trim());
    if (t) out.push(t);
  }
  return out;
}

// Routes are nested under a same-named wrapper; leaves have no child tags.
function routes(block) {
  const re = /<RoutesOfAdministration\b[^>]*>([^<]*)<\/RoutesOfAdministration>/g;
  const out = [];
  let m;
  while ((m = re.exec(block))) {
    const t = decodeEntities(m[1].trim());
    if (t) out.push(t);
  }
  return out;
}

function parseProducts(xml, listType) {
  const products = [];
  const re = /<Product>([\s\S]*?)<\/Product>/g;
  let m;
  while ((m = re.exec(xml))) {
    const b = m[1];
    const registrationStatus = tag(b, 'RegistrationStatus');
    products.push({
      drugIDPK: tag(b, 'DrugIDPK'),
      licenceNumber: tag(b, 'LicenceNumber'),
      productName: tag(b, 'ProductName'),
      paHolder: tag(b, 'PAHolder'),
      authorisedDate: tag(b, 'AuthorisedDate'),
      productType: tag(b, 'ProductType'),
      marketInfo: tag(b, 'MarketInfo'),
      registrationStatus,
      dosageForm: tag(b, 'DosageForm'),
      legalBasis: tag(b, 'LegalBasis'),
      activeSubstances: tags(b, 'ActiveSubstance'),
      routesOfAdministration: routes(b),
      atcs: tags(b, 'ATC'),
      dispensingStatuses: tags(b, 'Status'),
      supplyLegalStatus: tag(b, 'SupplyLegalStatus'),
      promotionLegalStatus: tag(b, 'PromotionLegalStatus'),
      supplyComments: tag(b, 'SupplyComments'),
      withdrawalDate: tag(b, 'WithdrawalDate'),
      listType: listType || (registrationStatus === 'WI' ? 'withdrawn' : 'authorised'),
    });
  }
  return products;
}

function datePublished(xml) {
  const m = xml.match(/datePublished="([^"]+)"/);
  return m ? m[1] : null;
}

async function loadXml(src) {
  if (USE_LOCAL) {
    if (!existsSync(src.local)) throw new Error(`Missing local file: ${src.local}`);
    return readFileSync(src.local, 'utf8');
  }
  const resp = await fetch(src.url, { headers: { 'User-Agent': 'HPRA-SearchPlus-build' } });
  if (!resp.ok) throw new Error(`Download failed (${resp.status}) for ${src.url}`);
  return resp.text();
}

// ── Change feed ────────────────────────────────────────────────────
const TRACKED_FIELDS = ['marketInfo', 'registrationStatus', 'paHolder', 'legalBasis', 'dosageForm', 'productName'];
const CAP = 2000; // keep each delta list bounded
const slim = (p) => ({ drugIDPK: p.drugIDPK, productName: p.productName, paHolder: p.paHolder, licenceNumber: p.licenceNumber });

function buildChanges(prev, current, prevMeta, meta) {
  const prevMap = new Map(prev.map((p) => [p.drugIDPK, p]));
  const curMap = new Map(current.map((p) => [p.drugIDPK, p]));

  const newlyAuthorised = [];
  const newlyWithdrawn = [];
  const added = [];
  const removed = [];
  const fieldChanged = [];

  for (const p of current) {
    const old = prevMap.get(p.drugIDPK);
    if (!old) {
      added.push(slim(p));
      (p.listType === 'withdrawn' ? newlyWithdrawn : newlyAuthorised).push(slim(p));
      continue;
    }
    if (old.listType !== p.listType) {
      (p.listType === 'withdrawn' ? newlyWithdrawn : newlyAuthorised).push(slim(p));
    }
    const diffs = {};
    for (const f of TRACKED_FIELDS) {
      if ((old[f] || '') !== (p[f] || '')) diffs[f] = { from: old[f] || '', to: p[f] || '' };
    }
    if (Object.keys(diffs).length) fieldChanged.push({ ...slim(p), changes: diffs });
  }
  for (const p of prev) {
    if (!curMap.has(p.drugIDPK)) removed.push(slim(p));
  }

  const cap = (arr) => ({ total: arr.length, truncated: arr.length > CAP, items: arr.slice(0, CAP) });
  return {
    generatedAt: new Date().toISOString(),
    since: prevMeta?.datePublished?.authorised || null,
    until: meta.datePublished.authorised,
    summary: {
      added: added.length,
      removed: removed.length,
      newlyAuthorised: newlyAuthorised.length,
      newlyWithdrawn: newlyWithdrawn.length,
      fieldChanged: fieldChanged.length,
    },
    newlyAuthorised: cap(newlyAuthorised),
    newlyWithdrawn: cap(newlyWithdrawn),
    added: cap(added),
    removed: cap(removed),
    fieldChanged: cap(fieldChanged),
  };
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log(USE_LOCAL ? 'Reading local XML…' : 'Downloading XML from HPRA…');
  const [authXml, withXml] = await Promise.all([loadXml(SOURCES.authorised), loadXml(SOURCES.withdrawn)]);

  const authorised = parseProducts(authXml, 'authorised');
  const withdrawn = parseProducts(withXml, 'withdrawn');
  const products = authorised.concat(withdrawn);
  console.log(`Parsed ${authorised.length} authorised + ${withdrawn.length} withdrawn = ${products.length} products`);

  if (!authorised.length) throw new Error('No authorised products parsed — aborting to avoid publishing empty data');

  const meta = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    datePublished: { authorised: datePublished(authXml), withdrawn: datePublished(withXml) },
    counts: { authorised: authorised.length, withdrawn: withdrawn.length, total: products.length },
  };

  // The app loads the authorised list on startup and lazy-loads the withdrawn
  // list on demand, so the two are written to separate files.
  const productsPath = join(DATA, 'products.json');            // authorised (loaded first)
  const withdrawnPath = join(DATA, 'products-withdrawn.json'); // withdrawn (lazy-loaded)

  // Reconstruct the previous full set (authorised + withdrawn) for the diff.
  let prevProducts = null;
  let prevMeta = null;
  if (existsSync(productsPath)) {
    try {
      const prevDoc = JSON.parse(readFileSync(productsPath, 'utf8'));
      prevMeta = prevDoc;
      prevProducts = prevDoc.products || [];
      if (existsSync(withdrawnPath)) {
        const prevW = JSON.parse(readFileSync(withdrawnPath, 'utf8'));
        prevProducts = prevProducts.concat(prevW.products || []);
      }
    } catch (e) {
      console.warn('Could not read previous build for diff:', e.message);
      prevProducts = null;
    }
  }

  let changes;
  if (prevProducts) {
    changes = buildChanges(prevProducts, products, prevMeta, meta);
    changes.firstRun = false;
  } else {
    changes = { generatedAt: meta.generatedAt, firstRun: true, since: null, until: meta.datePublished.authorised,
      summary: { added: 0, removed: 0, newlyAuthorised: 0, newlyWithdrawn: 0, fieldChanged: 0 },
      newlyAuthorised: { total: 0, truncated: false, items: [] },
      newlyWithdrawn: { total: 0, truncated: false, items: [] },
      added: { total: 0, truncated: false, items: [] },
      removed: { total: 0, truncated: false, items: [] },
      fieldChanged: { total: 0, truncated: false, items: [] } };
  }

  writeFileSync(productsPath, JSON.stringify({ ...meta, products: authorised }));
  writeFileSync(withdrawnPath, JSON.stringify({ count: withdrawn.length, products: withdrawn }));
  writeFileSync(join(DATA, 'changes.json'), JSON.stringify(changes, null, 0));
  console.log('Wrote data/products.json (authorised), data/products-withdrawn.json, and data/changes.json');
  console.log('Change summary:', JSON.stringify(changes.summary));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
