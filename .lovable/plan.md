## Ziel

Google-Drive-Synchronisierung sauberer, vollständiger und benutzerfreundlicher machen:
- Monats-Ordner mit Nummer **und** Name (z. B. `05_Mai`)
- Beim erstmaligen Verbinden: alle bestehenden Angebote, Rechnungen und Dokumente automatisch nachsynchronisieren
- Auf jedem Beleg/Dokument ein „Jetzt in Drive sichern"-Knopf
- Statusanzeige nur grün („in Drive gespeichert"), wenn der Upload wirklich erfolgreich war — und Fehler in Klartext erklärt

---

## 1. Monatsordner mit Name (`05_Mai`)

**Backend** `backend/src/drive/naming.ts`
- `applyPathTemplate`/`applyFileNameTemplate` um Platzhalter `{MMMM}` erweitern (deutscher Monatsname: Januar … Dezember) und `{MM-MMMM}` (z. B. `05_Mai`).
- Default-Templates in `backend/src/routes/drive.ts` (`DEFAULT_FOLDERS`) ändern:
  - `Rechnungen/{YYYY}/{MM}_{MMMM}` usw.
- Für bereits gespeicherte Settings: Migration nicht nötig — wir normalisieren beim Laden (`buildResponse`): wenn der Wert dem alten Default `…/{MM}` entspricht, auf neuen Default heben.

**Frontend** `src/components/einstellungen/GoogleDriveTab.tsx`
- `DEFAULT_FOLDERS` und `pfadVorschau` analog erweitern.
- `PFAD_PLATZHALTER` um `{MMMM}` ergänzen.

**Folder-Cache** `backend/src/drive/folders.ts`
- `folderCache` enthält alte Pfade als Keys. Bei Template-Wechsel wird der neue Pfad einfach neu angelegt. Wir fügen einen einmaligen „Soft-Reset" hinzu: wenn ein Cache-Eintrag auf einen Ordner zeigt, dessen Name nicht zum aktuell aufgelösten Segment passt, wird er übersprungen. Alte Ordner in Drive bleiben unangetastet (keine Datenverluste).

## 2. Backfill bei Verbindung

Neuer Service `backend/src/drive/backfill.ts`:
- Funktion `backfillAll()` enqueued alle bisher nicht erfolgreich hochgeladenen:
  - Angebote mit Status `angenommen|versendet`
  - Rechnungen mit Status `versendet|bezahlt|teilbezahlt`
  - Dokumente (`geloescht_am IS NULL`), die noch keinen `drive_status='uploaded'` haben
- Idempotenz-Key identisch zur Auto-Enqueue-Logik → Duplikate landen nicht doppelt in der Queue.

Wireup in `backend/src/routes/drive.ts`:
- Nach erfolgreichem `exchangeCode` (im Callback) und nach `connect` (sobald `refreshTokenIsSet`) → `void backfillAll()` einmalig anstoßen.
- Zusätzlich neuer Endpoint `POST /drive/backfill` (auth) für „Alles erneut prüfen"-Button in den Einstellungen.

UI: in `GoogleDriveTab.tsx` → `SynchronisationSection` Button „Alles erneut prüfen" + Toast mit Anzahl enqueued.

## 3. „Jetzt in Drive sichern"-Knopf pro Beleg

Neuer Endpoint `backend/src/routes/drive.ts`:
- `POST /drive/uploads/enqueue` mit Body `{ belegArt: "angebot"|"rechnung"|"dokument", belegId }` → ruft die gleichen Hilfsfunktionen wie der Backfill auf (eine Datei) und triggert sofort `tickDriveQueue(1)`.

Frontend-Hook `src/hooks/useApi.ts`:
- `useEnqueueDriveUpload()` Mutation.

Wo der Button hinkommt:
- `src/routes/angebote.$id.tsx` und `rechnungen.$id.tsx` → in der bestehenden Drive-Status-Zeile/Card: Sekundär-Button „Jetzt in Drive sichern" wenn Status ≠ `erfolg`.
- `src/components/dokumente/DokumentBearbeitenDialog.tsx` (oder Detail-Bereich) analog.
- `DriveStatusBadge` / `DriveSyncBadge` bekommen optionalen `onResync`-Callback bzw. der Button wird daneben gerendert.

## 4. Status-Anzeige & Fehlertexte

`backend/src/drive/upload-worker.ts` + `upload-repo.ts`:
- Beim `markFehler` → bekannten Google-Fehlertext (z. B. `invalid_grant`, `insufficientPermissions`, `storageQuotaExceeded`, `403: access_denied`) in benutzerfreundliche Codes mappen (`token-expired`, `drive-voll`, `kein-zugriff`).
- Response enthält `fehlerCode` zusätzlich zu `fehlerText`.

Frontend `DriveSyncBadge`/`DriveStatusBadge`:
- Anzeige-Logik vereinheitlichen:
  - `erfolg` → „In Drive gespeichert" (grün, Link öffnen)
  - `pending`/`running` → „Wird gesichert…" (kein „gespeichert"-Label)
  - `fehler`/`manuell` → konkrete Klartext-Hilfe je nach `fehlerCode`:
    - `token-expired` → „Verbindung abgelaufen — in Einstellungen → Google Drive neu verbinden."
    - `drive-voll` → „Google-Drive-Speicher voll — Platz schaffen und erneut versuchen."
    - `kein-zugriff` → „Kein Schreibzugriff auf den Ordner — Konto-Berechtigung prüfen."
    - sonst → Original-Fehlertext + „Erneut versuchen"-Button.

`useLiveEvents`: existierende Invalidierungen reichen — kein Toast-Spam, Throttle bleibt.

## 5. Tests / QA

- Backend: `backend/test/drive-backfill.spec.ts` für Backfill-Idempotenz + Naming `{MMMM}`.
- Manuell im Preview: Drive verbinden → bestehende Belege erscheinen in Queue → erfolgreiche und fehlerhafte States in den Einstellungen sichtbar → Detail-Seiten zeigen „Jetzt sichern"-Button.

---

## Technische Details

- `{MMMM}` wird ausschließlich auf Deutsch geliefert (fix `["Januar","Februar",…]`), da das ganze System auf de-DE läuft.
- Old → New Migration: nur Default-Template-Hub, keine DB-Migration nötig.
- `backfillAll` läuft im Hintergrund (async, nicht blockierend), maximal ~500 Items pro Call, danach erneut anstoßbar.
- Idempotenz-Key bleibt `{art}-{nummer|id}-{sha[0:16]}` — verhindert Doppel-Uploads.
- `POST /drive/uploads/enqueue` und `POST /drive/backfill` sind Auth-geschützt (`requireAuth`), keine Mail-Trigger (gilt absolute Regel).