---
name: Kürzel-Eindeutigkeit
description: Kunden-Kürzel systemweit unique, Backend 409, Live-Check via /kunden/kuerzel-frei
type: feature
---

# Kunden-Kürzel

## Regel
3-Letter-Kürzel pro Kunde, **systemweit unique** (case-insensitive, gespeichert UPPERCASE).

## Datenmodell (Step 3)
```sql
ALTER TABLE kunden ADD COLUMN kuerzel TEXT NOT NULL;
CREATE UNIQUE INDEX idx_kunden_kuerzel ON kunden(kuerzel);
```

## Endpoints
- `GET /kunden/kuerzel-frei?kuerzel=GFU&exceptId=<id>` → `{ frei: boolean, kunde?: { id, nummer, name } }`
- `POST/PATCH /kunden` → bei Konflikt **409 Conflict** mit Body `{ feld: "kuerzel", konflikt: { id, name } }`

## Frontend (existiert)
- Live-Check beim Tippen (debounced 300 ms)
- Submit-Button blockiert solange Konflikt erkannt
- Hinweis welcher Kunde das Kürzel bereits nutzt
