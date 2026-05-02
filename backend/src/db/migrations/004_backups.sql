-- Step 2: Backup-Historie
CREATE TABLE IF NOT EXISTS backup_history (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('daily','weekly','monthly','manual','pre-restore','pre-update')),
  trigger TEXT NOT NULL CHECK (trigger IN ('auto','manual','pre-restore','pre-update')),
  size_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('in_progress','success','failed')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  sha256 TEXT,
  schema_version INTEGER,
  app_version TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_backup_status_started ON backup_history(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_category_started ON backup_history(category, started_at DESC);
