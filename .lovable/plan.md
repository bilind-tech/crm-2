## Ziel

Der neue Raspberry Pi soll nach dem Neuformatieren sauber, schnell und zuverlässig laufen:

- CRM auf dem Pi stabil erreichbar per IP und `.local`
- Daten dauerhaft auf der USB-SSD, nicht auf der SD-Karte
- Einstellungen dürfen nicht mehr leer bleiben
- GitHub-/Update-Prozess soll einfach, sicher und ohne Datenverlust laufen
- Stundenzettel läuft zusätzlich auf Port `8080`, ohne CRM zu stören
- Keine Wiederholung der bisherigen Probleme: mDNS-Loop, langsamer Pi, Cookie-/Login-Probleme, unsichere/fragile Updates

## Plan

### 1. Installer für frischen Pi robust machen

Ich baue den Installer so um, dass er eine echte Neuinstallation zuverlässig vorbereitet:

- Vorab-Check für Raspberry Pi OS 64-bit, Node, Git, Avahi, SQLite-Build-Tools.
- USB-SSD-Erkennung und klare Prüfung:
  - bevorzugter Mount: `/mnt/data`
  - Datenziel: `/mnt/data/mycleancenter`
  - `/var/lib/mycleancenter` wird als Symlink auf die SSD gesetzt
- Der Installer soll abbrechen oder deutlich warnen, wenn die Daten versehentlich auf der SD-Karte landen würden.
- Verzeichnisse werden strikt getrennt:

```text
/opt/mycleancenter/              = Code/Releases
/var/lib/mycleancenter/          = Daten, zeigt auf SSD
/mnt/data/mycleancenter/         = echte Daten auf USB-SSD
```

- Bestehende Daten werden niemals gelöscht.
- Vor jedem Code-Wechsel wird automatisch ein Sicherheits-Backup erstellt, wenn bereits Daten existieren.

### 2. `.local` sauber lösen, ohne Restart-Loop

Das alte Problem kam vom fehlerhaften `mycleancenter-mdns-aliases.service`, der in einer Endlosschleife neu gestartet wurde.

Ich plane deshalb:

- Den kaputten Alias-Dienst bleibt dauerhaft entfernt.
- Kein `avahi-publish-address` als dauerhafter Loop-Dienst mehr.
- Stabiler Ansatz:
  - Avahi normal aktivieren.
  - Primäre lokale Adresse zuverlässig veröffentlichen.
  - `mycleancenter.local` über eine robuste, einmalige/refreshbare Avahi-Konfiguration statt über einen crashenden Prozess.
- IP-Zugriff bleibt immer funktionierend als Fallback.
- Installer prüft danach automatisch:

```text
http://<IP>:8787/health
http://mycleancenter.local:8787/health
```

Wenn `.local` im Netzwerk trotzdem nicht zuverlässig geht, zeigt der Installer direkt die IP-Adresse als sichere Alternative an, statt hängen zu bleiben.

### 3. Login, Cookies und leere Einstellungen endgültig stabilisieren

Das Problem mit leeren Tabs kam sehr wahrscheinlich daher, dass der Browser bei `http://IP:8787` keine `Secure` Cookies mitsendet.

Das wurde bereits teilweise korrigiert, ich würde es im Plan vollständig absichern:

- `COOKIE_SECURE=false` für lokalen HTTP-LAN-Betrieb fest in der Pi-Unit.
- `CORS_ORIGINS=*` beziehungsweise same-origin-freundlich für IP, Hostname und `.local`.
- Nach Login automatischer Session-Selbsttest:
  - Wenn `/auth/me` nicht funktioniert, wird klar „neu anmelden“ angezeigt.
- Einstellungen bekommen einheitliche Lade-/Fehlerzustände, nicht nur Firmendaten:
  - Firmendaten
  - Google Drive
  - Backup
  - Sicherheit
  - Systemupdate
  - Stundenzettel
- Kein Tab darf einfach leer bleiben.

### 4. GitHub-Update wirklich einfach, schnell und sicher machen

Aktuell ist der manuelle Ablauf mit `git pull && bun run release && install.sh` zu fehleranfällig und langsam auf dem Pi.

Ich plane einen besseren Update-Weg:

- In der App unter **Einstellungen → System & Updates**:
  - Public GitHub Repository eintragen
  - Branch auswählen, z. B. `main`
  - „Update prüfen“
  - „Update installieren“
- Für public GitHub soll kein Token Pflicht sein.
- Der Pi lädt den Code direkt von GitHub.
- Der Pi bereitet das Update zuerst vollständig in einem Staging-Ordner vor.
- Wichtig: Der aktive Code wird erst gewechselt, wenn vorher alles erfolgreich war:
  - Download ok
  - Paketstruktur ok
  - Abhängigkeiten ok
  - Build/Backend-Dateien ok
  - Migrationen geprüft
  - Sicherheitsbackup erstellt
- Danach erst atomarer Symlink-Wechsel:

```text
/opt/mycleancenter/current -> neue Version
/opt/mycleancenter/previous -> alte Version
```

- Wenn Healthcheck fehlschlägt: automatischer Rollback auf `previous`.
- Daten unter `/var/lib/mycleancenter` werden dabei nie überschrieben.

### 5. Update-Sicherheit technisch härten

Für maximale Sicherheit plane ich den Update-Mechanismus zu korrigieren:

- Der laufende Webdienst soll nicht dauerhaft Schreibrechte auf `/opt/mycleancenter` brauchen.
- Stattdessen ein kleiner, kontrollierter Update-Helper:
  - validiert Pfade
  - schreibt nur nach `/opt/mycleancenter/releases`
  - setzt nur `current`/`previous`
  - startet nur `mycleancenter` neu
- `sudoers` erlaubt nur diesen engen Helper, nicht beliebige Systembefehle.
- Keine Änderung an Daten außerhalb kontrollierter Backup-/Restore-Flows.

Das ist sicherer als dem Backend dauerhaft Schreibrechte auf Code-Verzeichnisse zu geben.

### 6. USB-SSD, Backups und Restore absichern

Ich plane den Installer und die Systemprüfung so, dass später klar ist: Daten liegen wirklich auf SSD.

Checks:

- `findmnt /var/lib/mycleancenter`
- Schreibtest im Datenverzeichnis
- SQLite-WAL aktiv
- `master.key` vorhanden und geschützt
- Backup-Verzeichnisse vorhanden
- Backup kann testweise erstellt werden

Backups bleiben:

```text
/var/lib/mycleancenter/backups/daily
/var/lib/mycleancenter/backups/weekly
/var/lib/mycleancenter/backups/monthly
/var/lib/mycleancenter/backups/safety
```

Und enthalten weiterhin:

- SQLite-DB via SQLite Online Backup
- Uploads/Dokumente
- `master.key`
- Backup-Manifest

### 7. Stundenzettel auf Port 8080 berücksichtigen

Der Stundenzettel soll zusätzlich auf demselben Pi laufen.

Ich plane:

- CRM bleibt auf Port `8787`.
- Stundenzettel bleibt auf Port `8080`.
- Installer prüft, ob `8080` frei oder bereits vom Stundenzettel belegt ist.
- CRM-Installer startet oder stoppt den Stundenzettel nicht ungefragt.
- In den CRM-Einstellungen wird als typische Adresse unterstützt:

```text
http://mycleancenter.local:8080
http://<IP>:8080
```

- Wenn iframe-Einbettung vom Stundenzettel blockiert wird, bleibt der sichere Fallback „in neuem Tab öffnen“.
- Kein `timekeeper.local`-Alias mehr, sofern du ihn nicht ausdrücklich willst.

### 8. Neuer „Deployment Doctor“

Ich plane ein Diagnosekommando, das nach der Installation alles prüft und klare Ergebnisse ausgibt:

```bash
sudo bash backend/deploy/install.sh --doctor
```

Es prüft:

- SSD-Mount korrekt
- Datenpfad zeigt auf SSD
- CRM-Service läuft
- Healthcheck per localhost, IP und `.local`
- Cookie-Konfiguration korrekt für HTTP-LAN
- mDNS läuft nicht in einem Loop
- Port `8787` frei/belegt durch CRM
- Port `8080` frei/belegt durch Stundenzettel
- Logs explodieren nicht
- SQLite integrity check ok
- Backup-Verzeichnis beschreibbar
- GitHub-Update-Konfiguration ok

### 9. Klare Neuinstallations-Anleitung

Ich würde danach eine einfache Anleitung bereitstellen, z. B.:

```text
1. Raspberry Pi OS Lite neu flashen
2. USB-SSD anschließen
3. SSD mounten oder Installer-Mount-Hilfe nutzen
4. Repository holen
5. Installer starten
6. Doctor prüfen
7. CRM im Browser öffnen
8. Stundenzettel-Adresse eintragen
9. GitHub-Update aktivieren
```

Ziel ist: Du sollst nicht wieder viele unklare Einzelbefehle ausprobieren müssen.

## Akzeptanzkriterien

Nach Umsetzung gilt die Installation nur als fertig, wenn:

- CRM öffnet schnell per IP.
- `mycleancenter.local` funktioniert oder es gibt eine klare, geprüfte Fallback-IP.
- Einstellungen zeigen nie mehr leere Inhalte ohne Fehlermeldung.
- Login bleibt über `http://IP:8787` und `http://mycleancenter.local:8787` erhalten.
- Daten liegen nachweislich auf der USB-SSD.
- Backup lässt sich erstellen.
- GitHub-Update läuft ohne manuelles `bun run release` auf dem Pi.
- Während Update bleibt die alte Version bis zum finalen Wechsel lauffähig.
- Bei Fehler wird automatisch zurückgerollt.
- Stundenzettel auf Port `8080` wird nicht blockiert.

## Nicht-Ziele

- Keine Cloud-Deployment-Umstellung.
- Keine Speicherung von Zugangsdaten im Code.
- Keine Rollen-/Mehrbenutzer-Verwaltung.
- Kein automatischer E-Mail-Versand.
- Keine riskante Änderung am Datenverzeichnis außerhalb Backup/Restore.