# Plan 1 — PDF-Vorschau stabil & ohne Flackern

## Ausgangslage (was schon stimmt)

- `useBelegPdf` nutzt React Query mit `staleTime: Infinity`, `gcTime: 30 min`, eigener Blob-URL-Lifecycle und verzögertem `revokeObjectURL` (StrictMode-sicher).
- `useBelegEditor` ruft nach Save `invalidatePdf(art, id)` auf.
- `useLiveEvents` invalidiert bei `beleg:mutated` zusätzlich `["pdf", art, id]`.
- Mock-Modus hat LRU-Cache in `src/lib/pdf/belegPdf.ts` (max 50).
- `PdfPreviewCard` zeigt bereits „PDF wird erstellt …".

## Was noch fehlt / falsch ist

### A. Status-0-Bug nach Reload („Unexpected server response (0)")
Der gespeicherte Blob lebt nur im React-Query-Cache **dieser Session**. Bei vollem Browser-Reload ist der Cache leer → Hook baut neu. Soweit korrekt.
Das eigentliche Problem: die alte `blob:`-URL aus der vorherigen Session steht u.U. noch in irgendeinem persistenten Container (Drive-Status-Card, History-State) oder wurde an `react-pdf` übergeben, **bevor** `containerWidth>0` gemessen wurde. `react-pdf` ruft die URL dann ab, der Browser meldet Status 0 (Blob existiert nicht mehr).

Gegenmaßnahme:
- In `PdfCanvasViewer`: bei jedem `pdfUrl`-Wechsel `setLoadError(null)` **und** `setNumPages(0)` (steht da) — zusätzlich den alten `<Document>` per `key={pdfUrl}` hart neu mounten, damit kein PDF.js-Worker-Task mit toter URL überlebt.
- In `useBlobUrl`: Wenn `query.isFetching && !query.data`, ist `entryRef.current` evtl. noch eine alte URL aus voriger Beleg-ID (Wechsel zwischen zwei Belegen). Lösung: Hook bekommt einen zweiten Parameter `cacheKey` (Beleg-ID); wenn `cacheKey` wechselt, sofort revoke + null setzen.
- Im PdfViewerDialog: bei `open=false` Blob-URL nicht weiter halten — `key={pdfUrl}` am Document-Element.

### B. Wording-Inkonsistenz
- `src/components/pdf/PdfCanvasViewer.tsx:86` → „PDF wird erzeugt …" → **„PDF wird erstellt …"**
- `src/components/pdf/PdfViewerDialog.tsx:103` → „PDF wird erzeugt …" → **„PDF wird erstellt …"**
- `src/components/pdf/PdfViewerDialog.tsx:110` → „PDF konnte nicht erzeugt werden" → **„PDF konnte nicht erstellt werden"**

### C. Loader-Politik
Aktuell zeigt `PdfPreviewCard` den Spinner sobald `status === "loading"`. Bei Cache-Hit innerhalb derselben Session ist `query.data` sofort da → kein Spinner. Bei Cache-Miss (erstes Öffnen, nach Reload) erscheint der Spinner — gewollt.
Eine kleine Verbesserung: solange `query.isFetching` läuft **und** wir noch eine alte gültige URL für dieselbe ID halten (Refetch nach Invalidation), das alte PDF stehen lassen statt Spinner zu zeigen — das ist mit dem heutigen `useBlobUrl`-Verhalten bereits so. Hier nur eine Mini-Änderung: Wenn `status==="loading"` aber `pdfUrl != null`, NICHT mehr „PDF wird erstellt …" einblenden, sondern nichts (URL bleibt sichtbar).

### D. Editor → Detailseite Refresh
`useBelegEditor` invalidiert bereits — funktioniert nur, wenn der Editor und die Detailseite **denselben QueryClient** teilen. Aktuell ja, weil QueryClient root-global ist. Ein Test-Trace im Mock-Modus reicht.

### E. Mock-LRU bei großem Beleg
`pdfLru` cached pro semantischem Hash. Bei reinem ID-Wechsel (Editor speichert → semantischer Hash ändert sich) entsteht ein neuer Eintrag, alter bleibt bis LRU-Verdrängung. Ungenutzte Einträge zur selben `id` proaktiv löschen, sobald ein neuer geschrieben wird (Disk-Backend macht das schon).

## Konkrete Änderungen

| Datei | Änderung |
|---|---|
| `src/components/pdf/PdfCanvasViewer.tsx` | Wording „erzeugt"→„erstellt"; `key={pdfUrl}` auf `<Document>` |
| `src/components/pdf/PdfViewerDialog.tsx` | Wording an 2 Stellen; `key={pdfUrl}` auf `<Document>`; bei `open=false` `pdfUrl` nicht rendern |
| `src/hooks/useBelegPdf.ts` | `useBlobUrl(blob, cacheKey)` — bei `cacheKey`-Wechsel sofort revoke; Status-Logik: `loading + pdfUrl` → kein Loader-Text in Card |
| `src/components/pdf/PdfPreviewCard.tsx` | Loader-Text nur wenn `!pdfUrl`; sonst altes PDF stehen lassen während Refetch |
| `src/lib/pdf/belegPdf.ts` | beim `lruSet` alle Einträge mit gleicher ID-Präfix entfernen |

## Akzeptanzkriterien

1. **Reload auf Detailseite**: PDF baut einmal (Spinner ~1-2s), dann sichtbar — kein „Status (0)"-Fehler mehr.
2. **Tab-Wechsel weg & zurück**: PDF sofort sichtbar, kein Spinner.
3. **Editor → Save → zurück zur Detailseite**: PDF aktualisiert sich einmalig, ohne weißes Flackern (altes Bild bleibt bis neues geladen).
4. **Wechsel zwischen zwei verschiedenen Belegen**: Beim Wechsel verschwindet die alte Vorschau sofort, neue baut auf — kein Status-0.
5. **Wording**: Überall „PDF wird erstellt" / „konnte nicht erstellt werden". Kein „erzeugt" mehr im Code.
6. **Mock & Backend gleich**: Verhalten in Lovable-Preview und (später) auf Pi identisch.

## Was NICHT angefasst wird

- Backend-PDF-Cache, Disk-Layout, ETag-Logik, Drive-Upload — alles korrekt.
- React-Query-Setup, QueryClient-Konfiguration im root.
- `fetchBackendPdf` (Backend-Fetcher).

## Risiko

Sehr niedrig. Reines UI-Refactoring + Wording. Kein Schema-, kein Backend-, kein Migrations-Touch. Vollständig in einem Schritt umsetzbar.

Sag „Go", dann setze ich diesen Plan in einem Rutsch um.
