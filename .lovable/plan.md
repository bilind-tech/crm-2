## Vier Änderungen am E-Mail-Versand

### 1. PDF-Vorschau direkt im Anhang ausklappen

In `src/components/email/EmailVersandDialog.tsx` bekommt die Anhang-Zeile rechts neben dem X einen Chevron-Button (`ChevronDown`/`ChevronUp`). Klick togglet einen ausklappbaren Bereich darunter mit einem `<iframe src={pdfBlobUrl}>` (ca. 480 px hoch, gerundete Border, neutraler `bg-muted/20`-Rahmen).

- Nur sichtbar wenn `pdfBlobUrl` vorhanden und `pdfStatus === "ready"` ist.
- State `pdfPreviewOffen` lokal in der Komponente, default `false`.
- Keine zusätzlichen Requests — `pdfBlobUrl` ist bereits geladen.

### 2. Vorlagen-Inhalte säubern (Grußformel & Fragen-Satz)

Alle Default-Vorlagen werden so umgeschrieben, dass sie **keinen** Schlussgruß (`Mit freundlichen Grüßen…`) und **keinen** Standard-Fragen-Satz (`Bei Fragen erreichen Sie uns…`) mehr enthalten — das übernimmt ausschließlich die Signatur.

**Backend** (`backend/src/email/templates.ts`):
- Letzten `P("Mit freundlichen Grüßen…")`-Absatz aus jedem Default entfernen.
- Sätze wie „Bei Fragen … erreichen Sie uns telefonisch unter {{firma.telefon}} oder per Antwort …" / „Sie erreichen uns telefonisch unter …" entfernen.
- Schlusssatz auf eine knappe Bedank/Abschluss-Zeile reduzieren („Vielen Dank für Ihr Vertrauen.", „Wir freuen uns auf Ihre Rückmeldung." etc.).
- Damit bestehende DB-Einträge (über `seed_key` schon eingespielt) ebenfalls aktualisiert werden, bekommt jeder Eintrag einen neuen `seed_key`-Suffix `.v2`. Die alten `.v1`-Vorlagen werden **nicht** gelöscht (User könnte sie bearbeitet haben), die neuen `.v2` werden zusätzlich eingespielt und — falls für den Kontext noch kein Standard existiert — als Standard markiert. Falls bereits eine User-Standard-Vorlage existiert, bleibt sie unverändert.

**Frontend-Seed** (`src/lib/erinnerung/seedVorlage.ts`):
- Letzten `<p>Mit freundlichen Grüßen…</p>` und den Fragen-Satz entfernen.
- Konstante `NAME` auf `"Zahlungserinnerung (freundlich) v2"` ziehen, damit die saubere Variante neu angelegt wird. `useErinnerungVorlageId` sucht zukünftig auf den neuen Namen.

### 3. Auto-Scroll nach oben beim Absenden

`handleSend` in `EmailVersandDialog.tsx` scrollt den scrollbaren `DialogContent`-Container vor dem Versand auf 0:

```ts
const scrollContainerRef = useRef<HTMLDivElement>(null);
// im handleSend, vor setPhase("sending"):
scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
```

Dazu wird ein `ref` an das äußere `<DialogContent>` gehängt (oder ein zusätzlicher Wrapper-Div innerhalb), so dass das bereits absolut positionierte `SendOverlay` (z. 412) im sichtbaren Viewport landet.

### 4. Bild-URL in Signatur automatisch als `<img>` rendern

Aktuell speichert der User die Signatur als HTML-Textarea. Wenn dort nur die reine URL `https://mycleancenter.de/logo.png` steht (statt `<img src="…">`), zeigt der Browser nichts an — weder im Editor noch beim Empfänger.

**Lösung** — neue Hilfsfunktion `autoLinkifyImages(html: string)` in `src/lib/email/signature.ts`:
- Erkennt nackte URLs (`https?://…\.(png|jpg|jpeg|gif|webp|svg)(\?…)?`) außerhalb bestehender HTML-Tags und wickelt sie in `<img src="…" alt="" style="max-width:240px;height:auto;display:inline-block">` ein.
- Wird **nur lesend** angewandt:
  - in der Signatur-Live-Vorschau (`EmailVersandDialog.tsx` Zeile ≈ 557–562),
  - im finalen `finaleBody`, der ans Backend geschickt wird (Zeile ≈ 233–235),
  - in der `EmailEinstellungen.tsx`-Signatur-Vorschau (`SignaturDialog`),
  - und in der „Vorschau"-Iframe-Vorlage des Versand-Dialogs (Zeile ≈ 530–538).
- Im DB-Wert der Signatur wird nichts verändert (User-Eingabe bleibt unangetastet); die Transformation passiert nur beim Rendern/Senden.

## Out of Scope

- Keine Änderung am SMTP-Versand, an `useSendEmail`, an Idempotenz oder Mahnwesen.
- Bestehende User-eigene Vorlagen (mit `seed_key = NULL` oder User-editierte Defaults) bleiben unverändert — nur die neuen `.v2`-Seeds kommen additiv dazu.
- Kein Rich-Text-Editor — Signatur bleibt HTML-Textarea + Vorschau.
