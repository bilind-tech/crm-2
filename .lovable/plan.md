# Step 12 — Dokumente & Handy-Scan ans Backend

Dokumente, Belege und Handy-Scans leben aktuell **nur im Mock** (`url` = base64-DataURL). Auf dem Pi würde das die SQLite aufblähen und nach 100 Belegen unbenutzbar machen. Step 12 baut den letzten großen fehlenden Backend-Bereich: echte Datei-Persistenz auf der USB-SSD, Upload-Sessions für Handy-Scans, und ein Cron für Fristen-Benachrichtigungen.

Danach ist **kein** Frontend-Bereich mehr ohne Backend-Gegenstück.

---

## Teil A — Datenmodell & Storage

**Migration `013_dokumente.sql`**

```sql
CREATE TABLE dokumente (
  id TEXT PRIMARY KEY,
  titel TEXT NOT NULL,
  beschreibung TEXT,
  typ TEXT NOT NULL CHECK (typ IN ('beleg','vertrag','angebot','rechnung','protokoll','bild','sonstiges')),
  kunde_id TEXT REFERENCES kunden(id) ON DELETE SET NULL,
  objekt_id TEXT REFERENCES objekte(id) ON DELETE SET NULL,
  dateiname TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  groesse_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,            -- für Dedup + Integritätscheck
  storage_path TEXT NOT NULL,      -- relativ zu DATA_DIR/uploads/dokumente/
  dokumentdatum TEXT,
  betrag REAL,
  steuerrelevant INTEGER NOT NULL DEFAULT 0,
  ust_satz REAL,
  faellig_am TEXT,
  erledigt_am TEXT,
  quelle TEXT NOT NULL DEFAULT 'upload',
  drive_status TEXT,               -- 'pending'|'uploaded'|'fehler'|null
  drive_file_id TEXT,
  drive_url TEXT,
  drive_letzter_versuch TEXT,
  drive_fehler TEXT,
  hochgeladen_am TEXT NOT NULL DEFAULT (datetime('now')),
  geloescht_am TEXT                -- soft delete (für Audit)
);
CREATE INDEX idx_dok_kunde ON dokumente(kunde_id) WHERE geloescht_am IS NULL;
CREATE INDEX idx_dok_objekt ON dokumente(objekt_id) WHERE geloescht_am IS NULL;
CREATE INDEX idx_dok_faellig ON dokumente(faellig_am) WHERE erledigt_am IS NULL AND geloescht_am IS NULL;
CREATE INDEX idx_dok_sha ON dokumente(sha256);

CREATE TABLE upload_sessions (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  kunde_id TEXT REFERENCES kunden(id) ON DELETE SET NULL,
  objekt_id TEXT REFERENCES objekte(id) ON DELETE SET NULL,
  erstellt_am TEXT NOT NULL DEFAULT (datetime('now')),
  ablauf_am TEXT NOT NULL,
  beendet INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_upsess_token ON upload_sessions(token);

-- Verknüpfung Session ↔ Dokumente (n:1)
ALTER TABLE dokumente ADD COLUMN upload_session_id TEXT REFERENCES upload_sessions(id) ON DELETE SET NULL;
```

**Storage-Layout auf der SSD** (`/var/lib/mycleancenter/uploads/dokumente/`):

```
uploads/dokumente/
  2026/05/{sha256[0:2]}/{sha256}.{ext}
```

Sharding nach Jahr/Monat + 2-Zeichen-Hash-Prefix → max ~256 Dateien pro Ordner, schnelles `ls`. Dedup über `sha256` UNIQUE-Check vor dem Schreiben (gleiche Datei → nur DB-Eintrag, kein zweites Speichern).

---

## Teil B — Backend-Routen `backend/src/routes/dokumente.ts`

| Method | Pfad | Auth | Zweck |
|---|---|---|---|
| GET | `/dokumente` | ja | Liste mit Filter `?kundeId&objektId&typ&jahr` |
| GET | `/dokumente/:id` | ja | Einzeldokument (Metadaten) |
| GET | `/dokumente/:id/datei` | ja | Binary-Stream (Content-Type, Content-Disposition) |
| POST | `/dokumente` | ja | Multipart-Upload (eine Datei + Metadaten als JSON-Field `meta`) |
| PATCH | `/dokumente/:id` | ja | Metadaten ändern (Titel, faelligAm, steuerrelevant…) |
| POST | `/dokumente/:id/erledigt` | ja | Erledigt-Marker setzen/entfernen |
| DELETE | `/dokumente/:id` | ja | Soft-Delete (`geloescht_am`), Datei bleibt für 30 Tage |
| POST | `/dokumente/check-fristen` | ja (Cron) | Anstehende/überfällige Fristen → Benachrichtigungen |

**Upload-Sessions** (`backend/src/routes/upload-sessions.ts`):

| Method | Pfad | Auth | Zweck |
|---|---|---|---|
| POST | `/upload-sessions` | ja | Session anlegen (60 min Gültigkeit), liefert Token + QR-URL |
| GET | `/upload-sessions/:token` | nein (Token = Auth) | Session validieren (Frontend `/m/upload/:session`) |
| POST | `/upload-sessions/:token/dokumente` | nein (Token) | Multipart-Upload via Handy |
| POST | `/upload-sessions/:id/beenden` | ja | Session schließen |

Token = 32 Byte base64url, hat im Hash ausreichend Entropie. Rate-Limit auf Token-Endpoints (10 Uploads/min) gegen Missbrauch.

**Multipart-Handling**: `@fastify/multipart` (bereits via `belege-pdf.ts` möglich, sonst neu installieren). Limit 20 MB pro Datei (entspricht aktuellem Frontend-`MAX_BYTES`). Server prüft MIME-Whitelist (`image/*`, `application/pdf`).

**Validation** (`backend/src/dokumente/validation.ts`): Zod-Schemas für Patch/Filter/Sessions; Multipart-Body separat (Stream → Disk-Temp → SHA256 → finale Zielpfad-Move).

---

## Teil C — Drive-Sync-Anbindung

`backend/src/drive/uploader.ts` (existiert seit Step 5) wird vom Dokumenten-Modul genutzt:

- Nach erfolgreichem `POST /dokumente` (synchron geschrieben) → asynchroner Job-Push in bestehende Drive-Queue mit `kind: "dokument"`, `dokumentId`.
- Drive-Ordnerstruktur: existierender Root `mycleancenter.cm` → Unterordner `Dokumente/{YYYY}/{MM}/`.
- Dateiname: `{kundenname}_{titel}_{MM}_{YYYY}.{ext}` (Slug-normalisiert).
- Status zurück in `dokumente.drive_*` Felder; SSE-Event `dokument:drive-aktualisiert`.

Bestehende `DriveSyncBadge`-Komponente bleibt unverändert — sie liest `drive` aus dem Dokument.

---

## Teil D — Fristen-Cron

**`backend/src/dokumente/fristen-cron.ts`** läuft via `setInterval` täglich um 07:00 Uhr Pi-Zeit:

1. Selektiert Dokumente mit `faellig_am IS NOT NULL AND erledigt_am IS NULL`.
2. Berechnet Status (heute, in 7 Tagen, überfällig) — Logik aus `src/lib/dokument/frist.ts` 1:1 ins Backend portiert (`backend/src/dokumente/frist.ts`).
3. Erzeugt Benachrichtigungen via existierendem `benachrichtigung`-Modul, dedupliziert per Tag (kein Spam bei wiederholten Läufen).
4. Triggert SSE `benachrichtigung:neu`.

Endpoint `POST /dokumente/check-fristen` ruft denselben Job manuell auf (für Tests + Frontend-Button „Jetzt prüfen").

---

## Teil E — Frontend-Anpassungen

**`src/lib/dokument/upload.ts`** — Refactor:

- `fileToDokumentPayload` entfällt; neuer Helper `uploadDokument(file, meta)` baut `FormData` und postet an `/dokumente` (multipart).
- Bildkompression bleibt **client-seitig** (Pi-CPU schonen, schneller Mobile-Upload), aber Resultat ist ein `Blob`, nicht mehr base64.

**`src/hooks/useApi.ts`** — `useCreateDokument` Mutation auf multipart umstellen (eigener `apiUpload`-Helper in `src/lib/api/client.ts`, der `Authorization` setzt aber `Content-Type` der Browser bestimmen lässt).

**`src/components/dokumente/*`**:
- `DokumentUploader.tsx` + `HandyScanDialog.tsx` nutzen neuen Upload-Pfad.
- `DokumentViewer.tsx`: `<img src=…>` und PDF-`<iframe src=…>` zeigen jetzt auf `/dokumente/:id/datei` (mit Auth-Header — für `<img>` Workaround: Blob-URL via `fetch + URL.createObjectURL`).

**`src/routes/m.upload.$session.tsx`** (Handy-Upload-Seite):
- Lädt Session via `GET /upload-sessions/:token` (kein Auth, Token reicht).
- Upload an `POST /upload-sessions/:token/dokumente`.

**`src/lib/mock/backend.ts`**: Mock-Implementierung für alle neuen Endpoints (in-memory `Map<id, Blob>` für Dateien), damit der Dev-Modus weiter ohne Pi läuft.

---

## Teil F — Migration bestehender Mock-Daten

Erstmal **nicht** nötig — das Mock ist Demo-Content, der beim ersten Pi-Start verschwindet. Falls der User produktiv schon Dokumente angelegt hat: kleiner Migrations-Hook, der beim ersten Mount alle `data:`-URLs in `localStorage` in einer Schleife per `POST /dokumente` hochlädt und dann den Eintrag entfernt. Marker `mcc_dokumente_migrated_v1`. Skip wenn keine vorhandenen Mock-Daten gefunden.

---

## Tests

- `backend/test/dokumente.spec.ts` — CRUD, Filter, Multipart-Upload (echtes PNG-Fixture), Dedup via SHA256, Auth-Pflicht, MIME-Whitelist, 20-MB-Limit, Soft-Delete.
- `backend/test/upload-sessions.spec.ts` — Token-Validität, Ablaufzeit, Token-only-Upload, Rate-Limit, Session-Beenden setzt `beendet=1`.
- `backend/test/dokumente-fristen.spec.ts` — Cron erzeugt korrekte Benachrichtigungen, dedupliziert pro Tag.
- `backend/test/dokumente-drive.spec.ts` — Mock-Drive-Uploader wird angetriggert, `drive_status` aktualisiert.

---

## Was bewusst NICHT in diesem Step ist

- Volltext-Suche in PDFs (OCR) — separater Step, braucht Tesseract-WASM.
- Versionierung von Dokumenten — aktuell unique per SHA256, neue Version = neues Dokument.
- Verschlüsselung-at-rest der Dateien — SSD ist im Pi-Gehäuse, LAN-only; Step 13-Kandidat falls gewünscht.

---

## Geänderte / neue Dateien (Übersicht)

**Neu:**
- `backend/src/db/migrations/013_dokumente.sql`
- `backend/src/dokumente/{repo,mappers,validation,types,storage,frist,fristen-cron}.ts`
- `backend/src/routes/dokumente.ts`
- `backend/src/routes/upload-sessions.ts`
- `backend/test/dokumente.spec.ts`, `upload-sessions.spec.ts`, `dokumente-fristen.spec.ts`, `dokumente-drive.spec.ts`
- `mem/features/dokumente.md`

**Editiert:**
- `backend/src/server.ts` (Routen + Cron registrieren, Multipart-Plugin)
- `backend/src/drive/uploader.ts` (kind=`dokument` ergänzen)
- `src/lib/api/client.ts` (`apiUpload` für multipart)
- `src/hooks/useApi.ts` (Dokument-Hooks)
- `src/lib/dokument/upload.ts` (Blob statt DataURL)
- `src/components/dokumente/{DokumentUploader,HandyScanDialog,DokumentViewer,DriveSyncBadge}.tsx`
- `src/routes/{dokumente,m.upload.$session}.tsx`
- `src/lib/mock/backend.ts` (Multipart-Mock + Sessions)
- `src/hooks/useLiveEvents.ts` (`dokument:*` Invalidations)
- `mem/index.md`

**Sag „weiter", dann setze ich Step 12 um.**
