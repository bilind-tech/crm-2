-- Migration 024: IMAP-Sent-Folder-Archiv-Status pro Versand-Zeile.
-- Rein additiv. Kein bestehender Sende-Status wird je davon abgeleitet —
-- IMAP-Append darf NIEMALS einen erfolgreichen SMTP-Versand fehlschlagen
-- lassen.
ALTER TABLE email_versand ADD COLUMN imap_archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_versand ADD COLUMN imap_archive_fehler TEXT NULL;