Ich habe die PDF-Stellen geprüft. Der wichtigste Fund: Der Browser-PDF-Generator nutzt aktuell noch die alte pdfmake-Callback-Variante `getBlob((blob) => ...)`. In der installierten pdfmake-Version `0.3.x` ist `getBlob()` aber async/promise-basiert. Dadurch kann der Promise in unserer App hängen bleiben — Ergebnis: `PDF wird erzeugt …` lädt endlos. Das betrifft Rechnung, Angebot, Auge-Icon, Detailkarte, E-Mail-Dialog und den Live-PDF-Editor, weil alle denselben Generator verwenden.

Plan zur Behebung:

1. PDF-Generator korrigieren
   - In `src/lib/pdf/belegPdf.ts` die pdfmake-Initialisierung robust machen.
   - VFS/Schriften korrekt über `addVirtualFileSystem(...)` bzw. kompatiblen Fallback registrieren.
   - `renderPdf(...)` von Callback-API auf `await pdfMake.createPdf(doc).getBlob()` umstellen.
   - Zusätzlich eine Timeout-/Fehlerbehandlung einbauen, damit nie wieder ein endloser Spinner ohne Fehlermeldung stehen bleibt.

2. PDF-Hook stabilisieren
   - In `src/hooks/useBelegPdf.ts` sicherstellen, dass bei jeder neuen Rechnung/jedem neuen Angebot alter Fehler und alte URL sauber zurückgesetzt werden.
   - Bei fehlenden Basisdaten nicht stumm auf `idle` hängen bleiben, sondern zuverlässig auf `loading`, `ready` oder `error` gehen.
   - Optional einen kurzen Schutz-Timeout einbauen, sodass die UI statt Endlos-Laden eine verständliche Fehlermeldung zeigt.

3. PDF-Anzeige an allen Stellen absichern
   - `PdfViewerDialog` so anpassen, dass die Anzeige auch funktioniert, wenn `react-pdf` die Seitenanzahl nicht sofort liefert.
   - Bei `Document`-Fehlern einen sichtbaren Fehler statt leerer Fläche anzeigen.
   - Das betrifft insbesondere:
     - Detailseite Rechnung unten
     - Auge-Icon in der Rechnungsübersicht
     - Angebot-PDFs analog
     - Live-PDF-Editor

4. Live-Editor prüfen/anpassen
   - `src/components/pdf-editor/LivePdfPreview.tsx` nutzt denselben PDF-Generator und profitiert vom Generator-Fix.
   - Ich ergänze dort ebenfalls eine robuste Fehler-/Timeout-Behandlung, damit der Live-Editor nicht endlos lädt.

5. Technische Verifikation ohne Browser-Navigation
   - Nach Umsetzung per Codeprüfung und automatischem Test/Runtime-Check sicherstellen, dass:
     - `generateRechnungPdf(...)` tatsächlich einen PDF-Blob erzeugt.
     - Der Blob `application/pdf` ist und nicht leer ist.
     - Der Viewer-Status von `loading` nach `ready` wechselt.
   - Keine Änderung am echten Datenverzeichnis oder am Pi-Update-/Backup-System.

Erwartetes Ergebnis nach Freigabe:
- Rechnung erstellen → PDF wird wirklich erzeugt.
- Detailseite unten zeigt nicht dauerhaft Spinner, sondern `PDF bereit` oder eine klare Fehlermeldung.
- Auge-Icon in der Rechnungsübersicht öffnet die Rechnung sichtbar.
- Angebot-PDFs funktionieren analog.
- Live-PDF-Editor lädt die Vorschau statt endlos zu hängen.