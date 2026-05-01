## Problem

Dialoge (und AlertDialoge) animieren sich beim Öffnen/Schließen mit `slide-in-from-left-1/2` + `slide-in-from-top-[48%]` und beim Schließen mit `slide-out-to-left-1/2` + `slide-out-to-top-[48%]`. Das erzeugt den hässlichen Effekt, dass das Fenster diagonal nach oben-links wegfliegt.

## Fix

Slide- und Zoom-Animationen aus den Dialog-Komponenten entfernen. Es bleibt nur ein dezenter Fade (`fade-in-0` / `fade-out-0`), damit nichts „springt", aber auch nichts mehr wegrutscht.

### Geänderte Dateien

1. **`src/components/ui/dialog.tsx`** — `DialogContent`-Klassen:
   - entferne: `data-[state=closed]:zoom-out-95`, `data-[state=open]:zoom-in-95`, `data-[state=closed]:slide-out-to-left-1/2`, `data-[state=closed]:slide-out-to-top-[48%]`, `data-[state=open]:slide-in-from-left-1/2`, `data-[state=open]:slide-in-from-top-[48%]`
   - behalte: `fade-in-0` / `fade-out-0`
   - `duration-200` → `duration-150`

2. **`src/components/ui/alert-dialog.tsx`** — `AlertDialogContent`: identische Bereinigung wie oben.

3. **`src/components/ui/popover.tsx`** und **`src/components/ui/dropdown-menu.tsx`** — die `slide-in-from-*-2`-Klassen (kleine 8px-Slides aus der Trigger-Richtung) entfernen, nur Fade behalten. Optional, weil hier weniger störend, aber für Konsistenz sinnvoll.

### Was **bleibt** wie es ist

- **`src/components/ui/sheet.tsx`** — Bottom-Sheet & Side-Sheets müssen vom Rand reinslidern, das ist gewolltes Verhalten (Mobile-Filter, etc.).
- **`src/components/ui/drawer.tsx`** — Vaul-Drawer-Mechanik bleibt.
- Keine Änderungen an `tailwindcss-animate`-Setup.

## Akzeptanz

- Beim Öffnen/Schließen von Dialogen (z. B. „Vom Handy scannen", „Dokument bearbeiten", Confirm-Dialoge) sieht man nur ein sanftes Ein-/Ausblenden — kein Diagonal-Slide nach oben-links mehr.
- Bottom-Sheets (Mobile-Filter) sliden weiterhin sauber von unten ein.
