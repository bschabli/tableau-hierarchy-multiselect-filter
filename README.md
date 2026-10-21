# Tableau Hierarchy Multi-Select Filter

Eine schlanke [Tableau Viz Extension](https://help.tableau.com/current/pro/desktop/de-de/viz_extensions.htm) für hierarchische Mehrfachauswahl über **Tableau Sets**. Ohne Build-Schritt, mit JavaScript und [Wunderbaum](https://github.com/mar10/wunderbaum).

## Einrichtung

1. [`hierarchy_filter.trex`](hierarchy_filter.trex) herunterladen und als **Viz Extension** in Tableau hinzufügen.
2. Auf der Marks-Karte zuordnen:
   - **Leaf ID:** eindeutiger technischer Schlüssel je auswählbarem Objekt.
   - **Hierarchiestufen:** Ebenen in der gewünschten Reihenfolge (oben nach unten).
   - **Set-Mitgliedschaft:** das zu steuernde Tableau Set (z. B. `s.filter_auswahl`).
3. Im Dashboard eine **Set Action** mit der Viz Extension als Quelle erstellen:
   - **Ausführen bei:** Auswahl (*Select*)
   - **Ziel:** das zugehörige Set; ausgewählte Werte dem Set zuweisen
   - **Auswahl aufheben:** **Alle Werte aus Set entfernen** (*Remove all values from set*)
4. In den Ziel-Arbeitsblättern nach der Set-Mitgliedschaft filtern, z. B. `[s.filter_auswahl]`. **Das Quellarbeitsblatt der Extension darf nicht nach diesem Set gefiltert werden.**

## Bedienung

**Alle**, **Keine** und die Checkboxen verändern zunächst nur die lokale Auswahl. Erst **Anwenden** schreibt sie in das Tableau Set. Das Aktualisieren-Symbol liest den Set-Zustand erneut ein und verwirft nicht übernommene Änderungen.

Die Suche markiert Treffer und öffnet passende Zweige. Mit dem Trichter-Symbol lassen sich nur Treffer anzeigen. Weitere Symbole öffnen oder schließen den gesamten Baum.

Unter **Format Extension** auf der Marks-Karte lassen sich ein optionaler Titel und ein **optionaler Zusammenfassungsparameter** einstellen. Dafür einen Tableau-Zeichenfolge-Parameter mit zulässigen Werten **Alle** (beliebiger Text, keine Werteliste) verwenden. Die Zusammenfassung wird beim Anwenden aktualisiert und verdichtet vollständig ausgewählte Zweige.

## Hinweise

- Die letzte befüllte Hierarchiestufe ist der sichtbare Endknoten; die **Leaf ID** wird nicht angezeigt.
- Fehlende untergeordnete Hierarchiestufen werden übersprungen. Ein `NULL` auf der obersten Ebene erscheint unter **Ohne Zuordnung**; vollständig leere Pfade unter **Ohne Bezeichnung**.
- Jede Leaf ID muss eindeutig sein. Mehrere Objekte mit gleichen Hierarchienamen benötigen eigene IDs.
- Tableau liest Änderungen an der `.trex` nicht durch bloßes Neuladen ein; bei Manifeständerungen die Extension erneut hinzufügen.
- Bei großen Datenmengen kann das Übertragen aller ausgewählten Marks Zeit beanspruchen.

## Technik und Lizenzen

GitHub Pages veröffentlicht `main` direkt über [die Extension](https://bschabli.github.io/tableau-hierarchy-multiselect-filter/index.html). Die Datei `.nojekyll` deaktiviert Jekyll für das statische Deployment. Es sind keine Installations- oder Build-Befehle erforderlich.

Projektlizenz: [Apache-2.0](LICENSE.txt). Wunderbaum: [MIT](licenses/WUNDERBAUM-LICENSE.txt). Alle Laufzeit-Abhängigkeiten liegen lokal im Repository.
