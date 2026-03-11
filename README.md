# HPRA SearchPlus

A fast, client-side browser for the [HPRA](https://www.hpra.ie/) (Health Products Regulatory Authority) medicines database XML export. Search, filter, and explore Ireland's authorised medications — no server required.

**[Live Demo →](https://snbyrnes.github.io/HPRA-SearchPlus/)**

---

## Features

### Search & Filter
- **Full-text search** across all fields (product name, substances, ATC codes, holders, licence numbers, etc.) with multi-word support — all terms must match
- **Search highlighting** — matched terms are highlighted in results
- **Multiselect filters** with searchable dropdowns for Dosage Form, PA Holder, Active Substance, Route of Administration, and ATC Code
- **Single-select filters** for Market Status, Product Type, Registration Status, Legal Basis, and Dispensing Status
- **ATC Hierarchical Browser** — drill into the ATC classification tree by therapeutic level (Anatomical → Therapeutic → Pharmacological → Chemical → Substance), with product counts at each node and click-to-filter
- **Clear All** button to reset every filter and search in one click

### Views & Display
- **Card view** — visual product cards with key details and active substance tags
- **Table view** — compact tabular format for power users
- **Detail modal** — click any product for a comprehensive 4-section breakdown:
  - Identification (Licence Number, Drug ID, Product Type, ATC Codes)
  - Authorization (PA Holder, Authorised Date, Registration Status, Market Info, Legal Basis)
  - Product Details (Dosage Form, Active Substances, Routes of Administration)
  - Legal & Supply Status (Dispensing, Supply, Promotion statuses, Supply Comments)
- **Statistics bar** — live counts of total, marketed, not marketed, and unknown products
- **Sort controls** — sort by Name, Holder, Date (newest/oldest), or Market Status
- **Pagination** — configurable 25/50/100/250 items per page

### Data Handling
- **Auto-load** — automatically finds and loads XML from the `data/` folder (or root fallback)
- **Drag & drop** — drop any HPRA XML file directly onto the page
- **File picker** — manual XML loading via the "Load XML" button
- **Hot-reload** — load a new XML file at any time without refreshing
- **CSV export** — export filtered results with all 17 fields, UTF-8 BOM for Excel compatibility

### UX
- **Dark mode** — toggle with the theme button (persisted via localStorage)
- **Resizable table columns** — drag the right edge of any column header to adjust its width; widths are saved per-column in localStorage and restored on next visit; reset all widths via the ⚙️ Columns picker
- **Shareable links** — every filter, search, sort, and view state is encoded into the URL; click 🔗 Share to copy a link colleagues can open to see exactly what you see
- **Keyboard shortcuts:**
  - `/` — focus the search bar
  - `Escape` — close modal or open dropdowns
- **Responsive** — works on desktop and mobile
- **Zero dependencies** — pure vanilla HTML/CSS/JS, no build step
- **Feedback** — footer link to [GitHub Issues](https://github.com/snbyrnes/snbyrnes.github.io/issues/new/choose) for bug reports and feature requests

---

## XML Fields Parsed

All 17 data fields from the HPRA product list are extracted and searchable:

| Field | Description |
|-------|-------------|
| DrugIDPK | Internal unique identifier |
| LicenceNumber | PA/EU licence number |
| ProductName | Full product name |
| PAHolder | Marketing Authorisation Holder |
| AuthorisedDate | Date of authorisation |
| ProductType | Human, Veterinary, etc. |
| MarketInfo | Marketed / Not marketed / Unknown |
| RegistrationStatus | Current registration state |
| DosageForm | Tablet, Solution, Capsule, etc. |
| LegalBasis | Legal basis for authorisation |
| ActiveSubstances | One or more active ingredients |
| RoutesOfAdministration | Oral, Intravenous, Topical, etc. |
| ATCs | ATC classification codes |
| DispensingLegalStatus | Dispensing classification(s) |
| SupplyLegalStatus | Supply classification |
| PromotionLegalStatus | Promotion classification |
| SupplyComments | Additional supply notes |

---

## Project Structure

```
hpra-search/
├── index.html              # Main application page
├── css/
│   └── styles.css          # All styles (light mode, dark mode, responsive)
├── js/
│   └── app.js              # Application logic (parsing, filtering, rendering)
├── data/
│   └── latestHumanlist.xml  # ← Drop the latest XML here
├── .nojekyll               # Prevents GitHub Pages Jekyll processing
├── .gitattributes          # Line-ending normalisation
└── README.md               # This file
```

---

## Getting Started

### Local Usage

1. Clone or download this repository
2. Place the HPRA XML file in the `data/` folder (named `latestHumanlist.xml`)
3. Serve the folder with any local HTTP server:
   ```bash
   # Python
   python -m http.server 8000

   # Node.js (npx)
   npx serve .

   # VS Code
   # Use the "Live Server" extension — right-click index.html → Open with Live Server
   ```
4. Open `http://localhost:8000` in your browser

> **Note:** Opening `index.html` directly as a `file://` URL will not auto-load the XML due to browser security restrictions (CORS). Use a local server, or use the drag-and-drop / file picker to load it manually.

### GitHub Pages Deployment

1. Push this repository to GitHub
2. Go to **Settings → Pages**
3. Set Source to **Deploy from a branch**, select `main` (or `master`), root `/`
4. Click **Save** — the site will be live at `https://<username>.github.io/<repo-name>/`

### Updating the Data

To update the product database:

1. Download the latest XML export from [HPRA](https://www.hpra.ie/)
2. Replace the file in the `data/` folder (keep the name `latestHumanlist.xml`)
3. Commit and push — GitHub Pages will serve the updated data automatically

The app also accepts these filename variants: `latestHumanList.xml`, `LatestHumanList.xml`, `humanlist.xml`, `HumanList.xml`, `products.xml`.

---

## Technology Choices

This project deliberately uses **vanilla JavaScript** with no frameworks or build tools:

- **No build step** — edit and deploy directly, no `npm install`, no bundler
- **Zero dependencies** — nothing to update, no supply-chain risk
- **Fast loading** — ~25KB total (HTML + CSS + JS) before the XML data
- **Easy maintenance** — a single JS file with clear sections, no abstraction layers
- **GitHub Pages compatible** — pure static files, no CI/CD pipeline needed

The XML data (~13MB) is parsed client-side using the browser's native `DOMParser`, which handles it in ~1–2 seconds on modern hardware.

---

## Browser Support

Works in all modern browsers:
- Chrome / Edge 80+
- Firefox 78+
- Safari 14+

---

## Licence

This tool provides a browser interface for publicly available HPRA data. The data itself is published by the [Health Products Regulatory Authority (HPRA)](https://www.hpra.ie/). This project is not affiliated with or endorsed by the HPRA.
