
# Phase C — Mahnwesen (Frontend + Mock-Backend)

## Was Mahnwesen ist — kurz

Wenn ein Kunde nicht zahlt, schreibst du ihm in **mehreren Stufen**: erst freundlich erinnern, dann bestimmter mahnen, schließlich letzte Aufforderung. Jede Stufe hat ein Datum, eine Frist, optional eine Mahngebühr — und alles muss nachvollziehbar sein.

Heute hast du **eine** Mahnvorlage und einen einzelnen Button "Mahnung senden" auf der Rechnungs-Detailseite. Das reicht weder rechtlich noch praktisch.

---

## Die 5 Ziele

1. **3 saubere Mahnstufen** statt einer pauschalen Mahnung
2. **Auto-Erkennung:** Rechnungen werden ohne Klick "überfällig", sobald die Fälligkeit überschritten ist; die fällige Mahnstufe wird vorgeschlagen
3. **Mahn-Cockpit** (`/mahnungen`) — eine zentrale Liste "diese Rechnungen sind dran", sortiert nach Dringlichkeit
4. **Mahn-Historie** pro Rechnung — wer wann mit welcher Stufe und Frist angeschrieben wurde, lückenlos
5. **Mahngebühren** konfigurierbar pro Stufe (z.B. 0 € / 5 € / 10 €), korrekt im Mahnschreiben angezeigt

---

## Konzept: Die 3 Stufen (Defaults — alles konfigurierbar)

| # | Bezeichnung | Trigger | Ton | Mahngebühr | Neue Frist |
|---|---|---|---|---|---|
| 1 | Zahlungserinnerung | 3 Tage nach Fälligkeit | freundlich | 0 € | +7 Tage |
| 2 | 1. Mahnung | 10 Tage nach Stufe 1 | bestimmt | 5 € | +7 Tage |
| 3 | Letzte Mahnung | 10 Tage nach Stufe 2 | letzte Aufforderung, Inkasso-Hinweis | 10 € | +7 Tage |

Nach Stufe 3: Rechnung wird als **"Inkasso-reif"** markiert — keine weitere automatische Mahnung. Du entscheidest manuell (Inkasso, Anwalt, abschreiben).

**Wichtige Regel:** Eine Stufe wird erst "fällig vorgeschlagen", wenn die in der vorigen Stufe gesetzte **neue Frist** abgelaufen ist. Das vermeidet, dass jemand am Tag nach der Erinnerung schon die 1. Mahnung bekommt.

---

## Die UI im Detail

### 1. Neues Mahn-Cockpit `/mahnungen`

Die wichtigste neue Seite. Reduziert das Problem "wo sind meine offenen Posten?" auf einen Klick.

```text
┌─────────────────────────────────────────────────────────────┐
│ Mahnwesen                                                   │
│                                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │ Erinnerg.│ │ 1. Mahng.│ │ Letzte M.│ │ Inkasso  │       │
│ │   3      │ │    2     │ │    1     │ │    1     │       │
│ │ 1.240 €  │ │  890 €   │ │ 1.200 €  │ │  900 €   │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
│ Filter: [ Alle ▾ ]  [ ↓ Dringlichkeit ]                    │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ ▌ RE-2025-014 · Müller GmbH                        │    │
│ │   850 € offen · 12 Tage überfällig                 │    │
│ │   FlowBar: ●─●─○─○ (1. Mahnung empfohlen)          │    │
│ │   [Mahnung vorbereiten]  [Verschieben ▾]           │    │
│ ├─────────────────────────────────────────────────────┤    │
│ │ ▌ RE-2025-009 · Schmidt KG                         │    │
│ │   1.200 € offen · 38 Tage · letzte Mahnung am 15.4 │    │
│ │   FlowBar: ●─●─●─○                                 │    │
│ │   [Inkasso-Vorgang starten]                        │    │
│ └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

- **4 KPI-Karten** = 4 Stufen mit Anzahl + Summe (klickbar = filtert die Liste)
- Sortierung default: dringendste oben (Tage seit Fälligkeit · Summe als Tiebreaker)
- Zeile = klickbar zur Rechnungs-Detailseite, Primary-Button öffnet direkt den Versand-Dialog mit vorausgewählter Stufe
- "Verschieben" = Mahnstufe um X Tage pausieren (z.B. wenn Kunde Zahlung mündlich zugesagt hat)
- Mobil: Karten stapeln sich, Aktions-Button volle Breite

### 2. Sidebar-Eintrag "Mahnungen" mit Live-Badge

Neuer Menüpunkt unter "Rechnungen" mit roter Badge-Zahl = Anzahl der Rechnungen, bei denen mindestens eine Stufe **fällig** (nicht versendet) ist. Sofort sichtbar, ohne irgendwo reinzuklicken.

### 3. Rechnungs-Detailseite — Mahn-Sektion neu

Ersetzt den heutigen einzelnen "Mahnung senden"-Button:

```text
┌───────────────────────────────────────────────┐
│ MAHNVERFAHREN                                 │
│                                               │
│ Stufenfortschritt: ●─●─○─○                   │
│                                               │
│ ✓ Zahlungserinnerung · 03.04.2026 · Frist 10.4│
│ ✓ 1. Mahnung         · 14.04.2026 · Frist 21.4│
│ ▸ Letzte Mahnung empfohlen seit 22.04.        │
│                                               │
│ [ Letzte Mahnung versenden (10 € Gebühr) ]   │
│ Stufe ändern ▾    Mahnverfahren pausieren    │
└───────────────────────────────────────────────┘
```

- Pro versendeter Stufe: Datum, Frist, Gebühr, Klick öffnet die zugehörige E-Mail in der Versand-Historie
- **Primary-Action** = nächste empfohlene Stufe (oder "Inkasso starten" nach Stufe 3)
- "Stufe ändern" = Dropdown, falls du eine Stufe überspringen oder wiederholen willst
- "Pausieren" = z.B. "Kunde hat versprochen bis 30.4. zu zahlen" — bis dahin keine Vorschläge

### 4. Versand-Dialog erweitert

`EmailVersandDialog` bekommt im Mahn-Kontext ein zusätzliches Feld oben:

- Dropdown "Mahnstufe" (vorausgewählt: empfohlene Stufe)
- Wechsel der Stufe → Vorlage tauscht automatisch, Mahngebühr-Hinweis aktualisiert sich, neue Frist wird neu berechnet
- Info-Box unter dem Editor: "Mahngebühr 5 € · neue Frist: 21.04.2026" — beides als Platzhalter `{{mahnung.gebuehr}}` und `{{mahnung.neueFrist}}` automatisch im Body verwendbar
- Beim Versand wird zusätzlich zur E-Mail ein **MahnVorgang**-Eintrag angelegt und mit der `EmailVersand`-ID verknüpft

### 5. Einstellungen → neuer Tab "Mahnwesen"

In `src/routes/einstellungen.tsx` als zusätzlicher Tab neben "E-Mail":

- 3 Stufen-Cards (Bezeichnung, Tage nach Vorgänger, Gebühr in €, Frist in Tagen, zugeordnete E-Mail-Vorlage)
- Master-Schalter: "Auto-Vorschlag aktiviert" (wenn aus: nur manuelle Mahnungen)
- Reset-Button "Auf Standard zurücksetzen"

### 6. Rechnungsliste-Verbesserung

In der existierenden `/rechnungen`-Tabelle: kleine Spalte "Mahnstufe" (●●○ Mini-Indikator) — auf einen Blick sichtbar, ohne in die Detailseite zu müssen.

### 7. Dashboard-Kachel

Auf `/` neue KPI-Karte "Mahnungen offen" (Anzahl + Summe) mit Link aufs Cockpit.

---

## Die intelligente Logik (Auto-Status)

Beim Laden jeder Rechnungsabfrage läuft `bestimmeAktuelleStufe(rechnung, config)` — eine **reine Funktion**, kein gespeicherter Zustand:

1. Wenn voll bezahlt oder storniert → Mahnkette beendet (Historie bleibt sichtbar)
2. Berechne `tageSeitFaelligkeit`
3. Prüfe Mahn-Historie: was war die letzte versendete Stufe? Wann war ihre Frist?
4. Ist Frist abgelaufen → nächste Stufe wird **empfohlen**
5. Bei Teilzahlung: Mahnstufe pausiert nicht, aber "Offen-Betrag" wird neu berechnet — sonst würde ein Kunde mit 1 € Restzahlung nie wieder gemahnt
6. Pausierung (`pausiertBis`-Datum) übersteuert alles bis zum Datum

**Status `ueberfaellig`** wird automatisch gesetzt, sobald `faelligkeitsdatum < heute && offen > 0 && status === "versendet"`. Beim Backend-Switch wandert das in einen Cron-Job auf dem Pi.

---

## Datenmodell (neu)

**Erweiterung `Rechnung`:**
```ts
mahnungen: MahnVorgang[];   // versendete Mahnungen, chronologisch
mahnPausiertBis?: ISODate;  // optional, "nicht vor diesem Datum mahnen"
```

**Neuer Typ:**
```ts
interface MahnVorgang {
  id: ID;
  rechnungId: ID;
  stufe: 1 | 2 | 3;
  versendetAm: ISODateTime;
  neueFrist: ISODate;
  gebuehr: number;            // EUR, in Mahnschreiben angezeigt
  emailVersandId?: ID;        // Verknüpfung zu EmailVersand für Audit
}

interface MahnStufeConfig {
  stufe: 1 | 2 | 3;
  bezeichnung: string;
  tageNachVorgaenger: number; // Stufe 1: Tage nach Fälligkeit
  gebuehr: number;
  fristTage: number;
  emailVorlageId?: ID;
}

interface MahnEinstellungen {
  autoVorschlagAktiv: boolean;
  stufen: MahnStufeConfig[];   // genau 3
}
```

**Globale Einstellungen** bekommen `mahnung: MahnEinstellungen` im DB-Mock.

---

## Mahngebühr — Designentscheidung

Die Mahngebühr wird **nicht** als zusätzliche Position in die Rechnung eingefügt (das würde die ursprüngliche Rechnung manipulieren — buchhalterisch heikel). Stattdessen:

- Gebühr ist **Eigenschaft des MahnVorgangs**
- Erscheint im Mahn-E-Mail-Body via Platzhalter `{{mahnung.gebuehr}}` und im Gesamtsatz `{{mahnung.gesamtForderung}}` (= offen + Gebühr)
- Im Mahn-Cockpit und Detail-Sektion wird sie separat ausgewiesen
- Spätere echte Buchung im Backend kann das als separate Forderung führen

---

## Neue Platzhalter (für E-Mail-Vorlagen)

Ergänzung in `src/lib/email/placeholders.ts`:

- `{{mahnung.stufe}}` — "Zahlungserinnerung" / "1. Mahnung" / "Letzte Mahnung"
- `{{mahnung.gebuehr}}` — formatierter EUR-Betrag
- `{{mahnung.neueFrist}}` — formatiertes Datum
- `{{mahnung.gesamtForderung}}` — offen + Gebühr formatiert
- `{{mahnung.tageUeberfaellig}}` — Zahl

---

## Geänderte und neue Dateien

**Neu:**
- `src/routes/mahnungen.tsx` — Cockpit-Seite
- `src/components/mahnung/MahnCockpit.tsx` — KPIs + Liste
- `src/components/mahnung/MahnSektion.tsx` — Block für Detailseite
- `src/components/mahnung/MahnHistorieListe.tsx` — versendete Stufen
- `src/components/mahnung/MahnStufenIndikator.tsx` — ●●○ Mini-FlowBar
- `src/components/mahnung/MahnEinstellungen.tsx` — Settings-Tab
- `src/components/mahnung/MahnPausierenDialog.tsx`
- `src/lib/mahnung/regeln.ts` — `bestimmeAktuelleStufe()`, `mahnenEmpfohlen()`, Helper
- `src/lib/mahnung/defaults.ts` — Standard-3-Stufen-Config

**Erweitert:**
- `src/lib/api/types.ts` — neue Typen + Erweiterung `Rechnung`
- `src/lib/mock/seed.ts` — 3 Mahn-Standardvorlagen, MahnEinstellungen, 3-4 realistisch überfällige Beispiel-Rechnungen mit teils existierender Mahn-Historie
- `src/lib/mock/backend.ts` — DB-Migration auf `v6`, Endpoints: `getMahnEinstellungen`, `updateMahnEinstellungen`, `mahnungVersenden(rechnungId, stufe)` (legt MahnVorgang an + ruft sendEmail intern auf), `mahnungPausieren`
- `src/hooks/useApi.ts` — `useMahnEinstellungen`, `useUpdateMahnEinstellungen`, `useMahnungVersenden`, `useMahnUebersicht` (aggregiert für Cockpit + Sidebar-Badge)
- `src/lib/email/placeholders.ts` — neuer `mahnung`-Block im PlaceholderContext
- `src/components/email/EmailVersandDialog.tsx` — Stufen-Dropdown bei `kontext === "mahnung"`, ruft `useMahnungVersenden` statt nur `useSendEmail`
- `src/routes/rechnungen.$id.tsx` — neue MahnSektion ersetzt heutigen Mahnung-Button
- `src/routes/rechnungen.tsx` — Mahnstufen-Spalte, KPI "Überfällig" wird klickbar zum Cockpit
- `src/routes/einstellungen.tsx` — neuer Tab "Mahnwesen"
- `src/components/layout/AppSidebar.tsx` — neuer Menüpunkt mit Badge
- `src/routes/index.tsx` (Dashboard) — Kachel "Mahnungen offen"
- `src/lib/flow/flows.ts` — `rechnungFlow` zeigt Mahnstufen, falls überfällig, als zusätzliche Schritte (oder dezentes Sub-Element unter "Versendet")

---

## Was Phase C NICHT macht

- Echter E-Mail-Versand (Mock simuliert weiter mit 1.2s Delay + 10% Fail)
- Echte Inkasso-API-Anbindung — "Inkasso-reif" ist nur Markierung + manueller Workflow
- Verzugszinsen-Berechnung (nach §288 BGB) — kann in Phase F nachgereicht werden, falls gewünscht
- SMS- oder Briefpost-Mahnungen
- PDF-Anlage Mahnung als separates Dokument (die Original-Rechnung wird angehängt, das reicht in der Praxis)

---

## Reihenfolge der Umsetzung

1. **Datenmodell + Defaults** (`types.ts`, `defaults.ts`, DB-Migration `v6`)
2. **Regel-Engine** (`regeln.ts` mit Unit-tauglicher reiner Funktion)
3. **Mock-Backend-Endpoints** + **Hooks** + neue **Platzhalter**
4. **Seed-Daten:** 3 Standardvorlagen (Erinnerung / 1. Mahnung / Letzte) + 3-4 überfällige Beispiel-Rechnungen mit teils schon laufender Mahnkette
5. **Einstellungs-Tab "Mahnwesen"**
6. **Mahn-Sektion** auf Rechnungs-Detailseite + Versand-Dialog-Erweiterung
7. **Mahn-Cockpit** `/mahnungen` + Sidebar-Badge + Dashboard-Kachel + Tabellen-Spalte

Sag "los Phase C" — dann baue ich das in einem Rutsch durch.
