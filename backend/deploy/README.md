# Pi-Deployment

Anleitung, um das CRM-Backend auf einem frisch geflashten Raspberry Pi 5 in Betrieb zu nehmen.

## Voraussetzungen

- Raspberry Pi 5 mit USB-SSD (siehe `mem://reference/hardware`)
- Raspberry Pi OS Lite (64-bit, Bookworm oder neuer)
- SSH aktiv, Standard-User `pi` mit sudo-Rechten
- Pi ist im LAN erreichbar unter `mycleancenter.local` (mDNS)

## Erstinstallation

```bash
# 1. Auf den Pi einloggen
ssh pi@mycleancenter.local

# 2. CRM-Code holen — entweder als ZIP entpacken …
sudo mkdir -p /opt/mycleancenter/releases/initial
sudo tar -xzf mycleancenter-vX.Y.Z.tar.gz -C /opt/mycleancenter/releases/initial
sudo ln -sfn /opt/mycleancenter/releases/initial /opt/mycleancenter/current

# 3. Setup-Skript starten (idempotent)
cd /opt/mycleancenter/current/backend/deploy
sudo bash install.sh
```

Das Skript:

- legt System-User `mycleancenter` an
- erzeugt `/var/lib/mycleancenter/{db,keys,uploads,logs,backups/...}`
- installiert Node.js 20 LTS (falls fehlt)
- kopiert die systemd-Unit nach `/etc/systemd/system/mycleancenter.service`
- erlaubt dem Service via `sudoers.d/mycleancenter` den eigenen Restart
- richtet `logrotate` für `/var/lib/mycleancenter/logs/` ein (14 Tage Vorhalt)
- startet den Service (`systemctl enable --now mycleancenter`)

Nach Erfolg:

```bash
curl http://mycleancenter.local:8787/health
# → {"status":"ok",...}
```

Im Browser dann `http://mycleancenter.local:8787` öffnen → Setup-Wizard.

## Updates

Updates laufen über die CRM-Web-UI: **Einstellungen → System → Update-Paket hochladen**.

Das Backend:

1. validiert das ZIP (Manifest, Schema-Version, SHA256)
2. erstellt automatisch ein Sicherheits-Backup
3. entpackt nach `/opt/mycleancenter/releases/<timestamp>/`
4. tauscht den `current`-Symlink atomar
5. ruft `sudo systemctl reload mycleancenter` auf
6. macht einen Healthcheck — bei Fehler automatischer Rollback

Die Daten unter `/var/lib/mycleancenter/` werden **nie** angefasst.

## Backups

Konfiguration in der Web-UI (Einstellungen → Backup). Defaults: tägliches SQLite-Snapshot, Rotation 7 daily / 4 weekly / 12 monthly. Speicherort `/var/lib/mycleancenter/backups/`.

Restore ebenfalls über die Web-UI — vor jedem Restore wird automatisch ein Sicherheits-Backup angelegt.

## Troubleshooting

```bash
# Service-Status
sudo systemctl status mycleancenter

# Live-Logs
sudo journalctl -u mycleancenter -f

# Persistente Logs (JSON-Lines)
ls /var/lib/mycleancenter/logs/

# Service neu starten
sudo systemctl restart mycleancenter

# Setup nochmal prüfen, ohne zu ändern
sudo bash /opt/mycleancenter/current/backend/deploy/install.sh --check
```

## Datei-Layout

```
/opt/mycleancenter/
├── current  →  releases/<timestamp>/      (Symlink, atomar getauscht)
├── previous →  releases/<vorgänger>/      (Symlink für Rollback)
└── releases/
    ├── 2026-05-02_103045/
    └── 2026-05-15_120012/

/var/lib/mycleancenter/        ← Daten, NIE durch Updates angefasst
├── db/mycleancenter.db
├── keys/master.key            (0600, root:mycleancenter)
├── uploads/
├── logs/app-YYYY-MM-DD.log
└── backups/
    ├── daily/  weekly/  monthly/
    ├── safety/                (Pre-Update + Pre-Restore)
    └── tmp/
```

## Sicherheit

- `master.key` (`/var/lib/mycleancenter/keys/`) wird beim ersten Start generiert. **Verschlüsselt alle Settings-Geheimnisse** (SMTP-Passwort, Google-Drive-Token). Geht der Key verloren, sind die Geheimnisse unbrauchbar — daher gehört er ins Backup.
- Der Service läuft als unprivilegierter User `mycleancenter` mit systemd-Hardening (`ProtectSystem=strict`, `ReadWritePaths=/var/lib/mycleancenter`, `NoNewPrivileges`).
- Web-UI ist via Cookie-Auth gesichert (Setup-Wizard beim ersten Aufruf).
