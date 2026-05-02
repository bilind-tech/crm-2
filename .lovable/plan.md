# Step 4 — Angebote, Rechnungen & Teilzahlungen

## Ziel
Viertes Backend-Modul: das Kerngeschäft (Angebote, Rechnungen inkl. Positionen, Teilzahlungen, Status-Lifecycle, Belegnummer-Vergabe nach Kundenkürzel) auf SQLite + Fastify im Pi-Backend. Die in Step 3 vorbereiteten atomaren Zähler und FTS-Trigger werden hier scharf geschaltet. Mock bleibt als Demo-Fallback erhalten.

## Backend

### 1. Migration `007_angebote_rechnungen.sql`
- `angebot` — Felder gemäß `Angebot`-Type. `kunde_id` FK `ON DELETE RESTRICT`, `objekt_id` / `ansprechpartner_id` `ON DELETE SET NULL`. `status` (enum als TEXT + CHECK). `archiviert INTEGER DEFAULT 0`. `optionen TEXT` (JSON). `drive TEXT` (JSON). `versendet_am`, `gueltig_bis`. Trigger `angebot_touch`.
- `angebot_position` — FK `ON DELETE CASCADE`, `sort INTEGER NOT NULL`. Spalten: `beschreibung`, `menge`, `einheit`, `einzelpreis_netto`, `steuersatz`, `rabatt`, `modus`, `pauschalpreis_netto`, `ausfuehrung`. Index `(angebot_id, sort)`.
- `rechnung` — analog Angebot + `quell_angebot_id` FK `ON DELETE SET NULL`, `rechnungsdatum`, `faelligkeitsdatum`, `mahn_pausiert_bis`, `inkasso_markiert`. Status-CHECK inkl. `teilbezahlt`/`bezahlt`/`ueberfaellig`/`storniert`.
- `rechnung_position` — wie `angebot_position`.
- `zahlung` — FK auf `rechnung(id) ON DELETE CASCADE`, `betrag INTEGER` (Cent), `datum`, `methode`, `referenz`, `notiz`, `erstellt_am`. Index `(rechnung_id)`.
- Belegnummer-Eindeutigkeit: `UNIQUE(nummer)` auf `angebot` und `rechnung`.
- FK `ON DELETE RESTRICT` von `kunde` ist jetzt scharf — die Step-3-Soft-Delete-Logik prüft `EXISTS angebot/rechnung` und wird gegen die echten Tabellen wirksam.

### 2. Migration `008_fts_belege.sql`
- Additive FTS5-Trigger für `angebot` und `rechnung`: `ai/au/ad` schreiben `(entity_typ, entity_id, titel='Nummer + Titel', untertitel='Kundenname', body='Positionen-Beschreibungen joined)` in `suche_idx`.
- Re-Index-Pfad für Belege wird in den bestehenden `rebuild`-Befehl integriert.

### 3. Module unter `backend/src/belege/`
- `mappers.ts` — `snake_case`↔`camelCase`, Geld als Cent ↔ Euro-Decimal, JSON-Parsing für `optionen`/`drive`/`positionen`.
- `belegnummer.ts` — nutzt `nextNummer(kundeId, "MMYY")` aus Step 3. Format aus `mem://features/belegnummern`: `{KÜRZEL}{MM}{YY}/{NN}` (z. B. `GFU0526/01`). Fallback wenn Kürzel fehlt: globaler Präfix aus `firmendaten.angebotPraefix` / `rechnungsPraefix`. Vergabe immer in derselben Transaktion wie der INSERT.
- `angebote-repo.ts` / `rechnungen-repo.ts` — CRUD inkl. Positionen, Filter (`kundeId`, `status`, `archiviert`, `q`), Pagination, Sortierung. Positionen in einer Transaktion zusammen mit Beleg neu schreiben (bestehende löschen → neu einfügen, sort-Reihenfolge).
- `status.ts` — Lifecycle-Engine. Tabelle erlaubter Übergänge (z. B. `entwurf→versendet`, `versendet→teilbezahlt|bezahlt|ueberfaellig|storniert`). Auto-Ableitungen:
  - Rechnung-Status aus Summe Zahlungen: `0 → unverändert`, `<brutto → teilbezahlt`, `>=brutto → bezahlt`. „ueberfaellig" wird per Tageslauf gesetzt (siehe Scheduler).
  - Endzustände (`bezahlt`, `storniert`, `abgelehnt`, `angenommen` bei Angebot) verhindern Statuswechsel zurück.
- `umwandeln.ts` — `angebot → rechnung`: kopiert Positionen, setzt `quellAngebotId`, vergibt neue Rechnungsnummer, Angebot-Status auf `angenommen`. Alles in einer Transaktion. Idempotenz: zweiter Aufruf liefert die existierende Rechnung statt Doppel.
- `duplizieren.ts` — Angebot-Klon ohne Versand-/Drive-Daten, neuer Status `entwurf`, neue Nummer.
- `zahlungen.ts` — Anlegen/Löschen einer Zahlung, dann `status.recompute(rechnungId)`. Validierung: `betrag>0`, `datum<=heute+1`. Methode-Default `ueberweisung` (passt zur Memory-Regel zum Mini-Dialog).
- `scheduler.ts` — täglicher Cron (intern, an bestehenden Backup-Scheduler andocken): markiert offene Rechnungen mit `faelligkeitsdatum<heute` und Status `versendet|teilbezahlt` als `ueberfaellig`, sofern nicht `mahnPausiertBis>=heute`.

### 4. Routes unter `backend/src/routes/`
- `angebote.ts`
  - `GET /angebote?kundeId&status&archiviert&q&limit&offset` — Liste; `q` nutzt FTS5.
  - `GET /angebote/:id` — Detail inkl. Positionen.
  - `POST /angebote` — Vergabe Nummer, Status `entwurf`.
  - `PATCH /angebote/:id` — Partial inkl. Positionen-Replace.
  - `DELETE /angebote/:id` — soft (`archiviert=1`) wenn `versendet_am` gesetzt, sonst hart.
  - `POST /angebote/:id/senden` — Status → `versendet`, `versendet_am=now`. Triggert in Step 6 Mailversand; in Step 4 nur Status + Audit.
  - `POST /angebote/:id/in-rechnung-umwandeln` — siehe `umwandeln.ts`.
  - `POST /angebote/:id/duplizieren`.
- `rechnungen.ts`
  - Analoge CRUD-/Senden-Routen.
  - `POST /rechnungen/:id/zahlungen` und `DELETE /rechnungen/:rechnungId/zahlungen/:zahlungId`.
  - `POST /rechnungen/:id/mahnung-pausieren` (Body `{ bis: ISODate }`).
  - `POST /rechnungen/:id/inkasso-markieren`.
  - Mahnstufen-Logik selbst kommt erst in Step 6 (E-Mail) — hier nur Felder + Status persistieren.
- Alle Mutationen schreiben Audit (`angebot.create`, `rechnung.zahlung.add`, `rechnung.status.auto`, …).

### 5. Belegnummer-Edge-Cases
- Monatsrollover: Nummer wird beim INSERT bestimmt, basierend auf `rechnungsdatum` (Rechnung) bzw. `erstelltAm` (Angebot). Bei späterem Editieren des Datums bleibt die Nummer.
- Stornierte Rechnungen behalten ihre Nummer; Lücken sind erlaubt, da Periode = `MMYY` × Kunde.
- Race: 100 parallele POST `/rechnungen` für denselben Kunden+Monat → Test in Vitest.

### 6. Tests `backend/test/belege.spec.ts`
- Angebot anlegen → Nummer `GFU0526/01`; zweites Angebot desselben Kunden im selben Monat → `/02`.
- Rechnung erstellen + zwei Teilzahlungen `< brutto` → Status `teilbezahlt`; dritte Zahlung füllt → `bezahlt`. Zahlung löschen → Status fällt zurück.
- 100 parallele POST `/rechnungen` für denselben Kunden in `0526` → 100 verschiedene Nummern, alle in `1..100`.
- `angebot_in_rechnung_umwandeln` zweimal hintereinander → liefert dieselbe Rechnung-ID, kein Duplikat, Angebot-Status bleibt `angenommen`.
- Kunde mit Rechnung löschen → 409 + Soft-Delete-Pfad (Step 3 Logik feuert via `EXISTS`).
- FTS: Suche nach Position-Beschreibung „Treppenhaus" findet Angebot.
- Scheduler: Rechnung mit `faelligkeitsdatum=gestern` Status `versendet` → nach Cron-Tick `ueberfaellig`. Mit `mahnPausiertBis=morgen` → bleibt.

## Frontend

### `src/lib/api/client.ts`
- `PI_PREFIXES` ergänzen: `/angebote`, `/rechnungen`.
- Mock-Override-Liste unverändert; Mock-Code für diese Pfade bleibt als Demo-Fallback.

### `src/hooks/useApi.ts`
- Keine Signatur-Änderung — alle Hooks (`useAngebote`, `useAngebot`, `useCreateAngebot`, `useUpdateAngebot`, `useSendeAngebot`, `useAngebotInRechnung`, `useDuplicateAngebot`, `useRechnungen`, `useRechnung`, `useCreate/Update/Delete/SendeRechnung`, `useAddZahlung`, `useDeleteZahlung`, Mahnpause/Inkasso) zeigen schon auf die produktiven Pfade.
- 409-Fehler bei Belegnummer-Konflikt (extrem selten dank Atomzähler) wird via bestehender `ApiError`-Pfad als Toast gezeigt.

### Keine UI-Änderung nötig
- Listen, Detailseiten, FlowBar, ZahlungErfassenDialog, PDF-Editor-Vorschau (Step 5 wird PDF-Daten ergänzen) — alles spricht schon gegen diese Endpoints.
- Kürzel-basierte Belegnummern werden automatisch sichtbar, sobald der Kunde ein Kürzel hat (Step 3 erzwingt Eindeutigkeit).

### `src/lib/mock/backend.ts`
- Marker `// STEP 4 ÜBERNOMMEN` über Angebot/Rechnung/Zahlung-Handler. Verhalten unverändert.

## Sicherheits- & Datenintegritäts-Garantien
- Belegnummern: Vergabe + INSERT in **einer** SQLite-Transaktion → nie Lücken durch fehlgeschlagene Inserts, nie Duplikate durch Races. UNIQUE-Constraint als Sicherheitsnetz.
- Rechnungs-Status leitet sich serverseitig aus Zahlungssumme ab — Client kann nicht „bezahlt" forcen (PATCH ignoriert `status` wenn aus Zahlungen ableitbar, außer für `storniert`).
- `ON DELETE RESTRICT` von Kunde → Rechnung verhindert Datenverlust; Soft-Delete-Pfad aus Step 3 greift.
- Geld wird intern als Integer-Cent gespeichert, an der API-Grenze nach Euro-Number gemappt → keine Float-Drift bei Teilzahlungs-Summen.
- Audit-Log enthält bei Status-Änderungen Vorher/Nachher.

## Reihenfolge der Umsetzung
1. Migrationen 007 + 008.
2. Module unter `backend/src/belege/` (mappers, belegnummer, repos, status, umwandeln, duplizieren, zahlungen, scheduler).
3. Routes + Registrierung in `backend/src/server.ts`.
4. Vitest-Suite (8 Tests) grün.
5. Frontend-Routing in `client.ts`.
6. Manuell im Preview: Angebot anlegen → senden → in Rechnung umwandeln → zwei Teilzahlungen → bezahlt.
7. Memory `mem://features/backend-step4-belege` + Eintrag in `mem/index.md`.

## Nicht-Ziele für Step 4
- Kein PDF-Rendering (Step 5).
- Kein Drive-Upload, kein E-Mail-Versand (Step 6 — `/senden` setzt vorerst nur Status).
- Keine Mahn-Eskalations-Mails (Step 6); Felder `mahnungen[]`, `mahnPausiertBis`, `inkassoMarkiert` werden aber persistiert.
- Keine SSE/Live-Aktivitäten (Step 8).

Sag „approved" wenn der Plan passt — dann starte ich Step 4.