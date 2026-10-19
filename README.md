# Tableau Hierarchy Multi-Select Filter

Open-source Viz Extension for Tableau, built with **Vanilla JavaScript** and a locally shipped Tableau Extensions API.

> **Status:** Architecture proof of concept (PoC). The final Wunderbaum hierarchy is not yet implemented. We first validate Set Actions across dashboards.

## Compact project structure

```text
├── index.html                    # App entry point
├── hierarchy_filter.trex         # Tableau Viz Extension manifest
├── js/
│   ├── app.js                    # Simple multi-select UI (replaceable with Wunderbaum)
│   ├── tableau-connector.js      # Tableau API, paginated reads and selection
│   ├── core.js                   # Stable IDs / IN-OUT parsing
│   └── tableau.extensions.1.latest.min.js  # Local Tableau API
├── css/filter.css
├── test-data.csv
├── tests/core.test.js
├── package.json
└── .github/workflows/pages.yml
```

Layout and connector separation are inspired by [Matrix-Pro-Tableau](https://github.com/bschabli/Matrix-Pro-Tableau).
The application does **not** reuse its pivot/matrix components. The originally evaluated official sample was [Samples/Viz/Sankey](https://github.com/tableau/extensions-api/tree/main/Samples/Viz/Sankey).

## GitHub Pages

For this repository enable **Settings → Pages → Source: GitHub Actions**. Then push to `main`.

- Extension UI: https://bschabli.github.io/tableau-hierarchy-multiselect-filter/index.html
- Tableau manifest: https://bschabli.github.io/tableau-hierarchy-multiselect-filter/hierarchy_filter.trex

GitHub Pages serves the files; opening the HTML alone outside Tableau cannot initialize a Viz Extension.

## Tableau PoC setup

1. Load [test-data.csv](test-data.csv) into Tableau (20 example leaf IDs).
2. Create a Tableau **set** of `[leaf_id]` named `s.filter_auswahl`. Initialize with `L002` and `L005`.
3. Create a **string parameter** `p.filter_modus` with the values `ALLE`, `AUSWAHL`, `KEINE`; default `AUSWAHL`.
4. Add the calculated Boolean field `cf.filter_aktiv`:

   ```tableau
   IF [p.filter_modus] = 'ALLE' THEN TRUE
   ELSEIF [p.filter_modus] = 'KEINE' THEN FALSE
   ELSE [s.filter_auswahl]
   END
   ```

5. Add a Viz Extension worksheet on **each of two dashboards**, loaded from `hierarchy_filter.trex` (download it locally before choosing it in Tableau).
6. Fill its encoding shelves:
   - **Leaf ID**: `[leaf_id]`
   - **Hierarchiestufen**: `[level_0]`, `[level_1]`, `[level_2]` (optional for PoC)
   - **Set-Mitgliedschaft**: `[s.filter_auswahl]` (IN/OUT)
7. Add a target worksheet to **both** dashboards and filter it by `[cf.filter_aktiv] = TRUE`. Never place this filter on the Viz Extension selector sheets.
8. On **each dashboard**, create a **Set Action**: source = its Viz Extension worksheet, run on **Select**, target = same `s.filter_auswahl`, action = **Assign values to set**, clearing selection = **Keep set values**.
9. Select multiple checkboxes, click **Set neu einlesen**, then switch to the other dashboard. Repeat in both directions.
10. Validate in Tableau Desktop, Server, and Cloud before extending the UI.

**Limitations:** This PoC requires exactly one selectable mark per leaf ID. Set Actions are asynchronous, and completion of `selectTuplesAsync` does not confirm the set was updated. Empty mark selections do not reliably clear a set; the separate `KEINE` mode handles this. Sets are data-source scoped. Performance with 15,000 leaves is not yet proven.

## Development

```sh
python -m http.server 8765
npm test
```

For localhost use a temporary copy of `hierarchy_filter.trex` with URL `http://localhost:8765/index.html`.

## Roadmap

1. Verify workbook-wide Set Action + parameter roundtrip across dashboards.
2. Integrate Wunderbaum (hierarchical checkbox and indeterminate state).
3. Implement ragged hierarchies and stable path identities.
4. Optimize caching, rendering, and Tableau selections for 15,000+ leaf IDs.

## License

Apache-2.0 (see LICENSE.txt), preserving applicable upstream notices and copyrights.
