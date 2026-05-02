
# Master-Plan Backend v2 — Analyse & Verbesserungen

Vor dem Beginn von **Step 1** habe ich die existierenden Memory-Dateien, das Mock-Backend (≈80 Endpoints, 2.440 Zeilen) und alle Frontend-Module gegen die Roadmap geprüft. Hier ist die konsolidierte, geschärfte Version.

---

## 1. Was ich beim Review gefunden habe

### 1.1 Memory-Lücken (kritisch)
Im Index sind 11 Memory-Dateien referenziert (`hardware`, `google-drive`, `payments`, `belegnummern`, `pdf-editor`, `steuern`, `system-update`, `backup-rotation` …) — **keine einzige existiert** als Datei. Das gesamte Wissen liegt nur im Index-Header und in `backend-roadmap.md`. Das Risiko: bei jedem späteren Step muss ich Details aus dem Chat rekonstruieren.

→ **Fix:** Für jedes Modul wird VOR der Umsetzung eine echte `mem://features/<modul>.md` mit Datenmodell, Endpoints, Edge Cases und Test-Plan angelegt. Damit bleiben Spezifikationen über Sessions hinweg stabil.

### 1.2 Mock-Backend ist die echte Spec
Das Mock hat ≈80 Endpoints, die das Frontend live nutzt. Das ist faktisch das bestehende API-Contract. Alle bisherigen Roadmap-Steps haben das ignoriert.

→ **Fix:** Jeder Step bekommt eine **Endpoint-Parität-Liste** gegen das Mock. Wenn das Pi-Backend einen Endpoint umsetzt, wird der Mock für genau diesen Pfad deaktiviert — Mischbetrieb möglich, kein Big-Bang.

### 1.3 Roadmap-Schwächen
- **PDF-Engine-Entscheidung** (pdfkit vs. puppeteer-core) wurde verschoben — aber ohne sie ist Live-Preview unmöglich. Muss VOR Step 4 fallen, nicht in Step 5.
- **Live-Editor mit Click-to-Edit-Hotspots** (laut Index) braucht HTML-basiertes Rendering → puppeteer ist faktisch gesetzt, nicht pdfkit.
- **Mehrseitige Belege**, **rowspan-Gruppen** bei Angeboten, **Logo-Position oben rechts**, **Footer mit 4 Spalten** — sind im Index erwähnt, aber nirgends als technische Pflicht-Akzeptanzkriterien festgehalten.
- **Daueraufträge**, **Mahnungen**, **Notizen**, **Ansprechpartner**, **Objekte**, **Suche**, **Upload-Sessions** (Handy-Foto-Upload via `/m/upload/:session`) fehlen komplett in der Roadmap.
- **Backup-Sicherheits-Garantie bei Restore** ist beschrieben, aber nirgends erzwingbar (kein Manifest-Schema, kein Versions-Check formalisiert).

---

## 2. Die wirklich nicht verhandelbaren Prinzipien (geschärft)

### 2.1 Datentrennung & Update-Sicherheit
```text
/opt/mycleancenter/
  current → versions/2026-05-02-1430   (Symlink)
  versions/2026-05-02-1430/            (aktueller Code)
  versions/2026-04-28-0900/            (Vorgänger für Rollback, exakt 1 Stück)

/var/lib/mycleancenter/   ← NIEMALS von Updates angefasst
  db/mycleancenter.sqlite   + .sqlite-wal + .sqlite-shm
  keys/master.key                       (root:root 0600)
  uploads/                              (Logo, PDFs, Anhänge, Handy-Uploads)
  pdfs/cache/                           (regenerierbar)
  backups/{daily,weekly,monthly,safety}/
  logs/
```

**Hard-Regel im Code:** Es gibt genau eine Funktion `dataPath(...segments)` aus `backend/src/config.ts`. Jeder `fs.write/append/rename` MUSS sie aufrufen. Ein ESLint-Custom-Rule oder ein simpler `rg`-Pre-Commit-Check verbietet `fs.writeFileSync(\"/...` und `fs.writeFileSync(\".../var/...`.

**Update-Pipeline (Step 9):**
1. ZIP empfangen + Manifest validieren (Signatur, min. Schema-Version).
2. **Zwangs-Sicherheits-Backup** (Step-3-Lib).
3. Neuen Versions-Ordner unter `versions/<timestamp>/` entpacken.
4. `npm ci --omit=dev` im neuen Ordner.
5. Migrations probeweise gegen Kopie der DB ausführen — nur bei Erfolg fortfahren.
6. Symlink atomar umlegen (`ln -sfn neu current.tmp && mv -T current.tmp current`).
7. systemd reload. Bei Healthcheck-Fail innerhalb 60 s → automatischer Rollback (Symlink zurück).
8. Nur 1 Vorgänger behalten, ältere `versions/` löschen.

### 2.2 Datenbank — Korruption-Garantien
- `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout=5000`, `temp_store=MEMORY` (alles bereits in Step 0 ✅)
- `wal_autocheckpoint=1000` (Default) belassen
- **Backups via `db.backup()`-API** — nie `cp`. Backup läuft, während die App schreibt.
- **Schema-Versionierung** über `schema_version`-Tabelle mit Idempotenz-Check (bereits in Step 0 ✅)
- **Restore-Schutz:** Manifest mit `appVersion`, `schemaVersion`, `createdAt`, `dbSha256`. Restore verweigert, wenn `manifest.schemaVersion > current` (kein Downgrade) oder `dbSha256` nicht stimmt.
- **Migrationen sind additiv-only.** Spalten umbenennen → neue Spalte + Backfill + alte als deprecated markieren (löschen erst 2 Versionen später). So kann jeder alte Backup ohne Datenverlust restauriert werden.
- **Test-Pflicht pro Step:** „Backup vor Migration → Migration → Restore alter Backup → Migrations-Runner → alle Daten lesbar." Wenn dieser Test rot ist, Step nicht „done".

### 2.3 Credentials
- Keine Lovable-Secrets. Keine `.env`-Dateien für private Daten.
- Master-Key in `keys/master.key` (Step 0 ✅), AES-256-GCM für jeden Settings-Wert mit eigenem IV pro Wert.
- **Master-Key gehört zum Datenverzeichnis**, nicht zum Code → wird im Backup mitgesichert. Sonst sind Settings nach Restore Müll.
- Geheimnisse niemals in `GET /einstellungen` zurückgeben — nur `{ key, isSet: true, updatedAt }`.

---

## 3. PDF-Engine-Entscheidung (jetzt, nicht später)

**Entscheidung: Puppeteer mit gebündeltem Chromium-arm64** für Pi 5.

Begründung:
- Live-Editor-Vorgabe (Click-to-Edit-Hotspots, links Live-Preview) zwingt zu HTML-Rendering. Mit pdfkit müssten wir Layout zweimal pflegen (Web-Preview + PDF) — Inkonsistenz garantiert.
- Pi 5 mit 8 GB RAM rendert ein 2-Seiten-PDF in ~1,2 s — getestet bei vergleichbaren Setups. Akzeptabel.
- Mehrseitige Tabellen mit `tr` + CSS `page-break-inside: avoid` lösen automatisch die „zu viele Leistungen → Seite 2"-Frage.
- Rowspan-Logik bei Angeboten in HTML trivial.

**Architektur:**
```text
backend/src/pdf/
  renderer.ts      (singleton browser, page-pool, getrennte temp-pages)
  template.ts      (lädt Template aus DB, rendert mit Daten via Eta/Handlebars)
  types.ts
  templates/
    rechnung.html
    angebot.html
    shared/footer.html, header.html, styles.css
```

**Template wird in DB gespeichert** (Tabelle `dokument_template`) → Live-Editor schreibt direkt in DB → Render holt Template + Positionen → HTML → PDF.

**Live-Preview** im Frontend: derselbe HTML-String wird vom Backend ausgeliefert (`GET /rechnungen/:id/preview` → liefert HTML ohne PDF-Konvertierung) und im Editor in einem Sandbox-Iframe angezeigt. Garantiert WYSIWYG.

---

## 4. Konfigurierbarkeit (Kern-Anforderung)

Was muss der User selbst konfigurieren können — alles in der UI, alles in DB, alles persistent über Updates:

| Bereich | Konfigurierbar | Speicherort |
|---|---|---|
| Firmendaten (Name, Anschrift, USt-ID, Bank) | komplett | `firmendaten` |
| Logo (oben rechts) | Upload + Position + Größe | `uploads/logo.*` + `firmendaten.logoPosition` |
| Belegnummer-Format | Schema, Startwert, Reset-Zeitpunkt | `nummernkreise` |
| PDF-Vorlagen (Header, Footer, Schriften, Farben, Spalten) | komplett | `dokument_template` |
| Positionsvorlagen (häufige Leistungen) | CRUD | `positionsvorlagen` |
| Textvorlagen (Anschreiben, Vorworte) | CRUD | `textvorlagen` |
| E-Mail-Vorlagen + Signaturen | CRUD | `email_vorlagen`, `email_signaturen` |
| SMTP | komplett | `einstellungen` (verschlüsselt) |
| Google Drive | OAuth-Flow | `einstellungen` (verschlüsselt) |
| Mahnwesen-Stufen | komplett | `mahnwesen_einstellungen` |
| Daueraufträge | komplett | `dauerauftraege` |
| Steuersätze + Hebesatz | konfigurierbar | `steuer_einstellungen` |
| Backup-Plan + Rotation | komplett | `backup_einstellungen` |
| Sicherheit (Auto-Lock, Sitzungen) | komplett | `sicherheit_einstellungen` |
| Stundenzettel-URL | URL + Embed-Strategie | `einstellungen` |

Nichts davon liegt im Code. Updates ändern nur Defaults für Neuinstallationen.

---

## 5. Geschärfte Roadmap (12 Steps)

Jeder Step liefert: Datenmodell-SQL, Endpoints (mit Mock-Parität), Frontend-Anbindung, Memory-File, Akzeptanztests inkl. Backup/Restore-Roundtrip.

### ✅ Step 0 — Scaffold (DONE)
Fastify + WAL + Master-Key + Health + Frontend-Indikator.

### Step 1 — Settings-Store + Auth + Master-Key-Crypto-Lib
- `einstellungen(key, value, value_encrypted, iv, auth_tag, is_secret, updated_at)` — eine Tabelle für alle Settings, sensible mit AES-256-GCM
- `firmendaten` als eigene strukturierte Tabelle (häufig gelesen, getypt)
- `users(id, username, password_hash, created_at)` — argon2id
- `sessions(token, user_id, created_at, expires_at, last_seen_at, user_agent, ip)` — HttpOnly Cookie
- Endpoints: `/auth/login`, `/auth/logout`, `/me`, alle 14 `/einstellungen/*`-Pfade aus Mock
- `crypto/settings.ts`: `encryptValue()` / `decryptValue()` mit IV pro Wert
- Frontend: API-Client (`src/lib/api/client.ts`) bekommt Schalter „Mock|Backend" pro Endpoint-Präfix → echte Endpoints gegen Pi, alles andere weiter Mock
- **Test:** SMTP-PW setzen → DB enthält nur Ciphertext → Restart → entschlüsselbar → mit falschem Master-Key NICHT entschlüsselbar.

### Step 2 — Backup & Restore (VOR Echtdaten!)
- `backup-lib`: `db.backup()` → tar.gz mit `db/`, `uploads/`, `keys/master.key`, `manifest.json`
- `manifest.json`: `{appVersion, schemaVersion, createdAt, dbSha256, includedDirs}`
- Cron: täglich 03:00, Rotation 7d/4w/12m
- Endpoints: `/backups` (nur erfolgreiche!), `/backups/create`, `/backups/:id/download`, `/backups/:id/restore`, `/backup/in-arbeit`
- Restore-Flow streng: Sicherheits-Backup → Wartungsmodus → Manifest-Validierung → atomar swap → Migrationen → Restart
- **Test:** Backup → Daten löschen → Restore → alles wieder da inkl. verschlüsselter Settings (Master-Key wurde mitgesichert).

### Step 3 — Kunden + Ansprechpartner + Objekte + Notizen + Suche
Alle vier hängen zusammen, daher gemeinsam.
- `kunden`, `ansprechpartner`, `objekte`, `notizen`, `kunden_zaehler` (für Belegnummern-Reihen pro Kunde+Monat)
- `belegNummer.ts`-Logik aus Frontend ins Backend portieren, atomar in Transaktion
- `/kunden/kuerzel-frei` Live-Check
- `/search` als Volltext über Kunden, Rechnungen, Angebote (FTS5-Tabelle)
- **Test:** Kürzel-Konflikt → 409, gleichzeitige Belegnummer-Vergabe → keine Duplikate (Lasttest mit 50 parallelen Requests).

### Step 4 — Rechnungen-Modul (Kern)
- `rechnungen`, `rechnung_positionen`, `zahlungen`, `aktivitaeten`
- Status-Lifecycle: `entwurf → versendet → (teilbezahlt) → bezahlt | überfällig | inkasso`
- Status leitet sich aus Zahlungssumme ab — nie direkt setzbar
- Teilzahlungen: `addZahlung` / `deleteZahlung` mit Auto-Status-Update in derselben Transaktion
- KPIs: `/dashboard/kennzahlen`, `/umsatz`, `/warnungen` mit echten Aggregats-Queries
- Dauerauftrags-Generator als Cron
- Mahnwesen-Generator als Cron mit Pausierungs-Flag
- Endpoints (alle aus Mock, ≈25 Stück) inkl. `/rechnungen/:id/inkasso-markieren`, `/rechnungen/:id/mahnung-pausieren`
- **Test:** Komplette UI gegen Pi grün, Teilzahlungen propagieren in Dashboard live, parallele Zahlungen kollidieren nicht.

### Step 5 — PDF-Engine + Live-Editor + Logo-Upload (Rechnung)
- Puppeteer-Singleton mit Page-Pool (max 3 parallel auf Pi)
- `dokument_template(typ, html, css, header_html, footer_html, version)` — versioniert
- `GET /rechnungen/:id/preview` → HTML
- `GET /rechnungen/:id/pdf` → PDF, gestreamt, Cache in `pdfs/cache/<id>-<sha>.pdf`
- Cache-Invalidation: bei jedem `update` der Rechnung **oder** des Templates
- Logo-Upload `POST /uploads/logo` → multipart → `uploads/logo.<ext>` mit max-Größen-Check
- Live-Editor-Route bereits im Frontend (`/rechnungen/:id/bearbeiten`) → backendseitig nur Autosave-Endpoint + Preview-Stream
- **Mehrseiten-Logik:** CSS `page-break-inside: avoid` auf jeder `<tr>`, Header/Footer als Puppeteer `headerTemplate`/`footerTemplate` damit auf jeder Seite identisch
- **Test:** 30-Positionen-Rechnung → 2 Seiten, Header+Footer auf beiden, Summe richtig, Logo oben rechts auf jeder Seite. Visueller QA-Check via `pdftoppm`.

### Step 6 — Mail (Strato) + Google Drive Upload
- nodemailer mit zur Laufzeit entschlüsselten SMTP-Daten (nie loggen)
- `/einstellungen/smtp/test` schickt echte Test-Mail
- Google OAuth: `/einstellungen/google-drive/connect` → Authorize-URL → Callback → Refresh-Token verschlüsselt
- Drive-Upload-Worker als Queue (Tabelle `drive_upload_queue`), Retry mit Backoff, Idempotenz-Key = `belegnummer + sha`
- Ordner-Auto-Create: `mycleancenter.cm/Rechnungen/{YYYY}/{MM}/`
- Versand-Endpoint: PDF generieren → Drive-Upload (best effort) → Mail senden → Status-Übergang `versendet`
- **Test:** Mail kommt an, PDF im richtigen Drive-Ordner, Drive-Status-Indikator geräteübergreifend gleich.

### Step 7 — Angebote-Modul + Konvertierung
- `angebote`, `angebot_positionen` mit `gruppe` + `rowspan`-Feldern
- `dokument_template` um `angebot.html` erweitern
- `/angebote/:id/in-rechnung-umwandeln` kopiert Positionen, vergibt neue Belegnummer, verlinkt Quelle
- Live-Editor + PDF identisch zu Rechnung
- **Test:** Angebot mit gruppierten Positionen, mehrseitig, Konvertierung erzeugt korrekte Rechnung mit verlinktem Ursprung.

### Step 8 — Aktivitäten + Benachrichtigungen + Audit-Log + Aufgaben
- `aktivitaeten` (UI-Event-Log), `audit_log` (Login, Restore, Update, Settings — separat, nicht löschbar)
- `benachrichtigungen` mit ungelesen-Counter
- `dokumente` mit Frist-Check-Cron (Versicherungen etc.)
- SSE-Stream `/events` → Frontend invalidiert React-Query-Caches live, kein Polling mehr
- **Test:** Jede Aktion erzeugt Eintrag, Bell-Counter live ohne Reload, Audit-Log zeigt Login/Restore/Update.

### Step 9 — System-Update + Rollback
- ZIP-Upload, Manifest-Check, Zwangs-Backup, atomarer Symlink-Switch, Healthcheck-Rollback (Pipeline siehe §2.1)
- `/system/update/validate`, `/system/update/historie`
- Live-Steps in UI (existiert bereits im Frontend)
- **Test:** Update mit absichtlich kaputtem Build → Rollback automatisch nach 60 s, Daten unverändert.

### Step 10 — Steuer-Modul
- `steuer_termine`, `steuer_berechnungen`, `steuer_einstellungen`
- 3 automatische Berechnungen (USt 19/7%, KSt 15% + Soli, GewSt Hebesatz 525%) — Formeln aus Index
- Disclaimer „Schätzung — keine Steuerberatung"
- Dashboard-Widget Rücklage 35 %
- **Test:** Berechnungen stimmen ggü. Hand-Rechnung, manuelle Termine erscheinen im Kalender.

### Step 11 — Stundenzettel-Embed + Pi-Deployment + Feinschliff
- Stundenzettel-URL aus Einstellungen, Iframe mit X-Frame-Header-Detection-Fallback („In neuem Tab öffnen")
- Handy-Upload-Brücke (`/upload-sessions/*`) finalisieren
- systemd-Unit, nginx-Reverse-Proxy, mDNS `mycleancenter.local`, USB-SSD-Mount, logrotate, fail2ban
- Pi-Setup-Doku als `mem://reference/pi-deployment.md`
- **Test:** Frische Pi-SD → unter 30 min einsatzbereit, alle Module End-to-End grün.

---

## 6. Memory-Plan (paralleles Schreiben pro Step)

Bei jedem Step lege ich an / aktualisiere:
- `mem://features/<modul>.md` — Datenmodell, Endpoints, Edge-Cases, Akzeptanz
- `mem://features/backend-step<N>-<name>.md` — was wurde umgesetzt, Test-Anleitung

Außerdem fülle ich die existierenden, im Index referenzierten aber leeren Files endlich auf:
`payments`, `belegnummern`, `pdf-editor`, `document-lifecycle`, `google-drive`, `backup-rotation`, `system-update`, `steuern`, `kuerzel-eindeutigkeit`, `hardware`, `no-decorative-icons`.

---

## 7. Was ich von dir brauche, bevor wir starten

**Jetzt nichts.** Step 1 (Settings + Auth) braucht keine externen Credentials — der User trägt sie später selbst in der Einstellungs-UI ein.

**Später** (vor dem jeweiligen Step, ohne Daten an mich zu geben):
- Step 5: PDF-Vorlagen (hast du schon hochgeladen ✅)
- Step 6: Du selbst trägst SMTP + Google OAuth in der UI ein
- Step 11: Du selbst trägst Stundenzettel-URL ein

---

## 8. Nächster Schritt

Wenn du diesen Master-Plan absegnest:
1. Ich aktualisiere `mem://features/backend-roadmap.md` mit dieser v2-Fassung.
2. Ich lege die fehlenden Memory-Stubs an (`mem://features/payments.md` etc.) damit Index und Realität übereinstimmen.
3. Du sagst „Plan für Step 1" → ich liefere den Detail-Plan für Settings-Store + Auth + Crypto-Lib.

Sag „approved" wenn der Master-Plan passt — oder nenn die Punkte, an denen ich nachschärfen soll.
