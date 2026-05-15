## Was gerade sehr wahrscheinlich kaputt ist

Der Fehler im Screenshot kommt nicht mehr von der Rechnungs-/Angebots-Detailseite selbst, sondern vom PDF-Anzeige-Modul:

```text
Unexpected server response (0) while retrieving PDF "blob:http://192.168.2.111:8787/..."
```

Das bedeutet: Die PDF wird offenbar erzeugt, aber `react-pdf`/PDF.js versucht sie über eine `blob:`-URL zu laden. Genau diese `blob:`-URL ist in manchen Browser-/Worker-Konstellationen instabil. Dann zeigt PDF.js den Fehler an, obwohl die PDF-Datei eigentlich vorhanden ist. Das passt auch dazu, dass Download/Öffnen teilweise möglich sein kann, aber die eingebettete Vorschau scheitert.

Wichtig: Das ist eine andere Fehlerklasse als der vorherige Crash der Detailseiten. Deshalb sollte die Lösung diesmal gezielt nur den PDF-Viewer und die PDF-Datenübergabe stabilisieren, nicht wieder breit an den Rechnungs-/Angebotsseiten herumändern.

## Ziel

PDFs müssen funktionieren an allen Stellen:

- Rechnungs-Detailseite: kleine Vorschau
- Angebots-Detailseite: kleine Vorschau
- Button „PDF ansehen“ / Vollbild-Dialog
- „PDF bearbeiten“ bei Rechnungen
- „PDF bearbeiten“ bei Angeboten
- Live-Vorschau im PDF-Editor

Und wichtig: Wenn die Vorschau intern kurz lädt oder neu rendert, darf die komplette Detailseite nicht crashen.

## Plan zur Umsetzung

### 1. PDF-Anzeige nicht mehr über `blob:`-URL rendern

Ich würde `PdfCanvasViewer` so umbauen, dass PDF.js nicht mehr `file={pdfUrl}` bekommt, sondern echte PDF-Binärdaten, z. B. `Uint8Array` oder `Blob`.

Warum:

- `blob:`-URLs sind gut für Download/Öffnen, aber nicht zuverlässig genug für PDF.js Worker-Rendering.
- Binärdaten direkt an PDF.js zu geben umgeht den fehleranfälligen Fetch auf `blob:http://...` komplett.
- Damit verschwindet genau die Fehlerursache aus dem Screenshot.

### 2. `useBelegPdf` soll zusätzlich den Blob zurückgeben

Aktuell liefert der Hook hauptsächlich:

```ts
url, status, error, fileName
```

Ich würde daraus machen:

```ts
url, blob, status, error, fileName
```

Die URL bleibt nur noch für:

- Download
- In neuem Tab öffnen
- E-Mail-Anhang/Blob-URL-Fallback, falls dort benötigt

Die Vorschau rendert dagegen aus `blob`/`Uint8Array`, nicht aus `url`.

### 3. Detailseiten minimal anfassen

In `rechnungen.$id.tsx` und `angebote.$id.tsx` würde ich nur die Übergabe an `PdfPreviewCard` ergänzen:

- weiter `pdfUrl={pdf.url}` für Download/Öffnen
- neu `pdfBlob={pdf.blob}` für die eigentliche Anzeige

Keine neue Logik in den Detailseiten, keine großen Umbauten. Damit bleibt das Risiko klein, dass die Seiten wieder gar nicht öffnen.

### 4. `PdfPreviewCard` und `PdfViewerDialog` robust machen

Beide Komponenten sollen dem Viewer künftig die PDF-Binärdaten übergeben.

Wenn PDF noch lädt:

- Loader anzeigen

Wenn PDF-Erzeugung wirklich fehlschlägt:

- kurze verständliche Meldung anzeigen
- technische Details nur in Konsole oder kopierbar/ausklappbar, nicht als riesiger roter PDF.js-Fehler mitten in der UI

Wenn nur die Anzeige scheitert, aber ein Blob vorhanden ist:

- automatisch einmal neu versuchen
- Download/Öffnen weiterhin anbieten
- die Detailseite darf nicht crashen

### 5. PDF-Editor-Live-Vorschau ebenfalls von `blob:`-URL entkoppeln

`LivePdfPreview` benutzt ebenfalls `Document file={pdfUrl}` und kann daher dieselbe Fehlerquelle haben.

Ich würde dort den Ablauf so ändern:

- PDF wird wie bisher per `generateAngebotPdf` / `generateRechnungPdf` erzeugt
- Für PDF.js wird `Uint8Array`/Blob direkt genutzt
- Blob-URL bleibt nur für Download-Fallback
- Der atomare Vorschau-Tausch bleibt erhalten: alte Vorschau bleibt sichtbar, bis neue Vorschau erfolgreich geladen wurde

### 6. Einen kleinen Diagnose-Text einbauen, aber nicht als Standard-Fehlerfläche

Falls es danach doch noch ein Problem gibt, soll die UI nicht einfach nur „PDF kann nicht angezeigt werden“ zeigen, sondern intern/ausklappbar Informationen liefern wie:

- Bereich: Detail-Vorschau, Dialog oder Editor
- Belegart: Rechnung/Angebot
- Fehlertext von PDF.js
- ob Blob vorhanden war und wie groß er war

So kannst du mir im Notfall wieder einen konkreten Output schicken, ohne dass die Seite unbrauchbar wird.

### 7. Validierung danach

Nach der Umsetzung würde ich gezielt prüfen:

1. Rechnung-Detailseite öffnet weiterhin.
2. Angebots-Detailseite öffnet weiterhin.
3. Kleine PDF-Vorschau rendert ohne `Unexpected server response (0)`.
4. „PDF ansehen“ rendert im Dialog.
5. „PDF bearbeiten“ öffnet und zeigt die Live-Vorschau.
6. Dasselbe für Angebote.
7. Konsole auf PDF.js-/Blob-Fehler prüfen.

## Dateien, die voraussichtlich geändert werden

- `src/hooks/useBelegPdf.ts`
- `src/components/pdf/PdfCanvasViewer.tsx`
- `src/components/pdf/PdfPreviewCard.tsx`
- `src/components/pdf/PdfViewerDialog.tsx`
- `src/components/pdf/PdfViewButton.tsx`
- `src/components/pdf-editor/LivePdfPreview.tsx`
- minimal: `src/routes/rechnungen.$id.tsx`
- minimal: `src/routes/angebote.$id.tsx`

## Warum dieser Plan sicherer ist als die bisherigen Versuche

- Er bekämpft den konkreten Fehler aus dem Screenshot: PDF.js lädt eine `blob:`-URL und scheitert mit Response 0.
- Er ändert nicht erneut breit die Rechnungs-/Angebotslogik.
- Die Detailseiten bleiben von der PDF-Anzeige entkoppelt: Wenn der Viewer Probleme hat, soll nicht die ganze Seite kaputtgehen.
- Die PDF-Datei selbst wird weiter erzeugt wie bisher; nur die Anzeige bekommt stabilere Daten.

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>