## Step 7 — Aktivitäten + Benachrichtigungen + Audit + SSE (Live-Updates)

Ziel: Eine **einheitliche Ereignis-Pipeline** auf dem Pi. Jede relevante Mutation (Beleg-Status, Zahlung, Mahnung, Mail-Versand, Drive-Upload, Backup, Auth, Settings, Update) erzeugt:
1. einen **Aktivitäts-Eintrag** (für User sichtbar, Verlauf + „Nächste Schritte"-Karte),
2. optional eine **Benachrichtigung** (Bell-Icon, ungelesen-Zähler, Toast),
3. einen **Audit-Eintrag** (forensisch, nicht löschbar in der UI),
4. ein **SSE-Event** an alle verbundenen Clients (Desktop + Handy zeitgleich).

Damit verschwindet das Polling aus `useApi.ts` und die UI fühlt sich live an.

---

### 1. Datenmodell (Migration `010_aktivitaet_benachrichtigung.sql`)

- `aktivitaet`
  - `id` TEXT PK
  - `art` TEXT (`beleg.status_geaendert`, `zahlung.erfasst`, `mahnung.erstellt`, `email.gesendet`, `email.fehler`, `drive.upload_erfolg`, `drive.upload_fehler`, `backup.erfolg`, `backup.fehler`, `update.installiert`, `update.rollback`, `kunde.angelegt`, `einstellung.geaendert`, `auth.login`, `auth.logout`)
  - `bezug_art` TEXT? (`rechnung`/`angebot`/`kunde`/`backup`/`update`/`system`)
  - `bezug_id` TEXT?
  - `titel` TEXT
  - `beschreibung` TEXT
  - `kontext_json` TEXT? (z. B. alter/neuer Status, Beträge)
  - `user_id` TEXT?
  - `zeitpunkt` DATETIME DEFAULT CURRENT_TIMESTAMP
  - Indexe: `(zeitpunkt DESC)`, `(bezug_art, bezug_id)`, `(art)`
  - Retention: 365 Tage Hard-Delete via Scheduler.

- `benachrichtigung`
  - `id` TEXT PK
  - `aktivitaet_id` TEXT FK → `aktivitaet.id` (ON DELETE CASCADE)
  - `prioritaet` TEXT (`info`/`warnung`/`fehler`/`erfolg`)
  - `gelesen_am` DATETIME?
  - `weggewischt_am` DATETIME?
  - `aktion_label` TEXT? / `aktion_route` TEXT? (z. B. `/rechnungen/abc`)
  - `created_at` DATETIME
  - Indexe: `(gelesen_am, weggewischt_am, created_at DESC)`
  - Nicht jede Aktivität wird Benachrichtigung — Mapping siehe Modul 3.

- `audit_log` existiert bereits — Step 7 erweitert nur die *Aufrufer*, nicht das Schema.

---

### 2. Backend-Module

**`backend/src/events/bus.ts`** — Prozess-interner EventEmitter (Singleton). Alle Module emittieren typisierte Events: `aktivitaet:neu`, `benachrichtigung:neu`, `benachrichtigung:gelesen`, `beleg:mutated`, `email:versand-changed`, `drive:upload-changed`, `backup:changed`, `update:phase`. Bestehende `belege/events.ts`, `email/events.ts` etc. werden hier registriert — keine doppelten Bus-Implementierungen.

**`backend/src/aktivitaet/repo.ts`** — `record({art, bezugArt?, bezugId?, titel, beschreibung, kontext?, userId?})`: schreibt Row, mappt optional auf `benachrichtigung` (Tabelle `aktivitaet_regeln` als Code-Konstante, kein DB-Eintrag). Emittiert `aktivitaet:neu` + ggf. `benachrichtigung:neu`. Liefert `list({limit, vor?, art?, bezugArt?, bezugId?})` paginiert.

**`backend/src/benachrichtigung/repo.ts`** — `list({nurUngelesen?})`, `markGelesen(id)`, `markAlleGelesen()`, `wegwischen(id)`, `ungeleseneZahl()`. Auto-Cleanup: weggewischte > 30 Tage werden gelöscht.

**`backend/src/aktivitaet/wireup.ts`** — abonniert beim Start alle Domain-Events und ruft `aktivitaet.record(...)`. Genau ein Punkt der Wahrheit, was eine Aktivität auslöst:
- `beleg:mutated` mit `statusVorher!==statusNachher` → `beleg.status_geaendert`.
- `zahlung:erfasst` → `zahlung.erfasst` (+ Benachrichtigung „Rechnung X bezahlt" bei Status `bezahlt`).
- `mahnung:erstellt` → Benachrichtigung „warnung".
- `email:versand-changed` → bei `gesendet` → Aktivität; bei `fehler` (nach max. Versuchen) → Benachrichtigung „fehler".
- `drive:upload-changed` → bei `fehler` Benachrichtigung, bei `erfolg` nur Aktivität.
- `backup:changed` → bei `erfolg`/`fehler` Aktivität, Fehler = Benachrichtigung.
- `auth.login`/`auth.logout` (von Step 1) → nur Audit + Aktivität (keine Benachrichtigung).
- `einstellung.geaendert` (sensible Keys: SMTP, Drive, Backup-Plan, Sicherheit) → Aktivität + Audit.

Jede Stelle, die `aktivitaet.record(...)` aufruft, ruft **zusätzlich** `audit({...})` für sicherheitsrelevante Aktionen — Audit bleibt eigene Senke (180-Tage-Retention bleibt).

---

### 3. SSE-Endpoint (`backend/src/routes/events.ts`)

- `GET /events/stream` (requireAuth, kein Rate-Limit auf dieser Route, `Connection: keep-alive`, `Content-Type: text/event-stream`, kein gzip — explizit `Content-Encoding: identity`).
- Beim Connect: `event: hello\ndata: {serverTime, schemaVersion}`.
- Heartbeat alle 25 s (`: ping`).
- Subscriptions: forwarded `aktivitaet:neu`, `benachrichtigung:neu`, `benachrichtigung:gelesen`, `beleg:mutated`, `email:versand-changed`, `drive:upload-changed`, `backup:changed`, `update:phase`. Kein roher User-Content — nur IDs + minimal-Felder, Frontend invalidiert die jeweiligen TanStack-Queries.
- Pro Connection eigener Listener-Set, `req.raw.on("close")` räumt auf. Max 10 parallele Connections pro User (FIFO-Drop ältester).
- Gracefully durch Wartungsmodus: wenn `maintenance` aktiv → sofort `event: maintenance` + close, Frontend pausiert Reconnect.

**Reconnect-Strategie clientseitig:** EventSource-Bridge in `src/lib/sse.ts` mit Exponential-Backoff (1s → 30s) und Resume durch `Last-Event-ID`-Header (Server merkt sich Ringpuffer der letzten 200 Events im RAM, schickt verpasste seit Last-ID nach).

---

### 4. REST-Routen (`backend/src/routes/aktivitaet.ts` + `benachrichtigung.ts`)

- `GET /aktivitaeten` — Filter `art`, `bezugArt`, `bezugId`, `vor` (Cursor), `limit` (max 100). Antwort: `{items, naechsterCursor?}`.
- `GET /aktivitaeten/:id` (für Deep-Link).
- `GET /benachrichtigungen` — `?nurUngelesen=true|false`, default false, immer ohne weggewischte.
- `POST /benachrichtigungen/:id/lesen`
- `POST /benachrichtigungen/lesen-alle`
- `POST /benachrichtigungen/:id/wegwischen`
- `GET /benachrichtigungen/anzahl` — `{ungelesen, gesamt}` (für Bell-Badge; durch SSE meist überflüssig, aber Initial-Load-fähig).
- `GET /audit` — admin-only (User-Rolle existiert noch nicht → vorerst nur eingeloggter User darf eigenes Log lesen; volle Admin-Sicht erst mit Rollen-Modul). Filter: `action`, `userId`, `from`, `to`, paginiert.

---

### 5. Frontend

**Infra:**
- `src/lib/sse.ts` — `createSseClient()` Singleton. Reconnect, Last-Event-ID, Browser-Tab-Visibility-Pause (kein Stream wenn Tab versteckt > 5 min, sofortiger Resync bei Re-Visibility).
- `src/hooks/useSse.ts` — registriert globale Handler im Root-Layout, mappt Events auf `queryClient.invalidateQueries([...])`. Konkretes Mapping:
  - `beleg:mutated` → invalidiert `["belege",art]`, `["beleg",art,id]`, `["dashboard"]`.
  - `email:versand-changed` → `["email","versand"]` + Detail.
  - `drive:upload-changed` → `["drive","uploads", belegId?]` + `DriveSyncBadge`.
  - `backup:changed` → `["backups"]` + `["backup","status"]`.
  - `aktivitaet:neu` → `["aktivitaeten"]`.
  - `benachrichtigung:neu` → `["benachrichtigungen"]` + Toast (Sonner) mit `aktion_route`-Link, falls vorhanden.
- Polling-Intervalle in `useApi.ts`, `useDrive.ts`, `useEmailVersand.ts` werden auf `staleTime: 30s, refetchInterval: false` reduziert — SSE ist Wahrheit, Polling nur als Sicherheitsnetz alle 60 s.

**UI-Komponenten:**
- `src/components/notifications/BenachrichtigungBell.tsx` — Bell-Icon im Header (`AppShell`), Badge mit Anzahl ungelesen, Popover mit Liste (Prio-Färbung, „Alle lesen", „Wegwischen", Klick auf Eintrag → navigiert zu `aktion_route`).
- `src/components/notifications/BenachrichtigungItem.tsx` — Eintrag mit Icon je Prio (kein Sparkle, schlicht Lucide `Bell`/`AlertTriangle`/`CircleCheck`), Zeit relativ.
- `src/routes/aktivitaet.tsx` — kompletter Rewrite: Filter-Bar (Art, Bezug, Zeitraum), virtualisierte Liste, Klick → Detail-Drawer mit `kontext_json`-Pretty-Print, Deep-Link zu Beleg/Backup/Update.
- `src/components/dashboard/NaechsteSchritteCard.tsx` — bekommt SSE-Live-Update statt Refetch-Timer.
- `src/routes/einstellungen.sicherheit.tsx` (existierender Tab erweitert) — Audit-Log-Viewer (eigene User-Aktionen), CSV-Export-Button.

**Verhalten:**
- Beim Login wird SSE gestartet, beim Logout sauber geschlossen.
- Unread-Badge persistiert nicht im LocalStorage — kommt immer vom Server (geräteübergreifend konsistent).
- Toast-Throttle: max 3 Toasts gleichzeitig, weitere werden in Bell gesammelt (kein Spam beim Massen-Mail-Versand).

---

### 6. Sicherheit & Härtung

- SSE-Auth über vorhandenes HttpOnly-Cookie (Fastify-Cookie ist schon registriert). Kein Token in URL.
- Pro IP max 5 SSE-Connections (zusätzlich zum 10/User-Limit).
- Keine sensiblen Felder im Stream (kein Klartext-SMTP-Passwort, keine PDF-Bytes — nur IDs/Statuswechsel).
- Audit-Einträge: Insert-only, keine UI-Lösch-Route, Retention-Purge nur via Scheduler.
- Rate-Limit: `/benachrichtigungen/lesen-alle` 10/min.

---

### 7. Tests (`backend/test/aktivitaet.spec.ts`, `sse.spec.ts`, `benachrichtigung.spec.ts`)

- Wireup: simulieren `beleg:mutated` → genau 1 Aktivität, kein Doppel-Eintrag bei identischem Status.
- Mahnung-Event → Benachrichtigung mit `prioritaet=warnung` + `aktion_route`.
- Mail-Fehler nach max-Versuchen → genau 1 Benachrichtigung (nicht pro Retry).
- Repo: `markGelesen` idempotent, `wegwischen` setzt Timestamp, `ungeleseneZahl` korrekt.
- SSE: Connect → `hello`, Emit eines Events → empfangen, `Last-Event-ID`-Resume liefert verpasste Events, Maintenance schließt Stream.
- Audit: Sensible Settings-Änderung erzeugt Audit + Aktivität, normale Logo-Änderung nur Aktivität.
- Retention: 366-Tage-alte Aktivität → vom Purge gelöscht, jüngere bleiben.

---

### 8. Memory-Updates

- Neue Datei `mem://features/backend-step7-aktivitaet-sse` (Architektur, Event-Liste, Mapping-Tabelle Aktivität→Benachrichtigung, SSE-Vertrag).
- Index-Eintrag „Step 7 — Aktivitäten + Benachrichtigungen + SSE".
- Roadmap-Tabelle in `mem://features/backend-roadmap` markiert Step 7 als done nach Abschluss.

---

### 9. Reihenfolge (1 Prompt, ohne Rückfragen)

```
1. Migration 010 (aktivitaet, benachrichtigung) + Indexe
2. backend/src/events/bus.ts + Konsolidierung der bestehenden Module-Emitter
3. backend/src/aktivitaet/{repo,wireup}.ts + benachrichtigung/repo.ts + Regel-Mapping
4. backend/src/routes/{aktivitaet,benachrichtigung,audit,events}.ts + server.ts wiring
5. SSE-Server: Heartbeat, Last-Event-ID-Ringpuffer, Connection-Limits, Maintenance-Hook
6. Audit-Aufrufe in auth/einstellungen/backup/update ergänzen (wo noch nicht vorhanden)
7. Retention-Scheduler (aktivitaet 365d, benachrichtigung weggewischt 30d)
8. Frontend: lib/sse.ts + hooks/useSse.ts + Root-Layout-Integration
9. UI: BenachrichtigungBell + Popover + Toast-Bridge, Aktivitätsseite-Rewrite, Audit-Viewer
10. Polling-Reduktion in useApi/useDrive/useEmailVersand auf 60 s Sicherheitsnetz
11. Tests aktivitaet.spec.ts + sse.spec.ts + benachrichtigung.spec.ts
12. mem-Updates + Roadmap-Häkchen
```

**Sag „weiter", dann lege ich mit Migration 010 + Event-Bus los.**