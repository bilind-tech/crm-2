## Ziel

Drei Änderungen:
1. Angebote und Rechnungen vollständig löschen können (auch versendete/bezahlte) — mit klarer Warnung.
2. Sidebar-Gruppenüberschriften „Stammdaten" und „Vertrieb & Abrechnung" ersetzen durch dezente Trennlinien (gleiche Farbe wie Text, niedrige Opacity). „Übersicht" und „System" ebenfalls.
3. Neue Unterseite **Einstellungen → Datenbank** anlegen. „Einstellungen" wird zu einer einklappbaren Gruppe in der Sidebar (Datenbank als Kind), standardmäßig **eingeklappt**. Inhalt der Datenbank-Seite vorerst leer/Platzhalter — Logik folgt später.

---

## 1. Angebote/Rechnungen löschen

**Backend** (`backend/src/belege/angebote-repo.ts`, `rechnungen-repo.ts`):
- `deleteAngebot(id, opts?: { force?: boolean })` und `deleteRechnung(id, opts?: { force?: boolean })`.
- Ohne `force`: aktuelles Verhalten (soft-archive wenn versendet/nicht-entwurf).
- Mit `force=true`: harter Delete inkl. Positionen, Zahlungen, Mahnungen, `email_versand`, `dokument`-Verknüpfungen in einer Transaktion.
- Drive-Aufräumen: bei hartem Delete `drive_upload_queue`-Einträge entfernen (Drive-Datei selbst bleibt — kein automatischer Drive-Delete in MVP).

**Routes** (`backend/src/routes/belege.ts`):
- `DELETE /angebote/:id?force=1` und `DELETE /rechnungen/:id?force=1` reichen `force` durch.
- Response unverändert (`mode`).

**Frontend**:
- `useDeleteAngebot` / `useDeleteRechnung` (`src/hooks/useApi.ts`): akzeptieren `{ id, force? }`.
- Neue Komponente `src/components/forms/BelegLoeschenDialog.tsx` (gemeinsam für Angebot/Rechnung):
  - Stufe 1: einfache Bestätigung („Als Entwurf löschen / Archivieren").
  - Wenn Status ≠ Entwurf: roter Warn-Block + Checkbox „Endgültig löschen inkl. aller Zahlungen, Mahnungen, E-Mail-Historie". Button rot, nur aktiv wenn Checkbox gesetzt.
- Detailseiten `angebote.$id.tsx` und `rechnungen.$id.tsx`: Trash-Button in Action-Bar, öffnet den Dialog; nach Erfolg Navigation zurück zur Liste.
- Listenseiten `angebote.tsx`/`rechnungen.tsx`: bestehenden Inline-Confirm durch denselben Dialog ersetzen (konsistentes Verhalten).

---

## 2. Sidebar: Trennlinien statt Gruppenlabels

`src/components/layout/AppSidebar.tsx`:
- `renderGroup` umbauen: statt `<SidebarGroupLabel>` mit Text eine schmale `<div>`-Linie rendern, z. B.
  `<div className="mx-3 my-1 h-px bg-sidebar-foreground/15" />`.
- Erste Gruppe (Übersicht) ohne Trennlinie davor; ab der zweiten Gruppe (Stammdaten) jeweils eine Linie als visueller Separator.
- Im eingeklappten Sidebar-State (Icon-only) auch dünne Linie zentriert (`mx-2`).
- Tooltips/Aria bleiben, Reihenfolge bleibt.

---

## 3. Einstellungen-Gruppe mit Datenbank-Unterseite

**Neue Route** `src/routes/einstellungen.datenbank.tsx`:
- Leere Seite mit `PageHeader` „Datenbank" + Hinweistext „Wird in Kürze gebaut".
- Kein Backend, keine Daten.

**Sidebar-Änderung** (`AppSidebar.tsx`):
- System-Gruppe: „Einstellungen" wird ein einklappbarer Eintrag mit Sub-Items.
  - Verwendet shadcn `SidebarMenuSub` + `Collapsible` (oder eigenes `useState`).
  - Default: **eingeklappt** (`defaultOpen={false}`). Auto-expand wenn `pathname.startsWith("/einstellungen")`.
  - Sub-Items: „Übersicht" → `/einstellungen`, „Datenbank" → `/einstellungen/datenbank`.
- Chevron-Icon rechts (rotiert beim Aufklappen).
- Im collapsed-Sidebar-State: nur Haupt-Icon, Sub-Menu via Hover-Popover (shadcn default verhalten).

---

## Technische Details

| Aufgabe | Datei |
| --- | --- |
| Force-Delete Logic | `backend/src/belege/angebote-repo.ts`, `rechnungen-repo.ts` |
| Route-Param | `backend/src/routes/belege.ts` |
| Hook-Signatur | `src/hooks/useApi.ts` |
| Dialog | `src/components/forms/BelegLoeschenDialog.tsx` (neu) |
| Detail-Buttons | `src/routes/angebote.$id.tsx`, `src/routes/rechnungen.$id.tsx` |
| Listen-Refactor | `src/routes/angebote.tsx`, `src/routes/rechnungen.tsx` |
| Sidebar | `src/components/layout/AppSidebar.tsx` |
| Datenbank-Seite | `src/routes/einstellungen.datenbank.tsx` (neu) |

Tests: `backend/tests/belege-delete-force.spec.ts` (force löscht Zahlungen+Mahnungen+email_versand kaskadiert).

---

## Nicht Teil dieses Plans

- Google-Drive-Datei wird beim Force-Delete **nicht** automatisch im Drive entfernt (Sicherheit). Optionale „Aus Drive löschen"-Aktion später.
- Datenbank-Seiteninhalt (Backup-Status, Tabellen-Statistik, …) — kommt im Folgeschritt.
