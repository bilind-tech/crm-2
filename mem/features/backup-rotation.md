---
name: Backup & Rotation
description: tar.gz mit DB + uploads + master.key + manifest, Daily/Weekly/Monthly Rotation, strenger Restore-Flow
type: feature
---

# Backup & Rotation

## Datei-Struktur eines Backups (tar.gz)
```
backup-2026-05-02T030000.tar.gz
├── manifest.json
├── db/mycleancenter.sqlite        (via db.backup() API, konsistent)
├── uploads/                        (vollständig)
└── keys/master.key                 (sonst Settings nach Restore Müll)
```

## Manifest
```json
{
  "appVersion": "0.5.2",
  "schemaVersion": 12,
  "createdAt": "2026-05-02T03:00:00Z",
  "dbSha256": "…",
  "includedDirs": ["db","uploads","keys"],
  "type": "scheduled|manual|safety"
}
```

## Rotation
- Daily: 7 Stück (älter → gelöscht)
- Weekly: 4 Stück (jeden Sonntag aus dem jeweils neuesten Daily promoted)
- Monthly: 12 Stück (am 1. des Monats promoted)
- Safety: unbegrenzt (vor jedem Update + jedem Restore), älter als 90 Tage werden manuell aufgeräumt

## Cron
- Täglich 03:00, ENV-konfigurierbar

## Sichtbarkeitsregel (Frontend + Backend)
- Backups in Liste/Status NUR wenn `status === "erfolg"` UND `abgeschlossenAm != null`
- Sonst „in Arbeit"-Indikator getrennt

## Restore-Flow (streng)
1. **Sicherheits-Backup** des aktuellen Stands → `backups/safety/`
2. Backend in Wartungsmodus (alle Endpoints außer `/health` antworten 503)
3. tar.gz nach `temp/restore-<id>/` entpacken
4. **Manifest validieren:** Schema-Version ≤ aktuell, dbSha256 stimmt
5. Atomar swappen: `db/`, `uploads/`, `keys/` (mv -T)
6. Migration-Runner laufen lassen (alte Schemas auf aktuell heben)
7. Backend neu laden
8. Wartungsmodus aus

## Akzeptanztest
Echtdaten-Test: Kunden anlegen → Backup → Kunden löschen → Restore → alles wieder da, inkl. verschlüsselter Settings.
