---
name: System-Update
description: ZIP-Upload, Manifest-Check, Zwangs-Backup, atomarer Symlink-Switch, Healthcheck-Auto-Rollback
type: feature
---

# System-Update (Step 9)

## Pipeline
1. Frontend lädt ZIP hoch (`POST /system/update/validate` zur Vorab-Prüfung)
2. Manifest validieren (Signatur, min. Schema-Version, App-Version)
3. **Zwangs-Sicherheits-Backup** (Step-3-Backup-Lib, Type=`safety`)
4. ZIP nach `versions/<timestamp>/` entpacken
5. `npm ci --omit=dev` im neuen Ordner
6. **Migrations-Probelauf** gegen Kopie der DB — nur bei Erfolg fortfahren
7. Symlink atomar umlegen: `ln -sfn versions/<ts> current.tmp && mv -T current.tmp current`
8. systemd reload
9. Healthcheck alle 5s, max 60s — bei Fail automatischer Rollback (Symlink zurück)
10. Nur 1 Vorgänger-Version behalten, ältere `versions/` löschen

## Daten-Garantie
`/var/lib/mycleancenter/` wird in keinem Schritt angefasst. Update = nur Symlink + Code-Ordner.

## Rollback
- Manuell aus UI (`POST /system/update/rollback`)
- Automatisch bei Healthcheck-Fail
- Symlink zurück + systemd reload + Sicherheits-Backup bleibt erhalten

## UI (Frontend existiert)
Live-Steps mit Progress + aktueller Phase. Bei Rollback klare Meldung.
