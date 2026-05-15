-- Migration 025: Seed-Key für versionierte Default-E-Mail-Vorlagen.
-- Beim Boot werden Default-Vorlagen per ON CONFLICT(seed_key) DO NOTHING
-- eingefügt. User-eigene Vorlagen haben seed_key = NULL und werden niemals
-- überschrieben. Neue Defaults in späteren Versionen werden additiv ergänzt.

ALTER TABLE email_vorlage ADD COLUMN seed_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_email_vorlage_seedkey
  ON email_vorlage(seed_key) WHERE seed_key IS NOT NULL;