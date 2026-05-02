---
name: Belegnummern
description: Format {KÜRZEL}{MM}{YY}/{NN} pro Kunde+Monat, atomare Vergabe in Transaktion
type: feature
---

# Belegnummern

## Format
`{KÜRZEL}{MM}{YY}/{NN}` — Beispiel: `GFU0526/01`
- KÜRZEL: 3-Letter-Kürzel des Kunden, systemweit unique (siehe `kuerzel-eindeutigkeit`)
- MM: zweistelliger Monat
- YY: zweistelliges Jahr
- NN: zweistelliger Zähler ab 01, **pro Kunde + Monat + Belegart** (Rechnung/Angebot getrennt)

## Datenmodell (Step 3)
```sql
CREATE TABLE kunden_zaehler (
  kunde_id    TEXT NOT NULL REFERENCES kunden(id) ON DELETE CASCADE,
  belegart    TEXT NOT NULL CHECK (belegart IN ('rechnung','angebot')),
  jahr_monat  TEXT NOT NULL,           -- 'YYMM'
  letzter_nn  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kunde_id, belegart, jahr_monat)
);
```

## Vergabe (atomar in Transaktion)
```ts
db.transaction((kundeId, art, ym) => {
  const row = upsertAndIncrement(kundeId, art, ym);
  return formatNummer(kuerzel, ym, row.letzter_nn);
});
```

## Edge Cases
- Monatswechsel mitten im Erstellen → Belegnummer wird beim Speichern (nicht beim Öffnen) endgültig vergeben
- Storno einer Rechnung → Nummer bleibt belegt, kein Reuse
- Nummer-Format ist konfigurierbar (Tabelle `nummernkreise`), aber Default wie oben
