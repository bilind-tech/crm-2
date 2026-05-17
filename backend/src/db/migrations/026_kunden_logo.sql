-- Step 26: Kunden-Logo. Wird klein im UI (Header, Liste) gezeigt und kann
-- später ins PDF gemerged werden. BLOB direkt in der Kunde-Zeile, weil das
-- Bild typischerweise <100 KB ist und so atomar mit dem Kunde-Datensatz lebt.
ALTER TABLE kunde ADD COLUMN logo_blob BLOB;
ALTER TABLE kunde ADD COLUMN logo_mime TEXT;
ALTER TABLE kunde ADD COLUMN logo_updated_at TEXT;
