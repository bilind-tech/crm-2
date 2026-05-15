## Problem

Beim Klick auf „Drucken" auf Angebot-, Rechnung- oder Protokoll-Detail erscheint im Druck-Dialog **nicht das echte PDF**, sondern ein nahezu leeres A4-Blatt mit kleinen Texten in den Ecken (das sind die Browser-Druck-Header: URL, Datum, Seitenzahl).

## Ursache

`src/lib/pdf/printBlob.ts` legt für den nicht-iOS-Pfad ein Iframe an mit
```css
width: 0; height: 0;
```
und ruft danach `iframe.contentWindow.print()`. Chromium-basierte Browser **rendern den eingebetteten PDF-Viewer in einem 0×0-Iframe nicht** — `print()` druckt dann eine leere Page mit den Standard-Browser-Headern (das sind die kleinen Texte oben/unten rechts, die der User sieht). Mit echter Iframe-Größe rendert das PDF-Plugin normal und der Druck-Dialog enthält alle Seiten.

Multi-Page funktioniert sobald der PDF-Viewer richtig lädt — das PDF selbst hat ja schon korrekte Seitenumbrüche aus `printer.ts`/`pdf-lib`. Es gibt nichts, was wir am Inhalt ändern müssen, nur an der iframe-Sichtbarkeit.

## Fix

Eine Datei: `src/lib/pdf/printBlob.ts`.

### 1. Iframe sichtbar (für den PDF-Viewer) aber für den User unsichtbar machen

Statt `width: 0; height: 0` neue Styles:
```ts
iframe.style.position = "fixed";
iframe.style.inset = "0";
iframe.style.width = "100vw";
iframe.style.height = "100vh";
iframe.style.border = "0";
iframe.style.opacity = "0";
iframe.style.pointerEvents = "none";
iframe.style.zIndex = "-1";
```
Damit lädt der eingebettete PDF-Viewer den vollständigen Inhalt, der User sieht aber weiterhin nichts vom Iframe. Druck-Dialog zeigt das echte PDF inklusive aller Seiten.

### 2. Etwas mehr Wartezeit vor `print()`

Die aktuellen 50 ms reichen für PDFs nicht immer (insbesondere mehrseitige). Auf 250–300 ms hochziehen — bleibt für den User unmerklich.

### 3. `afterprint`-Cleanup nicht mehr global

Aktuell hängt der Listener am `window` — feuert pro Druck **aller** Iframes auf der Seite (wenn der User schnell mehrmals druckt, wird zu früh aufgeräumt). Auf das Iframe-`contentWindow` umstellen:
```ts
cw.addEventListener("afterprint", cleanup);
```
Plus beibehaltener Sicherheits-Timeout-Cleanup nach 60 s.

### 4. `printed`-Detektion robuster

Aktuell wird `printed = true` direkt nach dem `cw.print()`-Call gesetzt — bei Chromium blockiert `print()` synchron, also korrekt. In Firefox ist `print()` non-blocking; dort genügt der bestehende 6 s-Sicherheits-Fallback. Kein Eingriff nötig, nur Code-Kommentar präzisieren.

## Was nicht geändert wird

- Backend-PDF-Generierung (`backend/src/pdf/printer.ts`, `belegPdf.server.ts`): das PDF selbst ist korrekt, multi-page funktioniert dort längst.
- `PrintButton.tsx`: API bleibt identisch (`url` / `getBlob`).
- iOS-Safari-Pfad (`openInNewTab`): bleibt — dort funktioniert iframe-print prinzipiell nicht.
- Aufrufer (Angebot/Rechnung/Protokoll-Detail): keine Änderung.

## Verifikation

- Preview auf Angebot-Detail navigieren, „Drucken" klicken → echter PDF-Inhalt im Druck-Dialog mit allen Seiten.
- Gleiches für Rechnung und Schlüsselübergabe-Protokoll (nutzt `getBlob`-Pfad).
- Mehrseitiges Angebot mit ≥2 Seiten testen → alle Seiten im Druckdialog vorhanden.

## Risiken

Minimal. Iframe ist via `opacity:0` + `pointer-events:none` + `z-index:-1` für den User unsichtbar/unklickbar; layout-bedingte Nebenwirkungen (Scrollbar etc.) sind durch `position: fixed` ausgeschlossen.
