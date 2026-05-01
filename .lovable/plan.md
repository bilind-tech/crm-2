## Ziel

Zwei Verbesserungen, die sich „magisch" anfühlen:

1. **Smart-Prefill** für Telefon-, Mobil- und Webseite-Felder (`+49 ` bzw. `https://` ist sofort da, beim ersten Klick steht der Cursor schon richtig — Backspace löscht das Präfix wie jedes andere Zeichen).
2. **Kunden-Kürzel** (3–4 Zeichen) als neues Feld im Tab „Basis" beim Anlegen eines Kunden, mit **Live-Vorschau** der zukünftigen Rechnungs-/Angebotsnummer im Format `KÜRZEL-YYYY-MM-##`.

---

## Teil 1 — Smart-Prefill Inputs

### Neue Komponente `src/components/ui/smart-input.tsx`

Ein leichter Wrapper um den bestehenden `<Input>` mit einer Prop `prefix` (z. B. `"+49 "` oder `"https://"`).

Verhalten:
- Beim Mount: ist der Wert leer → Wert = Präfix setzen, sodass `f.telefon = "+49 "` schon im Form-State steht.
- Beim Fokus: wenn nur das Präfix steht, Cursor ans Ende setzen (kein Auto-Selektieren — fühlt sich natürlicher an).
- Backspace/Delete funktioniert normal — Nutzer kann das Präfix komplett löschen, auch ohne Präfix wieder tippen.
- Beim Speichern: wenn der Wert exakt = Präfix (nur Whitespace dahinter), als „leer" behandeln → `undefined` ans Backend.
- Optional: dezente `placeholder=""` (weil Präfix selbst sichtbar ist).

### Einsatzorte

| Feld | Präfix |
|---|---|
| `KundeForm` Telefon | `+49 ` |
| `KundeForm` Mobil | `+49 ` |
| `KundeForm` Webseite | `https://` |
| `AnsprechpartnerForm` Telefon/Mobil (falls vorhanden) | `+49 ` |
| `EinstellungenTab` Firmen-Telefon / -Webseite | analog |

Speicher-Logik in `KundeForm.submit()` so anpassen, dass `telefon === "+49 "` (trim) als `undefined` gilt.

---

## Teil 2 — Kunden-Kürzel + Live-Nummer-Vorschau

### Datenmodell

`src/lib/api/types.ts` — `interface Kunde` ergänzen:

```ts
kuerzel?: string; // 3-4 Zeichen Großbuchstaben, optional, einmalig pro Kunde
```

### Form-Erweiterung `KundeForm.tsx`

Im Tab **Basis**, oben (direkt unter Typ/Status), neuer Bereich:

```text
┌─ Basis ────────────────────────────────────────────┐
│ Typ          Status                                │
│ Firmenname *                                       │
│ ─────────────────────────────────────────────────  │
│ Kürzel  [MUST]   ← 3–4 Zeichen, automatisch upper  │
│  Vorschau:  MUST-2026-05-01  ✨                    │
│ ─────────────────────────────────────────────────  │
│ Anrede / Vorname / Nachname                        │
│ Telefon (+49 ) / Mobil (+49 )                      │
│ E-Mail / Webseite (https://)                       │
└────────────────────────────────────────────────────┘
```

Logik:
- Input nimmt max. 4 Zeichen, automatisch `toUpperCase()`, nur `[A-Z0-9]` erlaubt.
- Vorschlag-Generator: aus Firmenname → erste Buchstaben pro Wort, max. 4. Beispiel: „Müller Reinigung GmbH" → `MRG`. Wird beim Verlassen des Firmenname-Feldes nur dann gesetzt, wenn der Kürzel-Wert noch leer ist.
- **Live-Vorschau** unter dem Input, animiert (sanftes Fade beim Tippen):
  ```
  Vorschau: MUST-2026-05-01
  ```
  Format = `{KÜRZEL}-{YYYY}-{MM}-{##}` mit aktuellem Monat/Jahr und `01` als erste Rechnung. Monospace-Font, dezenter Akzent.
- Helper-Text: „3–4 Zeichen. So beginnen alle Rechnungen & Angebote dieses Kunden."

### Nummernschema

`nextNumber()` in `src/lib/mock/backend.ts` erweitern: zweite Variante `nextCustomerNumber(kuerzel, sequenz)` → `MUST-2026-05-01`. Sequenz pro Kunde + Monat.

State im Mock-Backend: `zaehler.proKunde: Record<kundeId, Record<"YYYY-MM", number>>`.

In den Stellen, die Rechnungen/Angebote anlegen (Zeilen 473, 540, 575, 607, 1521 in `backend.ts`):
- Wenn `kunde.kuerzel` gesetzt → neues Schema verwenden.
- Sonst → bestehendes globales Schema (Rückwärtskompatibilität für Alt-Kunden).

### Einstellungen → Nummernkreise

Hinweistext ergänzen: „Kunden mit eigenem Kürzel verwenden ihr eigenes Schema (`KÜRZEL-YYYY-MM-##`). Diese Vorlagen gelten für alle anderen."

---

## Geänderte Dateien

- **neu** `src/components/ui/smart-input.tsx`
- `src/components/forms/KundeForm.tsx` — Kürzel-Feld + Live-Vorschau, SmartInput für Telefon/Mobil/Webseite, leer-Erkennung im submit
- `src/lib/api/types.ts` — `Kunde.kuerzel?`
- `src/lib/mock/backend.ts` — `nextCustomerNumber()`, Zähler-State pro Kunde+Monat, alle 5 Anlage-Stellen
- `src/components/einstellungen/*` (falls Telefon/Web-Felder vorhanden) — SmartInput
- `src/routes/einstellungen.tsx` — kurzer Hinweistext bei Nummernkreisen

---

## Was es NICHT ändert

- Bestehende Kunden ohne Kürzel behalten ihr globales `RE-2026-####`-Schema. Kein Daten-Migrationsschritt nötig.
- Andere Inputs (E-Mail, Adresse, Notizen) bleiben unangetastet.
- Backend-Pi-Phase wird nicht berührt; alles läuft im Mock weiter.

Sag „los" und ich setze es um.