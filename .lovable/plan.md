# Protokoll-PDF-Vorschau zuverlässig machen

## Ursache

Bei Angebot/Rechnung funktioniert die Vorschau, weil die PDF dem PDF.js-Viewer **direkt als ArrayBuffer** (über `pdfBlob`) übergeben wird. Bei den Protokollen wird stattdessen nur die `blob:`-URL übergeben — PDF.js holt die per `fetch`. Auf dem Pi (`http://mycleancenter-pi.local:8787`) scheitert dieser Worker-Fetch reproduzierbar mit `Unexpected server response (0) while retrieving PDF "blob:..."`. Genau dasselbe Problem hatten wir bei Angebot/Rechnung, dort durch ArrayBuffer-Übergabe + `slice(0)`-Kopien gelöst.

Zwei Stellen sind betroffen:

1. **Detailseite** `src/routes/protokolle.$id.tsx` → `<PdfPreviewCard … pdfUrl={pdf.url} />` (ohne `pdfBlob`).
2. **Editor-Live-Preview** `src/components/protokoll-editor/ProtokollLivePreview.tsx` → übergibt blob-URL an `<Document file={pdfUrl}>`.

## Lösung

### 1. `protokolle.$id.tsx` (1-Zeilen-Fix)
`pdfBlob={pdf.blob}` an `PdfPreviewCard` zusätzlich weiterreichen — analog zu `angebote.$id.tsx` Zeile 318 und `rechnungen.$id.tsx` Zeile 316. Hook `useProtokollPdf` liefert das `blob` bereits. Damit nutzt `PdfCanvasViewer` den ArrayBuffer-Pfad mit Re-Mount-Schutz (Detach-Retry).

### 2. `ProtokollLivePreview.tsx` (Refactor analog zu `LivePdfPreview`)
- ArrayBuffer-State (`pdfBuffer`) + `pendingBuffer` einführen, frische `slice(0)`-Kopie pro Document-Load (verhindert „ArrayBuffer detached").
- `key={`buf#${size}#${attempt}`}` auf `<Document>` für sauberen Re-Mount.
- `onLoadError`: bei `detached` einmal automatisch retryen, sonst Fehler anzeigen + Download-Fallback.
- Atomarer Swap: alte Vorschau bleibt sichtbar, bis neue PDF geladen ist (hidden Pre-Loader-Document).
- Loader-Pille erst nach ~250 ms zeigen, kein Flackern.
- Blob-URL nur noch für den Download-Fallback-Link, nicht mehr als PDF.js-Quelle.

Die bisherige Datei wird komplett ersetzt durch eine schlanke Variante (ohne Hotspots, da Protokolle keine haben).

## Validierung

- `bun run build` (TanStack typisiert alle Routen).
- In der Preview: Detailseite eines Protokolls → Vorschau-Karte rendert Seite 1.
- Editor-Route `/protokolle/:id/bearbeiten` → linke Vorschau zeigt PDF nach < 1 s, Tippen im rechten Editor löst stabil neue Vorschau ohne „Unexpected server response (0)" aus.
- Konsole frei von „detached" und „server response (0)".

## Betroffene Dateien

- `src/routes/protokolle.$id.tsx` (eine zusätzliche Prop)
- `src/components/protokoll-editor/ProtokollLivePreview.tsx` (Rewrite analog `LivePdfPreview` ohne Hotspots)
