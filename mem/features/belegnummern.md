---
name: Belegnummern
description: Format {KÜRZEL}{MMYY}/{NN} pro Kunde+Monat+Belegart, atomare Vergabe + Reservierung + Retry + Import-Scan
type: feature
---

# Belegnummern v2

## Format
`{PREFIX}{MMYY}/{NN}` — Beispiel: `GFU0526/01`

- **PREFIX** = Kunden-Kürzel (z. B. `GFU`) wenn vorhanden
- Ohne Kürzel: Fallback `AN-K001` / `RE-K001` (aus Kundennummer abgeleitet) — eindeutig pro Kunde, keine Kollisionen mehr.
- **MMYY** = zweistelliger Monat + zweistelliges Jahr (richtige Reihenfolge!)
- **NN** = laufender Zähler ab 01, **pro (Kunde, Belegart, Periode) getrennt**.

Single Source of Truth: `backend/src/belege/nummer-format.ts` (`parseBelegnummer`, `formatBelegnummer`, `fallbackPrefix`, `periodeMMYY`).

## Datenmodell (Migration 019)

```sql
CREATE TABLE belegnummer_zaehler (
  kunde_id        TEXT NOT NULL,
  belegart        TEXT NOT NULL CHECK (belegart IN ('angebot','rechnung')),
  periode         TEXT NOT NULL,            -- MMYY
  naechster_start INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (kunde_id, belegart, periode)
);

CREATE TABLE belegnummer_reserviert (
  nummer       TEXT NOT NULL,
  art          TEXT NOT NULL CHECK (art IN ('angebot','rechnung')),
  kunde_id     TEXT,
  grund        TEXT,
  erstellt_am  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (art, nummer)
);

-- angebot/rechnung bekamen: nummer_periode TEXT, nummer_quelle TEXT (auto|import|manuell)
```

## Vergabe (`backend/src/belege/belegnummer.ts`)

1. `vergebeBelegnummer(kundeId, art, bezugsdatum)` läuft IN derselben SQLite-Transaktion wie der Beleg-INSERT.
2. UPSERT + RETURNING in `belegnummer_zaehler` (atomar). Bei parallelen Schreibern serialisiert WAL + busy_timeout.
3. Skip-Schleife (max 50): wenn formatierte Nummer in `belegnummer_reserviert` ODER `angebot/rechnung` schon existiert → NN +1.
4. `mitBelegnummerRetry()`: bei `SQLITE_CONSTRAINT_UNIQUE: <tabelle>.nummer` → bis zu 5× neu vergeben (deckt seltene Races nach Import ab).

## Import-Scan
- `importScanZaehler()` parst alle bestehenden `nummer` aus `angebot`/`rechnung`, hebt jeden Zähler per `bumpBelegNummerMindestens` auf `MAX(nn)+1`. Idempotent.
- Wird automatisch beim Backend-Boot ausgeführt (`server.ts`, nach Migration). Endpoint `POST /belege/nummer/import-scan` für manuelles Re-Triggern.

## Reservierung
- `POST /belege/nummer/reservieren { art, nummer, kundeId?, grund? }` — Format-Check + Kollisions-Check, Insert in `belegnummer_reserviert`.
- 409 bei Kollision mit existierendem Beleg, 422 bei Format-Fehler.

## Vorschau
- `GET /kunden/:id/zaehler?art=angebot|rechnung` → `{ periode, art, naechsterStart, formatted }` mit echtem Anzeige-String (verwendet dieselbe Format-Logik wie die Vergabe → kein Drift).

## Edge Cases
- Monatswechsel: Nummer wird beim Speichern (nicht beim Öffnen) endgültig vergeben. Bezugsdatum für Angebot = `gueltigBis ?? today`, für Rechnung = `rechnungsdatum`.
- Storno / Archivierung: Nummer bleibt belegt, kein Reuse — UNIQUE-Constraint auf `angebot.nummer` / `rechnung.nummer` schützt dauerhaft.
- Manuelle Korrektur: wer eine spezifische Nummer braucht, reserviert sie vorher → Auto-Vergabe überspringt sie zuverlässig.

## Bugs gefixt (Migration 019)
- B1: Angebot/Rechnung teilten Zähler → jetzt getrennt
- B3: Fallback-Präfix war nicht kunden-eindeutig → jetzt mit Kundennummer
- B4: Importierte Belege kollidierten mit Auto-Vergabe → Boot-Scan + Reservierung
- B5: Keine Retry-Schicht → `mitBelegnummerRetry`
- B7: Peek lieferte nur Zahl → jetzt fertig formatierter String
