## Ziel
Die PDF-Vorschau bei Übergabeprotokoll und Schlüsselübergabe darf beim Bearbeiten nicht mehr ständig an/aus gehen. Die sichtbare PDF bleibt stabil stehen; Aktualisierungen passieren kontrolliert im Hintergrund.

## Plan
1. **Live-Aktualisierung entschärfen**
   - Die Protokoll-PDF wird nicht mehr bei jedem kleinen Tastendruck sofort neu geladen.
   - Stattdessen wird der Draft ruhig gesammelt und erst nach kurzer Pause neu gerendert.
   - Während der Eingabe bleibt die alte PDF sichtbar, ohne weißen Wechsel oder Neu-Mount-Flackern.

2. **PDF-Viewer stabilisieren**
   - Den versteckten zweiten `<Document>`-Preloader entfernen, weil genau dieses doppelte Laden sehr wahrscheinlich das schnelle An/Aus verursacht.
   - Neue PDF-Daten nur noch über eine stabile Viewer-Version tauschen.
   - `numPages`, `loadAttempt` und Buffer-Keys so trennen, dass React-PDF nicht in eine Neu-Lade-Schleife kommt.

3. **Nur echte Änderungen rendern**
   - Den Protokoll-Key robuster machen, damit leere/gleiche Daten, Timestamps oder API-Echos keinen neuen PDF-Build starten.
   - Wenn bereits ein Build läuft, wird nicht parallel neu gestartet; es wird nur der letzte Stand nachgezogen.

4. **Bearbeiten bleibt live, aber ruhig**
   - Hotspot-/Inline-Editoren bleiben nutzbar.
   - Die Vorschau zeigt bei schnellen Eingaben maximal dezent „aktualisiert …“, aber sie verschwindet nicht.
   - Tabellen/Schlüsselzeilen und Textfelder bleiben übersichtlich editierbar.

5. **Aufräumen kleiner Textreste**
   - Im Hotspot „Kunde“ steht noch „Stammdaten öffnen“, obwohl Stammdaten entfernt wurden. Das wird auf „Inhalt öffnen“ geändert.

## Technische Umsetzung
- Betroffene Dateien:
  - `src/components/protokoll-editor/ProtokollLivePreview.tsx`
  - `src/components/protokoll-editor/ProtokollHotspotEditor.tsx`
- Kernänderung:
  - Single-Viewer-Strategie statt sichtbares Document plus verstecktes Pending-Document.
  - Stable render version/sequence statt Buffer-Länge oder Pending-Document-Key.
  - Alter PDF-Buffer bleibt aktiv, bis der neue Buffer vollständig erzeugt wurde.

## Ergebnis
Die Protokoll-PDF flackert nicht mehr extrem beim Erstellen oder Bearbeiten; sie bleibt stabil sichtbar und aktualisiert sich kontrolliert im Hintergrund.