## Punkt 1 — „PDF bearbeiten" öffnet nichts

### Diagnose (am wahrscheinlichsten)

Der Button verlinkt korrekt auf `/angebote/$id/bearbeiten` bzw. `/rechnungen/$id/bearbeiten`. Routes existieren und sind in `routeTree.gen.ts` registriert. Beim Klick wird also die Route geladen — aber die Seite bleibt sichtbar leer. Plausibelste Ursachen:

1. **Endlos-Skeleton**: `Page()` zeigt `<DetailSkeleton />`, solange eine der vier Bedingungen `isLoading || !angebot || !kunde || !firma` greift. Wenn z. B. `useFirmendaten()` beim ersten Aufruf noch lädt UND `isLoading` für `useAngebot` schon `false` ist, fällt man in den Skeleton-Pfad — und durch das Editor-Layout `h-[calc(100dvh-4rem)]` innerhalb von `<main className="p-6">` wirkt der Skeleton evtl. unsichtbar/leer.
2. **Render-Crash in `LivePdfPreview`** ohne Fehler-Boundary: Wenn `generateAngebotPdf` crasht (z. B. wegen leerem Logo, fehlenden Positionen) oder `react-pdf` den Worker nicht lädt, sieht man nur eine weiße Fläche, weil keine Error-Boundary den Fehler abfängt.
3. **Höhen-Problem** des Editor-Containers: `<div className="flex h-[calc(100dvh-4rem)]">` rechnet mit einem 4 rem hohen App-Header — das stimmt aber nicht zwingend; gepaart mit `<main class="p-4 sm:p-6">` kann der Container auf < 100 px schrumpfen.

### Fix

**`src/routes/angebote.$id.bearbeiten.tsx` & `src/routes/rechnungen.$id.bearbeiten.tsx`**

1. Loading-Logik präzisieren — separate Spinner-States nutzen, NotFound nur wenn alle Queries gesettlet sind:
   - Skeleton zeigen, solange `useAngebot`/`useRechnung` lädt.
   - Sobald Beleg da ist, aber Kunde/Firma noch laden → kleiner Inline-Spinner mit Header (statt voller Skeleton), damit der User sofort visuelles Feedback bekommt, dass die Seite geladen wird.
   - NotFound nur bei `!isLoading && !angebot`.

2. Eine **Error-Boundary** um `<PdfEditorLayout>` legen (z. B. via `<RouteError>`-Komponente), damit ein Crash in `LivePdfPreview` einen sichtbaren Fehler statt einer weißen Seite ergibt. Konkret: `errorComponent` der Route setzen mit Hinweis „Editor konnte nicht geladen werden" + Zurück-Link.

**`src/components/pdf-editor/PdfEditorLayout.tsx`**

3. Höhe robust machen: statt `h-[calc(100dvh-4rem)]` → `min-h-[70vh] h-full flex-1`, damit der Editor immer sichtbar ist, selbst wenn die Header-Höhe abweicht.

4. Im `LivePdfPreview`: wenn `containerWidth === 0` länger als 1 s, einmaligen Fallback `setContainerWidth(600)` setzen — sonst bleibt die PDF-Vorschau ewig auf „PDF wird erzeugt …" wenn der ResizeObserver einen Edge-Case trifft.

5. Defensive Fehlerausgabe: PDF-Build-Catch-Block setzt zusätzlich `setError(e)`-State und zeigt „PDF konnte nicht erzeugt werden" an, statt nur `console.error`.

## Punkt 2 — Icons auf der Übersichtsseite mit eigener Hintergrundfarbe

Auf `src/routes/index.tsx` werden mehrere Icons (FileText, Bell, Repeat, CheckCircle2, ArrowRight) in den Section-Headern und Listen verwendet. Aktuell sind sie nur farbig-getintet ohne eigenen Hintergrund-Chip. Die `KpiCard` hat das schon (siehe `iconBg`) — wir ziehen das einheitlich auf alle Section-Header und List-Item-Icons.

### Fix

**`src/routes/index.tsx`** — überall, wo ein Icon im H2-Header oder am rechten Listen-Rand steht, das blanke Icon durch einen kleinen Hintergrund-Chip ersetzen:

```tsx
<span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
  <FileText className="h-4 w-4" />
</span>
```

Konkret an diesen Stellen:
- Zeile 243: „Offene Rechnungen" → `bg-primary/10 text-primary`
- Zeile 279: ✓ Listenitem (CheckCircle2) → `bg-success/10 text-success` als kleiner h-6 w-6 Chip
- Zeile 291: „Mahnwesen" → `bg-warning/10 text-warning`
- Zeile 296: zentrierter „alles erledigt"-CheckCircle2 → `bg-success/10`-Chip h-10 w-10
- Zeile 329: „Daueraufträge" → `bg-primary/10 text-primary`
- Zeile 336 (ArrowRight im „Übersicht öffnen") bleibt unverändert (Inline-Link-Affordance, kein Icon-Chip).

Die Größe der Chips orientiert sich an `KpiCard`: `h-7 w-7 rounded-lg` für H2-Icons, `h-6 w-6 rounded-md` für kleine Listen-Icons. Dadurch wirkt die ganze Übersichtsseite konsistent — jedes Icon „sitzt" auf seinem getinteten Background, statt frei zu schweben.

## Ergebnis

- „PDF bearbeiten" zeigt entweder den Editor, einen klaren Skeleton oder eine sichtbare Fehlermeldung — keine weiße Seite mehr.
- Alle Section- und Listen-Icons auf dem Dashboard haben einen einheitlichen, dezent farbigen Hintergrund-Chip — gleiche Sprache wie die KpiCards.
