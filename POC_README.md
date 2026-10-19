# Tableau Hierarchy Multi-Select — Set Action PoC

A Vanilla JS proof of concept in a fork of [tableau/extensions-api](https://github.com/tableau/extensions-api).
The tree UI is deliberately deferred: **first validate the workbook state synchronization**.

## GitHub Pages

The workflow `.github/workflows/deploy-hierarchy-poc.yml` deploys only the PoC and the **local** Tableau API library.
Enable **Settings → Pages → Source: GitHub Actions** and, if necessary, enable workflows under **Actions**.

- HTML: https://bschabli.github.io/tableau-hierarchy-multiselect-filter/Samples/Viz/HierarchyFilterPoC/index.html
- Manifest: https://bschabli.github.io/tableau-hierarchy-multiselect-filter/Samples/Viz/HierarchyFilterPoC/filter.trex

## Tableau worksheet and workbook setup

1. Connect `Samples/Viz/HierarchyFilterPoC/test-data.csv` to Tableau.
2. Create a Tableau **set** on `[leaf_id]` named `s.filter_auswahl`, initially including `L002` and `L005`.
3. Create a **string parameter** named `p.filter_modus` with values `ALLE`, `AUSWAHL`, `KEINE`; initial value `AUSWAHL`.
4. Create calculated field `cf.filter_aktiv`:

   ```tableau
   IF [p.filter_modus] = 'ALLE' THEN TRUE
   ELSEIF [p.filter_modus] = 'KEINE' THEN FALSE
   ELSE [s.filter_auswahl]
   END
   ```

5. Create **two Viz Extension worksheets**, one for each dashboard (e.g. `PoC_Filter_A`, `PoC_Filter_B`), using the public `filter.trex` downloaded locally.
6. Assign the encodings:
   - **Leaf ID:** `[leaf_id]`
   - **Hierarchiestufen:** `[level_0]`, `[level_1]`, `[level_2]` (optional for the initial test)
   - **Set-Mitgliedschaft:** `[s.filter_auswahl]` (IN/OUT).
7. Each dashboard also gets a target sheet with `[cf.filter_aktiv] = TRUE`. Do **not** apply this filter to either extension/selector sheet: all IDs must remain visible.
8. On **both dashboards**, create a Set Action: source = the respective Viz Extension worksheet; **Run on: Select**; target = **same set `s.filter_auswahl`**; assignment = **Assign values to set**; clearing the selection = **Keep set values**.
9. On dashboard A, alter multiple checkboxes and use **Set neu einlesen** to verify the set membership.
10. Switch to dashboard B and verify restoration; alter it there and switch back. Run the same checks in Tableau Desktop, Server, and Cloud.

## Important caveats

- An empty mark selection may **not** clear a Tableau set with **Keep set values**. Hence `p.filter_modus=KEINE` is a separate mode.
- The completion of `selectTuplesAsync` **does not prove the Set Action completed**. Read back the IN/OUT membership.
- A Tableau set belongs to its data source, and does **not** automatically synchronize unrelated sources.
- The PoC expects exactly **one mark per leaf ID**. Performance at 15,000 leaves is not yet demonstrated.
- Browser opening of the HTML *outside Tableau* is not a valid initialization test.
- This is a prototype, not a finished filter component; Wunderbaum follows after validation.

## Local development

From the fork root run `python -m http.server 8765`. For local Tableau usage, use a copy of the `.trex` with the source URL changed to `http://localhost:8765/Samples/Viz/HierarchyFilterPoC/index.html`.

Run tests from the PoC directory: `npm test`.

MIT-compatible custom PoC code under the fork's upstream Apache-2.0 license; official upstream files retain their original copyright notices.
