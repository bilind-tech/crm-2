---
name: Backend-Roadmap (Pi, Fastify, SQLite)
description: Schrittweiser Plan für den Aufbau des Pi-Backends. Jeder Step wird einzeln im Plan-Modus geplant, vom User genehmigt, dann zu 100% umgesetzt bevor der nächste startet.
type: feature
---

# Backend-Roadmap

## Arbeitsweise (verbindlich)
1. **Plan-Modus pro Step**: Vor jedem Step erstelle ich einen detaillierten Plan (Datenmodell, Endpunkte, UI-Anbindung, Edge Cases, Tests, betroffene Dateien). User genehmigt → erst dann Umsetzung.
2. **Modul fertig vor Wechsel**: Ein Modul wird zu 100% fertig (Backend + Frontend-Anbindung + Dashboard/Liste/Detail/Einstellungen synchron) bevor das nächste startet. Reihenfolge: Rechnungen → Angebote → Kunden → Zahlungen → … (siehe Steps).
3. **Lange Aufgaben in einem Prompt**: Wenn ein Step viele Files/Logik braucht, arbeite ich ohne Rückfragen durch bis fertig. User wartet einfach.
4. **Konsistenz-Regel**: Jede neue Funktion muss überall wirken (Liste, Detail, Dashboard-KPI, Aktivitäten, Benachrichtigungen, Einstellungen).
5. **Code-/Daten-Trennung**: Code in `/opt/mycleancenter/current/`, Daten in `/var/lib/mycleancenter/`. Backend-Code muss von Anfang an mit dieser Pfad-Konvention via ENV (`DATA_DIR`) arbeiten.
6. **Pi-kompatibel von Tag 1**: Keine Cloud-Lock-ins. Alles muss auf `arm64`/Pi-OS-Lite mit Node 20+ laufen. Keine nativen Module ohne Pi-Build.

## Tech-Stack Backend
- **Runtime**: Node.js 20 LTS auf Pi-OS-Lite
- **Framework**: Fastify (klein, schnell, schema-validation eingebaut)
- **DB**: better-sqlite3 (synchron, blitzschnell auf SSD, WAL-Mode)
- **Validation**: Zod (geteilt mit Frontend)
- **PDF**: pdfkit oder puppeteer-core (entscheiden wir in Step 3)
- **Mail**: nodemailer (Strato SMTP)
- **Drive**: googleapis
- **Auth (lokal)**: einfache Session-Cookies, da nur LAN
- **Service**: systemd-Unit

## Repo-Layout (geplant)
```
/backend
  /src
    /db          (better-sqlite3 init, migrations, prepared statements)
    /modules     (rechnungen, angebote, kunden, zahlungen, ...)
       /<modul>
         routes.ts
         service.ts
         schema.ts
    /lib         (pdf, mail, drive, backup, belegnummer)
    /server.ts   (Fastify bootstrap)
  /migrations    (nummerierte SQL-Files)
  package.json
/frontend (= aktuelles Lovable-Projekt)
  src/api/*.ts   (typed Client gegen Pi-API)
```

---

## Steps (Reihenfolge ist verbindlich)

### Step 0 — Backend-Grundgerüst & DB-Init
- `/backend` neu anlegen: Fastify + better-sqlite3 + Zod + tsx/typescript
- ENV-Lesung: `DATA_DIR`, `PORT`, `SESSION_SECRET`, `SMTP_*`
- DB-Datei unter `${DATA_DIR}/db/mycleancenter.sqlite`, WAL aktivieren
- Migration-Runner (nummerierte `.sql`-Files, `_migrations`-Tabelle)
- Health-Endpunkt `/health`
- systemd-Unit-Template + README für Pi-Installation
- Frontend bekommt zentralen `apiClient` mit `VITE_API_URL`
- **Akzeptanz**: `bun run dev` im Backend → `curl /health` → 200, DB-Datei wird erzeugt, leere Migration läuft.

### Step 1 — Kunden-Modul (Fundament für alles andere)
- Tabelle `kunden` (id, kuerzel UNIQUE, firma, anrede, vorname, nachname, anschrift_*, email, telefon, notizen, created_at, updated_at)
- Tabelle `kunden_zaehler` (kunde_id, jahr_monat, naechste_nr) für Belegnummern
- CRUD-Endpunkte + `/kunden/kuerzel-frei?kuerzel=…` (Live-Check)
- Belegnummer-Helper `naechsteBelegnummer(kuerzelKunde, jahrMonat)` — atomic
- Frontend: bestehende Kunden-Liste/-Detail/-Form an API hängen, Live-Kürzel-Check, 409-Handling
- **Akzeptanz**: Kunde anlegen, Kürzel-Konflikt erkannt, Detail/Liste zeigen Live-Daten ohne Reload.

### Step 2 — Rechnungen-Modul (Kern, höchste Priorität)
- Tabellen: `rechnungen`, `rechnung_positionen`, `zahlungen`
- Status-Lifecycle exakt nach `mem://features/document-lifecycle`
- Belegnummer beim Erstellen via Step-1-Helper
- Endpunkte: list (mit Filter/Search/Pagination), get, create, update, delete, send (E-Mail), addZahlung, deleteZahlung, status-Übergänge
- Status-Ableitung aus Zahlungssumme (offen/teilbezahlt/bezahlt) inkl. überfällig
- KPI-Endpunkt `/dashboard/kennzahlen` (Eingang/Offen/Überfällig/Gesamt) und `/dashboard/umsatz`
- Frontend: Liste, Detail, KPIs, Dashboard-Kacheln, FlowBar, Aktivitäten — alle via React-Query gegen die API, Cache-Invalidation wie bereits implementiert
- **Akzeptanz**: Komplette Rechnungs-UI funktioniert live gegen Pi-API, Teilzahlungs-Flow durchgängig, alle KPIs/Dashboard updaten ohne Reload.

### Step 3 — PDF-Engine + Live-Editor (Rechnung)
- Entscheidung pdfkit vs. puppeteer-core (Aufwand vs. Pixel-Treue) im Plan
- Template exakt nach Vorlage (User liefert Vorlage nach)
- Endpunkt `/rechnungen/:id/pdf` (stream)
- Live-Editor `/rechnungen/:id/bearbeiten` nach `mem://features/pdf-editor`: links Preview mit Hotspots, rechts Tabs, Autosave (debounced PATCH)
- **Akzeptanz**: PDF sieht 1:1 aus wie Vorlage, Live-Edit speichert ohne Klick, Preview rendert sofort.

### Step 4 — Mail-Versand + Google-Drive-Upload (Rechnung)
- nodemailer Strato, Versand-Endpunkt, Status-Übergang `versendet`
- Drive-OAuth in Einstellungen, Token verschlüsselt in DB (`einstellungen` Tabelle)
- Upload-Job nach Erstellung/Versand: `mycleancenter.cm/Rechnungen/{YYYY}/{MM}/`, Dateinamen-Schema
- Status-Indikator dezent in UI
- **Akzeptanz**: Rechnung versenden → Mail kommt an → PDF liegt im richtigen Drive-Ordner, Status-Indikator korrekt.

### Step 5 — Angebote-Modul (Spiegel zu Rechnungen)
- Tabellen `angebote`, `angebot_positionen`
- Status-Lifecycle nach Memory, Übergang Angebot → Rechnung
- PDF, Live-Editor, Mail, Drive — Wiederverwendung der Step-3/4-Lib
- **Akzeptanz**: Identische Funktionstiefe wie Rechnungen, „Aus Angebot Rechnung erstellen" funktioniert.

### Step 6 — Aktivitäten + Benachrichtigungen
- Event-Log-Tabelle, Trigger aus allen Service-Funktionen
- `/aktivitaeten`, `/benachrichtigungen` Endpunkte (mit ungelesen-Counter)
- Frontend: bestehende Komponenten anhängen, Live via Polling (5s) oder SSE (entscheiden im Plan)
- **Akzeptanz**: Jede Aktion erzeugt Eintrag, Bell-Counter live.

### Step 7 — Backup & Restore
- Daily/Weekly/Monthly nach `mem://features/backup-rotation`
- Sicherheits-Backup vor Restore und vor Update (absolute Regel!)
- Endpunkte: list, create, restore, download
- Sichtbarkeitsregel `status==="erfolg" && abgeschlossenAm`
- Optional Drive-Upload
- **Akzeptanz**: Tägliches Backup automatisch, Restore stellt Daten her ohne Code zu berühren.

### Step 8 — System-Update
- ZIP-Upload, Validierung, atomarer Symlink-Switch, Rollback
- Daten-Verzeichnis bleibt unangetastet (absolute Regel!)
- Live-Steps in UI nach `mem://features/system-update`
- **Akzeptanz**: Update läuft durch, Rollback funktioniert, Daten unverändert.

### Step 9 — Steuer-Modul
- Tabellen für Termine + Berechnungen, Sätze nach `mem://features/steuern`
- Drei Hauptsteuern automatisch, Rest manuell
- Dashboard-Widget „Rücklage 35%"
- **Akzeptanz**: Berechnungen stimmen mit Memory-Formeln, Disclaimer sichtbar.

### Step 10 — Stundenzettel-Embed + Einstellungen-Feinschliff + Deployment-Doku
- Iframe-Strategie nach `mem://features/stundenzettel-iframe`
- Einstellungen final: SMTP-Test, Drive-Status, Backup-Plan, Update-Verlauf
- Deployment-Doku: Pi-Image-Setup, systemd, nginx-reverse-proxy, mDNS `mycleancenter.local`, USB-SSD-Mount
- **Akzeptanz**: Frische Pi-Installation nach Doku in unter 30 Min einsatzbereit.

---

## Offene Punkte (vor Step-Start klären)
- Step 3: User liefert PDF-Vorlagen (Rechnung + Angebot) als Referenz
- Step 4: Strato SMTP-Zugangsdaten + Google-Cloud-OAuth-Client
- Step 10: Stundenzettel-App URL und Hosting-Situation
