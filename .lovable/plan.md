## Ziel
Alle PDF-Bereiche sollen zuverlässig funktionieren: Angebote, Rechnungen, PDF bearbeiten, Auge-Vorschau, Detailseiten-Vorschau sowie Protokolle/Schlüsselübergabe. Kein leerer Viewer, kein dauerhafter Fehlerzustand, klare automatische Wiederholung und Fallback auf Öffnen/Download, falls die Browser-Vorschau einmal nicht rendern kann.

## Plan

1. **PDF-Viewer zentral stabilisieren**
   - `PdfCanvasViewer` wird robuster gegen typische PDF.js-Probleme gemacht.
   - Blob-URLs werden nicht zu früh freigegeben.
   - Beim PDF-Wechsel wird sauber neu geladen.
   - Es gibt einen sichtbaren Retry-Mechanismus statt festhängender Fehleranzeige.
   - Wenn Canvas-Anzeige scheitert, bleiben „Öffnen“ und „Download“ nutzbar.

2. **Angebot/Rechnung Vorschau und Auge-Dialog reparieren**
   - `useBelegPdf` bekommt automatische Wiederholungen statt `retry: false`.
   - Backend-PDF-Fehler werden nicht mehr still verschluckt, sondern sauber ausgewertet.
   - Falls das Pi-Backend keine PDF liefern kann, wird nur dann auf Browser-PDF zurückgefallen, wenn das wirklich sinnvoll ist.
   - Fehler aus dem Backend werden verständlich angezeigt und lassen sich neu versuchen.

3. **PDF-Bearbeiten-Live-Vorschau stabil machen**
   - `LivePdfPreview` bekommt denselben robusten Lade-/Fehler-/Retry-Flow wie der normale Viewer.
   - Alte funktionierende Vorschau bleibt sichtbar, wenn ein neuer Render fehlschlägt.
   - Pending-URLs werden kontrolliert verwaltet, damit keine ungültige Blob-URL in PDF.js landet.

4. **Protokolle / Schlüsselübergabe ebenfalls einheitlich absichern**
   - `useProtokollPdf` und `ProtokollLivePreview` werden auf denselben stabilen PDF-Lifecycle gebracht.
   - Detailseite, Editor und Abschluss-Flow bekommen verlässliche Statuszustände.
   - Bei abgeschlossenen Protokollen bleibt die gespeicherte PDF-Vorschau nutzbar.

5. **PDF-Erzeugung selbst härten**
   - Client-PDF-Erzeugung für Belege und Werkzeuge bekommt klarere Fehlerbehandlung.
   - pdfmake-Fehler werden in verständliche Meldungen übersetzt.
   - Leere/ungültige PDF-Blobs werden abgefangen, bevor PDF.js sie lädt.

6. **Backend-PDF-Endpunkte absichern**
   - `/angebote/:id/pdf`, `/rechnungen/:id/pdf` und Meta/Regenerieren-Endpunkte bekommen strukturierte Fehlerantworten statt unklarer Internal-Server-Errors.
   - Nicht gefunden bleibt 404, Renderfehler werden sauber als PDF-Renderfehler gemeldet.
   - Cache-Invalidierung bleibt erhalten.

7. **Validierung nach Umsetzung**
   - Prüfen, dass folgende Wege dieselbe stabile PDF-Anzeige nutzen:
     - Angebotsliste Auge
     - Rechnungsliste Auge
     - Angebotsdetail Vorschau
     - Rechnungsdetail Vorschau
     - PDF bearbeiten bei Angebot/Rechnung
     - Protokoll-/Schlüsselübergabe-Detail
     - Protokoll-/Schlüsselübergabe-Editor
   - Zusätzlich wird auf ungültige Blob-URLs, PDF.js-Worker-Probleme und leere PDF-Blobs geprüft.

## Technische Details
- Hauptdateien: `src/components/pdf/PdfCanvasViewer.tsx`, `src/hooks/useBelegPdf.ts`, `src/components/pdf-editor/LivePdfPreview.tsx`, `src/hooks/useProtokollPdf.ts`, `src/components/protokoll-editor/ProtokollLivePreview.tsx`, `src/lib/pdf/belegPdf.ts`, `src/lib/pdf/werkzeugePdf.ts`, `backend/src/routes/belege-pdf.ts`, `backend/src/pdf/belegPdf.server.ts`.
- `routeTree.gen.ts` wird nicht manuell angepasst, weil es automatisch generiert wird.
- Fokus ist ausschließlich PDF-Stabilität und Vorschau/Render-Fehler, keine Änderungen an Daten oder Design.