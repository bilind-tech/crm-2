## Ziel

Drei zusammenhängende UI-Verbesserungen:

1. Slide-Over (Neue Rechnung / Neues Angebot) öffnet butterweich statt ruckelig.
2. In den Beleg-Formularen wird der Ansprechpartner direkt sichtbar angezeigt (nicht eingeklappt) und ist wechselbar; „Dauerauftrag" bekommt einen eigenen, prominenten Schalter.
3. Die Dashboard-Buttons / KPI-Karten bekommen mehr Farbe, weniger Eckenrundung und einen klareren Look.

---

## 1. Slide-Over Animation cleanen

Datei: `src/components/ui/slide-over.tsx`

- Aktuelle Animation nutzt `data-[state=open]:slide-in-from-right` von tailwindcss-animate. Das ruckelt, weil:
  - Die Animation läuft auf `transform: translate3d` + `opacity` mit `duration-500`.
  - Der Backdrop animiert gleichzeitig mit Blur, was auf schwächeren Layern Repaints triggert.
- Änderungen:
  - Eigene CSS-Keyframes (`@keyframes slideOverIn` mit `transform: translate3d(100%,0,0) → 0`) in `src/styles.css` hinterlegen, mit `cubic-bezier(0.32, 0.72, 0, 1)` (Apple-Easing) und `duration: 280ms`.
  - Backdrop ohne `backdrop-blur`, nur `bg-foreground/20` mit Fade 200ms.
  - `will-change: transform` setzen; Content `transform: translateZ(0)` damit GPU-Layer fest.
  - Schließ-Animation 220ms mit gleicher Easing.
- Resultat: Sehr clean, kein Stutter beim ersten Öffnen.

## 2. Ansprechpartner-Block in Beleg-Formularen

Dateien:
- `src/components/forms/AngebotForm.tsx`
- `src/components/forms/RechnungForm.tsx`
- neu: `src/components/forms/AnsprechpartnerPicker.tsx`

Neuer Block direkt unter Kunde/Objekt, immer sichtbar (nicht in `OptionenBlock` versteckt):

```text
┌─ Ansprechpartner ───────────────────────────────┐
│ Frau Müller · Geschäftsleitung                  │
│ → wird angeschrieben mit „Sehr geehrte Frau …"  │
│ [▼ wechseln]   [+ neuer Ansprechpartner]        │
└─────────────────────────────────────────────────┘
```

- `AnsprechpartnerPicker` lädt via `useAnsprechpartner(kundeId)` (existiert bereits über `useKunde`/Backend), wählt initial den `primaer:true`-Ansprechpartner.
- Anzeigt: Anrede + Vorname + Nachname + Position; darunter Vorschau der Anrede-Zeile („Sehr geehrte Frau …").
- Wechseln per Dropdown (shadcn `Select`).
- „+ neuer Ansprechpartner" öffnet eine kleine Inline-Form (Anrede, Vor-/Nachname, Position, E-Mail) und speichert via `useCreateAnsprechpartner`.
- Wenn Kunde keinen Ansprechpartner hat: Hinweisbox „Noch kein Ansprechpartner — jetzt anlegen".

Form-State erweitern:
- `ansprechpartnerId: string | undefined`
- Bei Submit: wird (falls neue Spalten gewünscht) im `notizen`-Feld oder via neues Feld `ansprechpartnerId` an Beleg gehängt. → Dazu `Angebot` und `Rechnung` in `src/lib/api/types.ts` um `ansprechpartnerId?: ID` erweitern und im Mock-Backend (`backend.ts`) durchreichen.
- Anrede-Vorschau wird auch ins PDF (`src/lib/pdf/belegPdf.ts`) übernommen — der Intro-Block beginnt mit „Sehr geehrte/r {Anrede} {Nachname}," wenn kein eigener Intro-Text aktiv ist.

## 3. „Dauerauftrag" raus aus Optionen-Akkordeon

- `OptionenBlock.tsx`: Checkbox „Dauerauftrag" bleibt drin, aber die Beleg-Forms zeigen zusätzlich oben (neben dem Titel) einen Toggle-Chip „Dauerauftrag", damit der wichtigste Schalter nicht versteckt ist. Beide States sind verbunden.
- Optionen-Bereich bleibt ansonsten so wie er ist (vorherige Anweisung des Users: nicht eingeklappt — also bleibt er als sichtbarer Block).

## 4. Dashboard-Buttons / KPI-Cards

Dateien: `src/components/layout/PageHeader.tsx` (KpiCard), `src/routes/index.tsx`, `src/components/ui/button.tsx` (nur falls nötig).

- KpiCard:
  - `rounded-2xl` → `rounded-xl` (weniger stark abgerundet).
  - Farbiger Akzent links als 3px-Streifen je nach `tone` (`primary | success | danger | default`).
  - Icon-Badge bekommt farbigen Hintergrund passend zum Tone (`bg-primary/10 text-primary` etc.) statt einheitlichem grau.
  - Wert in 2xl statt 3xl, Label etwas größer und mit Farbe.
- Dashboard `index.tsx`: Den vier KPIs bewusst je eigenen Tone geben (Kunden=primary, Aufträge=default, Umsatz=success, Offene Rechnungen=danger), so wirkt das Dashboard farbiger und lebendiger.
- „Neue Rechnung" / „Neues Angebot" Buttons in `rechnungen.tsx`/`angebote.tsx`: `rounded-full px-5` → `rounded-lg px-4`, kleiner, mit `bg-primary` solid und subtilem Hover-Schimmer.

---

## Technische Details (Kurz)

- `src/styles.css`: neue Keyframes `slideOverIn`/`slideOverOut` + Backdrop-Fade, plus Utility-Klassen.
- `src/components/ui/slide-over.tsx`: neue Klassen, kein `backdrop-blur` mehr, kürzere Dauer.
- `src/lib/api/types.ts`: `Angebot.ansprechpartnerId?` + `Rechnung.ansprechpartnerId?`.
- `src/lib/mock/backend.ts`: Feld bei Create/Patch durchreichen; Seed unverändert.
- `src/components/forms/AnsprechpartnerPicker.tsx`: neu (Anzeige + Select + Inline-Anlage).
- `src/components/forms/AngebotForm.tsx`, `RechnungForm.tsx`: Picker einbauen, Dauerauftrag-Toggle oben.
- `src/lib/pdf/belegPdf.ts`: Anrede aus Ansprechpartner für Intro nutzen.
- `src/components/layout/PageHeader.tsx`: KpiCard-Refresh.
- `src/routes/index.tsx`: KPIs mit Tones versehen.

Keine neuen Pakete nötig.
