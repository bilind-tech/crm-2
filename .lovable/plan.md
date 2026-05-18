
## Ziel

Das Live-PDF im Protokoll-Editor soll **niemals leer werden**, niemals „weg und wieder kommen", und der **Cursor in offenen Inline-Eingaben darf nicht springen** oder den Fokus verlieren — egal wie oft die PDF im Hintergrund neu gebaut wird.

## Analyse — warum es heute flackert und der Cursor springt

In `ProtokollLivePreview.tsx` läuft heute schon ein „atomarer Swap" mit einem zweiten, unsichtbaren `<Document>`. Trotzdem flackert es, weil:

1. **Der Swap ist nicht wirklich atomar.** Wenn `setPdfBuffer(pendingBuffer)` läuft, ändert sich `fileSource` am **sichtbaren** `<Document>`. react-pdf wirft daraufhin intern die alten `<Page>`-Canvas-Renderings weg und baut neue auf. Zwischen „weg" und „neu da" ist das Page-Element für ein paar Frames leer → das ist das, was du als „PDF geht weg und kommt wieder" siehst.
2. **Popover/Overlay liegen INNERHALB der Page-Wrapper, also unterhalb des `<Document>`-Teilbaums.** Sobald react-pdf intern die Pages neu mountet (genau das passiert bei file-Wechsel), wird auch das Overlay neu gemountet → das Popover wird kurz zerstört und neu aufgebaut → der `<Input>` darin wird neu gemountet → Fokus + Caret-Position gehen verloren → der Caret landet auf Position 0.
3. Beim ersten Aufklappen eines Popovers reicht ein einziger Zeichen-Tippen, der nach 450 ms einen Rebuild triggert, um genau dieses Caret-Reset auszulösen.

## Lösungsansatz

Zwei zusammenhängende Änderungen — beide nur im Protokoll-Editor, damit wir testen, bevor Angebote/Rechnungen drankommen.

### 1) Wirklich flickerfreier Cross-Fade-Swap (zwei sichtbare Documents)

Statt „pending offscreen → setPdfBuffer → altes wegwerfen" arbeiten wir mit zwei dauerhaft existierenden Documents, die wechselseitig die Rolle „aktuell sichtbar" / „im Aufbau" übernehmen:

```text
[Stack-Container]
 ├── Slot A  ← derzeit sichtbar (opacity 1)
 └── Slot B  ← neue PDF lädt darüber (opacity 0)
              wird sichtbar, wenn ALLE Pages onRenderSuccess gemeldet haben
              dann wird Slot A leer geschaltet und die Rollen tauschen.
```

Mechanik:
- Beide Slots sind dauerhaft im DOM; nur das `file`-Prop wechselt jeweils.
- Der „neue" Slot bekommt erst dann `opacity: 1` (und Slot A `opacity: 0`), wenn **alle** Pages des neuen Documents `onRenderSuccess` gefeuert haben. Erst dann darf der alte Slot abgeräumt werden.
- Die alte PDF bleibt also pixelgleich sichtbar, bis die neue **vollständig fertig gezeichnet** ist → kein Weißbild, kein Springen der Höhe.
- Solange der Build noch läuft, behält Slot A seine Hotspots; Slot B baut still im Hintergrund.

### 2) Overlay aus dem Document-Teilbaum herausziehen — Popover stabilisieren

Wir trennen Pixel und Interaktion sauber:

```text
[Page-Container, position: relative]
 ├── <PdfDocumentStack>      ← rein visuell, kann beliebig neu rendern
 └── <PdfInteractionLayer>   ← liegt absolute darüber, NIE neu gemountet
        ├── Hotspot-Boxen (Position aus letztem Build)
        └── Popover mit dem Inline-Editor (bleibt offen, behält Fokus)
```

Konkret:
- `PdfFieldOverlay` zieht aus dem `<Document>`-Teilbaum raus und wird als Geschwister neben den Document-Stack gehängt, mit derselben gemessenen Page-Geometrie (renderWidth, Page-Höhe via `onPageLoadSuccess`).
- Das Overlay nutzt **stabile** Hotspots: solange ein Popover offen ist, friert es die alten Koordinaten ein (kein Layout-Shift während Eingabe). Erst wenn das Popover geschlossen wird, übernimmt es die Koordinaten des aktuellsten Builds.
- Da das Popover und sein Input-Subtree nicht mehr Kind des `<Document>` sind, ist der Mount-Zyklus von react-pdf egal — `<Input>` bleibt mit Fokus und Caret-Position erhalten.

### 3) Tipp-Schutz für offene Eingaben (Anti-Build während aktiver Eingabe)

Zusätzlich, klein aber sehr wirksam:
- Während ein Hotspot-Popover offen ist UND der User aktiv in einem Input/Textarea tippt, wird die Debounce-Zeit für den Auto-Rebuild von 450 ms auf **1100 ms ab letzter Tastatur-Aktivität** verlängert.
- Sobald der User aufhört zu tippen (oder das Popover schließt / blur), greift wieder der schnelle Modus.
- Effekt: Während du wirklich tippst, baut die PDF im Hintergrund nicht mit. Sobald du eine kurze Denkpause machst (~1 s), kommt der nächste Build — und dank Cross-Fade siehst du auch davon nichts „weggehen".

### 4) Sanfter Übergang statt „weg/da"

- Cross-Fade-Dauer: 120 ms `opacity`-Transition auf beiden Slots. Das ist kein „blinken", sondern ein unsichtbar weiches Aufdecken.
- Höhe des Stack-Containers richtet sich nach der maximalen Höhe beider Slots, damit kein Layout-Sprung passiert, wenn die Seitenzahl wechselt.

## Was wir NICHT anfassen

- `useProtokollEditor` (Draft + Autosave) bleibt unverändert.
- `generateProtokollPdf` (Backend-Renderer) bleibt unverändert.
- Hotspot-Tracker (`hotspotTracker.ts`) bleibt unverändert.
- Angebote / Rechnungen werden **bewusst nicht** mitverändert. Wir migrieren sie erst, nachdem Protokolle in der Praxis sauber laufen.

## Geänderte Dateien

- `src/components/protokoll-editor/ProtokollLivePreview.tsx`
  - Zwei dauerhafte Document-Slots + Cross-Fade-State (`frontSlot: "A" | "B"`, `bufferA`, `bufferB`, `hotspotsA`, `hotspotsB`).
  - Render-Bereitschaft pro Slot über `onRenderSuccess`-Zähler je Page → erst dann tauschen.
  - Overlay aus `<Document>` herausgezogen, als Sibling über beide Slots gelegt.
  - Eingefrorene Hotspot-Koordinaten, solange `openHotspotId !== null`.
  - Dynamisches Debounce: 450 ms normal, 1100 ms, solange Inline-Eingabe aktiv ist.
- (klein) `src/components/protokoll-editor/ProtokollHotspotEditor.tsx`
  - Inputs/Textareas melden ihre Aktivität an die Preview via Callback (`onTyping`) — bewusst minimaler Eingriff: ein simpler `onInput`-Handler aus der Preview wird per Context-Prop oder via `data-typing="true"`-Heuristik in der Preview erkannt. Bevorzugte Lösung: kleiner React-Context `LivePreviewActivityContext.notifyTyping()`, den der Hotspot-Editor bei jedem `onChange` aufruft.

## Akzeptanzkriterien (so testen wir am Ende)

- Während du in einem Inline-Input tippst: PDF flackert nicht; Cursor bleibt an der Stelle, an der du tippst; Fokus geht nicht verloren.
- Hotspot-Hover und Aufklappen funktioniert auch direkt nach einem Rebuild — keine „toten" Hotspots in den ersten 200 ms.
- Beim Hinzufügen / Verschieben / Löschen einer Schlüsselzeile aktualisiert sich die PDF im Hintergrund ohne sichtbares Wegblitzen.
- Tab-Wechsel/Window-Blur baut sofort fertig, aber ebenfalls per Cross-Fade.
- Wenn ein Build fehlschlägt, bleibt die letzte gültige PDF sichtbar; das Status-Pill zeigt den Fehler dezent oben rechts.

## Rollback

Beide Slots + Overlay-Trennung leben komplett in `ProtokollLivePreview.tsx`. Falls etwas haken sollte, lässt sich auf den heutigen Single-Document-Stand zurückkehren, ohne andere Dateien anzufassen.
