---
name: Google Drive Integration
description: OAuth-Flow im Backend, Tokens verschlüsselt in einstellungen, automatischer PDF-Upload mit Queue, Frontend-Connect mit Client-ID/Secret + Sync-Sektion
type: feature
---

# Google Drive

## OAuth-Flow
1. User öffnet Einstellungen → Google Drive → „Mit Google verbinden"
2. ConnectDialog: Felder **Client-ID** + **Client Secret** + kopierbare Redirect-URI (`{BACKEND_URL}/einstellungen/google-drive/callback`); kurze 3-Schritt-Anleitung zur Cloud Console
3. Beim Klick: `PATCH /einstellungen/google-drive` (Secret nur wenn neu) → `POST /einstellungen/google-drive/connect` liefert `{ authorizeUrl }` → `window.open(authorizeUrl, "_blank")`
4. Google → `GET /einstellungen/google-drive/callback?code=…` → Backend tauscht Code gegen Refresh-Token, AES-GCM-verschlüsselt gespeichert → Redirect zu `/einstellungen?tab=drive&status=ok|err&msg=…`
5. Page-Komponente liest Query, zeigt Toast (success/error), entfernt Params via `history.replaceState`, ConnectDialog schließt sich, sobald `verbunden===true`
6. Status geräteübergreifend (Desktop, Handy, alle Browser im LAN)

## Ordnerstruktur
- Root-Ordner `mycleancenter.cm` (einmalig auto-erstellt, ID gecached)
- `Rechnungen/{YYYY}/{MM}/`, `Angebote/{YYYY}/{MM}/`, `Dokumente/{YYYY}/{MM}/`
- Monat/Jahr live aus aktuellem Datum

## Dateiname-Schema
`{nummer} {kunde} {leistung} {MM}-{YYYY}.pdf`

## Upload-Queue (Tabelle `drive_upload_queue`)
- Idempotenz-Key: `belegnummer + sha256(pdf)`
- Retry: Exponential-Backoff (1m, 5m, 15m, 1h, 4h, 24h, dann `manuell`)
- Status: `pending` / `running` / `erfolg` / `fehler` / `manuell`
- Backend-Events: `drive:hochgeladen`, `drive:fehler`, `drive:upload-changed`

## Frontend-Sync-Sektion (GoogleDriveTab)
- Sichtbar nur wenn `verbunden===true`
- Hooks: `useDriveUploads()` (refetch 4 s solange pending/running), `useRetryDriveUpload()`
- Counter-Pills: läuft / Warteschlange / erfolgreich / manuell / Fehler
- Liste der `fehler`+`manuell`-Einträge (max 5, „Alle anzeigen"): Dateiname, Beleg-Typ, Versuche, Fehlertext truncated, Buttons „In Drive öffnen" + „Erneut"
- Sonst: „Alles synchron"-Zeile

## SSE-Reducer (`useLiveEvents`)
- `drive:hochgeladen` + `drive:upload-changed` → invalidiert `["drive","uploads"]`, `qk.einstellungen.googleDrive`, `["aktivitaeten"]`. Kein Toast.
- `drive:fehler` → gleiche Invalidierung; bei `final===true` Toast `warning`, **maximal 1× pro 60 s** (Modul-Throttle `lastDriveErrToast`)

## Mock
- `POST /einstellungen/google-drive/connect` → `{ authorizeUrl: "/einstellungen?tab=drive&status=ok&mock=1" }`
- `GET /einstellungen/google-drive/mock-callback` schaltet `verbunden=true` (vom Page-Effect getriggert wenn `mock=1`)
- `GET /drive/uploads` + `POST /drive/uploads/:id/retry` mit 2 Beispiel-Einträgen (1× erfolg, 1× manuell mit Fehlertext)

## Wichtig
- Tokens NIEMALS loggen
- Client-Secret nur überschreibend (PATCH ohne Feld = unverändert); Frontend zeigt „bereits hinterlegt"
- Bei Token-Refresh-Fehler → Status auf `disconnected`, User-Notification
