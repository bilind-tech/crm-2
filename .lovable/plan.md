# Plan: Backup & Restore finalisieren

## Leitprinzip (unverhandelbar)

**Daten-Verzeichnis (`/var/lib/mycleancenter/`) wird NIE durch Code-Updates oder durch irgendeinen Prozess außerhalb des kontrollierten Restore-Flows verändert.** Updates ersetzen ausschließlich `/opt/mycleancenter/current/`. Vor jedem Update UND vor jedem Restore wird automatisch ein Sicherheits-Backup erzeugt. Beides ist heute schon im Code (`pre-update`/`pre-restore`), wird aber im Plan hart abgesichert.

## Aktueller Stand (kurz)

Backend hat bereits: `createBackup`, `restoreFromArchive`, Rotation (Daily/Weekly/Monthly), node-cron Scheduler, Maintenance-Mode, Manifest mit Schema-Version, Upload+Restore eines mitgebrachten Archivs, Passwort-Re-Auth für Restore, Audit-Log, Progress-Polling. Frontend hat BackupTab, RestoreBackupDialog, BackupUploadDropzone.

## Lücken / Schwachstellen

1. **Daten-Schutz-Garantie nicht hart erzwungen** — `system/runner.ts` (Update-Flow) hat theoretisch FS-Zugriff auf `dataDir`. Es gibt keinen Guard, der das verbietet.
2. **`master.key`-Swap im Restore ist riskant**: Wenn das einzuspielende Backup einen anderen Key trägt als die aktuell im Filesystem liegenden Uploads → nach Rollback bei späterem Fehler könnten Uploads/DB inkonsistent sein. Lösung: Key NUR überschreiben, wenn das Backup tatsächlich einen mitbringt UND der Restore vollständig durchläuft.
3. **SHA256 wird beim Upload-Restore nicht verifiziert** (nur Magic-Bytes + Manifest).
4. **Drive-Mirror ist nur UI-Toggle**, kein Code lädt fertige Backups nach Drive.
5. **`reconcileDiskState()` wird nie aufgerufen** → DB-Geister bleiben.
6. **`safeRm(workDir)` per `setTimeout(24h)` überlebt keinen Restart** → tmp/-Müll sammelt sich.
7. **Kein Boot-Health-Check**: „Letztes erfolgreiches Backup älter als X Tage" wird nicht gemeldet.
8. **Restore-Fortschritt** wird gepollt statt via SSE gepusht (UX okay, aber unrund).
9. **App-Version-Mismatch** beim Restore wird nicht gewarnt (nur Schema-Downgrade blockiert).
10. **Frontend-Stub-Hinweis** im BackupTab ist veraltet — Backend ist real.

## Was wir bauen

### 1. Daten-Schutz-Wall (höchste Prio)

- Neues Modul `backend/src/system/data-guard.ts`: exportiert `assertNotInDataDir(p)` — wirft, wenn ein Pfad innerhalb `config.dataDir` liegt.
- `system/runner.ts` (Update-Flow): an jeder FS-Mutation (`copyFileSync`, `renameSync`, `rmSync`, `writeFileSync`, `unlinkSync`) Aufrufer-Pfad durch `assertNotInDataDir` schicken. Whitelist nur: `tmpDir`, `currentDir`, `previousDir` unter `/opt/mycleancenter/`.
- Beim Boot: `assertCodeAndDataSeparated()` prüft `config.dataDir` ≠ Code-Pfad und loggt im Audit.
- Doku-Kommentar oben in `restore.ts`, `create.ts`, `system/runner.ts`: „NIE Daten außerhalb des kontrollierten Flows berühren".

### 2. Restore härter machen

- `restore.ts`: `master.key` nur swappen, wenn das Backup eine `keys/master.key` mitbringt UND sie sich vom aktuellen Key unterscheidet. Bei identischem Hash: gar nicht anfassen.
- Vor Swap: `manifest.dbSha256` gegen frisch entpackte `db/mycleancenter.db` verifizieren — bei Mismatch sofort abbrechen, vor dem ersten Swap.
- `app-version`-Mismatch: WARN ins Audit + im Restore-Dialog im Frontend als gelber Hinweis („Backup wurde mit v0.1.7 erstellt, läuft auf v0.2.0 — empfohlen, aber prüfe nach Restore"). Kein Hard-Block.
- Boot-Hook `cleanupOrphanRestoreTmp()`: löscht alle `restore-*` Ordner in `backupsTmpDir`, die älter als 24h sind. Ersetzt das verlorene `setTimeout`.

### 3. Upload-Restore: SHA256 verifizieren

- `routes/backup.ts` POST `/backup/upload`: nach Magic-Bytes + Manifest auch `sha256` der hochgeladenen Datei berechnen und im Response zurückgeben. Auf Wunsch im Dialog anzeigen.
- POST `/backup/upload/:uploadId/restore`: bevor `restoreFromArchive` startet, optional Manifest-`dbSha256` gegen DB-Datei nach Extract prüfen (passiert bereits in (2)).

### 4. Drive-Mirror für Backups

- Setting `backup.driveMirror` (boolean) bereits im UI vorhanden → Backend-Schema in `settings/schemas.ts` ergänzen falls fehlt.
- Nach erfolgreichem `createBackup`: wenn `driveMirror=true` UND Drive verbunden → Job `mirrorBackupToDrive(id)` in die bestehende Drive-Upload-Queue einreihen. Zielordner: `mycleancenter.cm/Backups/{YYYY}/{MM}/`. Dateiname = lokaler Dateiname.
- Status pro Backup-Eintrag: `driveStatus: "pending" | "synced" | "skip" | "error"` — neue Spalte in `backup_history` via Migration `005_backup_drive.sql`.
- Frontend: kleines Cloud-Icon pro Backup-Zeile (synced=grün, pending=spin, error=rot mit Retry-Button).
- Wichtig: Drive-Fehler darf das lokale Backup NIE als „failed" markieren.

### 5. Reconcile + Health

- `startScheduler()` ruft beim Boot `reconcileDiskState()` und `cleanupOrphanRestoreTmp()`.
- Neuer Cron `0 3 * * *`: `reconcileDiskState()` täglich.
- `/backup/health` (auth): liefert `{ letztesErfolgreichesBackup, alterStunden, warn: alterStunden > 36 }`. Frontend zeigt Warn-Badge in BackupStatusCard.

### 6. Restore-Fortschritt via SSE

- `events/bus.ts` bekommt Channel `restore:progress`. `setRestorePhase` emittiert zusätzlich zum Memory-Store auch ein SSE-Event.
- Frontend `useRestoreStatus` bleibt als Fallback-Polling, aber `useLiveEvents` reagiert auf `restore:progress` und invalidiert. Polling-Intervall hoch auf 3s.

### 7. Frontend-Aufräumen

- BackupTab: Stub-Kommentar entfernen.
- RestoreBackupDialog: gelben Versions-Mismatch-Hinweis aus Manifest anzeigen (Feld kommt aus Upload-Response bzw. Detail-Endpoint).
- BackupStatusCard: „Letztes Backup vor Xh" + Warn-Badge bei >36h.
- Drive-Status-Icons in Backup-Liste.

### 8. Tests / Audit

- Manueller End-to-End-Durchlauf in der Doku (`mem://features/backup-rotation` aktualisieren):
  1. Backup → Download → DB+Uploads ändern → Restore aus Datei → Stand korrekt.
  2. Restore mit kaputtem tar.gz → Rollback, Uploads unverändert.
  3. Restore mit Schema-Downgrade → blockiert.
  4. Update mit `data-guard` aktiv → Versuch FS-Write nach `/var/lib/...` wirft.
  5. Drive-Mirror an → Upload erscheint in Drive-Ordner.

## Reihenfolge der Umsetzung

1. Data-Guard + Boot-Asserts (Daten-Schutz-Wall) — kritisch.
2. Restore-Härtung (Key-Swap + SHA-Verify + Cleanup-on-Boot).
3. Upload-SHA + Versions-Hinweis Frontend.
4. Reconcile-Cron + `/backup/health`.
5. Drive-Mirror (Migration + Queue-Job + UI-Icons).
6. SSE-Progress.
7. Frontend-Aufräumen + Memory-Update.

## Geänderte / neue Dateien

**Neu**: `backend/src/system/data-guard.ts`, `backend/src/db/migrations/005_backup_drive.sql`, `backend/src/backup/drive-mirror.ts`, `backend/src/backup/health.ts`, `backend/src/backup/cleanup.ts`.

**Edit**: `backend/src/backup/restore.ts`, `backend/src/backup/create.ts`, `backend/src/backup/scheduler.ts`, `backend/src/backup/repo.ts`, `backend/src/routes/backup.ts`, `backend/src/system/runner.ts`, `backend/src/settings/schemas.ts`, `backend/src/events/bus.ts`, `src/components/einstellungen/BackupTab.tsx`, `src/components/einstellungen/RestoreBackupDialog.tsx`, `src/hooks/useApi.ts`, `src/hooks/useLiveEvents.ts`, `src/lib/api/types.ts`, `mem://features/backup-rotation`.

Sag „weiter" / „Approved", dann setze ich Schritt 1+2 (Data-Guard + Restore-Härtung) zuerst um — das ist der sicherheitskritische Kern.