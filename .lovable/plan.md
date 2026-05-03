# Belegnummern-Logik v2 — kollisionsfrei, konsistent, importfest

## Status quo & gefundene Bugs

| # | Beobachtung | Schweregrad |
|---|---|---|
| B1 | **Angebot und Rechnung teilen denselben Zähler** (`belegnummer_zaehler` PK = `(kunde_id, periode)`). Memory schreibt aber explizit „pro Kunde + Monat + **Belegart**". Real entstehen Lücken in beiden Sequenzen (Angebot 01, Rechnung 02, Angebot 03 …). | hoch |
| B2 | `createAngebot` ruft `vergebeBelegnummer` **ohne Bezugsdatum** → Default `new Date()`. Wenn der Beleg an einem späten Abend mit `erstelltAm`-Override erzeugt würde (oder Server-Uhr abweicht), fällt Periode auseinander. | mittel |
| B3 | **Fallback-Präfix `AN`/`RE` ohne Kürzel** ignoriert die Kunde-ID im sichtbaren Teil → zwei kürzelfreie Kunden bekommen `AN0526/01` mit identischem String, würden aber als unterschiedlich aussehende Belege auftauchen → Verwirrung; UNIQUE-Constraint auf `nummer` schlägt erst beim 2. Insert zu, der Zähler wurde dann schon hochgezählt → **Lücke**. | hoch |
| B4 | **Kein Manual/Import-Pfad**: Migration aus Altsystem kann beliebige `nummer` setzen (Schema erlaubt es), aber `belegnummer_zaehler` wird nie nachgezogen → der nächste Auto-Generate kollidiert mit Altdatenbestand → UNIQUE-Verletzung, User sieht 500. | hoch |
| B5 | **Keine Retry-Schicht bei UNIQUE-Verletzung**: jede konkurrente oder racy Vergabe schlägt direkt fehl statt sauber neu zu ziehen. | mittel |
| B6 | **Periode-Format `MMYY`** in Code, Memory schreibt teils `YYMM` — Memory ist falsch, aber führt zu Re-Implementierungs-Bugs durch andere Agenten. | niedrig |
| B7 | `peekBelegNummer` gibt nicht den korrekten *Anzeige*-String, nur die laufende Zahl. Frontend muss Format selbst nachbauen → Drift-Gefahr. | niedrig |
| B8 | Fehlende **Audit-Spalte**: man kann nicht nachvollziehen, ob eine Nummer auto-vergeben oder importiert wurde. | niedrig |
| B9 | `archiviert`/`status='storniert'` (Rechnung) entfernt Beleg nicht aus UNIQUE-Pool — gut. Aber: nirgendwo dokumentiert, dass Storno-Nummern nie wiederverwendet werden. | niedrig |

## Lösung

### 1. Schema-Migration `019_belegnummer_v2.sql`
- Neue Spalte **`belegart`** in `belegnummer_zaehler`, neuer PK `(kunde_id, belegart, periode)`.
- Backfill: bestehende Zeilen werden auf die **maximale tatsächlich vergebene Nummer** in der jeweiligen Belegart-Tabelle aligniert (zwei Inserts: einmal als `angebot`-Zähler, einmal als `rechnung`-Zähler, jeweils gestartet bei `MAX(nn)+1` parsed aus `nummer`).
- Neue Tabelle `belegnummer_reserviert(nummer TEXT PRIMARY KEY, art TEXT, kunde_id TEXT, grund TEXT, erstellt_am TEXT)` → Importierte/manuelle Nummern werden dort eingetragen, damit der Auto-Vergabe-Pfad sie skippen kann.
- Nicht-zerstörende Migration (CREATE TABLE … AS SELECT), Daten-Verzeichnis bleibt unangetastet.

### 2. `nummern.ts` & `belegnummer.ts` neu
- `nextBelegNummer(kundeId, belegart, periode)` mit `belegart` im UPSERT.
- Neuer Helfer `claimNummerOrSkip(formatString)`: prüft `belegnummer_reserviert` und überspringt belegte Bereiche (max. 50 Loops, dann Hard-Fail mit klarer Fehlermeldung).
- `vergebeBelegnummer` läuft in **Retry-Schleife** (max 5×): bei `SQLITE_CONSTRAINT_UNIQUE` auf `angebot.nummer`/`rechnung.nummer` → Zähler nochmal ziehen, neu probieren. Verhindert Race nach Import oder paralleler Schreibvorgänge.
- Fallback-Präfix-Bug fixen: ohne Kürzel wird zusätzlich die **Kunden-Nummer** (`K-2026-001`) ins Präfix geschoben → `AN-K001-0526/01`. Eindeutig.
- `peekBelegNummer` gibt **fertig formatierten String** + Zahl zurück.

### 3. Bezugsdatum sauber durchreichen
- `createAngebot` nutzt `data.gueltigBis ?? today` als Bezugsdatum (oder explizit `bezugsdatum`-Feld in `AngebotWrite`, optional).
- `createRechnung` bleibt bei `rechnungsdatum`. Schon korrekt.
- Bezugsdatum wird zusammen mit Nummer in einem neuen Feld `nummer_periode` (TEXT) gespeichert → spätere Audits/FAQ.

### 4. Import-/Manual-Endpunkt
- `POST /belege/nummer/reservieren { art, nummer, grund }` → trägt in `belegnummer_reserviert` ein, validiert Format, prüft Kollision mit existierenden Belegen.
- `POST /belege/nummer/import-scan` → liest alle bestehenden `nummer` aus `angebot`/`rechnung`, parsed `KÜRZEL/AN/RE` + `MMYY` + `NN`, hebt den Zähler je `(kunde, art, periode)` mindestens auf `MAX(nn)+1`. **Idempotent**, kann jederzeit aufgerufen werden — wird auch beim ersten Boot nach Migration einmalig automatisch ausgeführt.

### 5. Validierung & Format-Single-Source-of-Truth
- Neue Datei `backend/src/belege/nummer-format.ts`:
  - `parseBelegnummer(s) → { kuerzel|prefix, kundennummer?, periode, nn }` oder `null`.
  - `formatBelegnummer(parts) → string`.
  - Regex bleibt eng: `^([A-Z0-9]{2,8})(?:-K(\d{3,5}))?(\d{4})\/(\d{2,4})$`.
- Wird sowohl im Backend (Import-Scan, Validation) als auch über eine schmale `/belege/nummer/format`-Spiegelung im Frontend genutzt (Anzeige in Listen, Drucken).

### 6. Tests (Vitest, im Backend)
- `belegnummer.test.ts`:
  - 1000 parallele `vergebeBelegnummer` für denselben Kunden+Monat+Art → exakt 1..1000, keine Duplikate, keine Lücken.
  - Mischbetrieb Angebot/Rechnung gleicher Kunde+Monat → zwei unabhängige 1..N Sequenzen.
  - Import-Scan auf Tabelle mit manuell gesetztem `GFU0526/47` → nächste Auto-Nummer = `GFU0526/48`.
  - Reservierung `GFU0526/49` → nächste Auto-Nummer = `GFU0526/50`.
  - Bezugsdatum am 31.05. 23:59 UTC vs. 01.06. 00:01 UTC → unterschiedliche Periode.

### 7. Memory & Doku
- `mem://features/belegnummern.md` aktualisiert: Format `MMYY` (richtig), neue Tabelle mit `belegart`, Reservierungs-Mechanismus, Retry, Fallback-Präfix-Regel.

## Reihenfolge der Umsetzung
1. Migration `019_belegnummer_v2.sql` + Backfill-Logik.
2. `nummer-format.ts`, `nummern.ts`, `belegnummer.ts` neu mit Retry + Reservation-Skip.
3. `angebote-repo.ts` / `rechnungen-repo.ts` an neue Signatur (`belegart`-Param) anpassen.
4. Boot-Hook in `server.ts`: einmaliger Import-Scan.
5. Routes: `/belege/nummer/reservieren`, `/belege/nummer/import-scan`, `/kunden/:id/zaehler/:art` (Peek mit Format).
6. Vitest-Suite.
7. Memory-Update.

## Was sich für Frontend/UX nicht ändert
- Bestehende `nummer`-Strings bleiben gültig.
- `peek`-Endpunkt für Live-Vorschau bekommt zusätzliches Feld `formatted`, alte Felder bleiben → nicht-brechend.
- Keine Daten werden gelöscht oder umgeschrieben; Migration ist additiv.

Sag „weiter", dann setze ich Punkt 1–4 um, danach 5–7.
