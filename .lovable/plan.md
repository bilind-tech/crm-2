**Problem:** Der Dokumente-Viewer öffnet PDFs über `<iframe src={blobUrl}>`. In der Lovable-Preview (und Browsern ohne PDF-Plugin) bleibt die Fläche weiß. Für Angebote/Rechnungen wurde genau deswegen schon `PdfCanvasViewer` (react-pdf, Canvas) eingeführt — nur die Dokumente-Vorschau ist noch nicht migriert.

**Änderung (eine Datei):** `src/components/dokumente/DokumentViewer.tsx`
- Beim PDF-Branch das `<iframe>` ersetzen durch `<PdfCanvasViewer pdfUrl={dateiUrl} pdfBlob={blob} fileName={dokument.dateiname} className="h-full w-full overflow-y-auto bg-muted/30" />`.
- `useDokumentBlobUrl` liefert bereits `{ url, blob }` — `blob` mitgeben, damit PDF.js den ArrayBuffer bekommt (vermeidet „Unexpected server response (0)" bei `blob:`-URLs, identisch zur Belege-Vorschau).
- Alle Seiten rendern (kein `firstPageOnly`), Container scrollt wie heute.
- Bilder-Branch, Lade-Spinner, Nicht-darstellbar-Fallback, Header (Download/Drucken/Bearbeiten/Editor) und Footer (Kunde, Objekt, Drive-Sync) bleiben 1:1.

**Nicht angefasst:** Backend, Drucken-Flow, andere Komponenten.

**Akzeptanz:** Öffnen einer PDF aus „Dokumente" zeigt sofort die gerenderte Vorschau (alle Seiten, scrollbar) mit Lade-Spinner und Fehler-Fallback („Erneut versuchen / In neuem Tab öffnen / Herunterladen") — exakt wie in der Angebot-/Rechnung-Vorschau.