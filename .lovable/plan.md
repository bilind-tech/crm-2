## 1. Neue mobile FilterBar (alle Listenseiten)

Aktuell: Pillen-Tabs brechen unschön um, doppelter Container, Suche separat darunter — wirkt überladen. Auf Touch zu klein.

Neu für Mobile (`<md`):
- **Sticky Toolbar** direkt unter dem Header, eine Zeile, bündig:
  - Kompaktes **Such-Icon-Feld** (volle Breite, dezent), Tap = Cursor rein, kein Modal-Sprung mehr.
  - Rechts daneben ein **„Filter"-Button mit Gegenstand-Counter** (z. B. „Alle" / „Versendet · 1").
- Klick auf den Filter-Button öffnet ein **Bottom-Sheet** (vom unteren Rand hoch, native-feel) mit:
  - Großen, fingerfreundlichen Status-Zeilen (Häkchen + Label + Count rechts).
  - Schließen automatisch nach Auswahl.
- Status-Pillen werden auf Mobile **komplett ausgeblendet** (sie brachen vorher um). Auf Desktop/Tablet (`md:`) bleibt die heutige Pillen-Leiste 1:1 erhalten.

Datei: `src/components/layout/FilterBar.tsx` (neu) — wird aus `src/routes/angebote.tsx` re-exportiert, um Imports in `rechnungen/kunden/objekte/dokumente.tsx` nicht zu brechen. Bottom-Sheet basiert auf dem vorhandenen `Dialog`/`Drawer` aus `src/components/ui/`.

## 2. Dokumente erweitern: Titel, Frist, Mahn-Status

### Datenmodell (`src/lib/api/types.ts`)
`Dokument` bekommt:
- `titel` ist bereits vorhanden — bleibt editierbar.
- `faelligAm?: ISODate` — bis wann zu erledigen (z. B. „Belege ans Steuerbüro").
- `erledigtAm?: ISODateTime` — als erledigt markiert.
- bereits vorhandene `beschreibung`, `dokumentdatum`, `betrag`, `steuerrelevant` werden ebenfalls editierbar gemacht.

Status leitet sich ab (kein zusätzliches Feld nötig):
- `erledigtAm` gesetzt → **erledigt**
- sonst `faelligAm < heute` → **überfällig**
- sonst `faelligAm` in <= 3 Tagen → **bald fällig**
- sonst → **offen**

### Bearbeiten-Dialog `DokumentBearbeitenDialog`
Neu unter `src/components/dokumente/DokumentBearbeitenDialog.tsx`:
- Titel, Beschreibung, Typ, Dokumentdatum, **Frist (faelligAm)**, Betrag, „Steuerrelevant"-Toggle, „Erledigt"-Toggle.
- Bild-/PDF-Vorschau oben.
- Speichern → `useUpdateDokument` (PATCH).

### Hooks & Mock-Backend
- `useUpdateDokument` neu in `src/hooks/useApi.ts` (PATCH `/dokumente/:id`).
- Mock-Backend: PATCH-Handler analog zu Angeboten (`Object.assign`).

### Dokumente-Liste
- Tap auf Dokument-Karte/Zeile → öffnet Bearbeiten-Dialog.
- Status-Badge sichtbar: grau „Offen", orange „Bald fällig", rot „Überfällig", grün „Erledigt".
- Frist-Datum als Sublabel.

### Benachrichtigungen für überfällige Dokumente
- Bestehender `scheduler` (`src/lib/mock/scheduler.ts`) bekommt einen zusätzlichen Pass: durchsucht alle Dokumente, bei denen `faelligAm < heute` und `erledigtAm == null` und für die noch keine Benachrichtigung existiert (Schlüssel: `dokument:<id>:ueberfaellig`) → erstellt `Benachrichtigung` mit Link `/dokumente`.
- Erscheint dann sofort im vorhandenen Glocken-Popover oben rechts (nutzt `GET /benachrichtigungen`, ist bereits angeschlossen).
- Wird ein Dokument als erledigt markiert → entsprechende ungelesene Benachrichtigung wird mit-gelöscht (Idempotenz).

### Dashboard-KPI
- Neue kleine KPI „Offene Dokumente" mit Count, falls > 0 → tone `warning`. Auf Dokumente-Seite eigene KPI-Karte „Überfällig" ergänzen (ersetzt eine vorhandene Karte, damit es 4 bleiben).

## Was NICHT angefasst wird
- Vorhandener Drag&Drop-Uploader und Handy-Scan-Brücke bleiben unverändert.
- Pillen-Filter auf Desktop/Tablet bleibt.
- Bestehende Benachrichtigungen für andere Bereiche.
