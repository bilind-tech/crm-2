-- Step 13b: Idempotenz-Log für Steuer-Frist-Benachrichtigungen.
-- Verhindert mehrfache Notifications pro Posten/Tag/Status.
CREATE TABLE IF NOT EXISTS steuer_frist_benachrichtigung_log (
  posten_id TEXT NOT NULL,
  tag       TEXT NOT NULL,
  status    TEXT NOT NULL CHECK (status IN ('ueberfaellig','heute','bald')),
  erstellt_am TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (posten_id, tag, status)
);
