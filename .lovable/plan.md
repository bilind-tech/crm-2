## Problem

1. „Zahlung erfassen" ist als Button-Beschriftung unklar — klingt nach Buchhaltungs-Jargon.
2. Der Dialog `ZahlungErfassenDialog` zeigt sofort sehr viele Felder (Offen-Übersicht, 3 Schnell-Buttons, Betrag, Datum, Methode, Notiz). Auf dem Handy wirkt das überladen und „hässlich".
3. Es gibt keine einfache Ja/Nein-Frage für den häufigsten Fall: „Hat der Kunde voll bezahlt?".

## Ziel

- Klarer, aktiver Button-Text statt „Zahlung erfassen".
- Beim Klick öffnet sich ein **kleines, mittig zentriertes** Dialog-Fenster mit nur einer Frage: „Hat der Kunde bezahlt?" + Buttons **Ja, voll bezahlt** / **Nein, Teilbetrag** / **Abbrechen**.
- Klick auf **Ja** → bucht sofort den vollen offenen Betrag, Dialog schließt.
- Klick auf **Nein** → wechselt im selben Dialog zu einem zweiten, ebenfalls minimalen Schritt: nur Betrags-Eingabe (groß, Ziffern-Tastatur) + zwei Buttons (Speichern / Abbrechen).
- Datum, Methode, Notiz verschwinden aus der UI — werden automatisch gesetzt (Datum = heute, Methode = Überweisung, Notiz leer). Bestehende Datenstruktur bleibt voll erhalten.

## Änderungen

### 1. Neuer Button-Text
Überall wo aktuell „Zahlung erfassen" steht (`src/routes/rechnungen.tsx` Zeilen 237/240/345 + Tooltips, `src/routes/rechnungen.$id.tsx` Zeilen 76/147), ersetzen durch:

- **Button-Label:** „Als bezahlt markieren"
- **Tooltip:** „Bezahlung eintragen — voll oder teilweise"

(„Als bezahlt markieren" ist eindeutig eine Aktion, kein Statement, dass es bereits passiert ist — der Kontext macht klar, dass jetzt erst gebucht wird.)

### 2. `ZahlungErfassenDialog.tsx` umbauen — zweistufiger Mini-Dialog

**Stufe 1 — Frage (Default beim Öffnen):**
- Zentriert, schmal (`sm:max-w-sm`).
- Titel: „Bezahlt?"
- Beschreibung: „Rechnung `{nummer}` · offen: **{formatEUR(offen)}**"
- Drei Buttons untereinander auf Mobile, nebeneinander ab `sm`:
  - Primary, groß, h-12: „Ja, voll bezahlt ({formatEUR(offen)})" → bucht sofort den vollen Betrag und schließt.
  - Outline: „Nein, nur ein Teil" → wechselt zu Stufe 2.
  - Ghost: „Abbrechen" → schließt.

**Stufe 2 — Teilbetrag:**
- Titel: „Wie viel wurde bezahlt?"
- Großes Input-Feld (h-14, text-2xl, `inputMode="decimal"`), automatisch fokussiert, vorbelegt mit leer.
- Hinweis darunter: „Offen: {formatEUR(offen)}".
- Zwei Buttons:
  - Primary: „Speichern" (disabled wenn betrag ≤ 0 oder > offen).
  - Outline: „Zurück" → zurück zu Stufe 1.
- Kein Datum, keine Methode, keine Notiz mehr sichtbar.

**Backend-seitig:** Beim Submit immer `datum: todayISO()`, `methode: "ueberweisung"`, `notiz: undefined` an `useAddZahlung` übergeben (gleiche API wie heute, kein Backend-Change).

### 3. State-Reset
- `useEffect` setzt beim Öffnen Stufe immer auf `"frage"` zurück, Betrag auf `""`.

## Was NICHT geändert wird
- Datenmodell, Zahlungs-API, FlowBar-Status-Ableitung — alles unverändert.
- Andere Dialoge / Routes bleiben gleich.
- Keine Sparkles, keine Gradient-Hintergründe (`bg-background` bleibt).

## Ergebnis

- Auf dem Handy klein, mittig, klar: ein Button für den Standardfall („voll bezahlt"), ein zweiter für Teilzahlung, ein Abbrechen.
- Keine überladene Maske mehr für 90 % der Fälle.
- Wer einen Teilbetrag tippen will, sieht nur ein einziges Eingabefeld.
