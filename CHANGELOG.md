# Changelog

All notable changes to HPRA SearchPlus will be documented in this file.

---

## v1.11.0 — 2026-06-26

### Changed
- **Lazy-loaded withdrawn list** — the data pipeline now writes the authorised and withdrawn lists to separate files (`products.json` + `products-withdrawn.json`). The app loads only the authorised list on startup (~510 KB gzipped instead of ~1.3 MB) and fetches the withdrawn list on demand the first time the **Medicine List** filter is set to *Withdrawn* or *All* (or when opening a shared link that needs it). Active filter selections are preserved across the load. Since the table already paginates, no row virtualization was required.

---

## v1.10.0 — 2026-06-26

### Added
- **Pre-built data pipeline** — a dependency-free Node script (`scripts/build-data.mjs`) downloads both HPRA XML lists, parses them, and emits a single compact `data/products.json`. The browser now loads that JSON directly instead of parsing ~31 MB of XML on every visit (≈1.3 MB over the wire after gzip, and no client-side `DOMParser`). Output was validated field-for-field against the previous in-browser parser across all ~29,800 products with zero differences.
- **"What changed" feed** — the pipeline diffs each build against the previous one and writes `data/changes.json` (newly authorised, newly withdrawn, changed fields, removed). A 🆕 button in the header opens a summary of what changed in the latest daily update.
- **Full ATC names (all levels)** — a bundled `data/atc-dictionary.json` (WHO ATC/DDD Index 2026, ~7,000 codes) now labels ATC codes at every level — previously only the 14 top-level groups were named. Names appear in the ATC tree browser, the ATC filter dropdown (now searchable by name), the ATC table column (on hover), the detail modal, and global search.

### Changed
- **Daily workflow** now runs the data pipeline and commits `products.json` + `changes.json`. The raw XML is downloaded transiently and is no longer committed to the repo (it remains available via drag-and-drop import and as a load fallback).

---

## v1.9.0 — 2026-06-26

### Added
- **Withdrawn medicines list** — the app now loads HPRA's `withdrawnHumanlist.xml` (~19,700 products) alongside the authorised list and merges the two in the browser
- **"Medicine List" filter** — a new dropdown filters between **Authorised**, **Withdrawn**, or **All**; it defaults to **Authorised** so the existing view is unchanged until you opt in
- **Withdrawal Date** — exposed as an optional table column, a detail-modal field, in full-text search, and in the CSV export (which also gains a "Medicine List" column)
- **Daily refresh of both lists** — the GitHub Actions workflow refreshes both the authorised and withdrawn lists every day at 05:00 UTC (see v1.10.0 for the JSON pipeline that superseded the raw-XML commit step)

---

## v1.8.0 — 2026-05-12

### Added
- **Automated daily data updates** — GitHub Actions workflow downloads the latest HPRA XML from `assets.hpra.ie` at 05:00 UTC every day and commits it to the `data/` folder automatically; can also be triggered manually from the GitHub Actions tab
- **Cache-busting on XML fetch** — the auto-load now appends a timestamp query string and sets `cache: 'no-store'` to ensure the browser always loads the freshest data rather than a cached copy

---

## v1.7.0 — 2026-05-09

### Added
- **Keyboard Shortcuts Help Modal** — press `?` or click the new `?` button in the header toolbar to open a shortcuts reference overlay
- **`n` / `p` shortcuts** — jump to the next or previous page without using the mouse
- **`e` shortcut** — trigger a CSV export of the current filtered results
- **`t` shortcut** — toggle between Table and Cards view
- **`?` shortcut** — open the keyboard shortcuts help modal
- All new shortcuts are disabled while the cursor is inside any input or filter field to avoid conflicts

---

## v1.6.0 — 2026-05-08

### Added
- **Mark as Reviewed** — each result row (table view) and product card (card view) now has a checkbox to mark it as reviewed
  - Reviewed items are visually highlighted with a green tint for easy identification
  - Reviewed state persists across page refreshes via localStorage
- **Reviewed filter button** — `☑ Reviewed (N)` button in the header toolbar; click to toggle a "show reviewed only" view
- **Reviewed stats pill** — teal pill in the statistics bar shows how many products have been marked reviewed
- **Reviewed filter pill** — when the reviewed-only filter is active, a dismissible pill appears in the filter bar; cleared by "Clear All" as well
- **CSV export** — exported CSV now includes a leading `Reviewed` column (Yes/No) for all rows

---

## v1.5.0 — 2026-03-11

### Added
- **Resizable table columns** — drag the right edge of any column header to adjust its width; widths persist across sessions via localStorage
- **Reset Widths button** — new "↔ Widths" button in the ⚙️ Columns picker resets all column widths back to their natural auto-sized layout
- **GitHub Issues link in footer** — quick link to report bugs or request features directly from the app

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
