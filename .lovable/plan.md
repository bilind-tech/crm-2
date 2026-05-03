## Ziel

Drei konkrete Probleme im Live-Editor & PDF-Layout fixen:

1. **Inline-Editor Intro/Outro/Titel zeigt leeres Feld.** Beim Klick auf „Sehr geehrte Damen und Herren / Einleitungstext" soll der **tatsächlich im PDF angezeigte Text** im Textarea stehen — auch wenn es der automatisch erzeugte Standardtext ist. So kann der User direkt feinjustieren, statt von Null abzutippen.
2. **Meta-Box oben rechts (Rechnungsnummer / Datum / Fällig am).** Zeilen sind zu locker, der „Bei Zahlung bitte Rechnungs-Nr. angeben"-Block hat zu viel Abstand, und der Rahmen wirkt unsauber. Soll ein dezenter, sauberer Rahmen werden — clean, eng, professionell.
3. **Live-Preview flackert.** Bei jeder Eingabe verschwindet die PDF kurz und kommt wieder. Soll stehen bleiben, bis die neue Version fertig ist und dann nahtlos austauschen — und schneller reagieren.

## Änderungen

### A) Inline-Editor mit Default-Text vorbefüllen

Datei: `src/components/pdf-editor/HotspotInlineEditor.tsx`

- Neue Helper `defaultIntroFor(draft, kind)` / `defaultOutroFor(draft, kind)` aus `src/lib/pdf/belegPdf.ts` exportieren (die bereits existierenden `defaultIntroAngebot`, `defaultOutroAngebot`, `defaultIntroRechnung`, `defaultOutroRechnung`).
- Im Editor:
  - **Intro:** `value = draft.optionen?.eigenesIntro ?? draft.introText ?? defaultIntroFor(draft, kind)`
  - **Outro:** analog mit `eigenesOutro / outroText / defaultOutroFor`
  - **Titel:** bleibt wie bisher (`draft.titel`), aber `placeholder` beibehalten.
- `kind` (`"angebot" | "rechnung"`) als zusätzliches Prop an `HotspotInlineEditor` durchreichen (von `PdfEditorLayout` → `renderEditor`).
- Beim ersten Tippen wird der Default automatisch zu „eigenem" Text — kein Magic-Save nötig, einfach `set("optionen", { ...opt, eigenesIntro: e.target.value })` wie bisher.

### B) Meta-Box (oben rechts) kompakt & sauber gerahmt

Dateien: `src/lib/pdf/belegPdf.ts` **und** `backend/src/pdf/layout.ts` (Parität!)

In `metaBox(...)`:
- `paddingTop`/`paddingBottom` von `4` → `2`.
- Header-Note („Bei Zahlung bitte Rechnungs-Nr. angeben"): zwischen `noteLines` `margin` `[0, 0, 0, 1]`, und insgesamt `margin: [0, 0, 0, 3]` zur Trennlinie.
- Rahmen: alle Außenlinien (`hLine` an `i===0` und `i===body.length`, `vLine` an `i===0` und `i===widths.length`) auf einheitlich `0.6` in `COLOR_TEXT`.
- Trennlinie zwischen Note-Block und Daten: `0.4` statt `0.5` (dezenter).
- Datenzeilen-`margin` von `[0, 2, x, 2]` → `[0, 1, x, 1]`.
- Header-Note Zeilen: `lineHeight: 1.15`, Datenzeilen: `lineHeight: 1.2`.
- Box-Breite minimal anpassen, falls nötig (`width: 235`).

Ergebnis: kompakter „Kasten" mit gleichmäßiger 0.6pt-Border rundherum, klarer dünner Trennlinie, deutlich engerem Zeilenabstand.

### C) Live-Preview ohne Flacker, schneller

Datei: `src/components/pdf-editor/LivePdfPreview.tsx`

- `DEBOUNCE_MS` von `600` → `300`. (Schneller reagierend.)
- **Wichtigster Fix gegen Flackern:** PDF-Build-`useEffect` darf bei Änderungen NICHT die alte `pdfUrl` zerstören. Aktuell bleibt `pdfUrl` zwar formal stehen, aber `<Document file={pdfUrl}>` rendert beim Wechsel der URL kurz nichts. Lösung:
  - Statt direkt `setPdfUrl(newUrl)` ein neues Pattern: vorab ein verstecktes `<Document file={nextUrl} onLoadSuccess={...}>` „pre-rendern". Erst wenn das `onLoadSuccess`-Callback feuert, wird `pdfUrl = nextUrl` als sichtbar gesetzt und alte URL revoked.
  - Konkret: zusätzliches State-Feld `pendingUrl`. Im sichtbaren Bereich bleibt `pdfUrl` so lange unverändert, bis `pendingUrl` geladen ist; dann atomarer Swap.
- Loader-Pille bleibt, aber `LOADER_DELAY_MS` von `400` → `250`, damit bei längeren Builds dezent sichtbar.
- Page-Re-Render-Glitch: `<Page>` bekommt `key={pdfUrl + '-' + pageNum}` damit beim Swap konsistent neu gemountet wird (aber erst nach dem Atomic Swap → kein Blank-Frame mehr).

Datei: `src/hooks/useBelegEditor.ts` (klein):
- Autosave-Debounce von `3000` ms → `1500` ms (User erwartet „live", nicht „nach 3s").
- An der Volatile-Logik nichts ändern.

## Technische Notizen

- Defaults aus `belegPdf.ts` exportieren als named exports, ohne die Aufrufstellen in `buildAngebotDoc`/`buildRechnungDoc` zu verändern.
- `HotspotInlineEditor` Prop-Signatur erweitern; `PdfEditorLayout`'s `renderEditor` (im `LivePdfPreview` Render-Prop) gibt `kind` mit.
- Backend-`layout.ts` muss exakt dieselben Padding-/Linien-Werte bekommen (sonst weicht der gespeicherte PDF vom Live-Preview ab).
- Keine API-Änderungen, keine Migrations, keine neuen Dependencies.

## Ergebnis

- Klick auf „Sehr geehrte Damen und Herren …" → Textarea zeigt den vollen Text inkl. „gerne unterbreiten wir Ihnen …" / „hiermit übersenden wir …", direkt editierbar.
- Meta-Box rechts oben: klarer, gleichmäßiger schmaler Rahmen, enge Zeilen, professionell.
- Tippen im Editor → Preview bleibt stehen, ~300 ms später ersetzt sie sich nahtlos durch die neue Version, ohne Weiß-Blink.
