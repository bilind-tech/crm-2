## Ziel

Auf der Detailseite von Angeboten und Rechnungen soll neben „PDF ansehen" ein Button **„PDF bearbeiten"** sein. Klick öffnet eine eigene **Editor-Route** (Vollbild-Layout):

- **Links**: Live-PDF-Vorschau (alle Seiten scrollbar, sauber gerendert).
- **Rechts**: Vollständiger Bearbeitungs-Panel — Stammdaten, Positionen, Texte, Optionen, Logo/Firmendaten-Override.
- **Klick in die PDF (links)** scrollt das passende Feld rechts ins Sichtfeld und fokussiert es („Click-to-edit"). So entsteht der Word-/Canva-ähnliche Eindruck, ohne dass wir wirklich Text in die PDF zeichnen — die PDF rendert nach jedem Edit live neu.

Das Frontend ist so gebaut, dass das spätere Pi-Backend die identischen API-Endpoints (`PATCH /angebote/:id`, `PATCH /rechnungen/:id`, `GET /firmendaten`, `PATCH /firmendaten`) anspricht — der Mock-Backend-Adapter macht heute schon genau das.

---

## Architektur

```text
src/routes/angebote.$id.bearbeiten.tsx     ← neue Route /angebote/:id/bearbeiten
src/routes/rechnungen.$id.bearbeiten.tsx   ← neue Route /rechnungen/:id/bearbeiten

src/components/pdf-editor/
  PdfEditorLayout.tsx       ← 2-Spalten-Shell (Header + Resizable Split)
  LivePdfPreview.tsx        ← debounced PDF-Renderer (react-pdf)
  PdfFieldOverlay.tsx       ← unsichtbare Klick-Hotspots auf der PDF
  EditorPanel.tsx           ← rechte Spalte, Tab-Navigation
  panels/StammdatenPanel.tsx
  panels/PositionenPanel.tsx     ← wrappt bestehenden PositionenEditor
  panels/TexteOptionenPanel.tsx  ← Anschreiben/Outro/Optionen
  panels/LogoFirmaPanel.tsx      ← Logo-Upload + Firmendaten (per-Beleg-Override)

src/hooks/useBelegEditor.ts    ← lokaler Draft-State, Autosave, Dirty-Tracking
src/lib/pdf/fieldMap.ts        ← Mapping {feldId → PDF-Region}
```

---

## 1. Neue Routen

`src/routes/angebote.$id.bearbeiten.tsx` und `…/rechnungen.$id.bearbeiten.tsx`.

Beide laden den jeweiligen Beleg + Kunde + Firmendaten und rendern `<PdfEditorLayout>`. TanStack-Routenkonvention `*.bearbeiten.tsx` → URL `/angebote/:id/bearbeiten`.

Header: Zurück-Pfeil, Belegnummer, Status-Pill, „Speichern" (manuell, zusätzlich zu Autosave), „Verwerfen", „PDF herunterladen".

---

## 2. Buttons auf den Detailseiten

`src/routes/angebote.$id.tsx` + `src/routes/rechnungen.$id.tsx`:

In `PageHeader.actions` direkt neben „PDF" einen weiteren Button **„PDF bearbeiten"** (Pencil-Icon), der via `<Link to="/angebote/$id/bearbeiten">` navigiert. Der bisherige `PdfViewButton` (Modal-Vollansicht) bleibt unverändert daneben erhalten.

Zusätzlich in `PdfPreviewCard`: zweiten Button „Bearbeiten" neben „PDF ansehen".

---

## 3. PdfEditorLayout (2-Spalten)

```text
┌──────────────────────────────────────────────────────────────┐
│  ←  Angebot AN-2025-001  [Entwurf]      Verwerfen  Speichern │
├───────────────────────────┬──────────────────────────────────┤
│                           │ [Stammdaten][Positionen][Texte]…│
│   ┌──────────────────┐    │                                  │
│   │   PDF Seite 1    │    │  Titel:    [____________]        │
│   │ (klickbare       │    │  Datum:    [____________]        │
│   │  Hotspots)       │    │  Gültig:   [____________]        │
│   └──────────────────┘    │  …                               │
│   ┌──────────────────┐    │                                  │
│   │   PDF Seite 2    │    │                                  │
│   └──────────────────┘    │                                  │
└───────────────────────────┴──────────────────────────────────┘
```

- **Desktop (≥ lg)**: 50/50 split via `react-resizable-panels` (bereits installiert? Falls nicht: wir bauen es mit Grid + Drag-Handle, oder nutzen die schon vorhandene `src/components/ui/resizable.tsx`).
- **Tablet/Mobile**: gestapelt — oben Tabs „Vorschau / Bearbeiten" als Switch, weil Side-by-Side auf 390 px keinen Sinn macht. Der Editor bleibt voll bedienbar, die Preview ist auf Knopfdruck einsehbar.

---

## 4. LivePdfPreview

- Verwendet `generateAngebotPdf` / `generateRechnungPdf` aus `src/lib/pdf/belegPdf.ts`, aber gefüttert mit dem **Draft** statt der gespeicherten DB-Version.
- Re-Render **debounced (300 ms)** nach jeder Änderung im Draft. Während Re-Render: alte PDF bleibt sichtbar mit dezentem Lade-Overlay (kein Flackern, kein leerer Zustand).
- Rendering wie im bestehenden `PdfViewerDialog`: alle Seiten untereinander, container-breite Skalierung, IntersectionObserver für aktuelle Seite.
- Ein einziger Blob-URL-Lifecycle (alter Blob wird mit `URL.revokeObjectURL` ersetzt).

---

## 5. Click-to-Edit (PdfFieldOverlay)

Das ist der Kern des „Word-Gefühls". Wir zeichnen **keine** echten Editierfelder in die PDF (das geht nicht reibungslos und würde den PDF-Bauplan brechen). Stattdessen:

- Über jeder PDF-Seite liegt ein absolut positioniertes SVG/Div-Layer mit unsichtbaren, klickbaren Rechtecken — den **Hotspots**.
- Jeder Hotspot trägt eine `feldId` (z. B. `"titel"`, `"intro"`, `"position:0.beschreibung"`, `"kunde.adresse"`, `"firma.logo"`, `"summe"`).
- Hover: dünner gestrichelter Rahmen + kleines „bearbeiten"-Tooltip.
- Klick: scrollt im rechten Panel zum entsprechenden Tab + Feld, fokussiert das Input, kurzes Highlight.

### Field-Map (`src/lib/pdf/fieldMap.ts`)

Definiert grobe **prozentuale Boxen pro Seite 1** des Standard-Layouts (das Layout ist deterministisch: Header oben, Adresse links, Meta-Tabelle rechts, Titel, Anrede, Intro, Tabelle, Summen, Outro). Beispiel:

```ts
[
  { id: "firma.logo",    page: 1, box: { x: 0.05, y: 0.03, w: 0.30, h: 0.06 } },
  { id: "kunde.adresse", page: 1, box: { x: 0.05, y: 0.13, w: 0.45, h: 0.10 } },
  { id: "meta",          page: 1, box: { x: 0.55, y: 0.13, w: 0.40, h: 0.10 } },
  { id: "titel",         page: 1, box: { x: 0.05, y: 0.27, w: 0.90, h: 0.04 } },
  { id: "intro",         page: 1, box: { x: 0.05, y: 0.33, w: 0.90, h: 0.08 } },
  { id: "tabelle",       page: 1, box: { x: 0.05, y: 0.43, w: 0.90, h: 0.30 } },
  { id: "summe",         page: 1, box: { x: 0.55, y: 0.74, w: 0.40, h: 0.10 } },
  { id: "outro",         page: 1, box: { x: 0.05, y: 0.85, w: 0.90, h: 0.08 } },
]
```

Tabellenzeilen-Hotspots werden **dynamisch** aus den aktuellen Positionen abgeleitet (gleichmäßig zwischen y 0.43 und 0.73 verteilt — gut genug, um „Position 2 anklicken → springt zu Position 2 im Editor").

Das ist absichtlich pragmatisch: keine pixelgenaue PDF-Koordinaten-Berechnung, kein Reverse-Engineering von pdfmake. Wenn das Layout später feiner wird, kann pdfmake einen `pageBreakBefore`-Callback und Bookmarks ausgeben — als Vorbereitung dafür dokumentieren wir die Field-Map als „bewusst grob, später durch echte Koordinaten ersetzbar".

---

## 6. EditorPanel (rechte Spalte)

Tab-Navigation (`Tabs` aus shadcn) mit 4 Tabs:

1. **Stammdaten** — Titel, Kunde (read-only Badge mit „wechseln" → öffnet Picker), Ansprechpartner (`AnsprechpartnerPicker`), Datum, Gültig bis (Angebot) / Rechnungs- + Fälligkeitsdatum (Rechnung), Steuersatz, Gesamtrabatt.
2. **Positionen** — wiederverwendet **bestehenden** `PositionenEditor` (1:1 eingebettet — dort kann der User schon heute alles ändern).
3. **Texte & Optionen** — Anschreiben (Intro), Outro, `OptionenBlock` (Material bereitgestellt, Standard-Anschreiben, Wiederkehrend + Details).
4. **Logo & Firma** — Per-Beleg-Override: Logo-Upload (Datei → Data-URL, gespeichert in `optionen.logoOverride` + `optionen.firmaOverride`). Wenn nichts überschrieben → Hinweis „Aktuell wird das Standard-Logo aus Einstellungen verwendet" + Link zu `/einstellungen`.

Pro Feld: `data-feld-id`-Attribut, damit Click-to-Edit hin-scrollen kann. `useBelegEditor` stellt `focusField(id)` bereit.

---

## 7. useBelegEditor

```ts
const { draft, set, setPosition, addPosition, removePosition,
        isDirty, save, discard, focusField } = useBelegEditor(beleg);
```

- Hält Draft im lokalen State (initial = geladener Beleg).
- `set("titel", value)` patched den Draft-Pfad.
- `isDirty` = Diff zwischen Draft und Original.
- **Autosave**: 1,5 s nach letzter Änderung → `useUpdateAngebot` / `useUpdateRechnung` (existieren). Toast „Gespeichert" am unteren Rand, dezent.
- **Manuelles Speichern** + **Verwerfen** im Header.
- Beim Verlassen mit `isDirty`: `useBlocker` von TanStack Router → Bestätigungsdialog.

---

## 8. Datenmodell-Erweiterung

`src/lib/api/types.ts` → `BelegOptionen`:

```ts
logoOverride?: string;        // Data-URL
firmaOverride?: Partial<Firmendaten>;
```

`belegPdf.ts` so anpassen, dass es bei vorhandenem Override Logo/Firma nimmt statt der Standardquellen.

---

## 9. Backend-Vertrag (für später, nichts zu coden)

Im Frontend werden ausschließlich die **bereits definierten** Endpoints genutzt:

- `GET /angebote/:id` / `PATCH /angebote/:id`
- `GET /rechnungen/:id` / `PATCH /rechnungen/:id`
- `GET /firmendaten` / `PATCH /firmendaten`
- `GET /kunden/:id`

Das Pi-Backend muss nur PATCH auf `optionen.logoOverride` und `optionen.firmaOverride` akzeptieren (zusätzlich zu den vorhandenen Feldern). Drive-Re-Upload nach jedem Save passiert dort wie bisher.

---

## Nicht-Ziele

- **Keine** echte WYSIWYG-Editierung *im* PDF-Canvas (kein Setzen von Text per Mouse-Drag in pdf.js). Wir simulieren es überzeugend via Click-to-Edit + Live-Re-Render.
- Kein Drag-and-Drop von Layout-Bausteinen — Layout bleibt deterministisch.
- Keine neue PDF-Engine. Wir bleiben bei pdfmake; spätere Migration wäre möglich, aber nicht nötig.
- Kollaborative Mehrnutzer-Edits: nicht jetzt.

---

## Reihenfolge der Umsetzung

1. Datenmodell (`BelegOptionen.logoOverride/firmaOverride`) + `belegPdf.ts` Override-Support.
2. `useBelegEditor` Hook + Autosave + Dirty/Blocker.
3. `PdfEditorLayout` + `LivePdfPreview` (ohne Click-to-Edit) + `EditorPanel` mit Stammdaten- und Positionen-Tab.
4. Routen `/angebote/:id/bearbeiten` und `/rechnungen/:id/bearbeiten`, Buttons auf Detailseiten.
5. Texte/Optionen-Tab + Logo-/Firma-Tab.
6. `PdfFieldOverlay` + `fieldMap.ts` + `focusField`-Wiring.
7. Mobile-Variante (Tabs „Vorschau/Bearbeiten").
