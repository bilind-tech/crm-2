-- Belegnummern v2: getrennte Zähler pro Belegart + Reservierungstabelle.
-- Additiv & nicht-zerstörend. Daten bleiben unverändert.
-- Format unverändert: {KÜRZEL|PRÄFIX}{MM}{YY}/{NN}.

-- 1) Reservierungstabelle für importierte / manuell vergebene Nummern,
--    die der Auto-Vergabe-Pfad überspringen muss.
CREATE TABLE IF NOT EXISTS belegnummer_reserviert (
  nummer       TEXT NOT NULL,
  art          TEXT NOT NULL CHECK (art IN ('angebot','rechnung')),
  kunde_id     TEXT,
  grund        TEXT,
  erstellt_am  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (art, nummer)
);
CREATE INDEX IF NOT EXISTS ix_belegnummer_reserviert_kunde
  ON belegnummer_reserviert(kunde_id);

-- 2) Zähler-Tabelle umbauen: PK enthält jetzt belegart.
--    Bestehende Datensätze werden auf "rechnung" gemappt (war historisch
--    gemeinsamer Zähler, Rechnungen haben Vorrang in der UX). Anschließend
--    wird beim Boot ein Import-Scan ausgeführt, der für beide Belegarten die
--    Stände aus den realen Belegen ableitet.
CREATE TABLE IF NOT EXISTS belegnummer_zaehler_v2 (
  kunde_id        TEXT NOT NULL,
  belegart        TEXT NOT NULL CHECK (belegart IN ('angebot','rechnung')),
  periode         TEXT NOT NULL,                    -- "MMYY"
  naechster_start INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (kunde_id, belegart, periode)
);

INSERT OR IGNORE INTO belegnummer_zaehler_v2 (kunde_id, belegart, periode, naechster_start)
SELECT kunde_id, 'rechnung', periode, naechster_start FROM belegnummer_zaehler;

INSERT OR IGNORE INTO belegnummer_zaehler_v2 (kunde_id, belegart, periode, naechster_start)
SELECT kunde_id, 'angebot', periode, naechster_start FROM belegnummer_zaehler;

DROP TABLE belegnummer_zaehler;
ALTER TABLE belegnummer_zaehler_v2 RENAME TO belegnummer_zaehler;

-- 3) Audit-Spalten an angebot/rechnung — nur additive ALTERs.
ALTER TABLE angebot   ADD COLUMN nummer_periode TEXT;
ALTER TABLE rechnung  ADD COLUMN nummer_periode TEXT;
ALTER TABLE angebot   ADD COLUMN nummer_quelle  TEXT NOT NULL DEFAULT 'auto'
  CHECK (nummer_quelle IN ('auto','import','manuell'));
ALTER TABLE rechnung  ADD COLUMN nummer_quelle  TEXT NOT NULL DEFAULT 'auto'
  CHECK (nummer_quelle IN ('auto','import','manuell'));
