-- Step 16: Rollen, Recovery-Code, Aktiv-Flag für Benutzer.
ALTER TABLE app_user ADD COLUMN rolle TEXT NOT NULL DEFAULT 'mitarbeiter'
  CHECK (rolle IN ('owner','mitarbeiter'));
ALTER TABLE app_user ADD COLUMN recovery_hash TEXT;
ALTER TABLE app_user ADD COLUMN recovery_used_at TEXT;
ALTER TABLE app_user ADD COLUMN aktiv INTEGER NOT NULL DEFAULT 1;
ALTER TABLE app_user ADD COLUMN letzte_aktivitaet TEXT;

-- Bestehende User (sollte 0 oder 1 sein) auf owner heben, damit Migration auf
-- bereits eingerichteten Systemen ohne lockout läuft.
UPDATE app_user SET rolle = 'owner' WHERE rolle = 'mitarbeiter';

CREATE INDEX IF NOT EXISTS idx_app_user_rolle ON app_user(rolle);
CREATE INDEX IF NOT EXISTS idx_app_user_aktiv ON app_user(aktiv);
