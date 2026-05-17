
## 1. „Internal Server Error" beim Kunde-Speichern beheben

**Ursache:** `KundeBearbeitenDialog` initialisiert `setNotizen(kunde.notizen ?? "")`. In der neueren API kommt `kunde.notizen` als **Array von Notiz-Objekten** zurück (Tab „Notizen"). Beim Speichern schickt der Dialog dieses Array als `notizen` mit. Backend `updateKunde` reicht den Wert 1:1 an SQLite weiter → better-sqlite3 wirft, weil es Objekte nicht binden kann → 500.

**Fix (frontend, klein):**
- In `KundeBearbeitenDialog.tsx`: `notizen` nur noch als Freitext-Feld behandeln. Wenn `kunde.notizen` kein String ist, initial mit `""` füllen und das Feld nicht an PATCH senden (oder nur senden, wenn der User getippt hat).
- Backend zur Sicherheit härten: in `backend/src/kunden/repo.ts → updateKunde` Wert für `notizen` mit `typeof v === "string" ? v : null` einschränken; bei Tags identisch absichern; im Fastify-Handler `try/catch` mit `reply.status(422).send({ error: "validation" })`, damit nie wieder ein nackter 500 ankommt.

## 2. Kunden-Logo hochladen, anzeigen, ändern, entfernen

**Datenmodell:** Migration `017_kunden_logo.sql` — neue Spalten in `kunde`:
`logo_blob BLOB`, `logo_mime TEXT`, `logo_updated_at TEXT`.

**Backend-Routen (in `stammdaten.ts`):**
- `POST /kunden/:id/logo` — multipart-Upload (max 2 MB, nur `image/png|jpeg|webp|svg+xml`); im Repo `setKundeLogo()` (resize/normalize entfällt — pi-Backend hält das Original).
- `DELETE /kunden/:id/logo` — Spalten auf NULL setzen.
- `GET /kunden/:id/logo` — liefert Blob mit korrektem MIME, `Cache-Control: private, max-age=0, must-revalidate` + ETag = `logo_updated_at`.

**API-Hooks:** `useUploadKundeLogo(id)`, `useDeleteKundeLogo(id)` in `src/hooks/useApi.ts`; `Kunde.logoUrl` per Helper `kundeLogoUrl(id, updatedAt)` (URL mit `?v=<ts>` für Cache-Busting).

**UI-Komponente:** Neue `KundeLogo.tsx` mit Varianten `lg | md | sm` — zeigt Logo oder Initialen-Fallback.

**Einsatzorte:**
- `kunden.$id.tsx` Header-Karte: Initialen-Kachel durch `KundeLogo size="lg"` ersetzen + Hover-Button „Logo ändern/entfernen" (öffnet kleinen Dialog mit FilePicker + Vorschau + Entfernen).
- Kundenliste `kunden.tsx`: kleines Avatar links vor Namen (`size="sm"`).
- PDF (`backend/src/pdf/render.ts` + `belegPdf.server.ts`): falls Kunde Logo hat, dezent rechts neben der Adresse einbetten (max 80×40 px). Toggle in `pdf/firma.ts`-Layout-Defaults wäre Overkill — fest verdrahtet, klein, oben rechts im Adress-Block.

## 3. Kunde wirklich löschen (Hard-Delete mit Kaskade)

Aktuell: `deleteKunde` macht Soft-Delete sobald Angebote/Rechnungen existieren. Der User will eine echte Lösch-Option.

**Backend:**
- `deleteKunde(id, { force?: boolean })` — bei `force=true`:
  - Rechnungen + zugehörige `zahlungen`, `mahnungen`, `email_versand` löschen.
  - Angebote + Positionen löschen.
  - Objekte, Ansprechpartner, Dokumente (inkl. Datei-Blobs via `dokumente/storage`), Notizen kaskadieren.
  - `DELETE FROM kunde …` als harter Delete in **einer Transaction**.
- Route `DELETE /kunden/:id?force=1` (nur wenn `force` gesetzt → Hard). Ohne `force` bleibt bestehendes Verhalten (Soft).

**Frontend (`KundeLoeschenDialog.tsx`):**
- Stufe 1 bleibt; wenn `hatDaten`, zusätzliche Warnung in rot: „Endgültiges Löschen entfernt **alle** Rechnungen, Angebote, Zahlungen, Dokumente unwiderruflich."
- Stufe 2: Bestätigungs-Eingabe wie bisher + zusätzliche Checkbox „Ich verstehe, dass alle abhängigen Daten mitgelöscht werden". Button schickt `force=1`.
- `useDeleteKunde` erweitern auf `mutate({ id, force })`.

## 4. Stundenzettel-Iframe lädt leer (X-Frame-Options)

**Ursache:** `http://mycleancenter-pi.local:8080/040506` ist ein **anderer Origin** als der CRM-Port. Die Stundenzettel-App liefert vermutlich `X-Frame-Options: SAMEORIGIN` (oder die Login-Seite tut es). Browser blockiert die Einbettung → weiße Seite.

**Lösung: Reverse-Proxy im CRM-Backend** (same-origin → keine Frame-Header-Probleme):
- Neue Route `backend/src/routes/stundenzettel-proxy.ts` registriert unter Pfad `/extern/stundenzettel/*`. Liest Ziel-Basis aus Settings (`stundenzettel.url`), streamt Request/Response durch, leitet Status, Cookies, Headers weiter; strippt `X-Frame-Options` und `Content-Security-Policy: frame-ancestors`.
- Settings-Eintrag in `settings/schemas.ts` ergänzen / nutzen (es existiert schon `useStundenzettelUrl`).
- Frontend `useStundenzettelUrl()` liefert für den iframe nun den **same-origin Proxy-Pfad** (`/extern/stundenzettel/040506`), für „In neuem Tab" weiterhin die Direkt-URL.
- `stundenzettel.tsx`: `analysiereUmfeld` an die Proxy-URL anpassen — same-origin entfernt das Mixed-Content- und Cloud-LAN-Hindernis automatisch (Cloud-Preview-Hinweis bleibt, weil dort weder Backend noch Stundenzettel-App existieren).

**Edge-Cases im Proxy:** SSE/Websocket nicht nötig (Stundenzettel ist klassisches MPA/SPA), aber relative Pfade (`/assets/...`) müssen funktionieren → Path-Rewrite `^/extern/stundenzettel/ → /` und absoluter `Location:`-Header bei Redirects auf den Proxy-Pfad zurückschreiben.

## Technische Details

```
Migration 017:
  ALTER TABLE kunde ADD COLUMN logo_blob BLOB;
  ALTER TABLE kunde ADD COLUMN logo_mime TEXT;
  ALTER TABLE kunde ADD COLUMN logo_updated_at TEXT;
```

```
Geänderte/Neue Dateien:
  backend/src/db/migrations/017_kunden_logo.sql               (neu)
  backend/src/kunden/repo.ts                                  (notizen-guard, logo-fns, deleteKunde force)
  backend/src/routes/stammdaten.ts                            (logo-routes, force-param, try/catch)
  backend/src/routes/stundenzettel-proxy.ts                   (neu)
  backend/src/server.ts                                       (proxy registrieren)
  backend/src/pdf/render.ts | belegPdf.server.ts              (kunden-logo im PDF)
  src/components/forms/KundeBearbeitenDialog.tsx              (notizen-fix)
  src/components/forms/KundeLoeschenDialog.tsx                (hard-delete UI)
  src/components/forms/KundeLogoUploadDialog.tsx              (neu)
  src/components/kunden/KundeLogo.tsx                         (neu)
  src/routes/kunden.$id.tsx | kunden.tsx                      (KundeLogo einsetzen)
  src/routes/stundenzettel.tsx                                (Proxy-URL nutzen)
  src/lib/stundenzettel/config.ts                             (Proxy-URL-Helper)
  src/hooks/useApi.ts                                         (logo + delete-force hooks)
  src/lib/api/types.ts                                        (logoUpdatedAt im Kunde-Typ)
```

Tests: `kunden-delete-force.spec.ts`, `kunden-logo.spec.ts`, `stundenzettel-proxy.spec.ts`.
