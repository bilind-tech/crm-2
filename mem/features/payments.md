---
name: Teilzahlungen (Payments)
description: Mehrere Zahlungen pro Rechnung, Status leitet sich aus Zahlungssumme ab, Mini-Dialog-Flow
type: feature
---

# Teilzahlungen

## Datenmodell (geplant Step 4)
```sql
CREATE TABLE zahlungen (
  id           TEXT PRIMARY KEY,
  rechnung_id  TEXT NOT NULL REFERENCES rechnungen(id) ON DELETE CASCADE,
  betrag       REAL NOT NULL CHECK (betrag > 0),
  datum        TEXT NOT NULL DEFAULT (date('now')),
  methode      TEXT NOT NULL DEFAULT 'überweisung',
  notiz        TEXT,
  erstellt_am  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_zahlungen_rechnung ON zahlungen(rechnung_id);
```

## Status-Ableitung (im Service, nie direkt setzbar)
- `summe = SUM(betrag)`
- `summe == 0` → Status bleibt (entwurf/versendet/überfällig)
- `0 < summe < bruttoSumme` → `teilbezahlt`
- `summe >= bruttoSumme` → `bezahlt`
- Übergang läuft in derselben Transaktion wie das Insert/Delete der Zahlung.

## UI (existiert)
- Button „Als bezahlt markieren" → Mini-Dialog mittig
- Stufe 1: Ja/Nein/Abbrechen
- „Ja" → vollen Restbetrag automatisch buchen
- „Nein" → Stufe 2 mit nur **einem Betragsfeld**
- Datum (= heute), Methode (= überweisung), Notiz (= leer) NICHT in UI — backend füllt automatisch
