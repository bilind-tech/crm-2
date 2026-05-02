## Ziel

Dokumente werden zur richtigen Ablage: jedes Dokument lässt sich (optional) mit Titel, Beschreibung, Typ, Frist, Betrag und vor allem **einem Kunden** und/oder **Objekt** verknüpfen. In der Übersicht kann nach Kunde/Objekt **gefiltert** und volltext-gesucht werden. Per Klick öffnet sich ein **Viewer**, der PDFs (auch viele Seiten) und Bilder fehlerfrei auf Desktop und Handy anzeigt, mit **Download** und **Drive-Sync-Status**.

---

## 1. Bearbeiten-Dialog: Kunde + Objekt verknüpfen

**Datei:** `src/components/dokumente/DokumentBearbeitenDialog.tsx`

Neue Felder im Formular (alle optional):
- **Kunde** — Combobox (Suche nach Name/Nummer) über `useKunden()`
- **Objekt** — Select, gefiltert nach gewähltem Kunden über `useObjekte(kundeId)`. Wenn Kunde leer → Objekt-Select disabled.

State: `kundeId`, `objektId`. Beim Speichern an `useUpdateDokument` mitsenden (Felder existieren bereits in `Dokument`-Typ).

Drive-Sync-Anzeige im Dialog (klein, dezent, oben rechts neben dem Titel):
- ✓ „In Google Drive gesichert" (mit Tooltip Datum + Link öffnen)
- ⏳ „Wird synchronisiert…"
- ⚠ „Sync fehlgeschlagen" (mit Fehlermeldung im Tooltip)
- — „Noch nicht synchronisiert"

Status-Mapping nutzt `Dokument.drive` (existiert noch nicht im Typ → siehe Punkt 5).

---

## 2. Übersicht: Filter nach Kunde/Objekt + erweiterte Suche

**Datei:** `src/routes/dokumente.tsx`

- Volltextsuche erweitert: Titel, Dateiname, **Beschreibung**, **Kundenname**, **Objektname** (Lookup über `useKunden()` + `useObjekte()`).
- Neue Filter-Zeile unter `FilterBar` (analog zu `ZeitraumFilter`):
  - **Kunden-Select** („Alle Kunden" + Liste)
  - **Objekt-Select** (gefiltert nach Kunde, „Alle Objekte" + Liste)
  - **Reset**-Button
- Tabellenspalte „Kunde / Objekt" zwischen „Typ" und „Frist" einfügen (Desktop). Mobil: zusätzliche Zeile in `DokumentCard`.
- Kleines **Drive-Sync-Icon** (12px, dezent) rechts neben dem Titel in Tabelle und Karte.

---

## 3. Dokument-Viewer (neu)

**Neue Datei:** `src/components/dokumente/DokumentViewer.tsx`

Vollbild-Sheet (Headless-`Dialog` ohne max-width, `inset-0`), das beim Klick auf ein Dokument vor dem Bearbeiten-Dialog geöffnet wird. Layout:

```text
┌──────────────────────────────────────┐
│ Titel · Dateiname    [↓][✏][✕]      │ Header
├──────────────────────────────────────┤
│                                      │
│   PDF / Bild / Fallback              │ Body (scroll)
│                                      │
├──────────────────────────────────────┤
│ Kunde · Objekt · Drive-Status        │ Footer
└──────────────────────────────────────┘
```

Renderlogik nach `mimeType`:
- **`image/*`** → `<img>` mit `object-contain`, Pinch-Zoom über native Browser-Geste (touch-action: pinch-zoom).
- **`application/pdf`** → natives `<iframe src={url} />` mit `width=100% height=100%`. Browser-PDF-Viewer kann beliebig viele Seiten, hat eingebautes Scrollen, Zoom, Suche — funktioniert sowohl auf Desktop als auch auf modernen mobilen Browsern (iOS Safari & Chrome zeigen PDFs inline an). Fallback-Hinweis „Auf manchen Handys öffnet sich das PDF extern" + großer „Im neuen Tab öffnen"-Button für ältere Browser.
- **Sonstige** → großer Download-Button + Hinweis „Vorschau nicht verfügbar".

Header-Buttons:
- ↓ **Download**: erzeugt `<a href={url} download={dateiname}>` und klickt programmatisch.
- ✏ **Bearbeiten**: schließt Viewer, öffnet `DokumentBearbeitenDialog`.
- ✕ **Schließen**.

Footer zeigt:
- Verknüpften Kunden (klickbar → `/kunden/$id`) und Objekt (klickbar → `/objekte/$id`).
- **Drive-Sync-Status** als Badge mit Link „In Drive öffnen" wenn `drive.webViewLink` vorhanden.

Mobile: Header sticky, Body `flex-1 overflow-auto`, Footer sticky am unteren Rand mit `safe-area-inset-bottom`.

**Integration in `dokumente.tsx`:** statt direkt `setEditing(d)` zu setzen, neuen State `viewing` einführen. Klick auf Karte/Zeile öffnet Viewer; aus dem Viewer heraus geht der „Bearbeiten"-Knopf in den bestehenden Dialog.

---

## 4. Drive-Sync-Status (UI-only, Backend folgt)

**Datei:** `src/lib/api/types.ts`

Bereits vorhanden: `DriveSyncInfo` (für Angebot/Rechnung). Diesen Typ am `Dokument`-Interface ergänzen:

```ts
export interface Dokument {
  // … bestehende Felder
  drive?: DriveSyncInfo;
}
```

**Neue Datei:** `src/components/dokumente/DriveSyncBadge.tsx`

Wiederverwendbares Mini-Badge (size „xs" / „sm") mit drei Zuständen:
- `synced` (✓ grün, Tooltip „In Drive gesichert · {Datum}", optional Link zu `webViewLink`)
- `pending` (⏳ grau, „Wird synchronisiert…")
- `error` (⚠ warning, Tooltip mit Fehler + „Erneut versuchen"-Hinweis)
- `none` → nichts rendern (oder optional „—" bei Detail-Ansicht)

Logik:
```ts
function driveState(d: Dokument): "synced"|"pending"|"error"|"none" {
  if (!d.drive) return "none";
  if (d.drive.error) return "error";
  if (d.drive.fileId) return "synced";
  return "pending";
}
```

Im Mock-Backend (`src/lib/mock/seed.ts` / `backend.ts`) für ~2/3 der Bestands-Dokumente einen `synced`-Status seeden, damit der Status-Indikator sichtbar ist. Echte Sync übernimmt später das Pi-Backend (siehe Memory: `mem://features/google-drive`).

---

## 5. Mobile-Optimierung

- `DokumentBearbeitenDialog`: bei Mobil als Bottom-Sheet (volle Breite, `max-h-[90vh]`, scroll). Bereits Dialog — nur `sm:max-w-lg` und `max-h-[90vh] overflow-y-auto` ergänzen.
- `DokumentViewer` ist fullscreen → kein zusätzlicher Aufwand.
- Filter-Zeile mit Kunde/Objekt: auf Mobil zwei Selects untereinander (`grid-cols-1 sm:grid-cols-3`).

---

## Geänderte / neue Dateien

**Neu:**
- `src/components/dokumente/DokumentViewer.tsx`
- `src/components/dokumente/DriveSyncBadge.tsx`

**Geändert:**
- `src/routes/dokumente.tsx` — Kunde/Objekt-Filter, erweiterte Suche, Drive-Badge in Liste, Viewer-Integration
- `src/components/dokumente/DokumentBearbeitenDialog.tsx` — Kunde- & Objekt-Felder, Drive-Status-Anzeige, Mobile-Scroll
- `src/lib/api/types.ts` — `drive?: DriveSyncInfo` an `Dokument`
- `src/lib/mock/seed.ts` (oder `backend.ts`) — vereinzelt Dummy-Drive-Status seeden, damit UI sichtbar ist

---

## Nicht im Scope (bewusst weggelassen)

- Echter Google-Drive-Upload (passiert im Pi-Backend; Frontend zeigt nur Status).
- PDF-Annotation/-Highlight (Browser-PDF-Viewer reicht).
- Mehrfach-Verknüpfung eines Dokuments mit mehreren Kunden — Datenmodell bleibt 1:1 (`kundeId?`, `objektId?`).
