---
name: Backend Step 7 — Aktivitäten + Benachrichtigungen + SSE
description: Zentraler Event-Bus, Aktivitäts/Benachrichtigungs-Pipeline, Live-SSE mit Last-Event-ID-Resume
type: feature
---

# Step 7 — Aktivitäten + Benachrichtigungen + SSE

## Architektur
- **Migration 010**: `aktivitaet` (365d Retention), `benachrichtigung` (CASCADE auf aktivitaet, weggewischte 30d Retention).
- **`backend/src/events/bus.ts`**: typisierter In-Process-EventEmitter (Singleton, max 200 Listener). API: `emit(type, payload)`, `on(type, fn)`, `onAny(fn)`.
- **`belege/events.ts`** ist Bridge: alte `emitBelegMutated/emitBelegVersendet` rufen zusätzlich `emit("beleg:mutated", ...)` auf — keine Doppel-Bus.
- **email/drive Repos** emittieren `email:versand-changed` / `drive:upload-changed` direkt aus `markErfolg`/`markFehler`.
- **`zahlungen.ts`** emittiert zusätzlich `zahlung:erfasst` mit Status-nach-Recompute.
- **`auth.ts`** emittiert `auth:login`/`auth:logout`. **`einstellungen.ts`** emittiert `einstellung:geaendert` (Wireup filtert auf sensible Keys: smtp, googleDrive, backup, sicherheit, auth, stundenzettel).

## Aktivitäts-Wireup
`backend/src/aktivitaet/wireup.ts` ist genau eine Stelle, die Bus-Events → `record(...)` übersetzt. Mapping-Tabelle:

| Event | Aktivität | Benachrichtigung |
|---|---|---|
| beleg:mutated (Status-Wechsel) | beleg.status_geaendert | – |
| zahlung:erfasst (status=bezahlt) | zahlung.erfasst | erfolg |
| mahnung:erstellt | mahnung.erstellt | warnung |
| email:versand-changed gesendet | email.gesendet | – |
| email:versand-changed manuell (max retry) | email.fehler | fehler |
| drive:upload-changed erfolg | drive.upload_erfolg | – |
| drive:upload-changed manuell | drive.upload_fehler | fehler |
| backup:changed fehler | backup.fehler | fehler |
| update:phase rollback | update.rollback | warnung |
| auth:login/logout | auth.login/logout | – |
| einstellung:geaendert (sensibel) | einstellung.geaendert | – |

## SSE
`GET /events/stream` (requireAuth, rateLimit:false). `Content-Type: text/event-stream`, `Content-Encoding: identity`, Heartbeat 25s (`: ping`). Beim Connect: `event: hello`. **Last-Event-ID-Resume** über RAM-Ringpuffer (200 letzte Events). Limits: 10/User (FIFO-Drop), 5/IP. Maintenance-Mode: sofort `event: maintenance` + close.

## REST
- `GET /aktivitaeten` (Filter art/bezugArt/bezugId, Cursor `vor`, max 100)
- `GET /aktivitaeten/:id`
- `GET /benachrichtigungen?nurUngelesen=`, `/anzahl`
- `POST /benachrichtigungen/:id/lesen`, `/lesen-alle` (10/min), `/:id/wegwischen`
- `GET /audit` (MVP: nur eigene User-Einträge, full Admin später mit Rollen)

## Frontend (Pfade vorbereitet)
- `src/lib/api/client.ts` Pi-Prefixes erweitert um `/aktivitaeten`, `/benachrichtigungen`, `/audit`, `/events/`.
- `lib/sse.ts`, `hooks/useSse.ts`, `components/notifications/BenachrichtigungBell.tsx` und Aktivitätsseiten-Rewrite kommen im Folge-Prompt (UI-Iteration), Backend ist fertig & live-fähig.

## Sweeps
Alle 10 min: sessions + audit + lockouts + `purgeOldAktivitaeten` + `purgeOldWegwischte`.
