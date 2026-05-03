# Plan 5 — Werkzeuge-Seite (Übergabe-/Abnahmeprotokoll + Schlüsselübergabe)

Neue Sammelseite in der Sidebar (unter „Stundenzettel"), die als Hub für **kleine PDF-Werkzeuge** dient. Heute zwei Funktionen, später beliebig erweiterbar (FAQ-Aushang, Auftrag, Reinigungsnachweis, …). Reines Frontend für jetzt — die echten Vorlagen-Layouts und der finale Mail-Anhang-Pfad kommen, sobald du mir die Vorlagen schickst.

## A. Sidebar + Route

- Neuer Sidebar-Eintrag „Werkzeuge" mit Icon `Wrench`, direkt **unter** „Stundenzettel" in der Gruppe „Vertrieb & Abrechnung". Naming-Vorschlag: **„Werkzeuge"** (alternativ „Vorlagen & Tools"). Sag Bescheid, falls ein anderer Name besser passt.
- Neue Route `src/routes/werkzeuge.tsx` für die Hub-Seite.
- Neue Routen für die einzelnen Werkzeuge:
  - `src/routes/werkzeuge.uebergabeprotokoll.tsx`
  - `src/routes/werkzeuge.schluesseluebergabe.tsx`

## B. Hub-Seite `/werkzeuge`

Bewusst **ohne** die 4 KPI-Kacheln, die die Belege-Listen oben tragen — du willst hier keine Zähler. Stattdessen:

- Klassischer `PageHeader` „Werkzeuge" + kurzer Untertitel („PDF-Werkzeuge und schnelle Helfer für den Alltag").
- Suchfeld („Werkzeug suchen …") — wirkt clientseitig auf die Karten, nützlich sobald 5+ Tools drin sind.
- Gruppierte Karten-Sektionen (extensible). Start-Sektionen:
  - **„PDF-Vorlagen"** → Karten: *Übergabe-/Abnahmeprotokoll*, *Schlüsselübergabe*
  - **„Mehr folgt"** → leere Sektion mit gestricheltem Platzhalter („Hier kommen weitere Werkzeuge."). Sobald wir was Neues haben, fällt der Platzhalter raus.
- Jede Werkzeug-Karte: Icon (`FileSignature` / `KeyRound`), Titel, 1–2-Zeilen-Beschreibung, Button „Öffnen" → Route. Konsistent mit dem bestehenden Card-Stil (`rounded-2xl border bg-card shadow-sm`, kein Gradient, keine Sparkles).

Datenmodell intern als Liste von `WerkzeugDefinition { id, gruppe, titel, beschreibung, icon, route }` — neue Werkzeuge sind dann ein 5-Zeilen-Eintrag plus Route. Keine Backend-Tabelle nötig.

## C. Übergabe-/Abnahmeprotokoll `/werkzeuge/uebergabeprotokoll`

Schlankes Formular auf einer Seite (kein Wizard):

1. **Kunde** auswählen (Combobox aus `useKunden()`, mit Suche). Optional: Objekt aus `useObjekte()` — falls der gewählte Kunde mehrere hat, gefiltert.
2. **Art** (Radio): „Übergabe" / „Abnahme" / „Übergabe & Abnahme".
3. **Datum** (Default: heute), **Uhrzeit** (Default: jetzt).
4. **Anwesende Personen** (zwei Felder: Auftraggeber-Vertreter, Auftragnehmer-Vertreter). Vorausgefüllt aus Kunde-Hauptkontakt + Firmendaten.
5. **Leistungsumfang** (Textarea, vorausgefüllt mit „Endreinigung / Unterhaltsreinigung / …" — frei änderbar).
6. **Mängel / Bemerkungen** (Textarea, leer).
7. **Akzeptiert** (Checkbox „Abnahme erfolgt ohne Vorbehalt").
8. **Unterschriften** — zwei Felder „Name in Druckbuchstaben" für jetzt; echte Touch-Unterschriften setzen wir später drauf, wenn du das willst.

Sticky Action-Bar unten:
- **„PDF erstellen"** (primary) — generiert das PDF (siehe E unten).
- **„PDF + per E-Mail senden"** — öffnet den bestehenden `EmailVersandDialog` mit Kontext `allgemein` und dem PDF als Anhang. Kunde, Empfänger und Absenderfirma sind vorausgefüllt; du kannst Vorlage/Signatur wählen wie gewohnt.

## D. Schlüsselübergabe `/werkzeuge/schluesseluebergabe`

Gleiches Layout-Muster:

1. **Kunde** + (optional) Objekt.
2. **Datum / Uhrzeit**.
3. **Richtung**: Radio „Ausgabe an Kunden" / „Rücknahme von Kunden".
4. **Schlüsselliste** — dynamische Tabelle mit Spalten: *Bezeichnung*, *Anzahl*, *Schlüssel-Nr.*, *Bemerkung*. Buttons „+ Schlüssel hinzufügen" / Zeile löschen. Mindestens eine Zeile vorgegeben.
5. **Pfand** (optional, EUR-Feld).
6. **Empfangsbestätigung** (Checkbox + zwei Namensfelder Auftraggeber/Auftragnehmer).

Sticky Action-Bar wie oben (PDF / PDF + Mail).

## E. PDF-Generierung — Plan, nicht Implementierung

Layout wartet auf deine Vorlagen. **Sobald du mir die zwei Vorlagen schickst** (am liebsten als PDF oder Foto), baue ich:
- Pro Werkzeug ein React-PDF-Template in `src/lib/pdf/werkzeuge/uebergabeprotokoll.tsx` und `…/schluesseluebergabe.tsx` mit `@react-pdf/renderer` (gleicher Stack wie die Beleg-PDFs in `src/lib/pdf/`).
- Felder werden 1:1 aus dem Formular eingesetzt (Kunde, Datum, Tabellen, etc.).
- Header mit Firmendaten/Logo aus `useFirmendaten()` — also automatisch konsistent mit Rechnungs-/Angebots-Look.
- Dateiname-Schema: `Uebergabeprotokoll_{Kunde}_{YYYY-MM-DD}.pdf` bzw. `Schluesseluebergabe_{Kunde}_{YYYY-MM-DD}.pdf`.

In **diesem** Plan baue ich zunächst das **Frontend-Gerüst** (Hub + beide Formulare + lokales PDF-Stub mit Platzhalter-Layout, Download funktioniert sofort). Echte Vorlagen-Treue folgt im nächsten Schritt nach deiner Vorlage.

## F. Speicherung / Historie — bewusst rausgelassen

Du hattest nichts dazu gesagt. Mein Vorschlag: für jetzt **kein** Backend-Speicher — das PDF wird erzeugt, runtergeladen und (optional) per Mail verschickt. Kein neuer DB-Tabellen-Wildwuchs vor Pi-Auslieferung. Sobald du sagst „die sollen auch in Dokumenten auftauchen", erweitern wir's auf die `dokumente`-Tabelle (gleicher Drive-Sync-Pfad wie Rechnung/Angebot).

## G. E-Mail-Anhang — kleiner Vorbehalt

Der bestehende `EmailVersandDialog`-Pfad erwartet, dass das PDF beim Backend liegt (Beleg-PDF). Für ein frei generiertes PDF braucht der Versand-Endpunkt einen kleinen Erweiterungspunkt (PDF blob → upload → versand). **Im aktuellen Plan**: Button „PDF + per E-Mail senden" lädt das PDF zuerst herunter, öffnet dann den Mail-Dialog mit Hinweis „PDF bitte anhängen (Download lief gerade)". Sobald der Backend-Adapter steht (kleiner Folge-Plan), wird der Anhang automatisch.

## Geänderte / neue Dateien

| Datei | Änderung |
|---|---|
| `src/components/layout/AppSidebar.tsx` | Eintrag „Werkzeuge" unter Stundenzettel |
| `src/routes/werkzeuge.tsx` | **neu** — Hub-Seite, gruppierte Karten, Suche |
| `src/routes/werkzeuge.uebergabeprotokoll.tsx` | **neu** — Formular |
| `src/routes/werkzeuge.schluesseluebergabe.tsx` | **neu** — Formular |
| `src/components/werkzeuge/WerkzeugCard.tsx` | **neu** — Karten-Komponente |
| `src/components/werkzeuge/KundenObjektPicker.tsx` | **neu** — Combobox Kunde + Objekt |
| `src/lib/werkzeuge/registry.ts` | **neu** — `WerkzeugDefinition[]` |
| `src/lib/pdf/werkzeuge/uebergabeprotokoll.tsx` | **neu** — Stub-PDF (Platzhalter-Layout) |
| `src/lib/pdf/werkzeuge/schluesseluebergabe.tsx` | **neu** — Stub-PDF (Platzhalter-Layout) |

## Akzeptanzkriterien

1. In der Sidebar erscheint **„Werkzeuge"** direkt unter „Stundenzettel".
2. `/werkzeuge` zeigt zwei Karten ohne KPI-Kacheln-Header. Suche filtert die Karten clientseitig.
3. „Übergabe-/Abnahmeprotokoll" und „Schlüsselübergabe" haben jeweils ein eigenes Formular mit Kunden-Auswahl (vorausgefüllter Hauptkontakt) und einer „PDF erstellen"-Aktion, die ein gültiges PDF herunterlädt.
4. „PDF + per E-Mail senden" öffnet den vorhandenen E-Mail-Versand-Dialog mit Empfänger = Kunden-Hauptmail (für jetzt mit dem Hinweis aus G).
5. Eine neue Werkzeug-Karte hinzufügen = Eintrag in `registry.ts` + neue Route, sonst nichts.
6. Keine neuen Backend-Endpoints, keine Migrations, kein Auto-Mail-Trigger.

## Risiko

Niedrig. Reines Frontend, keine Daten-Mutationen außerhalb von „PDF runterladen". Bestehende Routen bleiben unangetastet.

Sag „Go" für die Frontend-Umsetzung. Sobald du mir die zwei Vorlagen schickst, mache ich daraus den passgenauen PDF-Layout-Plan (separat).
