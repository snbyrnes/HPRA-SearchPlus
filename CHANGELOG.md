# Changelog

All notable changes to HPRA SearchPlus will be documented in this file.

---

## v1.4.0 — 2026-03-08

### Added
- **ATC Hierarchical Browser** — drill into the ATC classification tree across all 5 levels (Anatomical → Therapeutic → Pharmacological → Chemical → Substance) with product counts at each node; click to filter, search to find codes, collapse/expand all
- **Shareable Links** — every filter, search, sort, view mode, and page state is encoded into URL query parameters; click 🔗 Share to copy a reproducible link for colleagues
- **Share button** in the header toolbar to copy the current filtered view URL to clipboard

### Changed
- **Renamed to HPRA SearchPlus** — updated title, headings, footer, comments, README, and changelog references
- **Table view is now the default** — loads in table mode when no saved preference exists

---

## v1.3.0 — 2026-03-08

### Added
- **Changelog popup** — footer link opens a modal showing project version history
- **Column Customisation** — choose which columns appear in table view via the ⚙️ Columns picker; selections persist across sessions
- **Data Freshness Indicator** — colour-coded badge next to the publication date shows how old the loaded data is (green ≤30 days, amber 31–90, red >90)

---

## v1.2.0 — 2025-12-01

### Changed
- **GitHub Pages deployment** — restructured project into separated HTML, CSS, and JS files
- Moved XML data to `data/` folder with auto-loading on page open
- Added `.nojekyll` and `.gitattributes` for GitHub Pages compatibility

### Added
- `README.md` with project documentation

---

## v1.1.0 — 2025-11-15

### Fixed
- **Multiselect dropdowns** — resolved broken event listeners and encoding issues with data-idx indexing and event delegation

### Improved
- Better multiselect search performance
- Consistent dropdown open/close behaviour

---

## v1.0.0 — 2025-11-13

### Added
- Full XML field coverage for all HPRA product data
- **Card and Table views** with toggle
- **Multiselect filters** for Dosage Form, PA Holder, Active Substance, Route, and ATC Code
- **Standard filters** for Market Status, Product Type, Registration, Legal Basis, and Dispensing
- **Full-text search** across products, substances, ATC codes, holders, and licence numbers
- **CSV export** of filtered results
- **Dark mode** with persistent preference
- **Sort options** — by name, holder, date, and market status
- Detailed product modal with full information display
- Pagination with configurable page sizes
- Drag-and-drop XML file loading
- Keyboard shortcut: `/` to focus search
