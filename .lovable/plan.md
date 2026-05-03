## Ziel

Die Positionstabelle in Angebots- und Rechnungs-PDFs schöner und professioneller machen. „Stunden" soll nicht mehr immer als leere Spalte mitlaufen, sondern nur erscheinen, wenn beim Erstellen einer Position bewusst „nach Stunden" gewählt wurde. Standard ist Pauschal.

## Was sich ändert

### 1. PDF-Tabelle (`src/lib/pdf/belegPdf.ts`)

Die Spalten-Anzahl wird dynamisch:

- Wenn **keine** Position eine Stunden-Position ist → Tabelle hat **3 Spalten**: `Leistung · Abrechnungsart · Preis (netto)`.
- Wenn **mindestens eine** Position nach Stunden abgerechnet wird → Tabelle hat wie bisher **4 Spalten** mit „Stunden" dazwischen, aber bei Pauschal-Zeilen bleibt das Stunden-Feld leer (statt „1 stk").

Weitere Verbesserungen am Tabellenkopf:
- Spaltenüberschrift „Preis ohne MwSt." → „**Preis (netto)**" (kürzer, üblicher in DE-Rechnungen).
- Spalte „Abrechnungsart": zeigt standardmäßig „**Pauschal**" für Pauschal-Positionen, „**Stundensatz**" bei Stunden-Positionen, sonst der vom Nutzer gepflegte Ausführungs-Text (z. B. „Mo–Fr · 5× wöchentlich"). Kein „à 12,00 €" mehr.

Auch die Spaltenbreiten (`widths`) werden auf die jeweilige Spaltenzahl angepasst.

### 2. Positionseditor (`src/components/forms/PositionenEditor.tsx`)

Aus dem heutigen 2-fach-Switch „Einzel · Pauschal" wird ein **3-fach-Switch**: „**Pauschal** · **Stunden** · **Einzel**".

- **Pauschal** bleibt der Standard beim Hinzufügen einer Position (Plus-Button öffnet direkt eine Pauschal-Karte).
- **Stunden** ist neu: zeigt zusätzlich Felder für „Stundenanzahl" und „Stundensatz (netto) €". Nur Positionen mit diesem Modus werden in der PDF-Tabelle in der Spalte „Stunden" geführt und triggern überhaupt erst die Anzeige der Stunden-Spalte.
- **Einzel** bleibt für sonstige Mengen-Positionen verfügbar, ist aber nicht mehr der Default.

Die Buttons unten („Einzelposition" / „Pauschal-Block") werden zu drei Buttons („Pauschal", „Stunden", „Einzel") umgebaut, mit „Pauschal" als visuell hervorgehobener Standard.

### 3. Datenmodell-Anpassung (`src/lib/api/types.ts`)

`PositionModus` bekommt einen dritten Wert `"stunden"` zusätzlich zu `"einzel" | "pauschal"`. Bestehende Positionen bleiben gültig (Default-Mapping `"einzel"`). Backend (`backend/src/...`) speichert den Wert weiterhin als String — keine Migration nötig, da das Feld bereits frei ist.

`toApiPositionen` / `fromApiPosition` werden für den neuen Modus erweitert (Menge = Stunden, Einheit = `"h"`, Einzelpreis = Stundensatz).

## Technische Details

- Helper `hasStundenPositionen(positionen)` in `belegPdf.ts` entscheidet über Spaltenanzahl.
- `stundenText(p)` liefert nur noch bei `p.modus === "stunden"` einen Wert (z. B. „4,5 h"), sonst leer.
- `abrechnungsartText(p)` liefert: `ausfuehrung` falls gesetzt, sonst feste Defaults pro Modus.
- Live-Preview im PDF-Editor (`useBelegPdf`) übernimmt das automatisch, da derselbe Renderer benutzt wird.

## Was sich NICHT ändert

- Bestehende, bereits gespeicherte Angebote/Rechnungen funktionieren weiter — sie haben Modus `"pauschal"` oder `"einzel"` und werden korrekt ohne Stunden-Spalte gerendert.
- Keine DB-Migration.
- Mahnungen, Versand, Drive-Upload, Steuer-Modul bleiben unberührt.
