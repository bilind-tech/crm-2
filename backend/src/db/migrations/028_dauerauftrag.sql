-- Dauerauftrag-Modul: Daueraufträge, Läufe (idempotent pro Periode) und Sonderpositionen.
-- Positionen werden als JSON-Blob am Dauerauftrag gespeichert (Template-Charakter).

CREATE TABLE IF NOT EXISTS dauerauftrag (
  id                    TEXT PRIMARY KEY,
  nummer                TEXT NOT NULL UNIQUE,            -- "DA-2026-001"
  kunde_id              TEXT NOT NULL REFERENCES kunde(id),
  objekt_id             TEXT,
  ansprechpartner_id    TEXT,
  bezeichnung           TEXT NOT NULL,
  frequenz              TEXT NOT NULL CHECK (frequenz IN ('monatlich','quartalsweise','halbjaehrlich','jaehrlich')),
  stichtag_typ          TEXT NOT NULL DEFAULT 'monatstag' CHECK (stichtag_typ IN ('monatstag','monatsletzter','quartalstag')),
  stichtag_wert         INTEGER,
  laufzeit_von          TEXT NOT NULL,
  laufzeit_bis          TEXT,
  positionen            TEXT NOT NULL DEFAULT '[]',      -- JSON-Array
  rabatt_gesamt         REAL NOT NULL DEFAULT 0,
  steuersatz            REAL NOT NULL DEFAULT 19,
  betreff_vorlage       TEXT NOT NULL DEFAULT 'Rechnung {{lauf.zeitraum}}',
  text_vorlage          TEXT NOT NULL DEFAULT '',
  modus                 TEXT NOT NULL DEFAULT 'entwurf' CHECK (modus IN ('entwurf','vollautomatisch')),
  email_empfaenger      TEXT NOT NULL DEFAULT '[]',       -- JSON-Array
  status                TEXT NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv','pausiert','beendet')),
  pausiert_bis          TEXT,
  letzte_ausfuehrung    TEXT,
  notizen               TEXT,
  erstellt_am           TEXT NOT NULL DEFAULT (datetime('now')),
  geaendert_am          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_dauerauftrag_kunde  ON dauerauftrag(kunde_id);
CREATE INDEX IF NOT EXISTS ix_dauerauftrag_status ON dauerauftrag(status);

CREATE TRIGGER IF NOT EXISTS dauerauftrag_touch
AFTER UPDATE ON dauerauftrag
FOR EACH ROW
BEGIN
  UPDATE dauerauftrag SET geaendert_am = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS dauerauftrag_lauf (
  id                TEXT PRIMARY KEY,
  dauerauftrag_id   TEXT NOT NULL REFERENCES dauerauftrag(id) ON DELETE CASCADE,
  periode           TEXT NOT NULL,                       -- "2026-04" / "2026-Q2" / "2026-H1" / "2026"
  geplant_fuer      TEXT NOT NULL,
  ausgefuehrt_am    TEXT,
  rechnung_id       TEXT,
  status            TEXT NOT NULL DEFAULT 'geplant' CHECK (status IN ('geplant','erzeugt','uebersprungen','fehler')),
  fehler_grund      TEXT,
  erstellt_am       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (dauerauftrag_id, periode)
);
CREATE INDEX IF NOT EXISTS ix_dauerauftrag_lauf_da     ON dauerauftrag_lauf(dauerauftrag_id);
CREATE INDEX IF NOT EXISTS ix_dauerauftrag_lauf_status ON dauerauftrag_lauf(status);

CREATE TABLE IF NOT EXISTS dauerauftrag_sonderposition (
  id                TEXT PRIMARY KEY,
  dauerauftrag_id   TEXT NOT NULL REFERENCES dauerauftrag(id) ON DELETE CASCADE,
  fuer_periode      TEXT NOT NULL,
  position          TEXT NOT NULL,                       -- JSON
  verbraucht_am     TEXT,
  erstellt_am       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_dauerauftrag_sopo_da ON dauerauftrag_sonderposition(dauerauftrag_id);
