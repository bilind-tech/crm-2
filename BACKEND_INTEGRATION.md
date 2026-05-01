# Backend Integration Guide

Dieses Dokument beschreibt, wie das echte Backend an das bestehende Frontend
angedockt wird. Solange `VITE_USE_MOCK=true` gesetzt ist, läuft alles in
einem In-Memory Mock-Backend mit `localStorage`-Persistenz im Browser.

## Schnellstart

1. `.env` anlegen (siehe `.env.example`):
   ```
   VITE_USE_MOCK=false
   VITE_API_BASE_URL=https://api.example.com
   ```
2. Backend bereitstellen, das die unten gelisteten Endpunkte exakt so
   implementiert wie in den Mock-Dateien (`src/lib/mock/backend.ts`).
3. Fertig. Es sind **keine** Frontend-Änderungen nötig.

## Architektur

```
src/
├── lib/
│   ├── api/
│   │   ├── client.ts      ← einzige Stelle für HTTP-Calls (Mock/Live-Switch)
│   │   └── types.ts       ← Single Source of Truth für alle Datenmodelle
│   └── mock/
│       ├── backend.ts     ← Spec-Backend (REST-Routen 1:1)
│       └── seed.ts        ← Initial-Konfig (Firmendaten, Vorlagen, Master-Passwort) — KEINE Demo-Geschäftsdaten
├── hooks/
│   └── useApi.ts          ← React-Query-Hooks pro Entität (kein fetch in Komponenten!)
└── routes/                ← Pages konsumieren ausschließlich Hooks aus useApi
```

**Regel:** Komponenten dürfen niemals direkt `fetch` aufrufen. Immer über
`useApi.ts`. Damit ist der Backend-Wechsel ein einziger Toggle.

## Auth-Flow

| Methode | Pfad                | Body                                 | Response                     |
|---------|---------------------|--------------------------------------|------------------------------|
| POST    | `/auth/unlock`      | `{ passwort: string }`               | `200 {}` / `401 { message }` |
| POST    | `/auth/lock`        | —                                    | `200 {}`                     |
| PATCH   | `/auth/passwort`    | `{ altesPasswort, neuesPasswort }`   | `200 {}` / `401 { message }` |

Standard-Master-Passwort im Mock: `040506`.

Sessions werden im Frontend nur als Bool (`unlocked`) gehalten. Beim echten
Backend bitte ein httpOnly-Cookie setzen und für nachfolgende Requests
verifizieren.

## REST-Endpunkte

Alle Pfade sind relativ zu `VITE_API_BASE_URL`. Datentypen siehe
`src/lib/api/types.ts`.

### Kunden

| Methode | Pfad                | Beschreibung               |
|---------|---------------------|----------------------------|
| GET     | `/kunden`           | Liste, Query: `q`, `status`, `tag`, `archiviert` |
| POST    | `/kunden`           | Anlegen                    |
| GET     | `/kunden/:id`       | Detail inkl. Sub-Listen    |
| PATCH   | `/kunden/:id`       | Update                     |
| DELETE  | `/kunden/:id`       | Löschen (kaskadiert)       |

### Ansprechpartner

| Methode | Pfad                       | Beschreibung |
|---------|----------------------------|--------------|
| GET     | `/ansprechpartner?kundeId=`| Liste        |
| POST    | `/ansprechpartner`         | Anlegen      |
| PATCH   | `/ansprechpartner/:id`     | Update       |
| DELETE  | `/ansprechpartner/:id`     | Löschen      |

### Objekte

| Methode | Pfad             | Beschreibung |
|---------|------------------|--------------|
| GET     | `/objekte`       | Liste        |
| POST    | `/objekte`       | Anlegen      |
| GET     | `/objekte/:id`   | Detail       |
| PATCH   | `/objekte/:id`   | Update       |
| DELETE  | `/objekte/:id`   | Löschen      |

### Angebote / Rechnungen

Analog zu Kunden, jeweils `/angebote` und `/rechnungen` mit allen
CRUD-Operationen plus:

| Methode | Pfad                                | Zweck                              |
|---------|-------------------------------------|------------------------------------|
| POST    | `/angebote/:id/in-rechnung`         | Angebot → Rechnung umwandeln       |
| POST    | `/rechnungen/:id/zahlungen`         | Zahlung erfassen                   |
| POST    | `/rechnungen/:id/mahnung`           | Mahnung versenden (zukünftig)      |

### Dashboard / Such-API

| Methode | Pfad                       | Response                    |
|---------|----------------------------|-----------------------------|
| GET     | `/dashboard/kennzahlen`    | `DashboardKennzahlen`       |
| GET     | `/dashboard/umsatz`        | `UmsatzPunkt[]`             |
| GET     | `/dashboard/warnungen`     | `Warnung[]`                 |
| GET     | `/search?q=`               | `SuchTreffer[]`             |

### Einstellungen

GET + PATCH für: `/einstellungen/firma`, `/smtp`, `/nummernkreise`,
`/sicherheit`, `/erscheinung`, `/backup`, `/positionsvorlagen`,
`/textvorlagen`.

## Empfohlenes Backend-Setup

- **Stack:** Node + Fastify oder Hono auf Cloudflare Workers; PostgreSQL
  oder SQLite via Drizzle ORM. Datentypen aus `types.ts` direkt als
  Drizzle-Schema umsetzbar.
- **Auth:** Session-Cookie httpOnly, Secret als Umgebungsvariable.
- **PDF-Erzeugung:** läuft weiterhin im Browser (`pdfmake`), kein
  Backend-Roundtrip nötig.

## Hinweise für KI-Coding-Agents (Claude Code etc.)

- Alle Datentypen sind in **einer** Datei: `src/lib/api/types.ts`.
- Alle Endpunkte stehen in **einer** Datei: `src/lib/mock/backend.ts`.
- Beim Anlegen des echten Backends: 1:1 dieselben Pfade, Methoden und
  Response-Shapes verwenden.
- Niemals Logik in Komponenten verschieben. Neue Features = neuer Hook in
  `useApi.ts` + neue Route im Backend, fertig.
