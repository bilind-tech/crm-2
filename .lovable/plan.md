## Ziel

Die App auf Mobil (≤640px) durchgehend benutzbar machen und das akute Problem fixen, dass der „+ Neu"-Dialog (QuickCreate) auf dem Handy nicht mittig sichtbar erscheint.

---

## Teil 1 — Sofort-Fix: QuickCreate-Dialog auf Mobil sichtbar

### Ursache
`src/components/layout/QuickCreate.tsx` setzt `max-w-[640px]` auf `<DialogContent>`, das selbst bereits `w-full` und `left-50% / top-50% / translate(-50%,-50%)` hat. Auf 390 px Viewport bleibt der Dialog technisch sichtbar, aber:
- Es gibt **kein horizontales Padding** zum Viewport-Rand → Inhalt klebt am Rand.
- Das Grid `grid-cols-2 gap-3 p-6` ist auf 390 px sehr eng, die Kacheln wirken gequetscht.
- Die Custom-Animation (`.quick-create-dialog` in `styles.css`) erzwingt `transform: translate(-50%,-50%) !important` auch während der Mount-Phase, was bei kleinen Viewports + virtueller Tastatur zu Off-Screen-Positionierung führen kann.
- `DialogHeader` nutzt `text-center sm:text-left` — also auf Mobil zentriert, der Quick-Create überschreibt das mit `text-left` und sieht dadurch unausgewogen aus.

### Änderungen
1. **`QuickCreate.tsx`**
   - `DialogContent`-Klassen ersetzen durch:
     `max-w-[min(640px,calc(100vw-2rem))]`, zusätzliche `mx-auto`, Padding-Reset bleibt.
   - Header-Padding mobil verkleinern: `px-5 pt-5 sm:px-7 sm:pt-7`.
   - Grid mobil: `grid-cols-2 gap-2.5 p-4 pt-3 sm:gap-3 sm:p-6 sm:pt-5`.
   - Kacheln kompakter auf Mobil: `p-3 sm:p-4`, Icon-Tile `h-10 w-10 sm:h-11 sm:w-11`.

2. **`styles.css` `.quick-create-dialog`**
   - `transform: translate(-50%, -50%) !important` entfernen, damit Radix' eigene Positionierung (die bereits `left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]` setzt) nicht doppelt erzwungen wird.
   - Stattdessen nur die Slide/Zoom-Animation neutralisieren und ein dezentes Fade + sanftes Scale-In behalten.

3. **Body-Scroll-Lock prüfen**: Radix sperrt Scroll automatisch — keine Änderung nötig, nur sicherstellen, dass kein eigener Code den Dialog ausblendet.

### Visueller Check nach Fix
- 390×844: Dialog mittig, je 16 px Abstand zu links/rechts, alle 5 Kacheln sichtbar in 2 Spalten (3. Reihe einspaltig oder als 2+2+1).
- Tap-Target ≥ 44 px Höhe.

---

## Teil 2 — Mobile-Optimierung der gesamten App

### A) Header (`AppHeader.tsx`)
Aktuell: SidebarTrigger + Suchfeld (flex-1) + „Neu"-Button + Bell. Auf 390 px wird das Suchfeld zerquetscht und der „Neu"-Button + Label nimmt Platz weg.

- Mobil: Suchfeld zu reinem Icon-Button kollabieren (`<Search />`), Voll-Suche öffnet sich weiterhin als Sheet.
- „Neu"-Button mobil nur Icon (Plus) ohne Label, Label ab `sm:` einblenden.
- Header-Padding `px-3 sm:px-4`, Gap `gap-2 sm:gap-3`.
- Bell-Popover: auf Mobil als bottom-sheet-ähnliches Popover mit `w-[calc(100vw-1.5rem)]` cappen.

### B) Sidebar
`SidebarProvider` von shadcn unterstützt bereits Mobile-Drawer (`Sheet`) automatisch, sofern `useSidebar()` sauber genutzt wird. Prüfen:
- `SidebarTrigger` ist im Header bereits vorhanden ✓.
- Sicherstellen, dass `Sidebar` auf Mobil als Off-Canvas-Sheet rendert (default-Verhalten) und nicht als Spalte den Content schiebt.
- Sidebar-Inhalt: Touch-Targets prüfen, alle `SidebarMenuButton` mind. 44 px hoch.

### C) Listen-Seiten (Tabellen)
Betroffen: `kunden.tsx`, `objekte.tsx`, `angebote.tsx`, `rechnungen.tsx`, `dauerauftraege.tsx`, `mahnungen.tsx`, `zahlungseingaenge.tsx`, `dauerauftraege.posteingang.tsx`.

Aktuelles Muster: `<div className="overflow-x-auto"><Table>…`. Horizontales Scrollen ist auf Mobil unangenehm und versteckt Aktionen.

Lösung: **Card-View ab Mobil, Tabelle ab `md:`**
- Neue kleine Helper-Komponente `MobileListCard` in `src/components/ui/` (Titelzeile, 1–2 Meta-Zeilen, Status-Badge, Trailing-Chevron).
- Pro Liste eine `<div className="md:hidden space-y-2">` mit Cards + bestehende Tabelle in `<div className="hidden md:block overflow-x-auto">` belassen.
- Tap auf Card navigiert zur Detail-Route.

### D) Detail-Seiten
- `kunden.$id.tsx`, `angebote.$id.tsx`, `rechnungen.$id.tsx`, `objekte.$id.tsx`, `dauerauftraege.$id.tsx`.
- Tabs (`TabsList overflow-x-auto`) bleiben — gut.
- Action-Bars (Bearbeiten/Versenden/PDF anzeigen) auf Mobil als **sticky Bottom-Action-Bar** mit den 1–2 wichtigsten Buttons; Rest in ein Overflow-Menü (`DropdownMenu`).
- Grids mit `grid-cols-2`/`grid-cols-3` für Meta-Infos auf Mobil zu `grid-cols-1` zwingen, ab `sm:` zweispaltig.

### E) Formulare (`/kunden/neu`, `/angebote/neu`, `/rechnungen/neu`, `/objekte/neu`)
- Zwei-Spalten-Layouts (`grid grid-cols-2`) auf Mobil einspaltig (`grid-cols-1 sm:grid-cols-2`).
- Inputs: `inputMode` setzen (`numeric`, `email`, `tel`, `url`) für bessere virtuelle Tastatur. Im `SmartInput` für Telefon `inputMode="tel"`, Website `inputMode="url"`.
- Submit-Buttons als sticky Footer auf Mobil (`sticky bottom-0 bg-background border-t -mx-4 px-4 py-3`).
- `PositionenEditor`: auf Mobil pro Position eine Karte statt Tabelle.

### F) PDF-Viewer (`PdfViewerDialog`)
- Auf Mobil: Dialog als Vollbild (`max-w-full h-[100dvh] rounded-none`).
- Zoom-Controls / Download-Button als Bottom-Bar.
- Seitenangabe „Seite X von Y" als sticky Top-Bar.

### G) Globale CSS-Polish
- `main` bereits `p-4 sm:p-6` ✓.
- `Toaster` auf Mobil: `position="top-center"` statt `top-right`, oder Breite cappen.
- `100dvh` statt `100vh` an Stellen, wo Viewport-Höhe wichtig ist (LockScreen, PDF-Viewer).
- Tap-Highlight entfernen: `-webkit-tap-highlight-color: transparent` global.

---

## Reihenfolge der Umsetzung (Tasks)

1. **Fix QuickCreate-Dialog** (Teil 1) — sofort sichtbar.
2. **AppHeader mobil verschlanken** + Toaster auf `top-center` mobil.
3. **Listen → Card-View ab Mobil** (alle 7 Listen-Routen, gemeinsame `MobileListCard`).
4. **Detail-Seiten**: Action-Bar mobil + Meta-Grid einspaltig.
5. **Formulare**: einspaltig, `inputMode`, sticky Submit, PositionenEditor-Cards.
6. **PdfViewerDialog**: Vollbild auf Mobil.
7. **CSS-Polish**: `100dvh`, Tap-Highlight.

Nach jedem Schritt visueller Mobil-Check (390×844).

---

## Was nicht geändert wird
- Sidebar-Drawer-Verhalten (shadcn-Standard reicht).
- Desktop-Layout (≥ md) bleibt unverändert.
- Datenmodell, Backend, Routen.
