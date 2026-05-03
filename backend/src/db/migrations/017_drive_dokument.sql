-- 017: Drive-Upload Queue erlaubt zusätzlich 'dokument' als beleg_art.
-- SQLite kann CHECK-Constraints nicht einfach altern → Tabelle neu aufbauen.

PRAGMA foreign_keys = OFF;

CREATE TABLE drive_upload_queue_new (
  id                    TEXT PRIMARY KEY,
  beleg_art             TEXT NOT NULL CHECK (beleg_art IN ('angebot','rechnung','dokument')),
  beleg_id              TEXT NOT NULL,
  datei_name            TEXT NOT NULL,
  pdf_sha256            TEXT NOT NULL,
  idempotenz_key        TEXT NOT NULL UNIQUE,
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','erfolg','fehler','manuell')),
  versuche              INTEGER NOT NULL DEFAULT 0,
  naechster_versuch_at  TEXT,
  drive_file_id         TEXT,
  drive_web_link        TEXT,
  fehler_text           TEXT,
  abgeschlossen_am      TEXT,
  erstellt_am           TEXT NOT NULL DEFAULT (datetime('now')),
  geaendert_am          TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO drive_upload_queue_new
  SELECT id, beleg_art, beleg_id, datei_name, pdf_sha256, idempotenz_key,
         status, versuche, naechster_versuch_at, drive_file_id, drive_web_link,
         fehler_text, abgeschlossen_am, erstellt_am, geaendert_am
    FROM drive_upload_queue;

DROP TABLE drive_upload_queue;
ALTER TABLE drive_upload_queue_new RENAME TO drive_upload_queue;

CREATE INDEX IF NOT EXISTS ix_drive_queue_status ON drive_upload_queue(status);
CREATE INDEX IF NOT EXISTS ix_drive_queue_beleg  ON drive_upload_queue(beleg_art, beleg_id);
CREATE INDEX IF NOT EXISTS ix_drive_queue_due
  ON drive_upload_queue(status, naechster_versuch_at);

PRAGMA foreign_keys = ON;
