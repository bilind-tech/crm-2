-- Step 8: System-Updates + Rollback.
-- Daten-Verzeichnis bleibt unangetastet — diese Tabellen sind reine Lauf-Historie.

CREATE TABLE IF NOT EXISTS system_update_lauf (
  id                 TEXT PRIMARY KEY,
  gestartet_am       TEXT NOT NULL DEFAULT (datetime('now')),
  beendet_am         TEXT,
  quelle             TEXT NOT NULL CHECK (quelle IN ('upload','rollback')),
  paket_version      TEXT NOT NULL DEFAULT '',
  paket_sha256       TEXT NOT NULL DEFAULT '',
  paket_groesse      INTEGER NOT NULL DEFAULT 0,
  vorherige_version  TEXT NOT NULL DEFAULT '',
  neue_version       TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'laeuft'
                     CHECK (status IN ('laeuft','erfolg','fehler','rollback')),
  aktueller_step     TEXT NOT NULL DEFAULT '',
  fehler_text        TEXT,
  user_id            TEXT,
  safety_backup_id   TEXT
);
CREATE INDEX IF NOT EXISTS ix_sys_update_lauf_zeit ON system_update_lauf(gestartet_am DESC);

CREATE TABLE IF NOT EXISTS system_update_step (
  id            TEXT PRIMARY KEY,
  lauf_id       TEXT NOT NULL REFERENCES system_update_lauf(id) ON DELETE CASCADE,
  step_id       TEXT NOT NULL,
  label         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'wartet'
                CHECK (status IN ('wartet','laeuft','ok','fehler','uebersprungen')),
  reihenfolge   INTEGER NOT NULL,
  gestartet_am  TEXT,
  beendet_am    TEXT,
  detail        TEXT,
  fehler_text   TEXT
);
CREATE INDEX IF NOT EXISTS ix_sys_update_step_lauf ON system_update_step(lauf_id, reihenfolge);

CREATE TABLE IF NOT EXISTS system_update_paket (
  id              TEXT PRIMARY KEY,
  dateiname       TEXT NOT NULL,
  groesse_bytes   INTEGER NOT NULL DEFAULT 0,
  sha256          TEXT NOT NULL DEFAULT '',
  manifest_json   TEXT NOT NULL DEFAULT '{}',
  staging_pfad    TEXT NOT NULL,
  validiert       INTEGER NOT NULL DEFAULT 0,
  gueltig_bis     TEXT NOT NULL,
  hochgeladen_am  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Optional: installierte Versionen historisch (für /historie).
CREATE TABLE IF NOT EXISTS system_installed_version (
  version       TEXT PRIMARY KEY,
  installed_at  TEXT NOT NULL DEFAULT (datetime('now')),
  ist_aktiv     INTEGER NOT NULL DEFAULT 0,
  rollback_verfuegbar INTEGER NOT NULL DEFAULT 1
);
