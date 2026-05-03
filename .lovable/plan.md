# Plan 2 — Demo-Modus ehrlich machen (SMTP & E-Mail-Versand)

## Problem (was du erlebt hast)

Du hast SMTP konfiguriert, „Verbindung prüfen" → grün, „Test-Mail" → grüner Toast — aber **es ging keine echte Mail raus**, weil im Lovable-Preview der Mock-Backend antwortet, nicht Strato. Strato sieht nichts, dein Postfach kriegt nichts. Das Programm lügt freundlich.

Das passiert auch beim Rechnungs-Versand: der Mock antwortet `{ ok: true, messageId: "mock-…" }` und die UI zeigt „Mail versendet". In Wahrheit: nichts.

## Ziel

Im Demo-Modus (Lovable-Preview, kein Pi) sind **alle E-Mail-Aktionen ehrlich**: kein „Erfolg"-Toast, sondern ein deutlicher „Demo-Modus — kein echter Versand"-Hinweis. Sobald die Backend-URL gesetzt ist (Pi läuft), funktioniert alles ohne Code-Änderung sofort wie heute schon konzipiert.

## Erkennungsmerkmal Demo-Modus

`isBackendUrlExplicit()` aus `src/lib/api/backendUrl.ts` ist bereits da. `false` = User hat keine Pi-URL hinterlegt → wir laufen 100% gegen Mock → Demo-Modus.

## Konkrete Änderungen

### A. Mock-Antworten ehrlich machen
`src/lib/mock/backend.ts` — bei diesen Endpoints statt simuliertem „ok" einen klaren Demo-Hinweis zurückgeben:

| Endpoint | Heute (lügt) | Neu (ehrlich) |
|---|---|---|
| `POST /einstellungen/smtp/test` | „Konfiguration plausibel (Mock)." | `{ erfolg: false, demo: true, nachricht: "Demo-Modus — SMTP wird erst auf dem Pi geprüft. Kein echter Verbindungstest möglich." }` |
| `POST /email/verify` | `{ ok: true, latencyMs: 240 }` | `{ ok: false, demo: true, errorCode: "EDEMO", error: "Demo-Modus — echte SMTP-Verbindung erst nach Pi-Deployment." }` |
| `POST /email/test` | `{ ok: true, messageId: "mock-…" }` | `{ ok: false, demo: true, errorCode: "EDEMO", error: "Demo-Modus — Test-Mails werden erst auf dem Pi tatsächlich versendet." }` |
| `POST /email/versenden` (Beleg-Versand) | „in Warteschlange aufgenommen" | `{ ok: false, demo: true, errorCode: "EDEMO", error: "Demo-Modus — Mail wurde NICHT versendet. Aktiv erst nach Pi-Deployment." }` |

Wichtig: das `demo: true`-Flag dient als Marker, damit die UI einen anderen Look (blauer Info-Banner statt rot/grün) zeigen kann.

### B. UI passt sich an
- `EmailEinstellungen.tsx` (SmtpTab):
  - Oben permanenter blauer Demo-Banner, sichtbar nur wenn `!isBackendUrlExplicit()`. Text: „**Demo-Modus** — du arbeitest gerade ohne Pi-Backend. Eingaben werden lokal im Browser gespeichert, aber **kein echter SMTP-Test und kein echter Versand** sind möglich. Sobald der Pi läuft und die Backend-URL eingetragen ist, funktioniert alles sofort."
  - „Verbindung prüfen" und „Test-Mail senden" bleiben klickbar, zeigen aber bei Demo-Antwort einen `toast.info` (nicht `error`/`success`) mit der Demo-Message.
  - Status-Banner-Logik: bei `demo: true` → eigener neutraler Look (blau), nicht rot.
- `EmailVersandDialog.tsx`:
  - Wenn `!isBackendUrlExplicit()`: zusätzlich zum bestehenden SMTP-Banner ein blauer Demo-Hinweis am oberen Rand: „**Demo-Modus** — der Versand wird simuliert, aber nicht real ausgeführt."
  - Beim Klick „Senden": wenn Antwort `demo: true` → `toast.info` mit der Message, Dialog bleibt offen (kein „erfolgreich"-Schein).

### C. Wo es bleibt wie es ist
- Auf dem Pi (Backend-URL gesetzt) ändert sich **nichts**. Der echte Endpoint antwortet mit echtem `{ ok: true }` oder echtem Fehler — ohne `demo`-Flag.
- Speichern der SMTP-Felder im Demo-Modus bleibt erlaubt (nützlich, um die Konfiguration vorzubereiten und später aufs Pi zu spiegeln).
- Die Mahn-Cron / Auto-Versand-Sperren bleiben unangetastet.

## Geänderte Dateien

- `src/lib/mock/backend.ts` — 4 Endpoints umbauen (siehe Tabelle)
- `src/components/email/EmailEinstellungen.tsx` — Demo-Banner, Status/Toast für `demo: true`
- `src/components/email/EmailVersandDialog.tsx` — Demo-Banner, Senden-Toast für `demo: true`
- ggf. `src/hooks/useApi.ts` — falls `useVerifySmtp`/`useSendTestMail`/`useSendVersand` ein zusätzliches `demo`-Flag im Result-Typ brauchen, Typen erweitern

## Akzeptanzkriterien

1. **Lovable-Preview, „Verbindung prüfen"**: blauer Demo-Hinweis, kein grüner Erfolg-Toast.
2. **Lovable-Preview, „Test-Mail senden"**: blauer Demo-Hinweis, Toast `info`, kein „versendet".
3. **Lovable-Preview, Rechnung versenden**: Dialog zeigt Demo-Hinweis vor dem Klick und nach dem Klick einen klaren „nicht versendet"-Toast.
4. **Pi-Modus** (Backend-URL gesetzt): identisches Verhalten wie heute — echter Test, echter Versand, echte Erfolgs-/Fehlermeldungen.
5. Keine Veränderung an Backend-Code, Mahnsperren, Cron-Guards.

## Risiko

Sehr niedrig. Reines UI- + Mock-Refactor. Keine Datenbank-, keine echten Versand-Pfade berührt.

Sag „Go", dann setze ich Plan 2 in einem Rutsch um.
