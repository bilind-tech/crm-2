## Ziel
Der Button **Aus GitHub aktualisieren** soll zuverlässig funktionieren, auch wenn sich `package.json` geändert hat oder eine Lockfile nicht exakt synchron ist. Der gezeigte Fehler entsteht aktuell, weil der Pi beim GitHub-Update im neuen Code-Ordner `npm ci` ausführt und dabei abbricht, sobald `package-lock.json` nicht exakt zu `package.json` passt.

## Problemursache
- **Updates prüfen** funktioniert, weil dabei nur GitHub abgefragt wird.
- **Aktualisieren** lädt den GitHub-Code und versucht auf dem Pi daraus Frontend/Backend zu bauen.
- In der Phase **Quarantäne** läuft für das Frontend `npm ci`.
- `npm ci` ist absichtlich streng und bricht ab, wenn `package.json` und `package-lock.json` nicht synchron sind.
- Dadurch scheitert das Update, obwohl der Code an sich korrekt sein kann.
- Gut: Der Fehler passiert vor dem finalen Symlink-Wechsel; das Sicherheits-Backup wurde erstellt und die Daten bleiben unangetastet.

## Plan

### 1. Update-Installer robuster machen
Ich ändere die Update-Pipeline so, dass sie nicht mehr hart an einem Lockfile-Mismatch scheitert:

- Zuerst weiterhin bevorzugt `npm ci` verwenden, wenn die Lockfile korrekt ist.
- Wenn `npm ci` mit einem bekannten Lockfile-Sync-Fehler scheitert, automatisch auf `npm install --no-audit --no-fund` wechseln.
- Das gilt für:
  - Frontend-Dependencies vor `build:spa`
  - Backend-Dependencies vor Backend-Build
  - finalen produktiven Backend-Install mit `--omit=dev`

Damit wird aus einem abbrechenden Update ein selbstheilender Update-Lauf.

### 2. Lockfile-Handling sauber trennen
Ich verhindere, dass falsche Lockfiles in den falschen Ordner kopiert werden:

- Root-`package-lock.json` bleibt nur für das Frontend/Root-Projekt relevant.
- `backend/package-lock.json` bleibt nur für das Backend relevant.
- Wenn im GitHub-Code eine Backend-Lockfile fehlt oder nicht passt, wird im Backend-Ordner sauber per `npm install` installiert statt mit einer fremden/falschen Lockfile zu scheitern.

### 3. Fehlertexte verständlicher machen
Falls ein Dependency-Install trotzdem fehlschlägt, soll die UI nicht mehr einen riesigen npm-Rohfehler anzeigen, sondern eine klare Meldung wie:

```text
Abhängigkeiten konnten nicht installiert werden.
Ursache: package-lock.json war nicht synchron und der automatische npm-install-Fallback ist ebenfalls fehlgeschlagen.
```

Die technischen Details bleiben gekürzt im Lauf-Detail erhalten, aber nicht als unlesbarer Block.

### 4. Update-Reihenfolge sicher beibehalten
Die bestehenden Sicherheitsregeln bleiben erhalten:

- Vor dem produktiven Code-Wechsel wird ein Sicherheits-Backup erstellt.
- `/var/lib/mycleancenter/` wird nicht verändert oder gelöscht.
- Der neue Code wird erst aktiv geschaltet, wenn Frontend und Backend gebaut bzw. geprüft sind.
- Bei Fehler bleibt die bisherige Version aktiv.

Ich werde dabei zusätzlich prüfen, dass der Build weiterhin **vor** dem finalen `current`-Symlink-Wechsel passiert.

### 5. Tests ergänzen
Ich ergänze Tests für genau diesen Fall:

- GitHub-/Update-Paket mit absichtlich unsynchronem `package-lock.json`.
- Erwartung: Der Installer versucht `npm ci`, erkennt den Lockfile-Fehler und fällt auf `npm install` zurück.
- Zusätzlich Test für Backend-Install-Fallback.
- Test, dass bei einem endgültigen Install-Fehler kein Datenverzeichnis angefasst wird und kein kaputter Code aktiv geschaltet wird.

### 6. Sofortige Reparatur für den aktuellen Stand
Zusätzlich zur Code-Härtung wird die aktuelle Repo-Situation bereinigt:

- Root-`package-lock.json` mit `package.json` synchronisieren.
- `backend/package-lock.json` mit `backend/package.json` synchron halten.
- Damit verschwindet der konkrete Fehler aus dem Screenshot sofort, und die neue Fallback-Logik verhindert, dass er später wieder blockierend wird.

## Ergebnis
Nach Umsetzung gilt:

- GitHub-Update funktioniert auch bei Versions- und Dependency-Änderungen zuverlässig.
- Lockfile-Mismatch führt nicht mehr automatisch zum Update-Abbruch.
- Alte Version und Daten bleiben geschützt.
- Fehlermeldungen werden deutlich verständlicher.
- Dieser konkrete Fehler soll dauerhaft nicht mehr auftauchen.