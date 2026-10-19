# Tableau Hierarchy Multi-Select Filter

Open-source Tableau Viz Extension using vanilla JavaScript, [Wunderbaum 0.14.1](https://github.com/mar10/wunderbaum/tree/v0.14.1), and a local Tableau Extensions API.

## Functionality

- Build a tree from the flat level encodings (including ragged hierarchies)
- Hierarchical checkboxes with parent/child propagation and indeterminate state
- Draft selection: checkbox edits and Alle/Keine are local until **Anwenden**\n- **Keine** temporarily clears the checkboxes; applying an empty selection restores **ALLE** (no filter restriction, Set remains unchanged).
- **Änderungen verwerfen** rereads the Tableau state and drops uncommitted edits\n- Expand/Collapse state and scroll position are preserved on Set refresh; rows use Wunderbaum's matching 32px virtual row height.
- Tableau Set Actions via `selectTuplesAsync`
- Read Set membership back from Tableau to restore selection

## Pro Filterinstanz konfigurieren

Mit **Konfigurieren** (oder dem Tableau-Kontextmenü **Configure**) einen Tableau-Zeichenfolge-Parameter mit den Werten `ALLE`, `AUSWAHL`, `KEINE` auswählen und eine Bezeichnung vergeben. Die Einstellungen werden über Tableau Extension Settings für diese Visualisierung im Workbook gespeichert. Für jede Dimension sollte ein eigener Parameter verwendet werden; das Tableau Set wird weiterhin über die Marks-Karte verbunden.

## Install

GitHub Pages publishes the root of `main` directly. Download `hierarchy_filter.trex` and add it as a Viz Extension. Keep the existing Set Action. The mode parameter can now be chosen per instance.

### Tableau configuration

- `Leaf ID`: stable unique leaf identifier
- `Hierarchiestufen`: ordered level columns
- `Set-Mitgliedschaft`: the Boolean Set field `s.filter_auswahl`
- Configurable parameter (e.g. `p.kostenstelle_filter_modus`): `ALLE`, `AUSWAHL`, `KEINE`
- Set Action on `Select`: assign marks to `s.filter_auswahl`, keep values on clearing

Do not filter the extension's own data to the selected set.

## Important caveat

The initial Wunderbaum implementation is a prototype. Performance at 15,000 leaves, Dashboard/Cloud behavior, and complex cases with large multiselections are not yet verified. It still sends one Tableau tuple per leaf, and the distinct empty selection is represented by parameter `KEINE`.

## Files

`js/app.js` = UI, `js/hierarchy.js` = hierarchy, `js/tableau-connector.js` = Tableau API, `js/core.js` = parsing, `js/vendor` = third-party library.

All runtime scripts and stylesheets are locally hosted. Wunderbaum is MIT licensed; see `licenses/WUNDERBAUM-LICENSE.txt`. Project license: Apache-2.0.
