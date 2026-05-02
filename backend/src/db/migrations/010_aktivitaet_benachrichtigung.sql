-- Step 7: Aktivitäten + Benachrichtigungen.
-- Audit bleibt eigene Senke (siehe 002_auth_settings.sql / audit_log).

CREATE TABLE IF NOT EXISTS aktivitaet (
  id           TEXT PRIMARY KEY,
  art          TEXT NOT NULL,
  bezug_art    TEXT,
  bezug_id     TEXT,
  titel        TEXT NOT NULL,
  beschreibung TEXT NOT NULL DEFAULT '',
  kontext_json TEXT,
  user_id      TEXT,
  zeitpunkt    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_aktivitaet_zeitpunkt ON aktivitaet(zeitpunkt DESC);
CREATE INDEX IF NOT EXISTS ix_aktivitaet_bezug     ON aktivitaet(bezug_art, bezug_id);
CREATE INDEX IF NOT EXISTS ix_aktivitaet_art       ON aktivitaet(art);

CREATE TABLE IF NOT EXISTS benachrichtigung (
  id              TEXT PRIMARY KEY,
  aktivitaet_id   TEXT NOT NULL REFERENCES aktivitaet(id) ON DELETE CASCADE,
  prioritaet      TEXT NOT NULL DEFAULT 'info'
                  CHECK (prioritaet IN ('info','erfolg','warnung','fehler')),
  titel           TEXT NOT NULL,
  beschreibung    TEXT NOT NULL DEFAULT '',
  aktion_label    TEXT,
  aktion_route    TEXT,
  gelesen_am      TEXT,
  weggewischt_am  TEXT,
  erstellt_am     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_benachrichtigung_state
  ON benachrichtigung(weggewischt_am, gelesen_am, erstellt_am DESC);
CREATE INDEX IF NOT EXISTS ix_benachrichtigung_aktivitaet
  ON benachrichtigung(aktivitaet_id);
