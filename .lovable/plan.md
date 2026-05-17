## Ziel

Auf der PDF-Generierung (Angebot, Rechnung — und überall sonst) soll **kein Kunden-Logo** mehr neben der Kundenadresse erscheinen. Nur das Firmen-Logo (Mein-Logo, rechts oben) bleibt.

## Was geändert wird

Eine Datei: `src/lib/pdf/belegPdf.ts`.

### Entfernen
- Helper `fetchKundenLogoDataUrl(kunde)` (Zeilen 106–123).
- Import `kundeLogoUrl` aus `@/hooks/useApi` (Zeile 14) — nicht mehr genutzt.
- Parameter `kundenLogo: string | null` aus der `buildDoc`-Signatur (Zeile 555).
- Der `kundenLogo ? [...] : []`-Block in der `kundeColumn`-Stack (Zeilen 565–573).
- Aufrufe `const kundenLogo = await fetchKundenLogoDataUrl(kunde);` und das `kundenLogo`-Argument in `generateAngebotPdf` (Zeilen 677, 693) und `generateRechnungPdf` (Zeilen 720, 758).

### Bleibt unverändert
- Firmen-Logo (`resolveLogo` + `header`) — rechts oben.
- Backend-PDF (`backend/src/pdf/*`) rendert ohnehin kein Kunden-Logo.
- Werkzeuge (`werkzeugePdf.ts` — Übergabeprotokoll, Schlüsselübergabe) verwenden ohnehin nur das Firmen-Logo. Keine Änderung nötig.
- `KundeLogo`-Komponente, Upload-Dialog, Kunden-Detailseite, `hasLogo`-Feld, Backend-Endpoint `/kunden/:id/logo` — alle bleiben, weil das Kunden-Logo weiterhin in der App-UI (Kunden-Übersicht/-Detail) zur Wiedererkennung gezeigt wird. Nur aus dem PDF fliegt es raus.

## Out of Scope
- Keine Backend-Änderungen.
- Keine Schema-/Migrations-Änderungen.
- Keine UI-Änderungen.
