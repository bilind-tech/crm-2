## Ziel
Die Installation ist fast durchgelaufen: Frontend, Backend-Build und Stundenzettel funktionieren. Der einzige harte offene Punkt ist: `mycleancenter.service` antwortet nicht auf `/health`. Bevor du nochmal Befehle am Pi ausführst, mache ich den Installer robuster und liefere danach einen finalen Reparaturblock, der keine Daten löscht und keine doppelten Projektkopien erzeugt.

## Was ich ändern werde

1. **Root-Lockfile reparieren**
   - `package-lock.json` ist aktuell nicht synchron zur `package.json`.
   - Das verursacht jedes Mal den sichtbaren `npm ci`-Fehler, auch wenn danach `npm install` weiterläuft.
   - Ich aktualisiere das Lockfile sauber, damit `npm ci` direkt funktioniert und die Installation weniger fehleranfällig wird.

2. **Pi baut das richtige Frontend-Bundle**
   - Aktuell baut `setup-pi.sh` mit `npm run build` das normale TanStack/SSR-Bundle (`dist/client`, `dist/server`).
   - Der Pi-Service erwartet aber ein statisches SPA unter `/opt/mycleancenter/current/dist`.
   - Ich ändere den Pi-Installer auf `npm run build:spa` und kopiere `dist-spa/` als `dist/` in den Release-Ordner.
   - Damit liefert Fastify später wirklich die richtige App aus.

3. **CRM-Service-Start härter absichern**
   - `install.sh` soll beim Healthcheck nicht nur warnen, sondern bei einem Startproblem direkt die letzten relevanten Logs ausgeben und mit Fehlercode abbrechen.
   - Dadurch endet das Setup nicht mehr mit „FERTIG“, wenn CRM gar nicht läuft.
   - Zusätzlich soll der Start explizit `systemctl reset-failed`, `daemon-reload` und einen sauberen Restart machen.

4. **Backend-Start robuster machen**
   - Die SSD-Prüfung in `config.ts` nutzt aktuell `require(...)` und `child_process` in einer ESM-TypeScript-Codebase. Auf Node kann das je nach Kompilat/Runtime ein Startproblem sein.
   - Ich ersetze das durch reine ESM-Imports (`fs.realpathSync`, `statfsSync`, `execFileSync`) oder entferne unnötige Shell-Pipes.
   - So ist der Backend-Start weniger abhängig von Node-/ESM-Eigenheiten.

5. **Pi-Deployment-Pfade vereinheitlichen**
   - `setup-pi.sh` nutzt aktuell `/opt/mycleancenter/releases/...`.
   - Die interne Update-Logik nutzt `/opt/mycleancenter/versions/...`.
   - Ich vereinheitliche das auf die vorhandene Installer-/Update-Struktur, ohne Datenpfad `/mnt/ssd/mycleancenter` anzufassen.

6. **Finale Befehle für dich vorbereiten**
   - Nach den Änderungen bekommst du genau einen sauberen Reparaturblock.
   - Der Block wird:
     - kaputte npm-Caches entfernen,
     - Rechte auf SSD-Datenpfad korrigieren,
     - den aktuellen Code neu holen,
     - CRM + Stundenzettel neu deployen,
     - danach Service-Status, Logs, Healthcheck, SSD-Mount und `.local` prüfen.
   - Wichtig: Daten bleiben auf `/mnt/ssd/mycleancenter`; Code liegt unter `/opt/...`; es wird nicht doppelt installiert, sondern atomar aktualisiert.

## Was ich nicht ändern werde
- Keine Cloud-Installation.
- Keine Datenbank auf SD-Karte.
- Kein Löschen von `/mnt/ssd/mycleancenter`.
- Keine Änderung am Single-User-Konzept.
- Kein automatischer E-Mail-Versand.

## Erwartetes Ergebnis
Nach dem finalen Reparaturblock sollten erreichbar sein:

```text
CRM:
http://mycleancenter.local:8787
http://mycleancenter-pi.local:8787
http://<Pi-IP>:8787

Stundenzettel:
http://stundenzettel.local:8080
http://mycleancenter-pi.local:8080
http://<Pi-IP>:8080

Daten:
/var/lib/mycleancenter -> /mnt/ssd/mycleancenter
```

## Falls trotzdem noch etwas scheitert
Dann zeigt der Installer direkt die genaue `journalctl`-Fehlerursache an, statt nur „FERTIG“ zu melden. Damit wäre der nächste Schritt eindeutig und nicht wieder Ratespiel.