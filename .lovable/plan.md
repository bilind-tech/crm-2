## Ziel

Im PDF-Editor von Angebot und Rechnung soll die Vorschau **automatisch** nachziehen, sobald der Nutzer ein Feld fertig bearbeitet — ohne Klick auf „Aktualisieren" und **ohne Flackern** (alte PDF bleibt sichtbar, bis die neue fertig ist und tauscht atomar).

## Was geändert wird

Nur eine Datei: `src/components/pdf-editor/LivePdfPreview.tsx`.

Die Komponente baut die PDF bereits atomar (`pdfBuffer`/`fileSource` wechseln erst nach erfolgreichem Build → kein Flackern, kein Remount des `<Document>`). Heute fehlt nur der Auto-Trigger.

### Änderungen

1. **Auto-Rebuild bei Draft-Änderung (debounced)**
   - Neuer Effekt: wenn `currentKey !== builtKey` und initialer Build durch ist, nach **800 ms Ruhe** automatisch `runBuild()` aufrufen.
   - Während laufendem Build wird der zuletzt gewünschte Key gemerkt (bereits vorhanden via `queuedKeyRef`); nach Abschluss wird, falls noch veraltet, automatisch ein weiterer Build gestartet.
   - Beim Tippen wird der Timer bei jedem Keystroke neu gesetzt → kein Build pro Zeichen, sondern einmal nach kurzer Pause.

2. **Status-Leiste vereinfachen**
   - „Vorschau nicht aktuell" + Button **„Aktualisieren"** entfernen.
   - Sichtbar bleibt nur ein dezenter Indikator oben rechts:
     - während Build: `wird aktualisiert …` mit Spinner
     - sonst: `Vorschau aktuell`
   - Fehlerfall (`buildError && pdfBuffer`): kleine Banner-Meldung bleibt, mit unauffälligem „Erneut versuchen".

3. **Flicker-Garantie unverändert**
   - `pdfBuffer`, `hotspots`, `numPages` werden **nur bei erfolgreichem Build** gesetzt → die alte PDF bleibt vollständig sichtbar, bis die neue gerendert ist. Bei Fehlern bleibt der letzte gute Stand stehen.
   - `<Document>` wird **nicht** unmountet; `file`-Prop wechselt zu einem neuen `Uint8Array`, react-pdf rendert intern den neuen Inhalt in dieselben Page-Knoten.

### Was unberührt bleibt

- `useBelegEditor` (Autosave 1.5 s, `invalidatePdf` für die Detailseite) — keine Änderung.
- Backend-PDF-Cache, Hotspot-Editor, Inline-Popover, Mobile-Toggle, Speichern/Verwerfen-Buttons im Header — keine Änderung.
- Keine neuen Dependencies.

## Akzeptanzkriterien

- Ich tippe in einem Feld → nach ~0,8 s Ruhe aktualisiert sich die PDF von allein.
- Während die neue PDF gebaut wird, sehe ich die **alte PDF unverändert** + kleinen Spinner rechts oben — kein weißer Blitz, kein Layout-Sprung.
- Kein „Aktualisieren"-Button mehr sichtbar.
- Gleiches Verhalten in Angebot- und Rechnung-Editor (beide nutzen dieselbe Komponente).
