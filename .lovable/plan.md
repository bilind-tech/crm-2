## Step 10 — Steuer-Modul: Persistenz auf dem Pi

Das Steuer-Modul ist im Frontend komplett (Übersicht, Berechnung, Dialoge, KPIs). Die Berechnungslogik (`src/lib/steuern/berechnung.ts`) bleibt **bewusst im Frontend** — sie operiert auf Rechnungen + Dokumenten, die ohnehin via React Query geladen werden. Was fehlt: alle drei `localStorage`-Stores wandern auf den Pi, damit Einstellungen, manuelle Posten und Bezahlt-Markierungen geräteübergreifend (Desktop, Handy, jeder Browser im LAN) konsistent sind und Backups sie mitnehmen.

### Was geändert wird

**1. Datenbank — Migration `012_steuern.sql`**

Drei Tabellen, additiv:

```sql
CREATE TABLE steuer_einstellungen (
  id                INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton
  kst_satz          REAL    NOT NULL DEFAULT 15,
  soli_satz         REAL    NOT NULL DEFAULT 5.5,
  gewst_messzahl    REAL    NOT NULL DEFAULT 3.5,
  gewst_hebesatz    REAL    NOT NULL DEFAULT 525,
  ust_rhythmus      TEXT    NOT NULL DEFAULT 'monatlich'
                    CHECK (ust_rhythmus IN ('monatlich','quartalsweise','jaehrlich')),
  ruecklage_satz    REAL    NOT NULL DEFAULT 35,
  ust_puffer_satz   REAL    NOT NULL DEFAULT 10,
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO steuer_einstellungen (id) VALUES (1);

CREATE TABLE steuer_manueller_posten (
  id                  TEXT PRIMARY KEY,
  art                 TEXT NOT NULL CHECK (art IN ('ust','kst','soli','gewst','manuell')),
  titel               TEXT NOT NULL,
  zeitraum_jahr       INTEGER NOT NULL,
  zeitraum_monat      INTEGER,
  zeitraum_quartal    INTEGER CHECK (zeitraum_quartal BETWEEN 1 AND 4),
  faellig_am          TEXT NOT NULL,
  geschaetzter_betrag REAL NOT NULL,
  notiz               TEXT,
  erstellt_am         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE steuer_bezahlt_markierung (
  posten_id            TEXT PRIMARY KEY,        -- ID des Auto- oder Manuell-Postens
  bezahlt_am           TEXT NOT NULL,
  tatsaechlicher_betrag REAL,
  notiz                TEXT,
  erstellt_am          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Auto-Posten-IDs sind im Frontend deterministisch (`ust-2026-Q1`, `kst-2026`, …). Das ist die Brücke zur Bezahlt-Tabelle — sie braucht keine Foreign Key, weil Auto-Posten in keiner Tabelle existieren.

**2. Backend — neues Modul `backend/src/steuern/`**

- `repo.ts` — typisiertes `better-sqlite3`-Repo: `getEinstellungen()`, `updateEinstellungen(patch)`, `listManuellePosten()`, `addManueller(...)`, `updateManueller(id, patch)`, `removeManueller(id)`, `listBezahlt()`, `setBezahlt(id, eintrag)`, `removeBezahlt(id)`.
- `mappers.ts` — `snake_case` ↔ `camelCase` zwischen DB und API-Shape. Validierung der `ust_rhythmus`-Enum.
- `validation.ts` — Zod-Schemas für Patch-Bodies (Min/Max für Sätze: KSt 0–50, Soli 0–20, GewSt-Messzahl 0–20, Hebesatz 200–1000, Rücklage 0–100, USt-Puffer 0–50).

**3. Backend — Routen `backend/src/routes/steuern.ts`**

Acht Endpoints, alle hinter `requireAuth`:

| Methode | Pfad | Zweck |
|---|---|---|
| GET    | `/steuern/einstellungen`                | Singleton lesen |
| PATCH  | `/steuern/einstellungen`                | Sätze/Rhythmus ändern |
| POST   | `/steuern/einstellungen/reset`          | auf Defaults zurücksetzen |
| GET    | `/steuern/manuelle-posten`              | Liste |
| POST   | `/steuern/manuelle-posten`              | Anlegen |
| PATCH  | `/steuern/manuelle-posten/:id`          | Ändern |
| DELETE | `/steuern/manuelle-posten/:id`          | Löschen |
| GET    | `/steuern/bezahlt`                      | Map `{ postenId → eintrag }` |
| PUT    | `/steuern/bezahlt/:postenId`            | Eintrag setzen/überschreiben |
| DELETE | `/steuern/bezahlt/:postenId`            | Eintrag löschen |

Jede Mutation sendet einen `aktivitaet:steuer:*`-Event über den bestehenden SSE-Bus, damit andere Tabs live aktualisieren. Audit-Eintrag bei jeder Änderung von `steuer_einstellungen`.

**4. Frontend — React-Query-Hooks**

`src/hooks/useApi.ts` bekommt:

```ts
useSteuerEinstellungen()           // GET  + cache
useUpdateSteuerEinstellungen()     // PATCH
useResetSteuerEinstellungen()      // POST .../reset
useManuellePosten()                // GET liste
useAddManuellerPosten()            // POST
useUpdateManuellerPosten()         // PATCH
useRemoveManuellerPosten()         // DELETE
useBezahltMarkierungen()           // GET
useSetBezahlt()                    // PUT
useRemoveBezahlt()                 // DELETE
```

Konvention identisch zu bestehenden Hooks (Backup, System-Update). SSE-Events `steuer:*` invalidieren die jeweiligen QueryKeys via `useLiveEvents.ts`.

**5. Frontend — Stores umbauen**

`src/lib/steuern/store.ts` wird zu einem **dünnen Adapter**, der dieselbe API behält wie heute (`useSteuerEinstellungen`, `useManuellePosten`, `useBezahltMarkierungen`), intern aber die neuen React-Query-Hooks nutzt. So bleibt `src/routes/steuern.tsx`, `SteuerTab.tsx` und `ManuellerPostenDialog.tsx` **unverändert**.

Migrationspfad bei vorhandenem `localStorage`:
- Beim ersten Laden, wenn Backend-Einstellungen `updated_at` noch der Default ist UND `localStorage` Werte hat → einmaliger PATCH mit lokalen Werten, danach `localStorage.removeItem(...)`. Gilt analog für manuelle Posten und Bezahlt-Map.
- Migration läuft `idempotent`, mit Marker `mcc_steuern_migrated_v1` in localStorage.

**6. Mock-Backend**

`src/lib/mock/backend.ts` bekommt Handler für die 10 neuen Endpoints, In-Memory-Map. Damit läuft die Demo ohne Pi weiter.

**7. Backup**

Migration `012` taucht in der bestehenden `db.backup()`-Pipeline (Step 2) automatisch auf. Restore-Test im Step bestätigt, dass eine Backup-Datei aus „vor Step 10" sauber via Migration-Runner auf das neue Schema gehoben wird.

**8. Tests**

`backend/test/steuern.spec.ts`:
- Singleton-Garantie (zweite Insert-Versuch schlägt am CHECK fehl).
- PATCH validiert Grenzen (negative Hebesatz → 400, Rhythmus-Enum-Verletzung → 400).
- Reset stellt Defaults her und behält `updated_at` aktuell.
- Manuelle Posten CRUD inkl. 404 bei unbekannter ID.
- Bezahlt-PUT idempotent (zweimal mit gleichem Body → identische Zeile, keine Duplicate).
- Restore eines Pre-Step-10-Backups + Migration-Runner → Defaults werden korrekt eingefügt, kein Datenverlust an anderen Tabellen.
- SSE-Event wird bei jeder Mutation gefeuert (über bestehenden Test-Hilfs-Listener).

### Technische Details

**Singleton-Pattern für Einstellungen:**
`CHECK (id = 1)` + initialer `INSERT (id) VALUES (1)` in der Migration. Das Repo hat nur `get()` und `update(patch)` — kein `create`, kein `delete`. Frontend muss nie eine ID kennen.

**Bezahlt-Markierung ohne FK:**
Auto-Posten existieren nur als Berechnungs-Output im Frontend. Ihre IDs sind deterministisch (`ust-{jahr}-Q{q}` / `ust-{jahr}-{mm}` / `kst-{jahr}` / `soli-{jahr}` / `gewst-{jahr}`). Wenn der User später die Periodik wechselt (monatlich → quartalsweise), ändert sich die ID-Struktur. Deshalb: beim Wechsel von `ust_rhythmus` werden alle `steuer_bezahlt_markierung`-Einträge mit Präfix `ust-` der laufenden Jahre gelöscht (Backend-Side-Effect im PATCH-Handler) und der User bekommt einen Hinweis-Toast „USt-Bezahlt-Historie zurückgesetzt". Manuelle Posten und Ertragsteuer-Markierungen bleiben.

**Migration aus localStorage:**
Frontend führt beim Mount eine Idempotenz-Prüfung durch. Wenn Backend-Einstellungen `updated_at` älter ist als localStorage-Daten und Marker fehlt → Push-Migration in einer Transaktion. Der Marker `mcc_steuern_migrated_v1=true` verhindert wiederholte Pushs, auch nach Logout/Login.

### Dateien

- created `backend/src/db/migrations/012_steuern.sql`
- created `backend/src/steuern/repo.ts`
- created `backend/src/steuern/mappers.ts`
- created `backend/src/steuern/validation.ts`
- created `backend/src/routes/steuern.ts`
- created `backend/test/steuern.spec.ts`
- edited  `backend/src/server.ts` — Route registrieren
- edited  `backend/src/events/bus.ts` — `steuer:*`-Events
- edited  `src/hooks/useApi.ts` — 10 neue Hooks
- edited  `src/lib/steuern/store.ts` — Adapter auf React Query, localStorage-Migration
- edited  `src/lib/mock/backend.ts` — Mock-Handler
- edited  `src/hooks/useLiveEvents.ts` — `steuer:*`-Invalidations
- edited  `mem/features/steuern.md` — Status „Backend-persistent, geräteübergreifend"

Sag „weiter", dann setze ich Step 10 um.