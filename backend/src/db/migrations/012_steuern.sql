-- Step 10: Steuer-Modul (GmbH Sankt Augustin).
-- Singleton-Einstellungen + manuelle Posten + Bezahlt-Markierungen für Auto-Posten.
-- Auto-Posten (USt/KSt/Soli/GewSt) leben weiterhin im Frontend-Berechnungs-Layer
-- und haben deterministische IDs (z. B. ust-2026-Q1, kst-2026). Sie werden hier
-- NICHT als Zeile gespeichert — nur ihre Bezahlt-Markierung (per posten_id-FK-frei).

CREATE TABLE IF NOT EXISTS steuer_einstellungen (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  kst_satz          REAL    NOT NULL DEFAULT 15,
  soli_satz         REAL    NOT NULL DEFAULT 5.5,
  gewst_messzahl    REAL    NOT NULL DEFAULT 3.5,
  gewst_hebesatz    REAL    NOT NULL DEFAULT 525,
  ust_rhythmus      TEXT    NOT NULL DEFAULT 'monatlich'
                    CHECK (ust_rhythmus IN ('monatlich','quartalsweise','jaehrlich')),
  ruecklage_satz    REAL    NOT NULL DEFAULT 35,
  ust_puffer_satz   REAL    NOT NULL DEFAULT 10,
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO steuer_einstellungen (id) VALUES (1);

CREATE TABLE IF NOT EXISTS steuer_manueller_posten (
  id                  TEXT PRIMARY KEY,
  art                 TEXT NOT NULL CHECK (art IN ('ust','kst','soli','gewst','manuell')),
  titel               TEXT NOT NULL,
  zeitraum_jahr       INTEGER NOT NULL,
  zeitraum_monat      INTEGER,
  zeitraum_quartal    INTEGER CHECK (zeitraum_quartal IS NULL OR zeitraum_quartal BETWEEN 1 AND 4),
  faellig_am          TEXT NOT NULL,
  geschaetzter_betrag REAL NOT NULL DEFAULT 0,
  notiz               TEXT,
  erstellt_am         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_steuer_man_faellig ON steuer_manueller_posten(faellig_am);

CREATE TABLE IF NOT EXISTS steuer_bezahlt_markierung (
  posten_id             TEXT PRIMARY KEY,
  bezahlt_am            TEXT NOT NULL,
  tatsaechlicher_betrag REAL,
  notiz                 TEXT,
  erstellt_am           TEXT NOT NULL DEFAULT (datetime('now'))
);
