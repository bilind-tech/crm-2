# Polish-Phase — Frontend-Feinschliff

## Warum diese Phase

Phase A–D haben das gesamte CRM-Frontend aufgebaut. Bevor wir uns ans Pi-Backend (Phase E) machen, gehen wir einmal mit der Lupe durch und beseitigen die kleinen Macken, die sich angesammelt haben: Buttons die nichts tun, hässliche Browser-Popups, Memory-Verstöße und ein paar Inkonsistenzen im Design.

Nichts davon ist dramatisch — aber zusammen heben sie die App von „funktioniert" auf „fühlt sich fertig an". Außerdem entfernen wir technische Stolpersteine, damit Phase E ein sauberes Fundament hat.

## Befund — was ich gefunden habe

### A) Funktionsbugs (echte Fehler)

1. **„Senden"-Button in Angebote-Liste tut nichts**
   `src/routes/angebote.tsx:52` ruft `useSendeAngebot("")` mit leerer ID auf, der Button feuert eine ungültige Mutation. Soll stattdessen ins Detail navigieren und dort den Versand-Dialog öffnen — oder weg.

2. **„Bezahlt markieren"-Button in Rechnungen-Liste tut nichts**
   `src/routes/rechnungen.tsx:189` ist ein leerer `<button>` ohne `onClick`. Entweder funktional machen (öffnet `ZahlungErfassenDialog`) oder entfernen.

3. **Native `confirm()`-Popups an 6 Stellen**
   `rechnungen.tsx`, `angebote.tsx`, `dauerauftraege.$id.tsx`, `zahlungseingaenge.tsx`, `EmailEinstellungen.tsx` (2x). Hässlich, mobil unscharf, nicht im Theme. Soll durch `AlertDialog` (shadcn) ersetzt werden.

4. **Native `confirm()` für Lösch-Aktionen ist auf Touch unzuverlässig**
   Siehe oben — speziell auf dem iPhone werden System-Popups manchmal weggewischt. Konsistente, große Touch-Targets im AlertDialog.

### B) Memory-Verstöße (Regelverletzung gegen die festgelegten Conventions)

5. **`ZahlungErfassenDialog` ohne `bg-background`**
   `src/components/forms/ZahlungErfassenDialog.tsx:93` — Memory-Regel verletzt: „Keine Gradient-Hintergründe in Dialogen — schlichtes `bg-background`."

6. **Gradient in `LockScreen` und `QuickCreate`**
   `LockScreen.tsx:26` (`bg-gradient-to-br from-background via-background to-accent/30`) und `QuickCreate.tsx:83` (Tile-Gradient). Sollten flach werden.
   *Ausnahme:* `PrimaryAction` darf bleiben — das ist der bewusst gewählte Premium-CTA-Look, kein Dialog-Hintergrund.

### C) Design-System-Inkonsistenzen

7. **`KpiCard` kennt keinen `warning`-Tone**
   `PageHeader.tsx:33` hat nur `default | success | danger | primary`. In `zahlungseingaenge.tsx:109` wird darum „Teilweise" als `danger` (rot) angezeigt — semantisch falsch, sollte `warning` (gelb) sein. Tone hinzufügen.

8. **`PageHeader.breadcrumb` und `hint` sind deprecated, werden aber überall noch übergeben**
   12 Routen übergeben weiterhin `breadcrumb="…"`. Props einfach aus den Aufrufen entfernen — saubereren Code.

9. **Inkonsistente Loading-States**
   7 Dateien zeigen nacktes „Lade …" als `<p>`. Einheitliche Skeleton-Loader (gibt's schon: `src/components/ui/skeleton.tsx`) für Detail-Seiten.

### D) Code-Qualität (kleinere Issues)

10. **React-Key-Anti-Pattern: `key={i}`**
    `dauerauftraege.$id.tsx:102` (Fahrplan-Liste) und `CsvImportDialog.tsx:234` (Vorschau-Tabelle) nutzen Index als Key. Bei den 50 CSV-Zeilen reicht `key={\`${e.buchungsdatum}-${e.betrag}-${i}\`}`, beim Fahrplan `key={d.toISOString()}`.

11. **Scheduler-Toast bei wiederholtem Tab-Wechsel**
    `__root.tsx:73-87` startet den Scheduler bei jedem Unlock neu — eigentlich idempotent, aber `onResult`-Closure ist veraltet. `qc` als Ref binden, nicht in Deps.

12. **Doppelter Daten-Fetch im Dashboard**
    `index.tsx` ruft `useZahlungseingaenge("offen")` und `useZahlungseingaenge("teilweise")` getrennt auf. Sidebar macht das gleiche nochmal. Macht 4 unnötige Requests pro Render-Zyklus. Stattdessen einmal alle holen und im Hook filtern (oder Sidebar-Werte cachen).

### E) UX-Verbesserungen (nice-to-have)

13. **Mobile Tabellen scrollen nicht**
    Die großen Tabellen in `rechnungen.tsx`, `angebote.tsx`, `dauerauftraege.tsx`, `kunden.tsx` brauchen `overflow-x-auto` auf 390px-Viewport. Aktuell wird die Tabelle abgeschnitten oder verzerrt das Layout.

14. **Zahlungs-Liste auf Rechnung-Detail braucht Edit-Button**
    Aktuell kannst du eine versehentlich erfasste Zahlung nicht löschen oder korrigieren — nur über Bank-Eingang-Lösen. Kleiner Trash-Button pro Zahlung mit AlertDialog-Bestätigung.

## Plan — was wir bauen

### Schritt 1 — Funktionsbugs fixen *(klein, sicher)*

- `KpiCard` um `warning`-Tone erweitern → in `zahlungseingaenge.tsx` „Teilweise" auf `warning` setzen
- „Senden"-Button in Angebote-Liste: Click navigiert ins Detail (kein Mutation-Aufruf mit leerer ID)
- „Bezahlt markieren"-Button in Rechnungen-Liste: öffnet `ZahlungErfassenDialog` für die Zeile, oder Button entfernen wenn zu kompliziert
- `bg-background` in `ZahlungErfassenDialog` ergänzen

### Schritt 2 — Native Popups raus *(größter Wirkungs-Hebel)*

Zentrale Komponente bauen: `src/components/ui/confirm-dialog.tsx`

```tsx
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, variant, onConfirm })
```

Dann an allen 6 Stellen `confirm(...)` ersetzen durch State + `<ConfirmDialog>`. Variante `destructive` für Löschungen (rote Bestätigung).

Damit:
- konsistentes Look-and-Feel
- mobile-tauglich (große Touch-Targets)
- Tastatur-Navigation (Enter/Esc)
- Screen-Reader-tauglich

### Schritt 3 — Memory-Compliance & Design-Polish

- `LockScreen`: Gradient durch `bg-background` ersetzen, Logo-Bereich als `bg-card` Karte
- `QuickCreate`: Tile-Gradient durch flachen `bg-muted/40` mit farbigem Icon-Akzent ersetzen
- `PageHeader`: `breadcrumb` und `hint` Props ganz entfernen, alle 12 Aufrufe putzen
- Einheitliche `LoadingPlaceholder`-Komponente (Skeleton) für die 7 Stellen

### Schritt 4 — Code-Qualität

- React-Keys in `dauerauftraege.$id.tsx` und `CsvImportDialog.tsx` stabil machen
- Scheduler in `__root.tsx`: `onResult` via `useRef` stabilisieren, damit nicht bei jedem Render neu gestartet
- Daten-Fetch konsolidieren: ein `useZahlungseingaenge()` pro Komponente, `useMemo` für die Status-Filter
- `console.error` in `useBelegPdf.ts` durch optional-chained Logger oder Toast ersetzen (es geht um PDF-Fehler, die der User sehen sollte)

### Schritt 5 — UX-Verbesserungen

- Alle Listen-Tabellen: `<div className="overflow-x-auto">` Wrapper, damit Mobile sauber scrollt
- Rechnung-Detail: pro Zahlung ein kleiner „Löschen"-Button (mit `ConfirmDialog`); ruft `useDeleteZahlung` auf, das im Mock-Backend bereits existiert (sonst neuen Endpoint ergänzen)

## Reihenfolge

Jeder Schritt ist eigenständig und committable. Ich gehe sie nacheinander durch — du sagst nach jedem Schritt „weiter" wenn alles passt, oder „stop / ändern" wenn nicht.

Geschätzter Gesamt-Aufwand: ein bis zwei Sessions.

## Was diese Phase NICHT tut

- Keine neuen Features
- Keine Änderungen am Daten-Modell
- Kein Backend-Code (kommt in Phase E)
- Keine Refactors um des Refactorns willen — nur was wirklich juckt

---

Sag **„los Polish"** und ich starte mit Schritt 1.
