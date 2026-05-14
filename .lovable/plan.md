## Ziel

Die Seite `/rechnungen` (und analog `/angebote`) lässt sich nach den letzten PDF-Stabilitäts-Änderungen nicht mehr öffnen. Der genaue Fehlertext ist unbekannt, daher gehe ich in zwei Schritten vor: erst Ursache eindeutig sichtbar machen, dann gezielt reparieren — ohne weitere Funktionalität anzufassen.

## Vorgehen

### 1. Ursache reproduzieren und festnageln
- Preview öffnen, in die Browser-Konsole und ins Network-Panel schauen, was beim Laden von `/rechnungen` und `/angebote` genau wirft (Stacktrace, Datei, Zeile).
- Vite-/Build-Logs prüfen, ob ein Syntax-/Import-Fehler in einer der zuletzt geänderten Dateien auftritt:
  - `src/hooks/useBelegPdf.ts`
  - `src/lib/pdf/backendPdf.ts`
  - `src/components/pdf/PdfCanvasViewer.tsx`
  - `src/components/pdf-editor/LivePdfPreview.tsx`
  - `src/components/protokoll-editor/ProtokollLivePreview.tsx`
  - `src/hooks/useProtokollPdf.ts`
- Verdachtspunkte, die ich gezielt prüfe:
  1. `fetchBackendPdf` wirft jetzt bei 5xx einen Fehler. Falls irgendwo (z. B. Listen-Hover, Prefetch, Editor-Mount) der Hook ohne Try/Catch erwartet wird, kann ein Fehler im Render-Tree hochbubblen.
  2. Backend ist offline (Health-Check schlägt fehl). `isBackendUrlExplicit()` sollte `false` liefern und sauber auf den Browser-Generator zurückfallen — falls in einer Umgebung doch `true`, würde jeder Aufruf jetzt hart fehlschlagen statt still zurückzufallen.
  3. Geänderter `PdfCanvasViewer` (neuer `attempt`-State, neuer `RefreshCw`-Import, geänderter `key`) — Tippfehler oder doppelter Import könnte den Modul-Import sprengen und damit jede Seite mitreißen, die `PdfViewButton` importiert (Listen!).

### 2. Reparatur
- Den konkret gefundenen Fehler beheben (Import, Syntax, Hook-Reihenfolge, Null-Check).
- `fetchBackendPdf` wieder defensiver machen: Bei 5xx **nicht mehr werfen**, sondern null zurückgeben und den Fehler nur im Konsolenlog vermerken. Die echte Fehlermeldung kommt dann sauber aus dem Client-Generator bzw. dem Hook-`error`-State, ohne die Listen-Seite zu sprengen.
- Sicherstellen, dass Listen-Seiten (`/rechnungen`, `/angebote`) keine PDF-Hooks beim reinen Listen-Render auslösen — `PdfViewButton` öffnet den Hook erst beim Klick auf das Auge. Falls doch irgendwo direkt gemountet, mit Error-Boundary umschließen.
- `PdfCanvasViewer`: prüfen, dass `attempt`/`RefreshCw` sauber genutzt werden und keine doppelten Imports/Closing-Tags entstanden sind.
- Backend-Route `belege-pdf.ts`: 500er bleiben strukturiert, aber Frontend toleriert sie wieder; 404er weiterhin 404.

### 3. Verifikation
- Preview neu laden: `/rechnungen` und `/angebote` öffnen sich ohne Crash.
- Auge-Icon auf einem Beleg → PDF wird gebaut/angezeigt; bei Fehler erscheint nur im Dialog die Meldung mit „Erneut versuchen", die Liste bleibt funktional.
- „PDF bearbeiten" für Angebot, Rechnung und Schlüsselübergabe einmal öffnen — Live-Preview lädt, kein Render-Crash.
- Konsole: keine roten Fehler mehr beim Listen-Render.

## Was nicht angefasst wird
- E-Mail-Versand, Drive-Upload, Backend-Renderpfad, Datenmodell, Auth, Mobil-Upload — alles bleibt wie zuletzt.
- Kein Refactor der Hooks, nur die minimal nötige Defensiv-Logik.

## Bitte vorab
Falls du den genauen Fehlertext nochmal siehst (auch nur ein Screenshot oder Copy-Paste der ersten roten Zeile in der Konsole), wäre das Gold wert — dann spare ich mir den Reproduktionsschritt und gehe direkt zur Reparatur.
