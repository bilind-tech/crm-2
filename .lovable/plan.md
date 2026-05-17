## Ziel
Das Flackern bei Übergabeprotokoll und Schlüsselübergabe wird nicht nur gedämpft, sondern technisch verhindert: Die sichtbare PDF wird beim Schreiben nicht mehr ständig neu gerendert.

## Ursache
Auch mit nur einem PDF-Viewer flackert `react-pdf`, sobald die PDF-Daten während des Tippens ausgetauscht werden. PDF.js löscht/rendert Canvas-Seiten neu — dadurch wirkt die Vorschau wie „an/aus“. Solange die Vorschau wirklich live bei jeder Texteingabe neu gebaut wird, kann dieses Flackern wiederkommen.

## Plan
1. **Live-Rendering beim Tippen stoppen**
   - `ProtokollLivePreview` rendert nicht mehr bei jeder Draft-Änderung sofort neu.
   - Stattdessen bleibt die letzte fertige PDF stabil sichtbar.
   - Während Eingaben geändert werden, erscheint nur ein dezenter Status wie „Änderungen warten“.

2. **Kontrollierte Aktualisierung einbauen**
   - Neue PDF wird erst nach einer längeren Ruhezeit aktualisiert, z. B. 2,5–3 Sekunden nach der letzten Änderung.
   - Zusätzlich bekommt die Vorschau einen kleinen Button „Vorschau aktualisieren“, damit der Nutzer sofort bewusst refreshen kann.
   - Kein weißes Neuladen, kein schnelles An/Aus beim Tippen.

3. **Viewer während Bearbeitung einfrieren**
   - Wenn ein Hotspot-Popover oder Textfeld aktiv ist, wird die PDF nicht neu ersetzt.
   - Erst wenn die Bearbeitung beendet/geschlossen wird oder genug Ruhezeit vergangen ist, wird neu gebaut.
   - Das macht es praktisch wie Word: Dokument bleibt stehen, Eingabe bleibt ruhig.

4. **PDF.js-Neumount minimieren**
   - `Document` und `Page` bekommen stabile Keys, damit nicht unnötig alles neu gemountet wird.
   - Seitenanzahl wird beim Neuladen nicht auf 0 gesetzt; die alte Seite bleibt sichtbar, bis neue Daten fertig sind.

5. **Autosave entkoppeln**
   - Autosave darf weiter speichern, aber darf die PDF-Vorschau nicht sofort neu triggern.
   - Server-Echos/Refetches werden ignoriert, solange der lokale Draft gerade bearbeitet wird.

## Dateien
- `src/components/protokoll-editor/ProtokollLivePreview.tsx`
- `src/components/protokoll-editor/ProtokollEditorLayout.tsx`
- optional klein: `src/hooks/useProtokollEditor.ts`, falls Server-Echos den Draft/Preview-Key weiter anstoßen

## Ergebnis
Beim Schreiben bleibt die PDF sichtbar und ruhig. Sie aktualisiert sich kontrolliert nach Pause oder per Button — nicht mehr extrem schnell live bei jedem Tastendruck.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>