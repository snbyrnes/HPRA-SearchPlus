/**
 * HPRA SearchPlus – Application Logic
 * Vanilla JS | No build step required
 */
(() => {
    // ── State ──────────────────────────────────────────
    let allProducts = [];
    let filteredProducts = [];
    let currentPage = 1;
    let itemsPerPage = 50;
    let viewMode = localStorage.getItem('viewMode') || 'table'; // 'card' | 'table'
    let currentSort = localStorage.getItem('sortMode') || 'name-asc';
    let searchTerm = '';
    let debounceTimer = null;

    // Multiselect state
    const msState = { form: [], holder: [], substance: [], route: [], atc: [] };

    // ATC browser state
    let atcBrowserFilter = '';
    let atcBrowserVisible = false;

    // ATC Level 1 names
    const ATC_LEVEL1_NAMES = {
        'A': 'Alimentary Tract & Metabolism',
        'B': 'Blood & Blood Forming Organs',
        'C': 'Cardiovascular System',
        'D': 'Dermatologicals',
        'G': 'Genito-Urinary & Sex Hormones',
        'H': 'Systemic Hormonal Preparations',
        'J': 'Anti-Infectives (Systemic)',
        'L': 'Antineoplastic & Immunomodulating',
        'M': 'Musculo-Skeletal System',
        'N': 'Nervous System',
        'P': 'Antiparasitic Products',
        'R': 'Respiratory System',
        'S': 'Sensory Organs',
        'V': 'Various'
    };

    // ── Table Column Definitions ───────────────────────
    const TABLE_COLUMNS = [
        { key: 'productName', header: 'Product Name', render: p => `<strong>${hl(p.productName)}</strong>`, default: true },
        { key: 'paHolder', header: 'PA Holder', render: p => hl(p.paHolder), default: true },
        { key: 'licenceNumber', header: 'Licence', render: p => hl(p.licenceNumber), style: 'font-size:11px;font-family:monospace;', default: true },
        { key: 'dosageForm', header: 'Dosage Form', render: p => hl(p.dosageForm), default: true },
        { key: 'activeSubstances', header: 'Active Substances', render: p => p.activeSubstances.map(s => hl(s)).join(', '), default: true },
        { key: 'marketInfo', header: 'Market', render: p => `<span class="cell-badge ${badgeClass(p.marketInfo)}">${p.marketInfo}</span>`, default: true },
        { key: 'routesOfAdministration', header: 'Routes', render: p => p.routesOfAdministration.join(', ') || '\u2014', style: 'font-size:11px;', default: true },
        { key: 'atcs', header: 'ATC', render: p => p.atcs.join(', ') || '\u2014', style: 'font-size:11px;font-family:monospace;', default: true },
        { key: 'authorisedDate', header: 'Auth. Date', render: p => p.authorisedDate || '\u2014', style: 'white-space:nowrap;', default: true },
        { key: 'drugIDPK', header: 'Drug ID', render: p => escHTML(p.drugIDPK), style: 'font-size:11px;', default: false },
        { key: 'productType', header: 'Product Type', render: p => escHTML(p.productType), default: false },
        { key: 'registrationStatus', header: 'Registration', render: p => escHTML(p.registrationStatus), default: false },
        { key: 'legalBasis', header: 'Legal Basis', render: p => escHTML(p.legalBasis), default: false },
        { key: 'dispensingStatuses', header: 'Dispensing', render: p => p.dispensingStatuses.join(', ') || '\u2014', default: false },
        { key: 'supplyLegalStatus', header: 'Supply Status', render: p => escHTML(p.supplyLegalStatus) || '\u2014', default: false },
        { key: 'promotionLegalStatus', header: 'Promotion', render: p => escHTML(p.promotionLegalStatus) || '\u2014', default: false },
        { key: 'supplyComments', header: 'Supply Comments', render: p => escHTML(p.supplyComments) || '\u2014', style: 'max-width:200px;', default: false },
    ];

    // Visible columns (persisted in localStorage)
    let visibleColumns = (() => {
        try {
            const saved = localStorage.getItem('visibleColumns');
            if (saved) return JSON.parse(saved);
        } catch (e) { /* ignore */ }
        return TABLE_COLUMNS.filter(c => c.default).map(c => c.key);
    })();

    // ── DOM refs ───────────────────────────────────────
    const $ = id => document.getElementById(id);
    const searchInput = $('searchInput');
    const searchClear = $('searchClear');
    const searchHint = $('searchHint');
    const sortSelect = $('sortSelect');
    const filterMarket = $('filterMarket');
    const filterType = $('filterType');
    const filterStatus = $('filterStatus');
    const filterLegalBasis = $('filterLegalBasis');
    const filterDispensing = $('filterDispensing');
    const clearFiltersBtn = $('clearFiltersBtn');
    const productsContainer = $('productsContainer');
    const paginationControls = $('paginationControls');
    const perPageSelect = $('perPageSelect');
    const exportBtn = $('exportBtn');
    const viewToggleBtn = $('viewToggleBtn');
    const atcBrowserBtn = $('atcBrowserBtn');
    const shareBtn = $('shareBtn');

    // ── Theme ──────────────────────────────────────────
    const themeToggle = $('themeToggle');
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark');
        themeToggle.textContent = '☀️';
    }
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        localStorage.setItem('darkMode', isDark);
        themeToggle.textContent = isDark ? '☀️' : '🌙';
    });

    // ── Toast ──────────────────────────────────────────
    function showToast(msg, duration = 2200) {
        const t = $('toast');
        t.textContent = msg;
        t.classList.add('visible');
        setTimeout(() => t.classList.remove('visible'), duration);
    }

    // ── Clipboard ──────────────────────────────────────
    function copyText(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            const orig = btn.textContent;
            btn.textContent = '✓';
            btn.classList.add('copied');
            showToast('Copied to clipboard');
            setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1200);
        });
    }

    // ── XML Loading ────────────────────────────────────
    // Try data/ subfolder first (GitHub Pages layout), then root (local use)
    const XML_FILENAMES = [
        'data/latestHumanlist.xml',
        'data/latestHumanList.xml',
        'data/LatestHumanList.xml',
        'data/humanlist.xml',
        'data/HumanList.xml',
        'data/products.xml',
        'latestHumanlist.xml',
        'latestHumanList.xml',
        'LatestHumanList.xml',
        'humanlist.xml',
        'HumanList.xml',
        'products.xml'
    ];

    async function tryAutoLoad() {
        for (const fname of XML_FILENAMES) {
            try {
                const resp = await fetch(fname);
                if (resp.ok) {
                    const text = await resp.text();
                    if (text.includes('<Product') || text.includes('<Products')) {
                        const displayName = fname.split('/').pop();
                        showToast(`Auto-loaded ${displayName}`);
                        return text;
                    }
                }
            } catch (e) { /* continue */ }
        }
        return null;
    }

    async function init() {
        const xmlText = await tryAutoLoad();
        if (xmlText) {
            processXML(xmlText);
        } else {
            $('loadingState').style.display = 'none';
            $('dropZone').style.display = 'block';
        }
    }

    function processXML(xmlText) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

            if (xmlDoc.getElementsByTagName('parsererror').length > 0)
                throw new Error('Invalid XML — failed to parse');

            // Publication date & freshness indicator
            const root = xmlDoc.documentElement;
            if (root?.hasAttribute('datePublished')) {
                const d = new Date(root.getAttribute('datePublished'));
                if (!isNaN(d.getTime())) {
                    const pubEl = $('publicationDate');
                    pubEl.textContent = `Published: ${d.toLocaleDateString('en-IE', {
                        year: 'numeric', month: 'long', day: 'numeric'
                    })} at ${d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}`;

                    // Freshness badge
                    const daysAgo = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
                    const fClass = daysAgo <= 30 ? 'freshness-fresh' : daysAgo <= 90 ? 'freshness-aging' : 'freshness-stale';
                    const fText = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
                    const fTip = daysAgo <= 30 ? 'Data is up to date' : daysAgo <= 90 ? 'Data may be outdated \u2014 consider updating' : 'Data is stale \u2014 please update the XML';
                    const badge = document.createElement('span');
                    badge.className = `freshness-badge ${fClass}`;
                    badge.textContent = fText;
                    badge.title = fTip;
                    pubEl.appendChild(badge);
                }
            }

            allProducts = parseProducts(xmlDoc);
            filteredProducts = [...allProducts];

            // Show UI
            $('loadingState').style.display = 'none';
            $('dropZone').style.display = 'none';
            $('searchRow').style.display = 'flex';
            $('filtersRow').style.display = 'flex';
            $('statsBar').style.display = 'flex';
            exportBtn.style.display = '';
            viewToggleBtn.style.display = '';
            atcBrowserBtn.style.display = '';
            shareBtn.style.display = '';
            if ($('appFooter')) $('appFooter').style.display = '';

            populateFilters();
            buildColumnPicker();
            applyUrlState();
            initAtcBrowser();
            if (atcBrowserVisible) $('atcBrowserPanel').style.display = '';
            sortSelect.value = currentSort;
            applyFilters();
            applySort();
            updateViewToggle();
            updateClearButton();
            renderProducts();
            updateUrlState();

            console.log(`Loaded ${allProducts.length} products`);
        } catch (err) {
            console.error(err);
            $('loadingState').innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">⚠️</div>
                    <div class="no-results-text">Error Loading File</div>
                    <p style="color:#86868b;margin-top:8px;">${err.message}</p>
                </div>`;
        }
    }

    // ── XML Parsing ────────────────────────────────────
    function parseProducts(xmlDoc) {
        const products = [];
        const nodes = xmlDoc.getElementsByTagName('Product');
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];

            // Get dispensing statuses (nested under DispensingLegalStatus > Status)
            const dispensingStatuses = [];
            const dlsElements = n.getElementsByTagName('DispensingLegalStatus');
            if (dlsElements.length > 0) {
                const statusElements = dlsElements[0].getElementsByTagName('Status');
                for (let j = 0; j < statusElements.length; j++) {
                    if (statusElements[j].textContent.trim())
                        dispensingStatuses.push(statusElements[j].textContent.trim());
                }
            }

            products.push({
                drugIDPK: txt(n, 'DrugIDPK'),
                licenceNumber: txt(n, 'LicenceNumber'),
                productName: txt(n, 'ProductName'),
                paHolder: txt(n, 'PAHolder'),
                authorisedDate: txt(n, 'AuthorisedDate'),
                productType: txt(n, 'ProductType'),
                marketInfo: txt(n, 'MarketInfo'),
                registrationStatus: txt(n, 'RegistrationStatus'),
                dosageForm: txt(n, 'DosageForm'),
                legalBasis: txt(n, 'LegalBasis'),
                activeSubstances: txts(n, 'ActiveSubstance'),
                routesOfAdministration: getRoutes(n),
                atcs: txts(n, 'ATC'),
                dispensingStatuses,
                supplyLegalStatus: txt(n, 'SupplyLegalStatus'),
                promotionLegalStatus: txt(n, 'PromotionLegalStatus'),
                supplyComments: txt(n, 'SupplyComments'),
            });
        }
        return products;
    }

    function txt(parent, tag) {
        const el = parent.getElementsByTagName(tag)[0];
        if (!el) return '';
        // Check for xsi:nil
        if (el.getAttribute('xsi:nil') === 'true') return '';
        return el.textContent.trim();
    }

    function txts(parent, tag) {
        const els = parent.getElementsByTagName(tag);
        const arr = [];
        for (let i = 0; i < els.length; i++) {
            const t = els[i].textContent.trim();
            if (t) arr.push(t);
        }
        return arr;
    }

    function getRoutes(node) {
        // Routes are nested: <RoutesOfAdministration><RoutesOfAdministration>...</RoutesOfAdministration></RoutesOfAdministration>
        // Both parent and children share the same tag name, so children are at depth > 0
        const routeEls = node.getElementsByTagName('RoutesOfAdministration');
        const routes = [];
        for (let i = 0; i < routeEls.length; i++) {
            // Only take leaf elements (those without child RoutesOfAdministration elements)
            if (routeEls[i].getElementsByTagName('RoutesOfAdministration').length === 0) {
                const t = routeEls[i].textContent.trim();
                if (t) routes.push(t);
            }
        }
        return routes;
    }

    // ── Filter Population ──────────────────────────────

    // Stores the actual string values for each multiselect, indexed by position.
    // This avoids putting raw values into HTML attributes where special chars break things.
    const msData = { form: [], holder: [], substance: [], route: [], atc: [] };

    function populateFilters() {
        // Clear previous options from <select> elements (supports re-loading a new file)
        [filterType, filterStatus, filterLegalBasis, filterDispensing].forEach(sel => {
            while (sel.options.length > 1) sel.remove(1);
        });

        // Product Type
        populateSelect(filterType, uniqueSorted(allProducts.map(p => p.productType)));
        // Registration Status
        populateSelect(filterStatus, uniqueSorted(allProducts.map(p => p.registrationStatus)));
        // Legal Basis
        populateSelect(filterLegalBasis, uniqueSorted(allProducts.map(p => p.legalBasis)));
        // Dispensing Status
        const allDisp = [];
        allProducts.forEach(p => p.dispensingStatuses.forEach(d => { if (!allDisp.includes(d)) allDisp.push(d); }));
        allDisp.sort();
        populateSelect(filterDispensing, allDisp);

        // Multiselects with counts
        buildMultiselectOptions('form', countBy(allProducts, p => [p.dosageForm]));
        buildMultiselectOptions('holder', countBy(allProducts, p => [p.paHolder]));
        buildMultiselectOptions('substance', countBy(allProducts, p => p.activeSubstances));
        buildMultiselectOptions('route', countBy(allProducts, p => p.routesOfAdministration));
        buildMultiselectOptions('atc', countBy(allProducts, p => p.atcs));
    }

    function uniqueSorted(arr) {
        return [...new Set(arr)].filter(v => v && v !== 'N/A').sort();
    }

    function countBy(products, accessor) {
        const map = {};
        products.forEach(p => {
            accessor(p).forEach(v => {
                if (v) map[v] = (map[v] || 0) + 1;
            });
        });
        return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
    }

    function populateSelect(sel, values) {
        values.forEach(v => {
            const o = document.createElement('option');
            o.value = v; o.textContent = v;
            sel.appendChild(o);
        });
    }

    // ── Robust Multiselect Engine ──────────────────────
    // Uses data-idx attributes referencing msData[key] array by index,
    // avoiding all HTML attribute encoding problems.
    // Event listeners are attached ONCE via delegation (outside populateFilters)
    // so they never stack up on reload.

    function buildMultiselectOptions(key, entries) {
        // Store values in msData for lookup by index
        msData[key] = entries.map(e => e[0]);
        msState[key] = []; // reset selection on reload

        const wrapper = document.querySelector(`.multiselect-wrapper[data-ms="${key}"]`);
        const optionsContainer = wrapper.querySelector('.multiselect-options');
        const searchInput = wrapper.querySelector('.multiselect-search input');

        // Clear search field
        searchInput.value = '';

        // Build options using DOM methods (no innerHTML encoding issues)
        optionsContainer.innerHTML = '';
        entries.forEach(([val, count], idx) => {
            const label = document.createElement('label');
            label.className = 'multiselect-option';
            label.dataset.idx = idx;
            label.dataset.searchText = val.toLowerCase(); // for search matching

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.dataset.idx = idx;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = val;

            const countSpan = document.createElement('span');
            countSpan.className = 'count';
            countSpan.textContent = count;

            label.appendChild(cb);
            label.appendChild(nameSpan);
            label.appendChild(countSpan);
            optionsContainer.appendChild(label);
        });

        updateMsDisplay(wrapper, key);
    }

    function getMsSelectedValues(key) {
        // Read checked indices and map back to actual string values
        const wrapper = document.querySelector(`.multiselect-wrapper[data-ms="${key}"]`);
        const checked = wrapper.querySelectorAll('.multiselect-options input[type="checkbox"]:checked');
        return [...checked].map(cb => msData[key][parseInt(cb.dataset.idx)]).filter(Boolean);
    }

    function updateMsDisplay(wrapper, key) {
        const display = wrapper.querySelector('.ms-display');
        const sel = msState[key];
        if (sel.length === 0) {
            display.textContent = 'All';
            display.classList.add('multiselect-placeholder');
        } else if (sel.length === 1) {
            display.textContent = sel[0].length > 28 ? sel[0].substring(0, 25) + '…' : sel[0];
            display.classList.remove('multiselect-placeholder');
        } else {
            display.textContent = `${sel.length} selected`;
            display.classList.remove('multiselect-placeholder');
        }
    }

    function closeAllMultiselects(except) {
        document.querySelectorAll('.multiselect-dropdown.active').forEach(dd => {
            if (!except || !except.contains(dd)) dd.classList.remove('active');
        });
        // Clear search fields when closing so options are visible next time
        document.querySelectorAll('.multiselect-search input').forEach(inp => {
            if (!except || !except.contains(inp)) {
                inp.value = '';
                // Unhide all options
                const opts = inp.closest('.multiselect-dropdown')?.querySelector('.multiselect-options');
                if (opts) opts.querySelectorAll('.multiselect-option').forEach(o => o.style.display = '');
            }
        });
    }

    // ── Multiselect event delegation (attached ONCE, works across reloads) ──
    // Handles: button toggle, checkbox change, search input, select-all, clear
    document.addEventListener('click', e => {
        // Close column picker if clicking outside it
        if (!e.target.closest('.column-picker-wrapper')) {
            $('columnPickerDropdown')?.classList.remove('active');
        }

        // Column picker button toggle
        const cpBtn = e.target.closest('#columnPickerBtn');
        if (cpBtn) {
            e.stopPropagation();
            closeAllMultiselects();
            $('columnPickerDropdown').classList.toggle('active');
            return;
        }

        // Column picker: Show All
        if (e.target.closest('.cp-show-all')) {
            e.stopPropagation();
            visibleColumns = TABLE_COLUMNS.map(c => c.key);
            localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns));
            buildColumnPicker();
            if (viewMode === 'table') renderProducts();
            return;
        }

        // Column picker: Defaults
        if (e.target.closest('.cp-defaults')) {
            e.stopPropagation();
            visibleColumns = TABLE_COLUMNS.filter(c => c.default).map(c => c.key);
            localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns));
            buildColumnPicker();
            if (viewMode === 'table') renderProducts();
            return;
        }

        // Inside column picker dropdown \u2014 keep it open
        if (e.target.closest('#columnPickerDropdown')) {
            e.stopPropagation();
            return;
        }

        // Button toggle: open/close dropdown
        const msBtn = e.target.closest('.multiselect-button');
        if (msBtn) {
            e.preventDefault();
            e.stopPropagation();
            const wrapper = msBtn.closest('.multiselect-wrapper');
            const dd = wrapper.querySelector('.multiselect-dropdown');
            const wasActive = dd.classList.contains('active');
            closeAllMultiselects(wasActive ? null : wrapper);
            if (!wasActive) {
                dd.classList.add('active');
                wrapper.querySelector('.multiselect-search input').focus();
            }
            return;
        }

        // Select-all button
        const selAllBtn = e.target.closest('.ms-select-all');
        if (selAllBtn) {
            e.preventDefault();
            e.stopPropagation();
            const wrapper = selAllBtn.closest('.multiselect-wrapper');
            const key = wrapper.dataset.ms;
            const opts = wrapper.querySelector('.multiselect-options');
            // Only select currently VISIBLE options
            opts.querySelectorAll('.multiselect-option:not([style*="display: none"]) input[type="checkbox"]').forEach(cb => cb.checked = true);
            msState[key] = getMsSelectedValues(key);
            updateMsDisplay(wrapper, key);
            filterAndRender();
            return;
        }

        // Clear button
        const clearBtn = e.target.closest('.ms-clear');
        if (clearBtn) {
            e.preventDefault();
            e.stopPropagation();
            const wrapper = clearBtn.closest('.multiselect-wrapper');
            const key = wrapper.dataset.ms;
            wrapper.querySelectorAll('.multiselect-options input[type="checkbox"]').forEach(cb => cb.checked = false);
            msState[key] = [];
            updateMsDisplay(wrapper, key);
            filterAndRender();
            return;
        }

        // Clicking inside an open dropdown should NOT close it
        if (e.target.closest('.multiselect-dropdown')) {
            e.stopPropagation();
            return;
        }

        // Clicking outside any multiselect → close all
        if (!e.target.closest('.multiselect-wrapper')) {
            closeAllMultiselects();
        }
    });

    // Checkbox change via event delegation on each wrapper
    document.querySelectorAll('.multiselect-wrapper').forEach(wrapper => {
        const key = wrapper.dataset.ms;
        wrapper.addEventListener('change', e => {
            if (e.target.type === 'checkbox') {
                msState[key] = getMsSelectedValues(key);
                updateMsDisplay(wrapper, key);
                filterAndRender();
            }
        });

        // Search input within each dropdown (event delegation)
        wrapper.addEventListener('input', e => {
            if (e.target.closest('.multiselect-search')) {
                const term = e.target.value.toLowerCase().trim();
                const opts = wrapper.querySelector('.multiselect-options');
                opts.querySelectorAll('.multiselect-option').forEach(opt => {
                    const searchText = opt.dataset.searchText || '';
                    opt.style.display = (!term || searchText.includes(term)) ? '' : 'none';
                });
            }
        });
    });

    // ── Column Picker change listener ─────────────────
    $('columnPickerDropdown')?.addEventListener('change', e => {
        if (e.target.type === 'checkbox') {
            const key = e.target.value;
            if (e.target.checked) {
                if (!visibleColumns.includes(key)) visibleColumns.push(key);
            } else {
                const filtered = visibleColumns.filter(k => k !== key);
                if (filtered.length === 0) { e.target.checked = true; showToast('At least one column required'); return; }
                visibleColumns = filtered;
            }
            // maintain column order consistent with TABLE_COLUMNS
            visibleColumns = TABLE_COLUMNS.map(c => c.key).filter(k => visibleColumns.includes(k));
            localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns));
            if (viewMode === 'table') renderProducts();
        }
    });

    // ── Filtering ──────────────────────────────────────
    function filterAndRender() {
        currentPage = 1;
        applyFilters();
        applySort();
        renderProducts();
        updateClearButton();
        updateUrlState();
    }

    function applyFilters() {
        const term = searchTerm.toLowerCase();
        const market = filterMarket.value;
        const type = filterType.value;
        const status = filterStatus.value;
        const legal = filterLegalBasis.value;
        const dispensing = filterDispensing.value;

        filteredProducts = allProducts.filter(p => {
            // Text search across ALL fields
            if (term) {
                const haystack = [
                    p.productName, p.paHolder, p.drugIDPK, p.licenceNumber,
                    p.dosageForm, p.legalBasis, p.marketInfo, p.registrationStatus,
                    p.supplyLegalStatus, p.promotionLegalStatus, p.supplyComments,
                    ...p.activeSubstances, ...p.routesOfAdministration,
                    ...p.atcs, ...p.dispensingStatuses
                ].join(' ').toLowerCase();
                // Support multi-word search: all words must match
                const words = term.split(/\s+/).filter(w => w);
                if (!words.every(w => haystack.includes(w))) return false;
            }

            if (market && p.marketInfo !== market) return false;
            if (type && p.productType !== type) return false;
            if (status && p.registrationStatus !== status) return false;
            if (legal && p.legalBasis !== legal) return false;
            if (dispensing && !p.dispensingStatuses.includes(dispensing)) return false;
            if (msState.form.length && !msState.form.includes(p.dosageForm)) return false;
            if (msState.holder.length && !msState.holder.includes(p.paHolder)) return false;
            if (msState.substance.length && !p.activeSubstances.some(s => msState.substance.includes(s))) return false;
            if (msState.route.length && !p.routesOfAdministration.some(r => msState.route.includes(r))) return false;
            if (msState.atc.length && !p.atcs.some(a => msState.atc.includes(a))) return false;
            if (atcBrowserFilter && !p.atcs.some(a => a.startsWith(atcBrowserFilter))) return false;

            return true;
        });
    }

    // ── Sorting ────────────────────────────────────────
    function applySort() {
        const [field, dir] = currentSort.split('-');
        const mult = dir === 'desc' ? -1 : 1;

        filteredProducts.sort((a, b) => {
            let cmp = 0;
            switch (field) {
                case 'name':
                    cmp = a.productName.localeCompare(b.productName);
                    break;
                case 'holder':
                    cmp = a.paHolder.localeCompare(b.paHolder);
                    break;
                case 'date':
                    cmp = parseDate(a.authorisedDate) - parseDate(b.authorisedDate);
                    break;
                case 'market':
                    cmp = marketOrder(a.marketInfo) - marketOrder(b.marketInfo);
                    break;
            }
            return cmp * mult;
        });
    }

    function parseDate(str) {
        if (!str) return 0;
        const parts = str.split('/');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
        return new Date(str).getTime() || 0;
    }

    function marketOrder(m) {
        return m === 'Marketed' ? 0 : m === 'Not marketed' ? 1 : 2;
    }

    // ── Rendering ──────────────────────────────────────
    function renderProducts() {
        productsContainer.style.display = 'block';
        updateStats();

        if (filteredProducts.length === 0) {
            productsContainer.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">🔍</div>
                    <div class="no-results-text">No medications found</div>
                    <p style="color:#86868b;margin-top:6px;">Try adjusting your search or filters</p>
                </div>`;
            paginationControls.style.display = 'none';
            return;
        }

        const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * itemsPerPage;
        const page = filteredProducts.slice(start, start + itemsPerPage);

        if (viewMode === 'table') {
            renderTableView(page);
        } else {
            renderCardView(page);
        }

        // Pagination
        if (totalPages > 1) {
            paginationControls.style.display = 'flex';
            $('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
            $('firstPageBtn').disabled = currentPage === 1;
            $('prevPageBtn').disabled = currentPage === 1;
            $('nextPageBtn').disabled = currentPage === totalPages;
            $('lastPageBtn').disabled = currentPage === totalPages;
        } else {
            paginationControls.style.display = 'none';
        }
    }

    function renderCardView(page) {
        productsContainer.innerHTML = `<div class="products-grid">${page.map(p => cardHTML(p)).join('')}</div>`;
        productsContainer.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => showDetail(card.dataset.id));
        });
    }

    function renderTableView(page) {
        const cols = TABLE_COLUMNS.filter(c => visibleColumns.includes(c.key));
        productsContainer.innerHTML = `
            <div class="products-table-wrapper">
            <table class="products-table">
                <thead>
                    <tr>${cols.map(c => `<th>${c.header}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${page.map(p => `
                        <tr data-id="${escHTML(p.drugIDPK)}">
                            ${cols.map(c => {
                                const style = c.style ? ` style="${c.style}"` : '';
                                return `<td${style}>${c.render(p)}</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>`;
        productsContainer.querySelectorAll('tbody tr').forEach(row => {
            row.addEventListener('click', () => showDetail(row.dataset.id));
        });
    }

    function cardHTML(p) {
        const badge = `<span class="badge ${badgeClass(p.marketInfo)}">${p.marketInfo}</span>`;
        const subs = p.activeSubstances.length
            ? `<div class="substance-tags">
                <span style="font-size:10px;font-weight:600;color:#86868b;">ACTIVE SUBSTANCES</span><br>
                ${p.activeSubstances.map(s => `<span class="substance-tag">${hl(s)}</span>`).join('')}
               </div>`
            : '';
        return `
            <div class="product-card" data-id="${escHTML(p.drugIDPK)}">
                <div class="product-name">${hl(p.productName)}</div>
                <div class="product-detail"><span class="detail-label">Holder</span><span class="detail-value">${hl(p.paHolder)}</span></div>
                <div class="product-detail"><span class="detail-label">Form</span><span class="detail-value">${hl(p.dosageForm)}</span></div>
                <div class="product-detail"><span class="detail-label">Licence</span><span class="detail-value" style="font-family:monospace;font-size:11px;">${hl(p.licenceNumber)}</span></div>
                ${p.atcs.length ? `<div class="product-detail"><span class="detail-label">ATC</span><span class="detail-value" style="font-family:monospace;font-size:11px;">${p.atcs.map(a => hl(a)).join(', ')}</span></div>` : ''}
                ${badge}
                ${subs}
            </div>`;
    }

    function badgeClass(m) {
        return m === 'Marketed' ? 'badge-marketed' : m === 'Not marketed' ? 'badge-not-marketed' : 'badge-unknown';
    }

    // Search highlighting
    function hl(text) {
        if (!text || !searchTerm) return escHTML(text || '');
        const escaped = escHTML(text);
        const words = searchTerm.toLowerCase().split(/\s+/).filter(w => w);
        if (!words.length) return escaped;
        // Build regex from search words
        const pat = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        return escaped.replace(new RegExp(`(${pat})`, 'gi'), '<mark>$1</mark>');
    }

    function escHTML(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // ── Statistics ─────────────────────────────────────
    function updateStats() {
        const total = filteredProducts.length;
        const marketed = filteredProducts.filter(p => p.marketInfo === 'Marketed').length;
        const notMarketed = filteredProducts.filter(p => p.marketInfo === 'Not marketed').length;
        const unknown = total - marketed - notMarketed;

        $('statTotal').textContent = `${total.toLocaleString()} of ${allProducts.length.toLocaleString()} products`;
        $('statMarketed').textContent = `✓ ${marketed.toLocaleString()} Marketed`;
        $('statNotMarketed').textContent = `✗ ${notMarketed.toLocaleString()} Not Marketed`;
        $('statUnknown').textContent = `? ${unknown.toLocaleString()} Unknown`;
    }

    // ── Detail Modal ───────────────────────────────────
    function showDetail(drugId) {
        const p = allProducts.find(x => x.drugIDPK === drugId);
        if (!p) return;

        const list = arr => arr.length ? `<ul>${arr.map(v => `<li>${escHTML(v)}</li>`).join('')}</ul>` : '<em style="color:#86868b;">None</em>';
        const val = v => v ? escHTML(v) : '<em style="color:#86868b;">—</em>';

        $('modalBody').innerHTML = `
            <div class="modal-header">
                <h2>${escHTML(p.productName)}</h2>
                <button class="modal-close" id="modalCloseBtn">&times;</button>
            </div>

            <div class="modal-section">
                <div class="modal-section-title">Identification</div>
                <div class="modal-field">
                    <div class="modal-field-label">Licence Number</div>
                    <div class="modal-field-value">${escHTML(p.licenceNumber)}
                        <button class="copy-btn" title="Copy licence number" onclick="event.stopPropagation()">📋</button>
                    </div>
                </div>
                <div class="modal-field">
                    <div class="modal-field-label">Drug ID</div>
                    <div class="modal-field-value">${val(p.drugIDPK)}</div>
                </div>
                <div class="modal-field">
                    <div class="modal-field-label">Product Type</div>
                    <div class="modal-field-value">${val(p.productType)}</div>
                </div>
                <div class="modal-field">
                    <div class="modal-field-label">ATC Codes</div>
                    <div class="modal-field-value">${p.atcs.length ? p.atcs.map(a => `<code style="background:#f0f0f5;padding:1px 5px;border-radius:4px;font-size:13px;">${escHTML(a)}</code>`).join(' ') : '<em style="color:#86868b;">—</em>'}</div>
                </div>
            </div>

            <div class="modal-section">
                <div class="modal-section-title">Authorization</div>
                <div class="modal-field">
                    <div class="modal-field-label">Marketing Authorisation Holder</div>
                    <div class="modal-field-value">${val(p.paHolder)}</div>
                </div>
                <div class="modal-field">
                    <div class="modal-field-label">Authorised Date</div>
                    <div class="modal-field-value">${val(p.authorisedDate)}</div>
                </div>
                <div class="modal-field">
                    <div class="modal-field-label">Registration Status</div>
                    <div class="modal-field-value">${val(p.registrationStatus)}</div>
                </div>
                <div class="modal-field">
                    <div class="modal-field-label">Market Info</div>
                    <div class="modal-field-value"><span class="badge ${badgeClass(p.marketInfo)}">${escHTML(p.marketInfo)}</span></div>
                </div>
                <div class="modal-field">
                    <div class="modal-field-label">Legal Basis</div>
                    <div class="modal-field-value">${val(p.legalBasis)}</div>
                </div>
            </div>

            <div class="modal-section">
                <div class="modal-section-title">Product Details</div>
                <div class="modal-field">
                    <div class="modal-field-label">Dosage Form</div>
                    <div class="modal-field-value">${val(p.dosageForm)}</div>
                </div>
                <div class="modal-field">
                    <div class="modal-field-label">Active Substances</div>
                    <div class="modal-field-value">${list(p.activeSubstances)}</div>
                </div>
                <div class="modal-field">
                    <div class="modal-field-label">Routes of Administration</div>
                    <div class="modal-field-value">${list(p.routesOfAdministration)}</div>
                </div>
            </div>

            <div class="modal-section">
                <div class="modal-section-title">Legal & Supply Status</div>
                <div class="modal-field">
                    <div class="modal-field-label">Dispensing Legal Status</div>
                    <div class="modal-field-value">${list(p.dispensingStatuses)}</div>
                </div>
                <div class="modal-field">
                    <div class="modal-field-label">Supply Legal Status</div>
                    <div class="modal-field-value">${val(p.supplyLegalStatus)}</div>
                </div>
                <div class="modal-field">
                    <div class="modal-field-label">Promotion Legal Status</div>
                    <div class="modal-field-value">${val(p.promotionLegalStatus)}</div>
                </div>
                ${p.supplyComments ? `
                <div class="modal-field">
                    <div class="modal-field-label">Supply Comments</div>
                    <div class="modal-field-value">${val(p.supplyComments)}</div>
                </div>` : ''}
            </div>
        `;

        // Copy button for licence number
        const copyBtn = $('modalBody').querySelector('.copy-btn');
        if (copyBtn) copyBtn.addEventListener('click', function() { copyText(p.licenceNumber, this); });

        $('modalCloseBtn').addEventListener('click', closeModal);
        $('detailModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        $('detailModal').classList.remove('active');
        document.body.style.overflow = '';
    }

    // ── Clear Filters ──────────────────────────────────
    function clearAllFilters() {
        searchInput.value = '';
        searchTerm = '';
        searchClear.classList.remove('visible');
        searchHint.style.display = '';
        filterMarket.value = '';
        filterType.value = '';
        filterStatus.value = '';
        filterLegalBasis.value = '';
        filterDispensing.value = '';
        atcBrowserFilter = '';
        updateAtcBrowserUI();

        Object.keys(msState).forEach(key => {
            msState[key] = [];
            const wrapper = document.querySelector(`.multiselect-wrapper[data-ms="${key}"]`);
            wrapper.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            // Also clear the dropdown search text and show all options
            const searchInp = wrapper.querySelector('.multiselect-search input');
            if (searchInp) searchInp.value = '';
            wrapper.querySelectorAll('.multiselect-option').forEach(o => o.style.display = '');
            updateMsDisplay(wrapper, key);
        });

        filterAndRender();
    }

    function updateClearButton() {
        const hasFilters = searchTerm || atcBrowserFilter ||
            filterMarket.value || filterType.value || filterStatus.value ||
            filterLegalBasis.value || filterDispensing.value ||
            Object.values(msState).some(a => a.length > 0);
        clearFiltersBtn.style.display = hasFilters ? '' : 'none';
    }

    // ── ATC Hierarchical Browser ──────────────────────
    let atcBrowserInitialized = false;

    function buildAtcTreeData() {
        const levels = [1, 3, 4, 5, 7];
        const prefixProducts = {};
        allProducts.forEach((p, idx) => {
            p.atcs.forEach(atc => {
                if (!atc) return;
                for (const len of levels) {
                    if (atc.length < len) break;
                    const prefix = atc.substring(0, len);
                    if (!prefixProducts[prefix]) prefixProducts[prefix] = new Set();
                    prefixProducts[prefix].add(idx);
                }
            });
        });

        function buildChildren(parentPrefix, parentLevelIdx) {
            const nextIdx = parentLevelIdx + 1;
            if (nextIdx >= levels.length) return [];
            const nextLen = levels[nextIdx];
            return Object.keys(prefixProducts)
                .filter(p => p.length === nextLen && p.startsWith(parentPrefix))
                .sort()
                .map(code => ({
                    code,
                    count: prefixProducts[code].size,
                    children: buildChildren(code, nextIdx)
                }));
        }

        return Object.keys(prefixProducts)
            .filter(p => p.length === 1)
            .sort()
            .map(code => ({
                code,
                count: prefixProducts[code].size,
                children: buildChildren(code, 0)
            }));
    }

    function renderAtcTreeHTML(nodes, depth) {
        if (!nodes.length) return '';
        return nodes.map(node => {
            const hasKids = node.children.length > 0;
            const pad = depth * 20;
            const activeClass = atcBrowserFilter === node.code ? ' atc-node-active' : '';
            const levelName = node.code.length === 1 ? (ATC_LEVEL1_NAMES[node.code] || '') : '';
            return `<div class="atc-node${activeClass}" data-code="${escHTML(node.code)}">
                <div class="atc-node-row" style="padding-left:${pad + 10}px" data-code="${escHTML(node.code)}">
                    ${hasKids ? '<span class="atc-toggle">\u25b6</span>' : '<span class="atc-toggle-spacer"></span>'}
                    <span class="atc-code-label">${escHTML(node.code)}</span>
                    ${levelName ? `<span class="atc-level-name">${escHTML(levelName)}</span>` : ''}
                    <span class="atc-node-count">${node.count}</span>
                </div>
                ${hasKids ? `<div class="atc-children" style="display:none">${renderAtcTreeHTML(node.children, depth + 1)}</div>` : ''}
            </div>`;
        }).join('');
    }

    function initAtcBrowser() {
        const tree = buildAtcTreeData();
        const treeEl = $('atcBrowserTree');
        treeEl.innerHTML = renderAtcTreeHTML(tree, 0);
        updateAtcBrowserUI();
        if (atcBrowserFilter) expandToNode(atcBrowserFilter);

        if (!atcBrowserInitialized) {
            atcBrowserInitialized = true;

            treeEl.addEventListener('click', e => {
                const toggle = e.target.closest('.atc-toggle');
                if (toggle) {
                    e.stopPropagation();
                    const node = toggle.closest('.atc-node');
                    const children = node.querySelector(':scope > .atc-children');
                    if (children) {
                        const isExpanded = children.style.display !== 'none';
                        children.style.display = isExpanded ? 'none' : '';
                        toggle.classList.toggle('expanded', !isExpanded);
                    }
                    return;
                }
                const row = e.target.closest('.atc-node-row');
                if (row) {
                    const code = row.dataset.code;
                    if (atcBrowserFilter === code) {
                        atcBrowserFilter = '';
                    } else {
                        atcBrowserFilter = code;
                        expandToNode(code);
                    }
                    updateAtcBrowserUI();
                    filterAndRender();
                }
            });

            $('atcBrowserSearch').addEventListener('input', e => {
                const term = e.target.value.toLowerCase().trim();
                const nodes = treeEl.querySelectorAll('.atc-node');
                if (!term) {
                    nodes.forEach(n => n.style.display = '');
                    return;
                }
                nodes.forEach(n => n.style.display = 'none');
                nodes.forEach(n => {
                    const code = (n.dataset.code || '').toLowerCase();
                    const name = (ATC_LEVEL1_NAMES[n.dataset.code] || '').toLowerCase();
                    if (code.includes(term) || name.includes(term)) {
                        n.style.display = '';
                        let el = n.parentElement;
                        while (el && el !== treeEl) {
                            if (el.classList.contains('atc-children')) el.style.display = '';
                            if (el.classList.contains('atc-node')) el.style.display = '';
                            el = el.parentElement;
                        }
                    }
                });
            });

            $('atcCollapseAll').addEventListener('click', () => {
                treeEl.querySelectorAll('.atc-children').forEach(c => c.style.display = 'none');
                treeEl.querySelectorAll('.atc-toggle').forEach(t => t.classList.remove('expanded'));
            });

            $('clearAtcFilter').addEventListener('click', () => {
                atcBrowserFilter = '';
                updateAtcBrowserUI();
                filterAndRender();
            });
        }
    }

    function expandToNode(code) {
        const treeEl = $('atcBrowserTree');
        const levels = [1, 3, 4, 5, 7];
        for (const len of levels) {
            if (len >= code.length) break;
            const prefix = code.substring(0, len);
            const parentNode = treeEl.querySelector(`.atc-node[data-code="${prefix}"]`);
            if (parentNode) {
                const children = parentNode.querySelector(':scope > .atc-children');
                if (children) {
                    children.style.display = '';
                    const toggle = parentNode.querySelector(':scope > .atc-node-row .atc-toggle');
                    if (toggle) toggle.classList.add('expanded');
                }
            }
        }
    }

    function updateAtcBrowserUI() {
        const filterBadge = $('atcActiveFilter');
        const clearBtn = $('clearAtcFilter');
        const treeEl = $('atcBrowserTree');
        treeEl.querySelectorAll('.atc-node-active').forEach(n => n.classList.remove('atc-node-active'));
        if (atcBrowserFilter) {
            const active = treeEl.querySelector(`.atc-node[data-code="${atcBrowserFilter}"]`);
            if (active) active.classList.add('atc-node-active');
            filterBadge.textContent = `Filtering: ${atcBrowserFilter}`;
            filterBadge.style.display = '';
            clearBtn.style.display = '';
        } else {
            filterBadge.style.display = 'none';
            clearBtn.style.display = 'none';
        }
        atcBrowserBtn.classList.toggle('active', atcBrowserVisible);
    }

    function toggleAtcBrowser() {
        atcBrowserVisible = !atcBrowserVisible;
        $('atcBrowserPanel').style.display = atcBrowserVisible ? '' : 'none';
        atcBrowserBtn.classList.toggle('active', atcBrowserVisible);
    }

    // ── URL State (Shareable Links) ───────────────────
    function updateUrlState() {
        const params = new URLSearchParams();
        if (searchTerm) params.set('q', searchTerm);
        if (filterMarket.value) params.set('market', filterMarket.value);
        if (filterType.value) params.set('type', filterType.value);
        if (filterStatus.value) params.set('reg', filterStatus.value);
        if (filterLegalBasis.value) params.set('legal', filterLegalBasis.value);
        if (filterDispensing.value) params.set('disp', filterDispensing.value);
        if (msState.form.length) params.set('form', msState.form.join('|'));
        if (msState.holder.length) params.set('holder', msState.holder.join('|'));
        if (msState.substance.length) params.set('sub', msState.substance.join('|'));
        if (msState.route.length) params.set('route', msState.route.join('|'));
        if (msState.atc.length) params.set('atc', msState.atc.join('|'));
        if (atcBrowserFilter) params.set('atcTree', atcBrowserFilter);
        if (currentSort !== 'name-asc') params.set('sort', currentSort);
        if (viewMode !== 'table') params.set('view', viewMode);
        if (currentPage > 1) params.set('page', String(currentPage));
        if (itemsPerPage !== 50) params.set('pp', String(itemsPerPage));
        const qs = params.toString();
        history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
    }

    function applyUrlState() {
        const params = new URLSearchParams(window.location.search);
        if (!params.toString()) return false;

        const q = params.get('q');
        if (q) {
            searchInput.value = q;
            searchTerm = q;
            searchClear.classList.add('visible');
            searchHint.style.display = 'none';
        }

        if (params.get('market')) filterMarket.value = params.get('market');
        if (params.get('type')) filterType.value = params.get('type');
        if (params.get('reg')) filterStatus.value = params.get('reg');
        if (params.get('legal')) filterLegalBasis.value = params.get('legal');
        if (params.get('disp')) filterDispensing.value = params.get('disp');

        const msParams = { form: 'form', holder: 'holder', substance: 'sub', route: 'route', atc: 'atc' };
        Object.entries(msParams).forEach(([key, param]) => {
            const val = params.get(param);
            if (val) {
                const values = val.split('|');
                const wrapper = document.querySelector(`.multiselect-wrapper[data-ms="${key}"]`);
                if (wrapper) {
                    wrapper.querySelectorAll('.multiselect-options input[type="checkbox"]').forEach(cb => {
                        const idx = parseInt(cb.dataset.idx);
                        cb.checked = values.includes(msData[key][idx]);
                    });
                    msState[key] = getMsSelectedValues(key);
                    updateMsDisplay(wrapper, key);
                }
            }
        });

        const atcTree = params.get('atcTree');
        if (atcTree) {
            atcBrowserFilter = atcTree;
            atcBrowserVisible = true;
        }

        const sort = params.get('sort');
        if (sort) { currentSort = sort; sortSelect.value = sort; }

        const view = params.get('view');
        if (view === 'card' || view === 'table') viewMode = view;

        const pp = params.get('pp');
        if (pp && ['25','50','100','250'].includes(pp)) {
            itemsPerPage = parseInt(pp);
            perPageSelect.value = pp;
        }

        const page = params.get('page');
        if (page) currentPage = parseInt(page) || 1;

        return true;
    }

    // ── CSV Export ─────────────────────────────────────
    function exportCSV() {
        if (!filteredProducts.length) { showToast('No results to export'); return; }

        const headers = [
            'Product Name', 'Licence Number', 'Drug ID', 'PA Holder',
            'Authorised Date', 'Product Type', 'Market Info', 'Registration Status',
            'Dosage Form', 'Active Substances', 'Routes of Administration', 'ATC Codes',
            'Legal Basis', 'Dispensing Legal Status', 'Supply Legal Status',
            'Promotion Legal Status', 'Supply Comments'
        ];

        const rows = filteredProducts.map(p => [
            p.productName, p.licenceNumber, p.drugIDPK, p.paHolder,
            p.authorisedDate, p.productType, p.marketInfo, p.registrationStatus,
            p.dosageForm, p.activeSubstances.join('; '), p.routesOfAdministration.join('; '),
            p.atcs.join('; '), p.legalBasis, p.dispensingStatuses.join('; '),
            p.supplyLegalStatus, p.promotionLegalStatus, p.supplyComments
        ].map(csvField));

        const BOM = '\uFEFF'; // UTF-8 BOM for Excel
        const csv = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HPRA-medications-${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Exported ${filteredProducts.length.toLocaleString()} products`);
    }

    function csvField(val) {
        if (val == null) return '""';
        const s = String(val);
        return (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r'))
            ? `"${s.replace(/"/g, '""')}"` : s;
    }

    // ── View Toggle ────────────────────────────────────
    function updateViewToggle() {
        viewToggleBtn.textContent = viewMode === 'card' ? '📊 Table' : '📇 Cards';
        const cpWrapper = $('columnPickerWrapper');
        if (cpWrapper) cpWrapper.style.display = viewMode === 'table' ? '' : 'none';
    }

    // ── Column Picker ──────────────────────────────────
    function buildColumnPicker() {
        const dropdown = $('columnPickerDropdown');
        if (!dropdown) return;
        let html = '<div class="cp-header">Table Columns</div>';
        html += '<div class="cp-actions"><button type="button" class="cp-show-all">Show All</button><button type="button" class="cp-defaults">Defaults</button></div>';
        html += TABLE_COLUMNS.map(c => {
            const checked = visibleColumns.includes(c.key) ? ' checked' : '';
            return `<label class="column-picker-option"><input type="checkbox" value="${c.key}"${checked}><span>${c.header}</span></label>`;
        }).join('');
        dropdown.innerHTML = html;
    }

    // ── Pagination ─────────────────────────────────────
    function goToPage(page) {
        const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
        currentPage = Math.max(1, Math.min(page, totalPages));
        renderProducts();
        updateUrlState();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ── Event Listeners ────────────────────────────────
    // Search with debounce
    searchInput.addEventListener('input', () => {
        searchTerm = searchInput.value.trim();
        searchClear.classList.toggle('visible', searchTerm.length > 0);
        searchHint.style.display = searchTerm.length > 0 ? 'none' : '';
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(filterAndRender, 200);
    });

    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchTerm = '';
        searchClear.classList.remove('visible');
        searchHint.style.display = '';
        filterAndRender();
        searchInput.focus();
    });

    // Select filters
    [filterMarket, filterType, filterStatus, filterLegalBasis, filterDispensing].forEach(sel => {
        sel.addEventListener('change', filterAndRender);
    });

    // Sort
    sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        localStorage.setItem('sortMode', currentSort);
        applySort();
        currentPage = 1;
        renderProducts();
        updateUrlState();
    });

    // Clear all
    clearFiltersBtn.addEventListener('click', clearAllFilters);

    // Export
    exportBtn.addEventListener('click', exportCSV);

    // View toggle
    viewToggleBtn.addEventListener('click', () => {
        viewMode = viewMode === 'card' ? 'table' : 'card';
        localStorage.setItem('viewMode', viewMode);
        updateViewToggle();
        renderProducts();
        updateUrlState();
    });

    // ATC browser toggle
    atcBrowserBtn.addEventListener('click', toggleAtcBrowser);

    // Share / copy link
    shareBtn.addEventListener('click', () => {
        updateUrlState();
        navigator.clipboard.writeText(window.location.href).then(() => {
            showToast('Link copied to clipboard');
        }).catch(() => {
            showToast('Could not copy link');
        });
    });

    // Pagination
    $('firstPageBtn').addEventListener('click', () => goToPage(1));
    $('prevPageBtn').addEventListener('click', () => goToPage(currentPage - 1));
    $('nextPageBtn').addEventListener('click', () => goToPage(currentPage + 1));
    $('lastPageBtn').addEventListener('click', () => goToPage(Math.ceil(filteredProducts.length / itemsPerPage)));
    perPageSelect.addEventListener('change', () => {
        itemsPerPage = parseInt(perPageSelect.value);
        currentPage = 1;
        renderProducts();
        updateUrlState();
    });

    // Modal close
    $('detailModal').addEventListener('click', e => { if (e.target.id === 'detailModal') closeModal(); });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if ($('detailModal').classList.contains('active')) {
                closeModal();
            } else {
                closeAllMultiselects();
            }
        }
        // / to focus search (when not already in an input)
        if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            e.preventDefault();
            searchInput.focus();
        }
    });

    // ── File Loading ───────────────────────────────────
    const fileInput = $('xmlFileInput');

    $('fileSelectBtn').addEventListener('click', () => fileInput.click());
    $('dropZoneBrowse')?.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) loadFile(file);
    });

    function loadFile(file) {
        $('loadingState').style.display = 'block';
        $('loadingState').innerHTML = '<div class="loading"><div class="loader"></div><p>Parsing XML data...</p></div>';
        $('dropZone').style.display = 'none';
        productsContainer.style.display = 'none';
        paginationControls.style.display = 'none';

        const reader = new FileReader();
        reader.onload = ev => {
            setTimeout(() => processXML(ev.target.result), 50);
        };
        reader.readAsText(file);
    }

    // Drag and drop
    const dropArea = $('dropArea');
    if (dropArea) {
        ['dragenter', 'dragover'].forEach(evt => {
            dropArea.addEventListener(evt, e => { e.preventDefault(); dropArea.classList.add('drag-over'); });
        });
        ['dragleave', 'drop'].forEach(evt => {
            dropArea.addEventListener(evt, e => { e.preventDefault(); dropArea.classList.remove('drag-over'); });
        });
        dropArea.addEventListener('drop', e => {
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.xml')) loadFile(file);
            else showToast('Please drop an XML file');
        });
        dropArea.addEventListener('click', e => {
            if (e.target.tagName !== 'BUTTON') fileInput.click();
        });
    }

    // Also allow dropping on the whole page when data is loaded
    document.body.addEventListener('dragover', e => e.preventDefault());
    document.body.addEventListener('drop', e => {
        e.preventDefault();
        const file = e.dataTransfer?.files[0];
        if (file && file.name.endsWith('.xml')) {
            loadFile(file);
        }
    });

    // ── Changelog Modal ──────────────────────────────
    function initChangelog() {
        const link = $('changelogLink');
        const modal = $('changelogModal');
        const closeBtn = $('closeChangelog');
        const body = $('changelogContent');
        if (!link || !modal) return;

        function openChangelog(e) {
            e.preventDefault();
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            if (body && body.querySelector('.changelog-loading')) {
                fetch('CHANGELOG.md')
                    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
                    .then(md => { body.innerHTML = '<div class="changelog-rendered">' + renderMarkdown(md) + '</div>'; })
                    .catch(err => { body.innerHTML = '<p style="color:#ff3b30;">Failed to load changelog: ' + err.message + '</p>'; });
            }
        }
        function closeChangelog() {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        link.addEventListener('click', openChangelog);
        closeBtn?.addEventListener('click', closeChangelog);
        modal.addEventListener('click', e => { if (e.target === modal) closeChangelog(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('active')) closeChangelog(); });
    }

    function renderMarkdown(md) {
        return md
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            .replace(/(?:^- .+$\n?)+/gm, match => {
                const items = match.trim().split('\n').map(l => '<li>' + l.replace(/^- /, '') + '</li>').join('');
                return '<ul>' + items + '</ul>';
            })
            .replace(/^---$/gm, '<hr>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(?!<[huplo])(.+)$/gm, '<p>$1</p>')
            .replace(/<p><\/p>/g, '')
            .replace(/<p>(<[hulo])/g, '$1')
            .replace(/(<\/[hulo][^>]*>)<\/p>/g, '$1');
    }

    // ── Init ───────────────────────────────────────────
    init();
    initChangelog();
})();
