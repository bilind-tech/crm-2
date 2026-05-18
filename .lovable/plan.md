## Plan: Protokoll-PDF ohne Flackern stabilisieren

Ich baue die Protokoll-Vorschau bewusst **nicht mehr extrem live**. Die PDF bleibt beim Bearbeiten stabil stehen und wird nur kontrolliert aktualisiert.

### 1. Automatisches Live-Rebuild fast komplett entfernen
- Kein PDF-Neuaufbau mehr bei jedem Tippen, Fokuswechsel oder Autosave-Echo.
- Die bestehende PDF bleibt sichtbar und wird nicht ständig neu gemountet.
- Dadurch hört dieses schnelle An/Aus-Flackern auf.

### 2. Vorschau auf kontrollierte Updates umstellen
- Nach Änderungen erscheint dezent ein Status wie „Vorschau nicht aktuell“.
- Aktualisierung nur über einen klaren Button „Vorschau aktualisieren“.
- Optional: ein sehr ruhiger Auto-Refresh nur nach langer Inaktivität, aber nicht während Eingabefelder/Hotspots aktiv sind.

### 3. PDF.js stabiler halten
- `Document` bleibt möglichst stabil gemountet.
- Kein `viewerSeq`-/Nonce-Mechanismus mehr, der die PDF unnötig neu laden kann.
- `numPages` wird beim Wechsel nicht auf 0 gerissen, damit die Fläche nicht leer blinkt.
- Blob/ArrayBuffer wird erst ersetzt, wenn die neue PDF wirklich fertig erzeugt wurde.

### 4. Bediengefühl verbessern
- Status-Anzeige wird ruhiger: keine schnell wechselnden Loader-Pillen.
- Button-Zustände sauber: „wird aktualisiert“, „aktuell“, „nicht aktuell“.
- Wenn ein Build fehlschlägt, bleibt die letzte funktionierende PDF sichtbar.

### 5. Autosave entkoppeln
- Autosave speichert weiter im Hintergrund.
- Autosave darf aber nicht mehr indirekt die PDF-Vorschau neu starten oder flackern lassen.

### Technische Änderungen
- Hauptdatei: `src/components/protokoll-editor/ProtokollLivePreview.tsx`
- Eventuell kleine Übergabe-Erweiterung in `src/components/protokoll-editor/ProtokollEditorLayout.tsx`, damit die Vorschau weiß, ob es ungespeicherte Änderungen gibt.
- Ziel: eine „Snapshot Preview“ statt einer aggressiven Live-PDF.