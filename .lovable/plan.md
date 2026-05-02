
## Ziel

Belegnummern für Kunden mit Kürzel folgen ab sofort dem Schema:

```
{KÜRZEL}{MM}{YY}/{NN}
```

Beispiel: Kunde mit Kürzel `GFU`, Mai 2026, erstes Dokument → **`GFU0526/01`**

- `MM` = 2-stelliger Monat
- `YY` = 2-stellige Jahreszahl
- `/NN` = laufende Nummer pro Kunde + Monat, 2-stellig, beginnt bei `01`
- Zähler läuft je Kunde und Monat eigenständig (Mai-Zähler ≠ Juni-Zähler)
- Gilt für Angebote, Rechnungen, Dauerauftrags-Rechnungen und Angebot→Rechnung-Konvertierung

Kunden ohne Kürzel behalten weiterhin das globale Schema aus den Nummernkreisen (Fallback).

## Änderungen

### 1. Zentrale Nummern-Erzeugung (`src/lib/mock/backend.ts`)

`nextCustomerNumber()` umstellen:
- Statt `${KUERZEL}-${YYYY}-${MM}-${NN}` → `${KUERZEL}${MM}${YY}/${NN}`
- Periode-Key intern bleibt `YYYY-MM` (eindeutig, keine Kollision über Jahresgrenzen)
- Fallback bei fehlendem Kürzel unverändert
- Wird bereits an allen 5 Stellen genutzt (Angebot anlegen, Rechnung anlegen, Angebot→Rechnung, Rechnung duplizieren, Dauerauftrag-Lauf) → keine weiteren Aufrufer-Änderungen nötig

### 2. Kürzel-Vorschau im KundeForm (`src/components/forms/KundeForm.tsx`)

Vorschau-String (Zeile 108–113) auf das neue Format anpassen:
- Neu: `${kuerzel}${MM}${YY}/01`
- Hinweis-Text bleibt: „So beginnen alle Rechnungen & Angebote dieses Kunden."

### 3. Live-Vorschau im AngebotForm (`src/components/forms/AngebotForm.tsx`)

Sobald ein Kunde gewählt ist, unter dem Titel-Feld eine kleine, dezente Vorschau anzeigen:

```
Belegnummer: GFU0526/01
```

- Hat der Kunde ein Kürzel → Vorschau im neuen Format mit `01` als Platzhalter (echte Zähler-Abfrage wäre overkill und nicht race-frei).
- Hat der Kunde kein Kürzel → Vorschau aus globalem `angebotPraefix` (Nummernkreise), ähnlich der Logik in `NummernkreiseTab.preview()`.
- Klein, mono, `text-muted-foreground`, kein eigener Block — direkt unter dem Titel.

### 4. Live-Vorschau im RechnungForm (`src/components/forms/RechnungForm.tsx`)

Analog zu AngebotForm: Vorschau direkt unter Titel, nutzt `rechnungPraefix` als Fallback.

### 5. Helper auslagern

Neuer kleiner Helper `src/lib/format.ts` (oder `src/lib/belegNummer.ts`):

```ts
export function vorschauBelegnummer(
  kuerzel: string | undefined,
  fallbackPraefix: string,
): string
```

- Wenn `kuerzel` gesetzt: `${KUERZEL}${MM}${YY}/01`
- Sonst: `fallbackPraefix` mit `{YYYY}/{YY}/{MM}/{####}/{###}` ersetzen, `NN`-Teile mit `0001`/`001`
- Wird in KundeForm, AngebotForm, RechnungForm wiederverwendet → eine Quelle der Wahrheit

### 6. Bestehende Belege

Bestehende Angebote/Rechnungen behalten ihre alte Nummer (`AN-2025-001` etc.) — nichts wird rückwirkend umnummeriert. Nur **neue** Belege ab dem Update bekommen das neue Format. Das entspricht dem Hinweis im NummernkreiseTab.

## Was sich nicht ändert

- Datenmodell (`Kunde.kuerzel`, `Angebot.nummer`, `Rechnung.nummer`) bleibt gleich — alles bleibt `string`.
- Nummernkreise-Einstellungen (für Kunden ohne Kürzel) bleiben unverändert.
- Kunden-Nummern (`K-2025-001`) bleiben am globalen `kundePraefix`.
- Mock-Persistenz, Cross-Tab-Sync, Zähler pro Kunde + Periode (`zaehlerProKunde`) bleiben strukturell identisch.

## Backend-Hinweis (für später, Pi)

Sobald das Live-Backend gebaut wird, MUSS dort exakt dieselbe Funktion `nextCustomerNumber()` server-seitig in einer DB-Transaktion laufen (SELECT FOR UPDATE auf den Periode-Counter), damit zwei parallele Anfragen niemals dieselbe Nummer ziehen. Format-String wird im Memory-Eintrag zur Belegnummer dokumentiert.
