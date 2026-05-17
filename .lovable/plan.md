## Ziel

Tabelle (Leistungspositionen) im Angebot-/Rechnung-PDF-Editor wie in Word direkt im PDF bearbeiten: hovern, sehen, was passiert, sofort tippen, Zeilen einfügen/löschen/verschieben — alles ohne Umweg über das rechte Panel und ohne Flicker.

## Ist-Zustand (gemessen)

- Tabelle hat zwei Hotspots: `tabelle` (gesamte Tabelle) + `pos:<id>` pro Zeile (`src/lib/pdf/belegPdf.ts:326,354`).
- Klick auf eine Zeile öffnet `HotspotInlineEditor` → kleines Popover mit Textarea + 3 Inputs (`src/components/pdf-editor/HotspotInlineEditor.tsx:55-123`). Funktioniert, ist aber „klein", versteckt Menge/Preis/Einheit, keine Zeilen-Aktionen (löschen/verschieben/einfügen), kein Tabellenkopf-Kontext.
- Klick auf die Tabelle selbst landet im Default-Zweig („wird im rechten Editor strukturiert bearbeitet" + Sprung-Button).
- Hover zeichnet die Box um die Zeile, aber **es gibt keine Zeilen-Aktionen direkt am Hotspot** und keinen Tabellen-Toolbar am Tabellen-Hotspot.

## Plan

### 1. Zeilen-Hover: Mini-Toolbar direkt am Hotspot

`src/components/pdf-editor/PdfFieldOverlay.tsx`:
- Für Hotspots, deren ID mit `pos:` beginnt, beim Hover (CSS `group-hover`) **rechts neben der Zeile** eine kleine, schwebende Toolbar einblenden:
  - Grip (Drag-Handle, Sortierung)
  - ▲ / ▼ (Zeile rauf/runter)
  - ＋ (Zeile darunter einfügen — Kopie der aktuellen)
  - ✕ (Zeile löschen, mit Bestätigung erst beim 2. Klick innerhalb 2 s)
- Aktionen werden über eine neue Prop `rowActions?: { onMoveUp, onMoveDown, onInsertBelow, onDelete, onDuplicate }` reingereicht. Standard `undefined` → Toolbar unsichtbar (Protokolle bleiben unverändert).
- Hover-Box-Stil für `pos:`-Zeilen leicht abgesetzt: zarter linker Balken in `primary` + Hintergrund `primary/5`, damit die Zeile als „bearbeitbar" gelesen wird, aber nicht aggressiv blinkt.

### 2. Zeilen-Klick: voller Inline-Editor in einer Reihe wie die Tabelle

`src/components/pdf-editor/HotspotInlineEditor.tsx` (Zweig `pos:`):
- Breiter (560 px), Layout = **eine Tabellenzeile**: Beschreibung links groß, daneben Spalten `Menge | Einheit | Einzelpreis | Σ` (oder bei `pauschal`: `Ausführung | Pauschalpreis | Σ`).
- Über jedem Feld eine winzige Headerzeile mit identischen Labels wie im PDF („Leistung", „Stunden", „Abrechnungsart", „Preis (netto)"), damit klar ist, welches Feld welche PDF-Spalte ist.
- Footer mit Aktionen: „Duplizieren", „Löschen", „Zeile darüber", „Zeile darunter", „Fertig". Aktionen wirken sofort und schließen den Popover nicht zwingend (außer Löschen).
- Tastatur: `Enter` in Beschreibung → neue Zeile darunter, `Cmd/Ctrl+Enter` → Fertig, `Esc` → Schließen, `Cmd/Ctrl+D` → Duplizieren, `Cmd/Ctrl+Backspace` → Löschen.
- Schreibt direkt in `draft.positionen` via `set("positionen", next)`.

### 3. Tabellen-Hotspot bekommt eigene Top-Toolbar

`src/components/pdf-editor/PdfFieldOverlay.tsx`:
- Für den `tabelle`-Hotspot beim Hover **oben rechts** ein kleines Pillenmenü statt nur „Bearbeiten":
  - ＋ Neue Zeile
  - 🕒 Stunden-Modus für neue Zeile (Toggle)
  - 19% / 7% Steuersatz-Umschalter
- Klick auf die Tabelle (nicht auf eine Zeile) öffnet **keinen** Popover mehr (nur die Toolbar reicht) — bisheriger Default-Hinweis-Popover entfällt.

### 4. Spaltenbreiten zwischen PDF und Inline-Editor synchron

Damit die Inline-Reihe optisch auf der PDF-Zeile sitzt und „wie in Word" wirkt:
- `leistungstabelle()` in `src/lib/pdf/belegPdf.ts` hat feste Spaltenbreiten (`["*", 110, 95]` bzw. `["*", 60, 90, 85]`).
- Diese Verhältnisse als Konstante exportieren (`TABLE_COL_WIDTHS_STUNDEN` / `TABLE_COL_WIDTHS_STANDARD`) und im neuen `pos:`-Editor zur Grid-Berechnung verwenden → sichtbar gleiche Spaltenstruktur.

### 5. Flicker beim Position-Editieren weiter dämpfen

- `HotspotInlineEditor` lokal `useDeferredValue` auf die Position verwenden, damit jedes Zeichen den PDF-Rebuild nicht **synchron** anstößt; der bestehende 450 ms Debounce in `LivePdfPreview` bleibt.
- Bei Zeilen-Reorder/Insert/Delete: vor `set("positionen", next)` einen `requestAnimationFrame` einplanen, damit das Popover nicht im selben Frame neu positioniert wird (kein „Springen").

### 6. Mini-Confirm beim Löschen (statt globalem Modal)

- 1. Klick auf ✕ → Button färbt sich rot + Text „Wirklich löschen?" für 2 s.
- 2. Klick innerhalb 2 s → Löschen. Klick daneben/Timer-Ablauf → Reset.
- Keine `confirm()`-Dialoge, kein Page-Modal.

### 7. Bestehendes rechtes Panel bleibt — als „Voll-Editor"-Fallback

- „Erweitert"-Button im Popover springt weiterhin in den Positionen-Tab (`PositionenPanel` → `PositionenEditor`). Kein Funktionsverlust.

### Bewusst NICHT enthalten

- Drag-and-drop-Sortierung über die ganze PDF-Seite (nur ▲/▼-Buttons; echte DnD wäre ein eigenes Projekt).
- Live-Edit direkt im PDF-Canvas ohne Popover (PDF.js gibt keine editierbare Text-Layer, daher Popover-Overlay als nächstbeste UX).
- Änderungen am Datenmodell oder am pdfmake-Layout (keine Spaltenänderung, kein neuer Hotspot).
- Protokoll-Editor (`ProtokollHotspotEditor`) bleibt unverändert; die Toolbar-Prop ist optional.

## Geänderte/neue Dateien

- `src/components/pdf-editor/PdfFieldOverlay.tsx` — Hover-Toolbar für `pos:`-Zeilen + Top-Toolbar für `tabelle`.
- `src/components/pdf-editor/HotspotInlineEditor.tsx` — neuer breiter `pos:`-Branch, Tastaturkürzel, Mini-Confirm-Delete, deferred values.
- `src/components/pdf-editor/PdfEditorLayout.tsx` — `rowActions` und `tableActions` aus `useBelegEditor` zusammenbauen und an die Preview/Overlay durchreichen.
- `src/components/pdf-editor/LivePdfPreview.tsx` — Props `rowActions`/`tableActions` an `PdfFieldOverlay` weiterreichen.
- `src/lib/pdf/belegPdf.ts` — Spaltenbreiten exportieren (keine Layout-Änderung).
- `src/hooks/useBelegEditor.ts` — kleine Helfer `movePosition(id, dir)`, `insertPositionAfter(id)`, `duplicatePosition(id)`, `removePosition(id)`, `addEmptyPosition(modus)`.

## Akzeptanzkriterien

- Maus über eine Tabellenzeile → Zeile leicht hervorgehoben, rechts schwebt eine kleine Toolbar mit ▲▼＋✕.
- Klick auf eine Zeile öffnet einen 560 px breiten Inline-Editor mit denselben Spalten wie das PDF; Tippen ändert sofort die Vorschau (debounced, ohne Weißblitz).
- Tastatur: `Enter` neue Zeile, `Esc` schließen, `Cmd/Ctrl+D` duplizieren, `Cmd/Ctrl+Backspace` löschen.
- Hover auf die Tabelle (nicht auf eine Zeile) zeigt oben rechts eine Pille mit „＋ Zeile", Stunden-Toggle, Steuersatz-Umschalter.
- Löschen erfordert 2. Klick zur Bestätigung; keine versehentliche Löschung.
- Reorder, Insert, Delete, Duplicate verändern Positionen sofort korrekt und ohne Springen des Popovers.
- Bestehendes rechtes Panel und Speichern-/Verwerfen-Flow funktionieren unverändert.
