---
name: Google Drive Integration
description: OAuth-Flow im Backend, Tokens verschlüsselt in einstellungen, automatischer PDF-Upload mit Queue
type: feature
---

# Google Drive

## OAuth-Flow (Step 6)
1. User klickt in Einstellungen → Google Drive → „Verbinden"
2. Frontend ruft `GET /einstellungen/google-drive/connect` → Backend liefert Authorize-URL
3. Browser-Redirect zu Google → User autorisiert
4. Google → `GET /einstellungen/google-drive/callback?code=…`
5. Backend tauscht Code gegen Refresh-Token + Access-Token
6. Refresh-Token wird AES-GCM-verschlüsselt in `einstellungen` gespeichert
7. Status `verbunden` ist in DB → geräteübergreifend sichtbar (Desktop, Handy, alle Browser im LAN)

## Ordnerstruktur
- Root-Ordner `mycleancenter.cm` (einmalig auto-erstellt, ID gecached)
- `Rechnungen/{YYYY}/{MM}/`
- `Angebote/{YYYY}/{MM}/`
- Monat/Jahr live aus aktuellem Datum (Monatswechsel automatisch)

## Dateiname-Schema
`{Belegnummer}_{Kundenname}_{Leistung-Kurz}_{MM-YYYY}.pdf`

## Upload-Queue (Tabelle `drive_upload_queue`)
- Idempotenz-Key: `belegnummer + sha256(pdf)`
- Retry mit Exponential-Backoff (1m, 5m, 15m, 1h, 4h, 24h, dann manuell)
- Status: pending / running / success / failed
- UI-Indikator klein/dezent (analog Backend-Status)

## Wichtig
- Tokens NIEMALS loggen
- Bei Token-Refresh-Fehler → Status auf `disconnected`, User-Notification
