---
name: Backend-Roadmap v2 (Pi, Fastify, SQLite)
description: Master-Plan v2 — geschärfte 12-Step-Roadmap mit Puppeteer-Entscheidung, Mock-Parität, Backup-Garantien und Konfigurierbarkeits-Matrix
type: feature
---

# Backend-Roadmap v2

> **Master-Plan vom User approved.** Volltext liegt in `.lovable/plan.md` (überschrieben bei nächstem Plan).
> Diese Datei = stabile Referenz für alle weiteren Steps.

## Arbeitsweise (verbindlich)
1. **Plan-Modus pro Step** → User-Approval → Umsetzung → Tests → nächster Step.
2. **Modul fertig vor Wechsel.** UI + Backend + Dashboard/Liste/Detail synchron.
3. **Lange Aufgaben in einem Prompt** — ich arbeite ohne Rückfragen durch.
4. **Konsistenz-Regel:** jede Funktion wirkt überall (Liste, Detail, KPIs, Aktivitäten, Benachrichtigungen, Einstellungen).
5. **Pi-kompatibel ab Tag 1** (arm64, Pi-OS-Lite, Node 20+).
6. **Mock-Parität:** jeder Step deaktiviert die im Mock-Backend ersetzten Endpoints einzeln. Mischbetrieb erlaubt.

## ABSOLUTE Regeln (unverhandelbar)

### Code/Daten-Trennung
```
/opt/mycleancenter/current → versions/<timestamp>/   (Symlink)
/var/lib/mycleancenter/                               (NIEMALS bei Updates angefasst)
  db/mycleancenter.sqlite + .sqlite-wal + .sqlite-shm
  keys/master.key                  (root:root 0600)
  uploads/                         (Logo, Anhänge, Handy-Uploads)
  pdfs/cache/                      (regenerierbar)
  backups/{daily,weekly,monthly,safety}/
  logs/
```
- Genau eine Funktion `dataPath(...segments)` aus `backend/src/config.ts`. Jeder fs-write geht darüber.
- Update = nur Symlink-Switch. Daten bleiben unangetastet.
- Restore: Sicherheits-Backup ZUERST → Manifest-Validierung → atomar swap → Migration-Runner.

### Datenbank
- WAL + foreign_keys + synchronous=NORMAL + busy_timeout=5000 + temp_store=MEMORY (Step 0 ✅)
- Backups via `db.backup()`-API, NIE `cp`.
- Schema-Versionierung über `schema_version` (Step 0 ✅), Migrationen **additiv-only**.
- Restore-Schutz: Manifest mit `appVersion`, `schemaVersion`, `createdAt`, `dbSha256`. Downgrade verboten.

### Credentials
- Keine Lovable-Secrets, keine `.env` für Privates.
- Master-Key in `keys/master.key`, AES-256-GCM mit IV pro Wert.
- Master-Key gehört zum Daten-Verzeichnis → wird im Backup mitgesichert.
- `GET /einstellungen` liefert nie Klartext sensibler Werte — nur `{ key, isSet, updatedAt }`.

## PDF-Engine: Puppeteer (entschieden)
- Gebündeltes Chromium-arm64. Singleton-Browser, Page-Pool max 3 parallel.
- Templates in DB (`dokument_template`), versioniert.
- Live-Preview = identischer HTML-String aus Backend, im Sandbox-Iframe.
- Mehrseiten via CSS `page-break-inside: avoid` + Puppeteer `headerTemplate`/`footerTemplate`.
- Cache `pdfs/cache/<id>-<sha>.pdf`, Invalidation bei Doc- oder Template-Update.

## Steps

| # | Modul | Highlight |
|---|---|---|
| 0 | Scaffold | ✅ DONE |
| 1 | Settings + Auth + Crypto | argon2id, AES-GCM, 14 `/einstellungen/*`-Endpoints |
| 2 | Backup & Restore | tar.gz mit DB + uploads + master.key + manifest |
| 3 | Kunden + Ansprechpartner + Objekte + Notizen + Suche (FTS5) | atomare Belegnummer-Vergabe |
| 4 | Rechnungen + Zahlungen + Mahnwesen + Daueraufträge | Status aus Zahlungssumme abgeleitet |
| 5 | PDF-Engine + Live-Editor + Logo (Rechnung) | Puppeteer, Mehrseiten, WYSIWYG |
| 6 | Mail (Strato) + Google Drive | Queue mit Retry, Idempotenz-Key |
| 7 | Angebote + Konvertierung in Rechnung | Rowspan-Gruppen, Quell-Verlinkung |
| 8 | Aktivitäten + Benachrichtigungen + Audit + SSE | Live-Updates statt Polling |
| 9 | System-Update + Rollback | Healthcheck-Auto-Rollback nach 60 s |
| 10 | Steuern (GmbH) | 3 Hauptsteuern automatisch, Rücklage-Widget |
| 11 | Stundenzettel + Pi-Deployment + Feinschliff | systemd, mDNS, USB-SSD, logrotate |

## Konfigurierbarkeits-Matrix (alles in DB, alles über Updates persistent)
Firmendaten · Logo+Position · Belegnummer-Format · PDF-Vorlagen · Positionsvorlagen · Textvorlagen · E-Mail-Vorlagen+Signaturen · SMTP · Google Drive · Mahnwesen · Daueraufträge · Steuersätze+Hebesatz · Backup-Plan · Sicherheit · Stundenzettel-URL.

## Test-Pflicht pro Step
„Backup vor Migration → Migration → Restore alter Backup → Migrations-Runner → alle Daten lesbar." Rot = Step nicht „done".

## Was vom User vor Step-Start kommt
- Step 5: PDF-Vorlagen ✅ vorhanden
- Step 6: SMTP + Google OAuth trägt User selbst in UI ein
- Step 11: Stundenzettel-URL trägt User selbst in UI ein
