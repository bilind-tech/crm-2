# Plan: „require is not defined" beim PDF-Versand fixen

## Was ist kaputt

Beim Klick auf „E-Mail senden" antwortet der Pi-Backend mit 502 und der Fehlermeldung:

> PDF konnten nicht erstellt werden: require is not defined

(jetzt sichtbar dank des vorherigen Fixes in `piClient.ts`).

## Ursache

Das Backend ist als ESM-Projekt konfiguriert (`backend/package.json` → `"type": "module"`, `tsconfig` → `"module": "ES2022"`).

In `backend/src/pdf/printer.ts` (Zeile 26) steht aber:

```ts
const { createRequire } = require("node:module");
const requireCjs = createRequire(import.meta.url);
const PdfPrinter = requireCjs("pdfmake/src/printer.js");
```

In einem ESM-Modul existiert `require` schlicht nicht — daher der Laufzeit-Fehler **„require is not defined"**, sobald zum ersten Mal eine PDF gerendert werden soll (also genau beim Mail-Versand mit Anhang). In der Lovable-Preview tritt das nicht auf, weil dort gar nicht das echte Backend läuft, sondern nur der Frontend-Build.

Die Idee, `createRequire` zu nutzen, ist richtig (pdfmake hat keine sauberen ESM-Exports). Der Import war nur falsch geschrieben.

## Fix (genau eine Datei)

`backend/src/pdf/printer.ts`:

- Oben einen statischen ESM-Import hinzufügen:
  ```ts
  import { createRequire } from "node:module";
  ```
- In `getPrinter()` den falschen `require("node:module")`-Aufruf entfernen und direkt nutzen:
  ```ts
  const requireCjs = createRequire(import.meta.url);
  const PdfPrinter: any = requireCjs("pdfmake/src/printer.js");
  ```

Das ist die offiziell empfohlene ESM-kompatible Methode, CommonJS-Module wie `pdfmake/src/printer.js` zu laden. Verhalten der PDF-Erzeugung und der Singleton-Logik bleibt 1:1 identisch.

## Was NICHT angefasst wird

- Keine Änderung am Frontend (PDF-Viewer, Detailseiten, Email-Dialog) — die laufen wieder, das soll so bleiben.
- Keine Änderung an `piClient.ts`, am Mail-Worker, an den Routen oder am Datenmodell.
- Keine Änderung an `package.json`, `tsconfig.json` oder Build-Skripten.
- Keine neuen Dependencies.

## Deployment auf dem Pi

Da Code (nicht Daten) ersetzt wird, auf dem Pi nach dem Update:

1. `npm run build` im `backend/`-Ordner (kompiliert das geänderte `printer.ts` nach `dist/`).
2. Backend-Service neu starten (z. B. `systemctl restart mycleancenter-backend`).

Daten in `/var/lib/mycleancenter/` werden nicht berührt — die Regel wird eingehalten.

## Verifikation nach dem Fix

1. Auf einer Rechnungs-/Angebots-Detailseite „E-Mail senden" klicken.
2. Erwartet: Mail geht raus, kein 502, kein „require is not defined".
3. PDF-Vorschau / Editor weiterhin funktionsfähig (sollten von der Änderung nicht betroffen sein).

Wenn ein neuer Fehler erscheint (z. B. SMTP `EAUTH`), ist das ein **anderer** Fehler und wird separat angegangen — der jetzige Fix beseitigt nur das `require`-Problem.
