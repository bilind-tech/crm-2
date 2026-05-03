## Problem

Wenn man im EmailVersandDialog auf „Senden" klickt, meldet die App „E-Mail versendet" — auch wenn in den Einstellungen noch gar kein SMTP-Server, Benutzer oder Passwort hinterlegt ist. Grund: Das Mock-Backend (`src/lib/mock/backend.ts`, Route `POST /email/versand`) simuliert blind ~90 % Erfolg und ignoriert komplett, ob SMTP überhaupt konfiguriert ist. Das echte Backend (Pi/Fastify) prüft das ebenfalls nicht hart genug vor dem Senden.

Bei einem Feature, über das aktiv mit Kunden kommuniziert wird, ist das ein No-Go. Es darf nie eine Erfolgsmeldung erscheinen, wenn nichts gesendet wurde.

## Lösung — drei Verteidigungslinien

### 1. UI: Versand-Button prüft SMTP vor dem Klick

Im `EmailVersandDialog.tsx`:
- `useSmtp()` mitladen.
- Senden-Button deaktivieren, wenn `!(smtp?.server && smtp?.benutzer && smtp?.passwortGesetzt)`.
- Klar sichtbarer Warn-Banner oben im Dialog mit Link zu Einstellungen → E-Mail, sobald SMTP unvollständig.
- Auch dort, wo der Dialog geöffnet wird (z. B. auf Rechnungs-/Angebot-Detailseite), wird zusätzlich kein „Erfolg" mehr suggeriert, falls Versand technisch nicht möglich.

### 2. Mock-Backend: liefert echten Fehler zurück, statt Erfolg vorzutäuschen

In `src/lib/mock/backend.ts` (Route `POST /email/versand`):
- Vor jeder Simulation prüfen: `d.smtp.server`, `d.smtp.benutzer`, `d.smtp.passwortGesetzt`. Wenn etwas fehlt → sofort `EmailVersand` mit `status: "failed"` und konkretem `fehlerGrund` zurückgeben („SMTP nicht konfiguriert. Bitte unter Einstellungen → E-Mail Server, Benutzer und Passwort hinterlegen."). Kein Aktivitäts-Log, kein Statuswechsel am Beleg.
- Die existierende 90/10-Zufallssimulation bleibt nur für den Fall, dass SMTP vollständig konfiguriert ist (so bleibt das Mock-Verhalten realistisch, aber niemals fälschlich „grün").

### 3. Echtes Backend (Fastify): hartes Pre-Check vor `enqueueVersand`

In `backend/src/routes/email.ts` (POST `/email/versand`):
- Vor dem Enqueue die SMTP-Settings laden (`AREAS.smtp` + `SENSITIVE_KEYS.smtpPassword`).
- Wenn `host`, `user` oder `password` fehlen → mit HTTP 412 (Precondition Failed) und `{ error: "smtp-not-configured", message: "..." }` antworten. Kein Datenbank-Eintrag, kein Logging als „pending".
- Damit ist garantiert, dass auch bei direkter API-Nutzung keine Mail in den Versand-Queue rutscht, solange SMTP nicht steht.

### 4. Frontend reagiert sauber auf den Fehler

`useSendEmail`/`EmailVersandDialog`:
- Wenn der Server `status: "failed"` (Mock) oder HTTP 412 (echtes Backend) liefert, zeigt der Toast den exakten `fehlerGrund` („SMTP nicht konfiguriert …") und bietet einen direkten Link in die SMTP-Einstellungen.
- Der bisherige `toast.success("E-Mail versendet")` läuft nur noch, wenn `status === "sent"`.
- Dialog bleibt offen, damit der Nutzer korrigieren kann.

## Technische Details

| Datei | Änderung |
|---|---|
| `src/components/email/EmailVersandDialog.tsx` | SMTP-Prüfung hinzufügen, Warn-Banner, Senden-Button-Disable, Link zu Einstellungen, Erfolgstoast nur bei `sent`. |
| `src/lib/mock/backend.ts` (`POST /email/versand`) | Vorab-Check auf `d.smtp.server/benutzer/passwortGesetzt`. Bei Fehlen: `failed`-Antwort mit klarem `fehlerGrund`, ohne Statuswechsel/Aktivitätslog. |
| `backend/src/routes/email.ts` | Vor `enqueueVersand` SMTP-Settings prüfen → bei fehlender Konfig HTTP 412 mit `smtp-not-configured`. |
| (optional) `src/components/email/EmailEinstellungen.tsx` | Kleiner Hinweis: „Solange SMTP nicht vollständig ist, kann nichts versendet werden." |

## Was nicht geändert wird

- Bestehende Idempotenz-Logik (Doppelklick-Schutz) bleibt unverändert.
- Mahnstufen-Bestätigungs-Flow bleibt unverändert.
- Auto-E-Mail-Verbot (Memory-Regel) bleibt vollständig erhalten — Versand weiterhin nur per direktem User-Klick.
- Keine SMTP-Anbieter-Wahl: Strato/Nodemailer-Setup bleibt wie geplant.

## Ergebnis

Nach dem Update:
- „E-Mail versendet" erscheint **nur noch**, wenn die Mail tatsächlich rausging.
- Ohne SMTP-Konfiguration: Senden-Button ist aus, Banner erklärt warum, Klick (falls doch erzwungen) → klare Fehlermeldung mit direktem Sprung in die Einstellungen.
- Drei voneinander unabhängige Schichten (UI, Mock, echtes Backend) verhindern, dass je wieder ein falsches Erfolgs-Signal entsteht.
