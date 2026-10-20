# Tableau Hierarchy Multi-Select Filter

Open-source Tableau Viz Extension using vanilla JavaScript, [Wunderbaum 0.14.1](https://github.com/mar10/wunderbaum/tree/v0.14.1), and a local Tableau Extensions API.

## Functionality

- Build a tree from the flat level encodings (including ragged hierarchies)
- Hierarchical checkboxes with parent/child propagation and indeterminate state
- Draft selection: checkbox edits and Alle/Keine are local until **Anwenden**
- **Alle** selects every checkbox and assigns all currently available values to the Tableau Set.
- **Keine** clears every checkbox and, on **Anwenden**, empties the Tableau Set (parameter `KEINE`).
- **Auswahl** uses exactly the checked values, including an empty manual selection.
- **Änderungen verwerfen** rereads the Tableau state and drops uncommitted edits
- Initial opening and deliberate **Neu einlesen** start with the entire tree collapsed.
- Automatic Set refreshes and checkbox/mode changes retain the user's open branches and scroll position.
- Borderless, separator-free simple tree with 26px virtual rows, subtle hover and keyboard focus highlights.
- Tableau Set Actions via `selectTuplesAsync`
- Read Set membership back from Tableau to restore selection
- Compact hierarchy search (case-insensitive partial title matches), highlights matching text
- Automatically expands all branches containing matches, including matching parent nodes
- Clearing the query restores the expansion state before searching
- Search never changes checkboxes, parameters or Tableau Set membership
- **Nur Treffer** toggles Wunderbaum's hide filter: only matches and their ancestor paths remain visible
- Compact icon tools for expand/collapse all and search-only mode, with keyboard focus, aria labels and tooltips
- **Alle öffnen / Alle schließen** expands or collapses the entire tree without changing selected values
- Compact 26px tree rows and tighter button spacing for narrow Tableau dashboard containers
- Missing FIRST hierarchy levels become an "Ohne Zuordnung" root; deeper NULL values are removed to keep ragged paths compact
- Optional second per-instance Tableau **text parameter** receives a compact, hierarchy-aware filter summary on **Anwenden** (and when configuring that parameter)
- Mode selection uses three buttons (Alle, Auswahl, Keine); changes remain local until **Anwenden**

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

**Modusauswahl:** Im Filter sind drei Buttons **Alle / Auswahl / Keine** sichtbar.
Die Änderung bleibt lokal bis **Anwenden**. Auf ausdrücklichen Wunsch gilt weiterhin:
**Alle + Anwenden** schreibt alle Werte ins Tableau Set, **Keine + Anwenden** leert das Tableau Set. Der Modus bleibt jeweils auf **Alle** beziehungsweise **Keine**. Die Checkboxen zeigen den Set-Inhalt.

**Hierarchie:** Die unterste ausgefüllte Ebene ist der letzte sichtbare Knoten.
Die Leaf ID ist ausschließlich der eindeutige technische Schlüssel; sie wird
nicht als zusätzliche Hierarchieebene angezeigt.

## Zusammenfassungsparameter

Optional kann über **Format Extension** ein zweiter Tableau-Parameter für die
Zusammenfassung gewählt werden, z. B. `p.kostenstellen_zusammenfassung`.
In Tableau vorher einen **Zeichenfolge-Parameter mit zulässigen Werten „Alle“**
(`All`, keine feste Werteliste) erstellen und im Workbook verwenden. Tableau
stellt der Extension nur verfügbare Workbook-Parameter zur Verfügung.

Beim Klick auf **Anwenden** schreibt die Extension:
- `Alle` bei vollständiger Auswahl
- `Keine` bei leerer Auswahl
- eine verkürzte Hierarchieliste bei Teilselektion, beispielsweise
  `Produktion, Vertrieb › Region Ost`

Sind alle Kinder einer Kategorie gewählt, wird nur die Kategorie genannt.
Die Zusammenfassung ist auf 240 Zeichen begrenzt und endet bei Bedarf mit
`(+N weitere)`. Der Parameter kann im Dashboard als dynamischer Text verwendet
werden. Der gespeicherte Parameter ist vom Modusparameter unabhängig.

## Fehlende Hierarchieebenen

**Übergangslösung:** Ein echtes NULL (oder `%null%`) auf der **obersten
Hierarchiestufe** wird als eigene Gruppe **„Ohne Zuordnung“** dargestellt.
Andere NULL-Stufen werden wie bisher übersprungen. Wenn bei einem Objekt
sämtliche Ebenen fehlen, erscheint es als **„Ohne Bezeichnung“** unter
„Ohne Zuordnung“. Auch mehrere solche Objekte behalten jeweils ihre
technische Leaf-ID und können getrennt ausgewählt werden.

Die technische Leaf-ID bestimmt **nicht** die sichtbare Tiefe. Ist `Null` dagegen ein **echter
Textwert**, weil ein Tableau-Berechnungsfeld beispielsweise
`IFNULL([Ebene], "Null")` verwendet, kann die Extension ihn nicht sicher von
einem realen Kategorienamen unterscheiden. In diesem Fall die betreffende
Hierarchiestufe in Tableau als **echtes NULL** belassen, und für die technische
Leaf-ID lieber stabile eindeutige Objektcodes oder eindeutig getrennte,
nichtleere Pfadsegmente verwenden. **Die Leaf-ID muss weiterhin für jedes
Objekt eindeutig sein.** Werden IDs nur aus Ebenennamen verkettet, können
mehrere unzugeordnete Objekte dieselbe ID erhalten. Das behebt die
Anzeige der Extension nicht; für diese Fälle braucht es eine stabile
Objektkennung oder eine zusätzliche eindeutige Komponente in der ID.

## Pro Filterinstanz konfigurieren

Über **Format Extension** in der Tableau-Marks-Karte einen Tableau-Zeichenfolge-Parameter mit den Werten `ALLE`, `AUSWAHL`, `KEINE` auswählen. Der Dialog verwendet echte HTML-Dropdowns statt `datalist`, sodass Vorschläge auch im eingebetteten Tableau-Browser sichtbar sind. Zusätzlich ist die manuelle Eingabe weiter möglich. Die API-Abfrage erfolgt nur einmal und Fehler beim Laden der Liste erscheinen als Hinweis im Dialog. Die Filterbezeichnung ist optional und kann per Checkbox eingeblendet werden. Parameter können aus Vorschlägen gewählt oder namentlich eingegeben werden. Die Einstellungen werden über Tableau Extension Settings für diese Visualisierung im Workbook gespeichert. Für jede Dimension sollte ein eigener Parameter verwendet werden; das Tableau Set wird weiterhin über die Marks-Karte verbunden.

## Install

GitHub Pages publishes the root of `main` directly. Download `hierarchy_filter.trex` and add it as a Viz Extension. Keep the existing Set Action. The mode parameter can now be chosen per instance.

### Tableau configuration

- `Leaf ID`: stable unique leaf identifier
- `Hierarchiestufen`: ordered level columns
- `Set-Mitgliedschaft`: the Boolean Set field `s.filter_auswahl`
- Configurable parameter (e.g. `p.kostenstelle_filter_modus`): `ALLE`, `AUSWAHL`, `KEINE`
- Set Action on `Select`: **Assign values to set** for `s.filter_auswahl`.
- **Required change:** Under **Clearing the selection**, select **Remove all values from set** (German: **Alle Werte aus Set entfernen**). The previous **Keep set values** configuration cannot empty the Set.
- Keep the extension's own source worksheet unfiltered, and ensure the Set Action targets the correct datasource/Set.

Do not filter the extension's own data to the selected set.

## Important caveat

The initial Wunderbaum implementation is a prototype. Performance at 15,000 leaves, Dashboard/Cloud behavior, and complex cases with large multiselections are not yet verified. The app selects Tableau tuples for each required Set update. An empty visible selection means an empty Set; all selected checkboxes mean all available values are in the Set. For larger hierarchies, selecting all tuples may have a performance cost.

## Files

`js/app.js` = UI, `js/hierarchy.js` = hierarchy, `js/tableau-connector.js` = Tableau API, `js/core.js` = parsing, `js/vendor` = third-party library.

All runtime scripts and stylesheets are locally hosted. Wunderbaum is MIT licensed; see `licenses/WUNDERBAUM-LICENSE.txt`. Project license: Apache-2.0.
