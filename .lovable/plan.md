
# Code-Update direkt aus GitHub (One-Click)

Ziel: In **Einstellungen → System-Update** kommt neben dem bestehenden ZIP-Upload ein zweiter Bereich **„Aus GitHub aktualisieren"**. Du verbindest einmalig dein Repository, danach reicht ein einziger Klick **„Jetzt auf neueste Version aktualisieren"**. Das System lädt den Code, prüft ihn, macht ein Sicherheits-Backup und tauscht den Code atomar aus — exakt der gleiche Ablauf wie beim ZIP-Update, nur dass das ZIP automatisch von GitHub geholt wird.

## Daten-Garantie (wie immer absolut bindend)

`/var/lib/mycleancenter/` (Datenbank, Uploads, Schlüssel, Backups) wird **in keinem Schritt** angefasst. Der bestehende `data-guard` blockiert jede FS-Mutation außerhalb des Code-Verzeichnisses technisch — das gilt unverändert auch für den neuen GitHub-Pfad. Vor jedem Update läuft automatisch ein Sicherheits-Backup, bei Healthcheck-Fail wird automatisch zurückgerollt.

## User-Flow (in der UI)

1. **Verbinden (einmalig)** in **Einstellungen → System-Update → „GitHub-Repository"**:
   - Felder: Repository (`besitzer/repo`), Branch (Default `main`), Personal Access Token (PAT, „fine-grained, nur Lese-Rechte auf dieses eine Repo, Contents: Read").
   - Button **„Verbindung testen"** → ruft GitHub API, zeigt aktuellen Commit + Build-Datum.
   - Token wird verschlüsselt im Backend abgelegt (gleicher Mechanismus wie Google-Drive-Refresh-Token, `SENSITIVE_KEYS`).
2. **Status-Karte** zeigt jederzeit:
   - „Installierte Version: `<commit-sha-kurz>` vom `<datum>`"
   - „Verfügbar auf GitHub: `<commit-sha-kurz>` vom `<datum>`"
   - Auto-Polling alle 30 min + Button **„Auf Updates prüfen"**.
3. **Ein-Klick-Update**: großer Primary-Button **„Jetzt auf `<sha>` aktualisieren"** (nur aktiv wenn neuere Version vorhanden und kein Update läuft). Klick → bestehender Fortschritts-Dialog mit den 7 Steps öffnet sich genau wie beim ZIP-Upload.
4. **Anmeldung**: keine zusätzliche GitHub-Login-Maske im Browser nötig. Der PAT, den du einmalig einträgst, dient als „Login" — das ist die robusteste Variante für ein Pi-LAN-System ohne öffentliche Callback-URL. (OAuth-App-Flow würde zwingend eine im Internet erreichbare Callback-URL brauchen, die der Pi nicht hat.)

## Was technisch passiert (für deine Information)

```text
Klick „Jetzt aktualisieren"
   │
   ▼
Backend lädt von GitHub den Release-Tarball des Ziel-Commits
   (https://api.github.com/repos/{repo}/tarball/{sha} mit PAT-Auth)
   │
   ▼
Tarball → entpacken in staging/<uploadId>/
   │
   ▼
Manifest aus dem Repo lesen (manifest.json im Repo-Root, vom CI signiert)
   bzw. — falls kein Manifest vorhanden — On-the-fly-Manifest erzeugen
   und mit dem lokalen master.key signieren (siehe „Manifest-Frage" unten)
   │
   ▼
Ab hier: identisch zum bestehenden ZIP-Flow
   entpacken → backup → quarantaene → install (npm ci) → migrations
   → neustart → smoketest   (Auto-Rollback bei Fehler)
```

## Manifest-Frage (eine Entscheidung von dir nötig)

Heute verlangt der Update-Runner ein vom Build-Server HMAC-signiertes `manifest.json` im Paket. Für GitHub-Updates gibt es zwei saubere Wege:

- **A) GitHub Actions baut bei jedem Push automatisch ein signiertes Release** (mit dem gleichen `master.key` als CI-Secret). Vorteil: identische Sicherheit wie ZIP-Upload. Nachteil: einmalig ein Workflow + Secret in GitHub einrichten.
- **B) Pi signiert beim Download lokal selbst** mit seinem `master.key`, weil er die Quelle (dein authentifiziertes Repo) ohnehin vertraut. Vorteil: null Setup in GitHub. Nachteil: kein zusätzlicher Schutz, falls dein GitHub-Account kompromittiert wäre — aber dann hättest du sowieso ein Problem.

Empfehlung für dich: **B) lokal signieren** — passt zum Single-User-Pi-Setup, kein extra GitHub-Workflow, ein-Klick bleibt wirklich ein Klick. Wir können später jederzeit auf A) hochziehen.

## Dateien & Endpoints

**Backend (neu)**
- `backend/src/system/github-source.ts` — `getLatestCommit()`, `downloadTarball(sha)`, `extractToStaging()`, `buildOrSignManifest()`.
- `backend/src/routes/system-github.ts` — `GET /system/github/status`, `POST /system/github/verbinden`, `POST /system/github/trennen`, `POST /system/github/pruefen`, `POST /system/github/install` (ruft den vorhandenen `startInstall()`).
- `backend/src/settings/schemas.ts` — neuer Block `githubUpdate { repo, branch, autoCheck }` + `SENSITIVE_KEYS.githubToken`.

**Frontend (neu / erweitert)**
- `src/components/einstellungen/SystemUpdateTab.tsx` — neuer Abschnitt **„GitHub-Aktualisierung"** **über** dem ZIP-Upload (ZIP bleibt als Fallback erhalten).
- `src/components/einstellungen/GitHubVerbindenDialog.tsx` — Repo + Branch + PAT eintragen, „Verbindung testen".
- `src/components/einstellungen/GitHubUpdateCard.tsx` — Status, Diff-Anzeige (installierter vs. verfügbarer Commit), Primary-Button.
- `src/hooks/useApi.ts` — `useGithubStatus`, `useGithubVerbinden`, `useGithubInstall`.

**Wiederverwendet (unverändert)**
- Update-Runner, Backup, Symlink-Swap, SSE-Phase-Events, Rollback-Dialog, OperationLockBanner.

## Sicherheit

- PAT wird AES-verschlüsselt im SQLite-`setting`-Store abgelegt (gleicher Pfad wie Google-Refresh-Token).
- Endpoints hinter `requireAuth`, Rate-Limit auf `/install` (1/min, weil schwergewichtig).
- PAT-Berechtigungs-Hinweis im Dialog: „Fine-grained PAT, Repo-Zugriff: nur dieses eine Repo, Permissions: Contents = Read."
- Manifest-Validierung (Schema-Downgrade verboten, Größenlimits, ZIP-Allowlist) gilt 1:1 — auch beim Tarball.
- Audit-Log-Einträge: `system.github.verbunden`, `system.github.update_gestartet`, `system.github.update_erfolg`, `system.github.update_fehler`.

## Was du in GitHub machen musst (einmalig, ~2 min)

1. github.com → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → „Generate new token".
2. Repository access: **Only select repositories** → dein Repo wählen.
3. Permissions → Repository permissions → **Contents: Read-only**. Sonst nichts.
4. Token kopieren, in der Pi-UI in den Dialog einfügen, „Verbindung testen" → fertig.

Danach läuft alles per Klick aus der UI.

## Offene Frage an dich (bitte kurz beantworten, dann setze ich um)

**Manifest-Signatur: A (GitHub Actions signiert) oder B (Pi signiert lokal)?**
Wenn dir egal: ich mache **B** — ein Klick, kein GitHub-Setup außer dem PAT.
