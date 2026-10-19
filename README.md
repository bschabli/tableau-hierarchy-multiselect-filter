# Tableau Hierarchy Multi-Select Filter

Open-source Tableau Viz Extension using vanilla JavaScript, [Wunderbaum 0.14.1](https://github.com/mar10/wunderbaum/tree/v0.14.1), and a local Tableau Extensions API.

## Functionality

- Build a tree from the flat level encodings (including ragged hierarchies)
- Hierarchical checkboxes with parent/child propagation and indeterminate state
- Draft selection: checkbox edits and Alle/Keine are local until **Anwenden**
- **Keine** temporarily clears the checkboxes; applying an empty selection restores **ALLE** (no filter restriction, Set remains unchanged).
- **Änderungen verwerfen** rereads the Tableau state and drops uncommitted edits
- Expand/Collapse state and scroll position are preserved on Set refresh; rows use Wunderbaum's matching 32px virtual row height.
- Tableau Set Actions via `selectTuplesAsync`
- Read Set membership back from Tableau to restore selection

## Format Extension – wichtig: `.trex` erneut laden

Die Konfiguration erscheint als **Format Extension** auf der **Marks-Karte des
Viz-Extension-Arbeitsblatts** (nicht im Dashboard-Objekt-Menü).
Tableau übernimmt Manifeständerungen nicht durch einen einfachen Webview-Reload.
Gehe auf **Worksheet → Manage Viz Extensions**, entferne die zuvor importierte
Version und füge die aktuelle `hierarchy_filter.trex` über die Marks-Karte
(**Viz Extensions → Add Extension → Access Local Viz Extensions**) erneut hinzu.
Ordne anschließend die Marks-Shelves wieder zu und prüfe die Set Action.
Der Manifeststand ist jetzt **0.2.0**.

Solange kein Modusparameter gespeichert ist, wird der Konfigurationsdialog beim
ersten Laden einmalig angeboten. Danach wird er über **Format Extension** geöffnet.

**Modusauswahl:** Im Filter ist ein Dropdown **Alle / Auswahl / Keine** sichtbar.
Die Änderung bleibt lokal bis **Anwenden**. Auf ausdrücklichen Wunsch gilt weiterhin:
**Keine + Anwenden** setzt den Filter auf **Alle** zurück.

**Hierarchie:** Die unterste ausgefüllte Ebene ist der letzte sichtbare Knoten.
Die Leaf ID ist ausschließlich der eindeutige technische Schlüssel; sie wird
nicht als zusätzliche Hierarchieebene angezeigt.

## Pro Filterinstanz konfigurieren

Über **Format Extension** in der Tableau-Marks-Karte einen Tableau-Zeichenfolge-Parameter mit den Werten `ALLE`, `AUSWAHL`, `KEINE` auswählen. Die Filterbezeichnung ist optional und kann per Checkbox eingeblendet werden. Parameter können aus Vorschlägen gewählt oder namentlich eingegeben werden. Die Einstellungen werden über Tableau Extension Settings für diese Visualisierung im Workbook gespeichert. Für jede Dimension sollte ein eigener Parameter verwendet werden; das Tableau Set wird weiterhin über die Marks-Karte verbunden.

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
