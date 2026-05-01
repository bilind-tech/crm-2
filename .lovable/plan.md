# Phase D — Wiederkehrende Rechnungen & Zahlungsabgleich

## Warum diese Phase

Du hast jetzt sauber: Angebot → Rechnung → Teilzahlung → Mahnung. Aber dein Geschäft ist **wiederkehrend**: Büroreinigung Müller GmbH = jeden Monat dieselbe Rechnung. Heute musst du jeden Monat manuell:
1. neue Rechnung anlegen, Kunde + Objekt + Positionen kopieren
2. PDF erzeugen, per Mail rausschicken
3. später Eingang am Konto manuell mit der Rechnung verknüpfen

Phase D macht aus diesem Workflow **einen Klick beim Anlegen, danach läuft es**. Plus: wenn Geld kommt, schlägt das System dir vor, welche Rechnung gemeint war.

---

## Die 4 Ziele

1. **Daueraufträge (Reinigungsverträge):** wiederkehrender Vertrag mit Kunde + Objekt + Positionen + Frequenz (monatlich, quartalsweise, jährlich) als eigene Entität
2. **Auto-Generator:** Beim Stichtag wird automatisch ein **Rechnungsentwurf** erzeugt — du bestätigst nur noch (oder lässt voll automatisch versenden)
3. **Zahlungsabgleich-Light:** Liste manuell eingegebener / importierter Banktransaktionen → das System schlägt pro Transaktion die wahrscheinlichste offene Rechnung vor (Match-Score nach Betrag + Verwendungszweck + Kundenname)
4. **Verbrauchs-/Sonderpositionen:** pro Lauf können einmalige Zusatzpositionen (z.B. Fensterreinigung extra im April) ergänzt werden, ohne den Dauerauftrag zu ändern

---

## Teil 1 — Daueraufträge

### Konzept

Ein **Dauerauftrag** ist die Vorlage für eine wiederkehrende Rechnung: er sagt *was, an wen, wie oft, ab wann, bis wann*. Er ist **keine Rechnung**, sondern erzeugt periodisch welche.

```text
Dauerauftrag DA-2026-003 · Müller GmbH · Bürogebäude Nord
├─ monatlich, jeweils zum 1. des Monats
├─ Laufzeit: ab 01.01.2026, unbefristet
├─ Positionen: Unterhaltsreinigung 850 €, Treppenhaus 120 €
├─ Versand: automatisch per Mail an buchhaltung@mueller.de
└─ Erzeugte Rechnungen: 4 (Jan–Apr) · nächste: 01.05.2026
```

### Neue Route `/dauerauftraege`

Liste aller Daueraufträge als Cards:

```text
┌───────────────────────────────────────────────────────┐
│ Daueraufträge                          [+ Neu anlegen]│
│                                                       │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│ │ Aktiv    │ │ Pausiert │ │ Nächster │               │
│ │   12     │ │    2     │ │  Lauf:   │               │
│ │ 8.450 €/M│ │          │ │ in 3 Tg. │               │
│ └──────────┘ └──────────┘ └──────────┘               │
│                                                       │
│ ▌ Müller GmbH · Bürogebäude Nord                     │
│   monatlich · 970 € netto · nächste am 01.05.        │
│   ●─●─●─● 4 Rechnungen erzeugt              [Öffnen] │
│                                                       │
│ ▌ Schmidt KG · Praxis Süd                            │
│   monatlich · 420 € netto · pausiert bis 30.06.      │
└───────────────────────────────────────────────────────┘
```

### Detail-/Anlegen-Seite `/dauerauftraege/$id` und `/dauerauftraege/neu`

Ein einziger Wizard-ähnlicher Flow auf einer Seite:

1. **Kunde + Objekt** (Pflicht, Auswahl wie bei Rechnung-Neu)
2. **Frequenz**: monatlich · quartalsweise · halbjährlich · jährlich
3. **Stichtag**: am Monatsersten / am Letzten / am X. (Spinner 1–28) / am Tag X des Quartals
4. **Laufzeit**: von Datum, bis Datum (oder unbefristet)
5. **Positionen**: identisch zum Rechnungs-Editor, mit Positionsvorlagen
6. **Rechnungstext-Token**: Betreff/Text mit `{{lauf.monat}}`, `{{lauf.zeitraum}}` (z.B. "April 2026", "Q2 2026")
7. **Automatisierungs-Modus**:
   - **Entwurf erstellen** (Standard, sicher) — Rechnung landet im Posteingang `/dauerauftraege/posteingang`, du klickst "Versenden"
   - **Vollautomatisch** — Rechnung wird sofort als versendet markiert, PDF erzeugt, E-Mail rausgeschickt, Drive-Upload
8. **Vorschau-Block unten:** "Nächste 6 Läufe würden am 01.05., 01.06., 01.07., … erzeugt"

Auf der Detailseite zusätzlich:
- **Liste erzeugter Rechnungen** (chronologisch, klickbar zur Rechnung)
- **Aktionen**: Pausieren bis Datum · Beenden zum Datum · Sofort-Lauf jetzt auslösen (für Tests)
- **FlowBar** wie bei Angebot/Rechnung: Aktiv → Pausiert → Beendet

### Posteingang `/dauerauftraege/posteingang`

Die Inbox für nicht-automatische Daueraufträge: alle erzeugten **Entwürfe**, die auf Bestätigung warten. Eine Checkbox-Liste mit:

```text
☐ RE-2026-042 · Müller GmbH · April 2026 · 970 € · [Vorschau]
☐ RE-2026-043 · Schmidt KG · April 2026 · 420 € · [Vorschau]

[ Auswahl versenden (2) ]   [ Alle versenden ]
```

Ein Klick → PDFs werden erzeugt, Mails versendet, Drive-Upload, Status `versendet`. Dieselbe Engine wie der manuelle Rechnungs-Versand.

### Sidebar

Neuer Eintrag **"Daueraufträge"** unter "Rechnungen", mit Badge = Anzahl Entwürfe im Posteingang.

### Dashboard-Widget

Kachel **"Wiederkehrender Umsatz"**: Summe aller aktiven Daueraufträge pro Monat (MRR-light) + "nächste Läufe in 7 Tagen: X Rechnungen, Y €".

### Logik (Auto-Generator)

Reine Funktion `berechneNaechsteLauftermine(da: Dauerauftrag, ab: Date, n: number): Date[]` → liefert die nächsten N Stichtage.

Beim App-Start und alle 60s im Frontend (im Mock-Modus) prüft `pruefeFaelligeLaeufe()`:
- für jeden aktiven Dauerauftrag: gibt es einen Lauf, der heute oder früher fällig wäre und noch nicht erzeugt wurde?
- wenn ja → Rechnungsentwurf erzeugen (`status: entwurf` oder bei Vollautomatik direkt versenden)
- Eintrag in `Aktivitaet`: "Dauerauftrag XY hat Rechnung RE-… erzeugt"

Beim Pi-Switch wandert das in einen täglichen Cron um 02:00.

**Wichtige Regeln:**
- **Idempotent:** ein Stichtag erzeugt genau eine Rechnung — Doppelklick oder Neustart erzeugt nichts doppelt (DB-Constraint via `(dauerauftragId, periode)`).
- Pausierung übersteuert: Läufe in der Pause werden **übersprungen**, nicht nachgeholt
- Beendigung zum Datum: letzter Lauf ist der letzte Stichtag ≤ Enddatum

---

## Teil 2 — Sonderpositionen pro Lauf

Auf der Dauerauftrag-Detailseite eine kleine Sektion **"Geplante Sonderpositionen"**:

```text
Geplante Zusätze
▸ April 2026: + Fensterreinigung 280 €              [×]
▸ Juni 2026:  + Grundreinigung 1.200 €              [×]
[ + Sonderposition für nächsten Lauf ]
```

Wird der Lauf erzeugt, werden diese Positionen einmalig in die Rechnung gehängt und aus der Vorhabensliste entfernt. Saubere Trennung zwischen "ändert den Vertrag" vs. "nur dieses eine Mal".

---

## Teil 3 — Zahlungsabgleich (Light)

### Konzept

Du tippst (später: importierst) Banktransaktionen ein → das System matched sie gegen offene Rechnungen.

Heute: Du erfasst Zahlungen über `ZahlungErfassenDialog` direkt auf der Rechnung. Das bleibt. Phase D fügt **den umgekehrten Weg** hinzu: "Hier ist eine Bank-Bewegung — welche Rechnung ist das?"

### Neue Route `/zahlungseingaenge`

```text
┌─────────────────────────────────────────────────────────────┐
│ Zahlungseingänge          [+ Eingang erfassen] [Import CSV] │
│                                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│ │Unzugeord.│ │ Zugeordn.│ │ Heute    │                     │
│ │   4      │ │   18     │ │  890 €   │                     │
│ └──────────┘ └──────────┘ └──────────┘                     │
│                                                             │
│ 28.04.  +850,00 €  "Müller GmbH RE 2025-014"               │
│         ▸ Vorschlag: RE-2025-014 Müller (850 € offen) 96%  │
│         [ Zuordnen ]  [ Andere wählen ▾ ]  [ Ignorieren ]  │
│                                                             │
│ 28.04.  +1.200,00 € "ueberweisung schmidt apr"             │
│         ▸ Vorschlag: RE-2025-009 Schmidt (1.200 € offen) 88%│
│         [ Zuordnen ]  [ Andere wählen ▾ ]                  │
│                                                             │
│ 27.04.  +50,00 €    "rest mueller"                         │
│         ⚠ Mehrere Treffer · [ Manuell wählen ]             │
└─────────────────────────────────────────────────────────────┘
```

### Match-Score (reine Funktion `bewerteMatch(tx, rechnung)`)

Punkte (0–100):
- **Betrag exakt = offen** → +50, **Betrag exakt = brutto** → +40, **Teilbetrag möglich** → +20
- **Rechnungsnummer im Verwendungszweck** (Regex auf Präfix) → +30
- **Kundenname-Token** (Substring oder Levenshtein ≤ 2) im Verwendungszweck → +15
- **IBAN des Kunden** im Sender (falls hinterlegt) → +10
- **Kunde hat nur eine offene Rechnung** → +5
- Score ≥ 80 = "starker Vorschlag" (grün), 50–79 = "Vorschlag" (gelb), <50 = "manuell wählen"

Top-3-Vorschläge pro Transaktion, der beste vorausgewählt.

### Aktionen
- **Zuordnen** → erzeugt einen `Zahlung`-Eintrag auf der Rechnung über die existierende Phase-B-Engine, Status der Rechnung aktualisiert sich automatisch (teilbezahlt/bezahlt), eine Mahnung in Vorbereitung wird ggf. zurückgesetzt
- **Aufteilen**: eine Bank-Transaktion auf 2 Rechnungen splitten (z.B. Sammelüberweisung)
- **Ignorieren**: markiert als "kein CRM-Bezug" (z.B. private Erstattung) — verschwindet aus der Hauptliste, bleibt in `Archiv`-Filter
- **Rückgängig**: Zuordnung lösen → Zahlung wird zurückgenommen, Transaktion wieder offen

### Manuelle Eingabe & CSV-Import

- **Dialog "Eingang erfassen"**: Datum, Betrag, Verwendungszweck, optional IBAN/Sender — minimal
- **CSV-Import** (CAMT.053 oder generisch): drag&drop, Spalten-Mapping-Schritt (Datum/Betrag/Zweck), Vorschau-Tabelle, Import-Button. **Phase-D scope:** nur das generische Format (Datum, Betrag, Zweck als 3 Spalten); CAMT echt erst auf dem Pi mit `camt`-Parser.

### Dashboard

Bestehende KPI "Ausstehend" bekommt darunter eine Zeile **"4 Eingänge unzugeordnet — jetzt zuordnen"** als Link.

---

## Datenmodell

```ts
// Daueraufträge
export type DauerauftragFrequenz = "monatlich" | "quartalsweise" | "halbjaehrlich" | "jaehrlich";
export type DauerauftragModus = "entwurf" | "vollautomatisch";
export type DauerauftragStatus = "aktiv" | "pausiert" | "beendet";

export interface Dauerauftrag {
  id: ID;
  nummer: string;                    // "DA-2026-003"
  kundeId: ID;
  objektId?: ID;
  bezeichnung: string;               // "Unterhaltsreinigung Bürogebäude Nord"
  frequenz: DauerauftragFrequenz;
  stichtag: { typ: "monatstag" | "monatsletzter" | "quartalstag"; wert?: number };
  laufzeitVon: ISODate;
  laufzeitBis?: ISODate;             // optional = unbefristet
  positionen: Position[];
  betreffVorlage: string;            // "Reinigung {{lauf.zeitraum}}"
  textVorlage: string;
  modus: DauerauftragModus;
  emailEmpfaenger?: string[];        // für Vollautomatik
  status: DauerauftragStatus;
  pausiertBis?: ISODate;
  letzteAusfuehrung?: ISODate;
  erstelltAm: ISODateTime;
  geaendertAm: ISODateTime;
}

export interface DauerauftragLauf {
  id: ID;
  dauerauftragId: ID;
  periode: string;                   // "2026-04" — eindeutig pro DA
  geplantFuer: ISODate;
  ausgefuehrtAm?: ISODateTime;
  rechnungId?: ID;
  status: "geplant" | "erzeugt" | "uebersprungen" | "fehler";
  fehlerGrund?: string;
}

export interface DauerauftragSonderposition {
  id: ID;
  dauerauftragId: ID;
  fuerPeriode: string;               // "2026-04"
  position: Position;
  verbrauchtAm?: ISODateTime;
}

// Zahlungseingänge
export type ZahlungseingangStatus = "offen" | "zugeordnet" | "ignoriert" | "teilweise";

export interface Zahlungseingang {
  id: ID;
  buchungsdatum: ISODate;
  betrag: number;                    // immer positiv
  waehrung: "EUR";
  verwendungszweck: string;
  senderName?: string;
  senderIban?: string;
  status: ZahlungseingangStatus;
  zuordnungen: ZahlungseingangZuordnung[];
  importQuelle: "manuell" | "csv";
  importiertAm: ISODateTime;
}

export interface ZahlungseingangZuordnung {
  rechnungId: ID;
  zahlungId: ID;                     // FK auf erzeugte Zahlung
  betrag: number;                    // bei Split: anteilig
}
```

Globale Einstellungen werden ergänzt um `dauerauftrag: { defaultModus, defaultStichtag }` und `zahlungsabgleich: { autoZuordnenAbScore: 95 }` (optional: alles ≥95 wird ohne Klick zugeordnet).

---

## Komponenten / Dateien (geplant)

**Neu:**
- `src/routes/dauerauftraege.tsx` (Liste + KPIs)
- `src/routes/dauerauftraege.neu.tsx`
- `src/routes/dauerauftraege.$id.tsx`
- `src/routes/dauerauftraege.posteingang.tsx`
- `src/routes/zahlungseingaenge.tsx`
- `src/lib/dauerauftrag/termine.ts` (reine Funktion: nächste Läufe)
- `src/lib/dauerauftrag/generator.ts` (Lauf → Rechnungsentwurf)
- `src/lib/zahlung/match.ts` (Score-Engine)
- `src/lib/zahlung/csv-import.ts` (Parser + Mapping)
- `src/components/dauerauftrag/DauerauftragForm.tsx`
- `src/components/dauerauftrag/SonderpositionDialog.tsx`
- `src/components/dauerauftrag/LaufVorschau.tsx`
- `src/components/zahlung/ZahlungseingangCard.tsx`
- `src/components/zahlung/ZuordnungsDialog.tsx`
- `src/components/zahlung/CsvImportDialog.tsx`
- `src/hooks/useDauerauftraege.ts`, `useZahlungseingaenge.ts`

**Geändert:**
- `src/lib/api/types.ts` — neue Typen
- `src/lib/mock/backend.ts` + `seed.ts` — DB v7, Endpunkte, Seed-Daten (3–4 Daueraufträge, ~10 Zahlungseingänge)
- `src/lib/mock/scheduler.ts` (neu) — 60s-Tick im Frontend für Lauf-Prüfung
- `src/hooks/useApi.ts` — neue Hooks
- `src/components/layout/AppSidebar.tsx` — 2 neue Einträge mit Badges
- `src/routes/index.tsx` — Dashboard-Widgets "Wiederkehrender Umsatz" + "Eingänge unzugeordnet"
- `src/routes/rechnungen.$id.tsx` — Hinweisbadge "aus Dauerauftrag DA-…" wenn aus Lauf entstanden
- `src/lib/email/placeholders.ts` — `{{lauf.monat}}`, `{{lauf.zeitraum}}`, `{{lauf.von}}`, `{{lauf.bis}}`

---

## Was Phase D NICHT tut (bewusst)

- Keine echte Bank-API-Anbindung (FinTS/HBCI) — kommt später, eigene Phase
- Keine SEPA-Lastschrift-Erzeugung — eigener Workflow
- Keine Dauerauftrag-Versionierung (Preisänderung mitten im Jahr) — Phase E falls nötig; jetzt: Dauerauftrag bearbeiten gilt ab nächstem Lauf
- CAMT.053-Parser nur als generisches CSV — echtes XML auf dem Pi

---

## Reihenfolge der Umsetzung — Status

**Schritt 1 — Daten + Logik ✅ erledigt**
- Typen, DB v7, Seed
- `termine.ts`, `generator.ts`, `match.ts`, CSV-Parser
- API-Endpunkte im Mock + Hooks (`useDauerauftraege`, `useZahlungseingaenge`)
- Scheduler-Tick (60s) in `__root.tsx`

**Schritt 2 — UI Daueraufträge ✅ erledigt**
- `/dauerauftraege`, `/dauerauftraege/$id`, `/dauerauftraege/posteingang`
- Sidebar-Eintrag + Entwurfs-Badge
- Dashboard-Widget mit MRR
- Settings-Tab "Daueraufträge"

**Schritt 3 — UI Zahlungseingänge ✅ erledigt**
- `/zahlungseingaenge` mit KPIs, Filter, Liste
- `CsvImportDialog` (Auto-Mapping, Vorschau)
- `ManuellerEingangDialog`
- `ZuordnenDialog` mit Top-5 Vorschlägen + Score-Badge + Sammelüberweisungen
- Sidebar-Badge (offen + teilweise)
- Dashboard-Widget
- Settings-Tab "Zahlungsabgleich" (Auto-Schwellwert)

**Schritt 4 — Integration ✅ erledigt**
- Rechnungs-Detail: Zahlungen mit "Bank"-Badge, Notiz aus Verwendungszweck
- Mahn-Engine reagiert automatisch (Status `bezahlt`/`teilbezahlt` → Mahnstufe wird neu bewertet)

## Offen für Pi-Backend (Phase E+)
- Echtes CAMT.053 statt CSV
- Cron-Job für DA-Generierung statt Frontend-Scheduler
- E-Mail-Auto-Versand bei DA-Lauf
- Persistente Storage statt LocalStorage

