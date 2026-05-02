## Ziel

Zwei robuste, ineinandergreifende System-Funktionen — komplett im Frontend simuliert, mit klaren Backend-Stub-Kommentaren, damit die Pi-Anbindung später ohne UI-Änderung funktioniert:

1. **Backup mit Rotation + Restore** — automatisches Tages-/Wochen-/Monats-Backup, sichtbare Historie mit echtem Status, Wiederherstellen aus Liste oder hochgeladener Datei. Anzeige nur, wenn Backup wirklich abgeschlossen ist.
2. **System-Update per ZIP/Ordner-Upload** — neuer Code wird hochgeladen, validiert, in Quarantäne geprüft, mit Migrations versehen, atomar umgeschaltet, ein-Klick-Rollback. Daten werden nie angefasst.

Beides als Tabs in `Einstellungen → System`.

---

## 1. Backup & Restore — Erweiterung des bestehenden BackupTab

**Datei:** `src/components/einstellungen/BackupTab.tsx` (neu strukturieren)

### 1.1 Status-Karte oben (neu)

Großer, beruhigender Status-Block als erstes Element — beantwortet sofort: *„Ist meine letzte Sicherung sauber durchgelaufen?"*

```
┌────────────────────────────────────────────────┐
│ ✓  Letztes Backup erfolgreich                  │
│    heute, 03:00 Uhr · vor 11 Stunden · 12,4 MB │
│    data-2026-05-02.sqlite.gz                   │
│                                                │
│    Nächstes Backup: heute, 03:00 Uhr           │
└────────────────────────────────────────────────┘
```

Status-Logik:
- **Grün ✓** wenn jüngstes Backup `status: "erfolg"` UND nicht älter als 25 h
- **Gelb ⚠** wenn jüngstes Backup älter als 25 h (Backup hat aussetzt)
- **Rot ✕** wenn jüngstes Backup `status: "fehler"`
- **Grau** wenn noch nie ein Backup gemacht wurde

> **WICHTIG (User-Anforderung):** Ein Backup-Eintrag taucht in der Liste & im Status NUR AUF, wenn `status === "erfolg"` UND `abgeschlossenAm !== null`. Solange der Backup-Vorgang läuft, wird er als separater „in Arbeit"-Indikator gezeigt, nicht als fertiges Backup.

### 1.2 Backup-Rotation statt einfacher Liste

Datenmodell-Erweiterung in `src/lib/api/types.ts`:

```ts
export type BackupKategorie = "daily" | "weekly" | "monthly" | "manuell" | "pre-restore" | "pre-update";

export interface BackupEintrag {
  id: string;
  kategorie: BackupKategorie;
  dateiname: string;            // z.B. "data-2026-05-02.sqlite.gz"
  zeitpunktStart: string;       // ISO — wann angefangen
  abgeschlossenAm: string | null; // ISO — wann fertig (null = noch in Arbeit)
  status: "in_arbeit" | "erfolg" | "fehler";
  groesseBytes: number;
  fehler?: string;
  ausloeser: "auto" | "manuell" | "vor-restore" | "vor-update";
  // Drive-Spiegel (optional)
  driveStatus?: "pending" | "synced" | "error";
}
```

Anzeige als drei zusammenhängende Listen mit Headern:
- **Letzte 7 Tage** (daily)
- **Letzte 4 Wochen** (weekly, Sonntags)
- **Letzte 12 Monate** (monthly, 1. des Monats)

Plus separater Bereich für „Sonderbackups" (manuell, pre-restore, pre-update) — die haben keine Rotation, werden nach 30 Tagen gelöscht.

Jeder Eintrag zeigt: Datum/Uhrzeit, Größe, Drive-Sync-Indikator (klein, dezent), und zwei Aktionen: **⬇ Herunterladen** und **↺ Wiederherstellen**.

### 1.3 Einstellungen-Block (überarbeitet)

```
Auto-Backup aktiv      [Switch]
Uhrzeit                03:00
Aufbewahrung           [Daily 7] [Weekly 4] [Monthly 12]   ← drei Felder
Zielordner (Pi)        /var/lib/mycleancenter/backups/
Drive-Spiegel aktiv    [Switch]   ← Backups zusätzlich nach Drive
```

### 1.4 „Jetzt sichern" mit Live-Fortschritt

Klick auf „Jetzt sichern" → erscheint sofort als „in Arbeit"-Eintrag oben mit Spinner:

```
⏳  Backup läuft …  (gestartet vor 3 Sekunden)
    ━━━━━━━━━━━━░░░░░░░ 60 %
```

Erst wenn Backend `abgeschlossenAm` setzt UND `status: "erfolg"`, springt der Eintrag in die Liste und Status-Karte wird grün. Bei Fehler: rot + Fehlermeldung.

### 1.5 Restore-Flow (3 Varianten)

**Variante A — Aus Historie wiederherstellen:**

Klick „↺" auf ein Backup → großer Sicherheitsdialog:

```
⚠  Backup wiederherstellen?

   Du wirst alle Daten auf den Stand vom
   30.04.2026, 03:00 Uhr zurücksetzen.

   ALLE Änderungen seit diesem Backup
   gehen verloren (12 Kunden, 47 Rechnungen,
   23 Zahlungen).

   Sicherheitsbackup wird automatisch erstellt,
   du kannst danach jederzeit wieder zurück.

   [Abbrechen]   [Ja, wiederherstellen]
```

Beim Bestätigen:
1. Eingabe-Bestätigung („Tippe **WIEDERHERSTELLEN** ein")
2. Sicherheits-Backup mit `kategorie: "pre-restore"` anlegen → in Liste sichtbar
3. Restore ausführen
4. Toast „Wiederhergestellt: Stand 30.04.2026, 03:00 Uhr"
5. Seite neu laden, damit alle Daten frisch sind

**Variante B — Backup-Datei hochladen und einspielen:**

Eigener Bereich **„Backup-Datei einspielen"** mit Drag & Drop für `.sqlite` / `.sqlite.gz` / `.db`:

```
┌────────────────────────────────────────────────┐
│   📁  Backup-Datei hier ablegen                │
│       oder klicken zum Auswählen               │
│                                                │
│       Akzeptiert: .sqlite, .sqlite.gz, .db     │
│       Maximal 500 MB                           │
└────────────────────────────────────────────────┘
```

Nach Upload: Vorschau-Karte mit Datei-Info (Größe, vermutetes Datum aus Dateiname, „enthält X Kunden / Y Rechnungen" wenn das Backend das vorher analysiert), dann gleicher Sicherheitsdialog wie A.

**Variante C — Backup herunterladen:**

Knopf an jedem Eintrag → lädt die `.sqlite.gz` direkt. Ist die einfache Standard-Aktion.

### 1.6 Frontend-Stub-Verhalten

Da Backend noch nicht da ist, simuliert `src/lib/mock/backend.ts`:
- Beim Klick „Jetzt sichern": `in_arbeit`-Eintrag anlegen, nach 1,5 s auf `erfolg` setzen mit zufälliger Größe
- Beim Restore: 1 s warten, dann Toast (keine echte Daten-Manipulation)
- Beim Upload: Datei lokal lesen, Größe anzeigen, beim Bestätigen: nur Toast
- Initiale Mock-Historie: 7 daily, 4 weekly, 12 monthly

Im Code: dicker Kommentar-Block am Anfang der Datei mit Erklärung, was das Pi-Backend später machen muss (sqlite3 `.backup`-API, gzip, fs.rename, schema_migrations check).

---

## 2. System-Update (neuer Tab)

**Neue Dateien:**
- `src/components/einstellungen/SystemUpdateTab.tsx`
- `src/lib/api/types.ts` (Erweiterung um Update-Typen)
- `src/hooks/useApi.ts` (neue Hooks: `useSystemInfo`, `useUploadUpdate`, `useInstallUpdate`, `useRollbackUpdate`, `useUpdateHistorie`)
- `src/lib/mock/backend.ts` (Mock-Endpunkte)

**Im `einstellungen.tsx`:** neuer Tab-Eintrag in Gruppe „System":
```
{ id: "system-update", label: "System & Updates", icon: Package, gruppe: "System" }
```

### 2.1 Tab-Aufbau

**Bereich 1: Aktuelle Version**

```
┌────────────────────────────────────────────────┐
│  myCleanCenter CRM                             │
│  Version 1.4.2                                 │
│  Installiert am 28.04.2026, 14:22 Uhr          │
│                                                │
│  Stack: Node 20 · SQLite 3.45 · Pi 5 (8 GB)    │
└────────────────────────────────────────────────┘
```

**Bereich 2: Update einspielen**

Drag & Drop für ZIP-Datei oder Ordner (Browser können Ordner per `webkitdirectory` annehmen):

```
┌────────────────────────────────────────────────┐
│   📦  ZIP- oder Ordner-Datei hier ablegen      │
│       oder klicken zum Auswählen               │
│                                                │
│       Akzeptiert: .zip oder Code-Ordner        │
│       Maximal 200 MB                           │
└────────────────────────────────────────────────┘
```

Nach Upload: **Validierungs-Vorschau** (vor dem eigentlichen Install):

```
┌────────────────────────────────────────────────┐
│  📦  mycleancenter-1.5.0.zip   12,8 MB        │
│                                                │
│  Validierung:                                  │
│   ✓ Gültiges Update-Paket                      │
│   ✓ Versionsnummer: 1.5.0  (aktuell: 1.4.2)    │
│   ✓ package.json gefunden                      │
│   ✓ 2 neue Migrations werden ausgeführt:       │
│       • 005_add_property_address_history       │
│       • 006_add_email_attachments              │
│   ⚠ Backend-Service wird ~10 s neu starten     │
│                                                │
│  Vor dem Update wird automatisch ein           │
│  Sicherheitsbackup erstellt.                   │
│                                                │
│  [Abbrechen]    [⚡ Update installieren]       │
└────────────────────────────────────────────────┘
```

Bei Validierungs-Fehler (z. B. ZIP unvollständig, ältere Version):
```
✕ Update kann nicht installiert werden
   Grund: Dies scheint kein gültiges
   myCleanCenter-Update zu sein. (package.json fehlt)
```

### 2.2 Live-Installations-Fortschritt

Nach Klick auf „Update installieren" → Modal mit Step-Liste, **garantiert in Reihenfolge**, jeder Step bestätigt sich erst wenn echt fertig:

```
Update wird installiert …

  ✓  ZIP entpackt
  ✓  Sicherheits-Backup erstellt (data-pre-update-...)
  ✓  Code in Quarantäne kopiert
  ⏳  npm install läuft … (45 / 120 Pakete)
  ○  Migrations ausführen
  ○  Service neu starten
  ○  Smoke-Test

Bitte Browser nicht schließen.
```

Bei Erfolg → Bestätigungs-Screen:
```
✓  Update auf Version 1.5.0 erfolgreich
   Installiert in 2 min 14 s.

   [App neu laden]
```

Beim Klick: Browser-Reload, neue Version aktiv.

Bei Fehler → automatisches Rollback wird angezeigt:
```
✕  Update fehlgeschlagen bei Schritt „Migrations"
   Fehler: column "drive_id" already exists

   ↺  Rollback auf Version 1.4.2 läuft …
   ✓  Rollback erfolgreich. App läuft wie vorher.

   [Schließen]
```

### 2.3 Update-Historie & Manuelles Rollback

```
Bisherige Versionen
─────────────────────────────────────────
  1.4.2  ●  aktiv          28.04.2026
  1.4.1  ○  Rollback verfügbar  [↺]   15.04.2026
  1.4.0     archiviert         02.04.2026
```

Nur die direkt vorherige Version hat „Rollback verfügbar" (Pi behält 1 Vorgänger-Code-Ordner). Klick → Sicherheitsdialog → gleicher Step-Fortschritt rückwärts.

### 2.4 Datentypen

```ts
// src/lib/api/types.ts
export interface SystemInfo {
  appName: string;
  version: string;
  installedAt: string;
  node: string;
  sqlite: string;
  hardware: string;
}

export interface UpdatePackageInfo {
  version: string;
  fileName: string;
  sizeBytes: number;
  pendingMigrations: string[];
  warnings: string[];
  valide: boolean;
  fehlerGrund?: string;
}

export type UpdateStepId =
  | "entpacken" | "backup" | "quarantaene" | "install"
  | "migrations" | "neustart" | "smoketest";

export interface UpdateStepStatus {
  id: UpdateStepId;
  label: string;
  status: "wartet" | "laeuft" | "ok" | "fehler";
  detail?: string;       // z.B. "45 / 120 Pakete"
  fehlerGrund?: string;
}

export interface UpdateLauf {
  id: string;
  von: string;           // Vorherige Version
  zu: string;            // Neue Version
  startetAm: string;
  beendetAm: string | null;
  status: "laeuft" | "erfolg" | "fehler" | "rollback";
  steps: UpdateStepStatus[];
}

export interface InstallierteVersion {
  version: string;
  installedAt: string;
  istAktiv: boolean;
  rollbackVerfuegbar: boolean;
}
```

### 2.5 Mock-Backend Verhalten

In `src/lib/mock/backend.ts`:
- `POST /system/update/validate` (Multipart) → liest Datei, simuliert Validierung in 800 ms, gibt `UpdatePackageInfo` zurück
- `POST /system/update/install` → liefert `updateLaufId`, dann simuliert Steps mit realistischen Delays (entpacken 500 ms, backup 1 s, install 8 s mit Pakete-Counter, migrations 1 s, neustart 2 s, smoketest 1 s)
- `GET /system/update/lauf/:id` → polling-Endpunkt für Live-Fortschritt
- `POST /system/update/rollback/:version` → simuliert Rollback in 5 s
- `GET /system/info` → Mock-Werte
- `GET /system/update/historie` → Mock-Liste mit 3 Versionen

Polling-Intervall im Frontend: 500 ms während laufendem Update via React-Query `refetchInterval`.

### 2.6 Sicherheits-Garantien (Code-Kommentare)

Großer Datei-Header in `SystemUpdateTab.tsx`:

```
// FRONTEND-STUB-HINWEIS:
// Aktuell wird kein echtes Update installiert. Die Steps sind simuliert.
//
// Das spätere Pi-Backend (POST /system/update/install) MUSS:
//   1. Code/Daten-Trennung respektieren — DATA_DIR niemals anfassen
//   2. Vor jedem Schritt logging in update_runs-Tabelle
//   3. Sicherheits-Backup VOR npm install (nicht erst danach)
//   4. Atomar umschalten via fs.rename (kein cp -r mid-flight)
//   5. Bei JEDEM Fehler: alten Code zurück-rename, Service starten,
//      Fehler an Frontend zurückgeben
//   6. Update-Endpunkt nur für authentifizierte Admin-User
//   7. Datei-Upload max 200 MB, Zip-Bomb-Schutz beim Entpacken
//   8. Migrations idempotent (schema_migrations-Tabelle prüft was schon lief)
```

---

## 3. Datenfluss-Übersicht

```
Backup-Status-Karte
        ↑ liest aus
        │
useBackupHistorie()  ──────►  GET /backup/historie
        │                      └─ Mock liefert nur Einträge mit
        │                         status="erfolg" UND abgeschlossenAm!=null
        │                         für die Hauptliste
        │
useCreateBackup()    ──────►  POST /backup/erstellen
        │                      └─ Mock: in_arbeit-Eintrag → 1.5s → erfolg
        │
useRestoreBackup()   ──────►  POST /backup/restore/:id
        │                      └─ Mock: legt pre-restore-Backup an, Toast
        │
useUploadBackup()    ──────►  POST /backup/upload  (multipart)
        │                      └─ Mock: validiert Dateiname, Toast
        │
useDownloadBackup()  ──────►  GET /backup/:id/download
                               └─ Mock: erzeugt Dummy-Blob
```

---

## 4. Files-Plan

**Neu:**
- `src/components/einstellungen/SystemUpdateTab.tsx` — kompletter Update-Tab inkl. Live-Fortschritt-Modal
- `src/components/einstellungen/RestoreBackupDialog.tsx` — wiederverwendbar für Variante A & B
- `src/components/einstellungen/BackupUploadDropzone.tsx` — Drag & Drop für `.sqlite(.gz)`
- `src/components/einstellungen/UpdateUploadDropzone.tsx` — Drag & Drop für `.zip` / Ordner

**Edit:**
- `src/components/einstellungen/BackupTab.tsx` — neue Status-Karte oben, Rotations-Listen, In-Arbeit-Indikator, Restore-Buttons, Upload-Bereich
- `src/lib/api/types.ts` — neue Typen `BackupEintrag` (erweitert), `SystemInfo`, `UpdatePackageInfo`, `UpdateStepStatus`, `UpdateLauf`, `InstallierteVersion`
- `src/hooks/useApi.ts` — neue Hooks: `useRestoreBackup`, `useUploadBackup`, `useDownloadBackup`, `useSystemInfo`, `useValidateUpdate`, `useInstallUpdate`, `useUpdateLauf` (mit Polling), `useUpdateHistorie`, `useRollbackUpdate`
- `src/lib/mock/backend.ts` — alle neuen Endpunkte plus realistische Mock-Daten
- `src/routes/einstellungen.tsx` — neuer Tab-Eintrag „System & Updates"

**Memory:** nach Approval lege ich `mem://features/backup-rotation` und `mem://features/system-update` an, plus Core-Regel zur Code/Daten-Trennung.

---

## 5. Was wir bewusst NICHT tun (Scope-Grenzen)

- Keine echte Datei wird auf der Disk verändert (alles Mock)
- Keine echten npm-Installs
- Kein echtes Entpacken von ZIPs (nur Datei-Metadaten lesen)
- Kein Auto-Update aus GitHub (das wäre Phase 2)
- Keine Restore-Funktion, die wirklich Daten überschreibt — der Mock zeigt nur den Flow

Aber: **alle UI-States, Fortschritte, Fehlerpfade, Rollback-Animationen und Sicherheitsdialoge sind voll funktionsfähig** — du kannst alles durchklicken wie in der echten App. Sobald das Pi-Backend die gleichen Endpunkte liefert, schwenkt alles ohne UI-Änderung um.
