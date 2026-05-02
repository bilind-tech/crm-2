## Ziel

Beim Erstellen von Angebot und Rechnung wird der Positions-Editor (Einzel-Position) vereinfacht und das Formular am Ende aufgeräumt:

1. **Einzelposition**: Felder „Menge" und „Einheit" komplett entfernen. Nur noch zwei Spalten: **Einzelpreis (50 %)** und **MwSt % (50 %)**. MwSt erscheint kompakt als Stepper-Button (▲ / ▼ neben einer kleinen Anzeige) — Klick erhöht/verringert in 1 %-Schritten.
2. **Pauschal-Position**: bleibt strukturell gleich (Pauschalpreis 50 % + MwSt 50 %), MwSt wird ebenfalls auf den Stepper umgestellt.
3. **Form-Footer (Angebot & Rechnung)**: Das separate **MwSt-Satz-Feld** wird komplett entfernt (kommt später in die Einstellungen). Übrig bleibt nur **Gesamtrabatt (%)** auf voller Breite, direkt über dem Sticky-Action-Bar mit „Angebot anlegen" / „Rechnung anlegen".
4. **Hintergrund**: Sicherstellen, dass der weiße/`bg-background`-Bereich des SlideOvers wirklich bis ganz nach unten geht (Sticky-Footer behält `bg-background`, Form-Container füllt Höhe).

Datenmodell-Implikation: Für Einzelpositionen wird intern `menge = 1` und `einheit = "stk"` fest gesetzt — so bleibt die Position strukturell kompatibel zum bestehenden Backend (`einzelpreisNetto` ist dann automatisch der Gesamtbetrag der Position). Keine API-/Typ-Änderungen nötig.

## Detail-Änderungen

### A) `src/components/forms/PositionenEditor.tsx`

- Import: `ChevronUp`, `ChevronDown` aus `lucide-react` ergänzen; `Popover` nicht nötig.
- Neue kleine Helper-Komponente `MwStStepper` direkt in der Datei:
  - Trigger-Button mit aktuellem Satz (z. B. „19 %"), kompakt, `h-11`, voll-breit.
  - Daneben/innerhalb zwei kleine Buttons (▲ / ▼) zum Erhöhen/Verringern um 1 % (Klamp 0–25).
  - Layout-Variante: ein einzelner Button mit großer Zahl in der Mitte und je einem Pfeil oben/unten rechts — passt visuell zum Einzelpreis-Input.
- `PositionCard` (Einzel-Branch, Zeilen 244–313):
  - Entfernen: „Menge"-Input und „Einheit"-Select (Spalten 1–2 des Grids).
  - Neues Layout: `grid grid-cols-2 gap-3` mit
    - links: Einzelpreis (Label „Preis (netto) €", Input `h-11`, größeres Font wie bei Pauschal)
    - rechts: `MwStStepper`
  - Änderungen an `update`-Aufruf so, dass `menge: 1`, `einheit: "stk"` automatisch in der Position bleiben (sind schon Default in `emptyPosition`, daher nichts zu tun — die UI-Felder werden lediglich nicht mehr angezeigt).
- `PositionCard` (Pauschal-Branch, Zeilen 209–235):
  - MwSt-Input durch `MwStStepper` ersetzen (gleiches Layout-Verhältnis 50/50 bleibt).
- `EINHEITEN`-Konstante und `Einheit`-Select-Code im Einzel-Branch werden nicht mehr verwendet — Konstante darf bleiben (für künftige Nutzung / Pauschal `einheit = "pauschal"`).

### B) `src/components/forms/AngebotForm.tsx` (Zeilen 183–193)

Aktuell:
```
grid sm:grid-cols-3
  Field „Gültig bis"
  Field „MwSt-Satz (%)"
  Field „Gesamtrabatt (%)"
```

Neu:
```
grid sm:grid-cols-2
  Field „Gültig bis"
  Field „Gesamtrabatt (%)"  (volle Breite auf Mobile)
```
oder zwei getrennte Blöcke — „Gültig bis" oben, „Gesamtrabatt" als eigene Zeile in voller Breite (User wünscht: „mach Gesamtrabatt ganz lang"). Wir wählen Variante 2: „Gültig bis" alleine in einer 1-spaltigen Reihe, „Gesamtrabatt" darunter in voller Breite.

State `steuersatz` bleibt bestehen (Default 19) — wird weiterhin als `defaultSteuersatz` an `PositionenEditor` übergeben und an die API gesendet. Setter `setSteuersatz` wird ungenutzt, kann entfernt werden oder bleibt für späteren Einstellungs-Hook.

### C) `src/components/forms/RechnungForm.tsx` (Zeilen 207–214)

Analog zu B):
- Block „MwSt-Satz" entfernen.
- „Gesamtrabatt (%)" wird ein einzelnes Feld in voller Breite, direkt über dem Sticky-Footer.

### D) Hintergrund / Tiefe

- Im SlideOver ist der äußere Container bereits `bg-background` und füllt die Viewport-Höhe (`h-full flex flex-col`, Inhalt `flex-1 overflow-y-auto`). Der Sticky-Footer in beiden Forms ist bereits `bg-background`. Damit beim Scrollen kein heller Streifen unten erscheint, ergänzen wir am Form-Wrapper `min-h-full` bzw. ein Padding-bottom, sodass auch bei kurzem Inhalt der Hintergrund visuell bis unten reicht. (Konkret: `<div className="space-y-5 pb-2">` bleibt — das `flex-1` des SlideOver-Body sorgt selbst schon für vollen Hintergrund. Wenn nötig, im SlideOver-Content `bg-background` zusätzlich auf den scrollenden Bereich, falls Tests einen Spalt zeigen.)

## Betroffene Dateien

- `src/components/forms/PositionenEditor.tsx` (Einzel-Layout umbauen, MwSt-Stepper, Pauschal-MwSt umstellen)
- `src/components/forms/AngebotForm.tsx` (MwSt-Feld entfernen, Gesamtrabatt voll-breit)
- `src/components/forms/RechnungForm.tsx` (MwSt-Feld entfernen, Gesamtrabatt voll-breit)

## Nicht betroffen / bleibt gleich

- API-Typen (`Position`, `Einheit`) und Backend-Aufrufe — `menge`/`einheit` bleiben im Datenmodell, werden für Einzelpositionen automatisch `1`/`"stk"`.
- PDF-Generierung — Einzelpositionen mit `menge=1` und `einheit="stk"` werden vom Renderer bereits korrekt verarbeitet. (Falls die PDF die Spalte „Menge" zeigt, erscheint dort dann „1 Stk" — das ist akzeptabel, da der User die Anzeige nur im Editor weghaben möchte. Optional kann später die PDF-Spalte ausgeblendet werden, ist aber kein Teil dieses Tasks.)
