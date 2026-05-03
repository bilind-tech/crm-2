# Übergabeprotokoll & Schlüsselübergabe: echter Live-Editor mit Preview, Speichern als „Protokoll"-Datensatz und permanente Einsicht

Ziel: gleiches Erlebnis wie Angebot/Rechnung — Formular links, Live-PDF-Preview rechts, Klick-zum-Bearbeiten in der Vorschau, autosaved als persistenter Datensatz, jederzeit aufrufbar. Kein E-Mail-Versand involviert. Heute: nur „PDF erstellen" → kein Datensatz, kein Wiederöffnen.

## Wie Angebot/Rechnung das macht (Referenz)

- Datensatz im Backend (`Angebot`/`Rechnung`) mit ID + Status.
- Liste-Route + Detail-Route + `:id/bearbeiten`-Route.
- `PdfEditorLayout` (split: `LivePdfPreview` + `EditorPanel` mit Tabs) → `useBelegEditor` hält Draft, Autosave 1.5 s über `useUpdate*`.
- `LivePdfPreview` baut die PDF debounced aus dem Draft via `generateAngebotPdf` / `generateRechnungPdf`, atomarer URL-Swap.

## Neue Datentypen (`src/lib/api/types.ts`)

```ts
export type ProtokollKind = "uebergabe" | "schluessel";
export type ProtokollStatus = "entwurf" | "abgeschlossen";

export interface ProtokollBase {
  id: ID;
  kind: ProtokollKind;
  nummer: string;            // PR0526/01 / SU0526/01
  status: ProtokollStatus;
  kundeId?: ID;
  objektId?: ID;
  datum: ISODate;
  uhrzeit: string;           // HH:MM
  vertreterAuftraggeber: string;
  vertreterAuftragnehmer: string;
  dokumentId?: ID;           // Verknüpfung zur PDF in „Dokumente"
  erstelltAm: ISODateTime;
  aktualisiertAm: ISODateTime;
}

export interface UebergabeProtokoll extends ProtokollBase {
  kind: "uebergabe";
  art: "uebergabe" | "abnahme" | "beides";
  leistungsumfang: string;
  bemerkungen: string;
  ohneVorbehalt: boolean;
}

export interface SchluesselProtokoll extends ProtokollBase {
  kind: "schluessel";
  richtung: "ausgabe" | "ruecknahme";
  schluessel: { bezeichnung: string; anzahl: number; schluesselNr: string; bemerkung: string }[];
  pfandEur?: number;
  bestaetigt: boolean;
}

export type Protokoll = UebergabeProtokoll | SchluesselProtokoll;
```

## Mock-Backend (`src/lib/mock/backend.ts`)

CRUD-Endpoints exakt wie bei Belegen:

- `GET /protokolle?kind=…&kundeId=…` (Liste)
- `GET /protokolle/:id`
- `POST /protokolle` (legt Entwurf an, generiert Nummer aus bestehendem `nextProtokollNummer`)
- `PATCH /protokolle/:id` (Autosave)
- `DELETE /protokolle/:id`
- `POST /protokolle/:id/abschliessen` → setzt Status `abgeschlossen`, baut PDF, legt zugehöriges `Dokument` an (Typ `protokoll`), speichert `dokumentId` am Protokoll.

Persistenz: in `localStorage` neben `kunden`/`angebote`/`rechnungen` (Mock-Pattern). Real-Backend (Pi/SQLite) übernimmt die gleiche Form — TODO als Kommentar.

## Hooks (`src/hooks/useApi.ts`)

`useProtokolle`, `useProtokoll(id)`, `useCreateProtokoll`, `useUpdateProtokoll(id)`, `useDeleteProtokoll`, `useAbschliessenProtokoll(id)` — analog zu den Beleg-Hooks, mit Cache-Invalidation und optimistischem Update wie bestehende Angebots-Hooks.

## PDF-Renderer (Edit `src/lib/pdf/werkzeugePdf.ts`)

Bereits vorhanden — leicht erweitert:

- `generateUebergabeprotokollPdf(data, … )` und `generateSchluesseluebergabePdf(data, …)` geben jetzt `{ blob, hotspots }` zurück (selbe Form wie `belegPdf.ts`), Hotspots vorerst leer-Array → Live-Preview funktioniert; Click-to-Edit wird über sichtbare Klickflächen aus dem Editor-Layout adressiert (Schritt unten).

## Editor-Komponenten

Eigene leichtere Variante neben dem bestehenden `PdfEditorLayout` (Beleg-spezifisch durch Positionen/Steuern), gleicher Look:

- `src/components/protokoll-editor/ProtokollEditorLayout.tsx` — Header mit „Zurück / Speichern-Status / Verwerfen / Speichern / Abschließen" + Mobile-Toggle Vorschau/Bearbeiten + Resizable-Split.
- `src/components/protokoll-editor/ProtokollLivePreview.tsx` — wie `LivePdfPreview`, ruft je nach `kind` den passenden Generator auf, atomarer URL-Swap, debounced.
- `src/components/protokoll-editor/UebergabePanel.tsx` — Felder: Kunde+Objekt (mit `KundenObjektPicker`), Art-Radio, Datum, Uhrzeit, Vertreter, Leistungsumfang, Bemerkungen, ohneVorbehalt. Tab-frei, da kompakt.
- `src/components/protokoll-editor/SchluesselPanel.tsx` — Felder: Kunde+Objekt, Richtung-Radio, Datum, Uhrzeit, Schlüssel-Tabelle (Add/Remove-Zeilen), Pfand, Bestätigt.

`useProtokollEditor(protokoll)` (neu, klein): hält Draft, Autosave 1.5 s via `useUpdateProtokoll`, `isDirty` / `saving` / `discard` / `save` — strukturell wie `useBelegEditor`.

## Routen

- `src/routes/protokolle.tsx` — Liste aller Protokolle (Tabs Übergabe/Schlüssel/Alle), Suche, „Neu"-Button.
- `src/routes/protokolle.$id.tsx` — Detail-Ansicht (read-only, mit „Bearbeiten" + „PDF herunterladen" + „Abschließen" wenn Entwurf).
- `src/routes/protokolle.$id.bearbeiten.tsx` — Live-Editor (`ProtokollEditorLayout`).
- `src/routes/werkzeuge.uebergabeprotokoll.tsx` + `werkzeuge.schluesseluebergabe.tsx`: ersetzen durch **„Neu erstellen"-Stub** → legt sofort Entwurf via `useCreateProtokoll({ kind: 'uebergabe' | 'schluessel' })` an und navigiert direkt nach `/protokolle/:id/bearbeiten`. Werkzeuge-Kacheln im Sidebar bleiben Einsprungspunkte.

## Sidebar / Werkzeuge-Index

- Bestehende Kacheln „Übergabe-/Abnahmeprotokoll" und „Schlüsselübergabe" auf Werkzeuge-Index-Seite zeigen jetzt: oben „+ Neues Protokoll" (legt Entwurf an + öffnet Editor) und darunter Liste der letzten 5 Protokolle dieser Art mit Klick → `/protokolle/:id`.
- Optional „Sonstiges → Protokolle" Link in Sidebar zur Vollliste.

## Abschließen-Flow (analog „Senden" bei Angebot)

Im Editor-Header zusätzlich zum Speichern: Button **„Abschließen & PDF generieren"**.

1. `save()` zwingend.
2. `useAbschliessenProtokoll` POSTet → Backend baut PDF (server-seitig später, im Mock im Browser via vorhandene Generatoren), legt `Dokument` an, setzt `protokoll.status='abgeschlossen'` + `dokumentId`.
3. Toast: „Abgeschlossen — in Dokumenten gespeichert" mit Link.
4. Editor weiterhin nutzbar (Korrekturen → erneut „Abschließen" überschreibt Dokument).

Bestehender Auto-Save-in-Dokumente bei „PDF erstellen"-Button entfällt (war Workaround).

## „Direkt einsehbar wie bei Angebot/Rechnung"

- Detail-Route `/protokolle/:id` zeigt eingebettete PDF (oder Status „Entwurf — noch nicht abgeschlossen") + Metadaten + Buttons (Bearbeiten/PDF/Abschließen/Löschen).
- Auf **Kunden-Detail** + **Objekt-Detail**: neue Sektion „Protokolle" listet zugehörige Protokolle (Pattern wie „Angebote/Rechnungen"-Sektion).
- In **Dokumente**-Liste: bereits vorhanden via `dokumentId`-Verknüpfung — Klick auf Dokument zeigt PDF; zusätzlich kleiner „Zum Protokoll →"-Link wenn `quelle==='protokoll'` (neuer Wert für `quelle`).

## Memory-Update

`mem://features/protokolle` neu anlegen mit: Datentypen, Lifecycle (Entwurf → Abgeschlossen), Routen, Editor-Pattern. Index entsprechend erweitern.

## Dateien

**Neu**
- `src/components/protokoll-editor/ProtokollEditorLayout.tsx`
- `src/components/protokoll-editor/ProtokollLivePreview.tsx`
- `src/components/protokoll-editor/UebergabePanel.tsx`
- `src/components/protokoll-editor/SchluesselPanel.tsx`
- `src/hooks/useProtokollEditor.ts`
- `src/routes/protokolle.tsx`
- `src/routes/protokolle.$id.tsx`
- `src/routes/protokolle.$id.bearbeiten.tsx`

**Edit**
- `src/lib/api/types.ts` — Protokoll-Typen, `quelle: 'protokoll'`.
- `src/lib/mock/backend.ts` — Storage + Endpoints + Abschliessen-Logik.
- `src/hooks/useApi.ts` — Hooks.
- `src/lib/pdf/werkzeugePdf.ts` — Rückgabe `{ blob, hotspots: [] }` für Editor-Konsistenz.
- `src/routes/werkzeuge.uebergabeprotokoll.tsx` + `werkzeuge.schluesseluebergabe.tsx` — Dünner „Neu"-Einsprung; Liste + Suche + „Erstellen → öffnet Editor".
- `src/routes/werkzeuge.index.tsx` — Kachel-Texte aktualisieren.
- `src/components/layout/AppSidebar.tsx` — optional „Protokolle"-Eintrag unter „Sonstiges".
- `src/routes/kunden.$id.tsx` + `objekte.$id.tsx` — Sektion „Protokolle".

## Risiko

Mittel — neue Entitäten + Routen, aber strikt nach dem etablierten Angebot/Rechnung-Pattern. Kein Eingriff in Beleg-/Mahn-/Mail-Logik. Bestehende „PDF erstellen"-Knöpfe bleiben als Fallback während der Migration sichtbar; werden im letzten Schritt entfernt.
