# Finale Backend-Härtung — Status

## ✅ Umgesetzt (Block A + B + Teile von C)

### Block A — Kritisch
- ✅ `emailRoutes` in `server.ts` registriert (Import + register).
- ✅ systemd-Unit korrigiert: `TZ=Europe/Berlin`, `CORS_ORIGINS=http://mycleancenter.local:8787`, `GOOGLE_OAUTH_REDIRECT` hartkodiert.
- ✅ Rate-Limit 5/min auf `/backup/upload`, `/backup/:id/restore`, `/backup/upload/:uploadId/restore`.

### Block B — Sicherheit
- ✅ Helmet mit restriktiver CSP (default-src 'self', kein inline-script, frame-ancestors 'none').
- ✅ Roter Sicherheits-Disclaimer im Backup-Tab beim Drive-Spiegel-Switch (Master-Key-Warnung + 2FA-Empfehlung).
- ✅ `markSetupComplete()` löscht `setup.token` von der Platte.
- ✅ `purgeExpiredSessions()` räumt `lastTouchedAt`-Cache mit auf.
- ✅ `MAX_FAILS` von 5 auf 10 (LAN-Single-User: alle Geräte hinter derselben IP).

### Block C — Polish
- ✅ `npm ci`-Timeout im Update-Runner auf 10 min erhöht.

## ⏭ Bewusst zurückgestellt
- Drive-Backup OHNE Master-Key (echte Trennung): braucht eigenen Restore-Flow für den Key + UI-Wiederherstellungs-Code-Eingabe → größerer Eingriff, separater Pass nach Erst-Deploy. Der Disclaimer schließt die Lücke vorübergehend.
- `safety` ↔ `pre-restore` Kategorien zusammenlegen, `wrangler.jsonc` löschen, Token-Last-Used-Anzeige → Polish, kann später.
- Pi-Deployment-Doku in Memory schreiben → erst beim tatsächlichen Deploy zusammen mit dem User.

## Pi-Deployment-Checkliste (kurz)
1. Pi-OS-Lite, USB-SSD an `/var/lib/mycleancenter` via fstab (mit `nofail`).
2. `sudo timedatectl set-timezone Europe/Berlin` (TZ in systemd reicht für den Service, OS-weit ist sauberer).
3. Hostname `mycleancenter` + `avahi-daemon` aktiv → `mycleancenter.local`.
4. `install.sh` ausführen → Setup-Token-URL aus Konsole nehmen → Passwort + Recovery-Code SOFORT aufschreiben.
5. Drive verbinden in Einstellungen → erstes manuelles Backup → Restore-Test in Test-Umgebung.
6. GitHub-PAT (Fine-grained, nur „Contents: Read") für Auto-Updates eintragen.
7. Vor Go-Live: SMTP-Test senden, Mahn-Cron als deaktiviert verifizieren.
