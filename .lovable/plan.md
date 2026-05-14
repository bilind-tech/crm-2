## Ziel
Der Fehler `Something went wrong` soll bei `Angebot neu`, `Rechnung neu`, `Objekt neu` und ähnlichen Erstellen-Seiten weg. Kunden funktionieren bereits, deshalb konzentrieren wir uns auf die anderen Erstellen-/Detailbereiche.

## Was wahrscheinlich falsch ist
Es ist nicht der komplette Raspberry kaputt. Der Build lief durch. Das Problem ist sehr wahrscheinlich eine Kombination aus:

1. Die Schnellanlage führt auf Platzhalter-Seiten wie `/angebote/neu` und `/rechnungen/neu`.
2. Die eigentlichen funktionierenden Formulare liegen schon in den Listen-Seiten als SlideOver/Formular.
3. Bei direktem Öffnen oder Navigieren auf manche Unterseiten greift der Router/Fallback aktuell fehleranfällig.
4. Der Pi hatte außerdem vorher ein kaputtes `current`-Layout/Symlink-Problem, das jetzt separat sauber aktiviert werden muss.

## Änderungen im Programm nach Bestätigung
Ich würde im Code Folgendes ändern:

1. **`/angebote/neu` reparieren**
   - Statt Platzhalterkarte direkt das echte `AngebotForm` anzeigen.
   - Nach Speichern zurück zu `/angebote`.
   - Kein kaputter Zwischenzustand mehr.

2. **`/rechnungen/neu` reparieren**
   - Statt Platzhalterkarte direkt das echte `RechnungForm` anzeigen.
   - Nach Speichern zurück zu `/rechnungen`.

3. **`/objekte/neu` reparieren**
   - Statt Platzhalterkarte direkt das echte `ObjektForm` anzeigen.
   - Nach Speichern zurück zu `/objekte`.

4. **Schnellanlage stabilisieren**
   - Die Schnellanlage soll nicht mehr auf halbfertige/kaputte Platzhalter laufen.
   - Kunde bleibt wie aktuell funktionierend.
   - Angebot/Rechnung/Objekt öffnen dann die reparierten Neu-Seiten.

5. **Fallback-Regeln prüfen/ergänzen**
   - Sicherstellen, dass direkte Browseraufrufe wie `/angebote/neu`, `/rechnungen/neu`, `/objekte/neu`, Detailseiten und Bearbeiten-Seiten immer die SPA zurückbekommen und nicht in einen Backend-404/Fehler laufen.

6. **Keine Daten anfassen**
   - Es wird nichts in `/var/lib/mycleancenter` gelöscht oder überschrieben.
   - Es geht nur um Code/Release.

## Nach der Codeänderung: Befehl für den Raspberry
Nach deiner Bestätigung und nachdem ich den Code geändert habe, bekommst du einen fertigen Update-Befehl. Der Befehl wird ungefähr so aufgebaut sein:

```bash
set -e

REPO="https://github.com/bilind-tech/remix-of-crm.git"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
SRC="/tmp/mcc-src-$STAMP"
NEW="/opt/mycleancenter/versions/$STAMP"

sudo rm -f /opt/mycleancenter/current.new /opt/mycleancenter/current.tmp /opt/mycleancenter/previous.new || true

git clone --depth 1 "$REPO" "$SRC"

cd "$SRC"
npm ci --no-audit --no-fund
npm run build:spa

cd "$SRC/backend"
npm ci --no-audit --no-fund
npm run build

sudo mkdir -p "$NEW/backend"
sudo cp -a "$SRC/dist-spa" "$NEW/backend/dist-spa"
sudo cp -a "$SRC/dist-spa" "$NEW/dist"
sudo cp -a "$SRC/backend/dist" "$NEW/backend/dist"
sudo cp "$SRC/backend/package.json" "$NEW/backend/package.json"
sudo cp "$SRC/backend/package-lock.json" "$NEW/backend/package-lock.json"

cd "$NEW/backend"
sudo npm ci --omit=dev --no-audit --no-fund
sudo chown -R mycleancenter:mycleancenter "$NEW"

if [ -e /opt/mycleancenter/current ] || [ -L /opt/mycleancenter/current ]; then
  sudo ln -sfn "$(readlink -f /opt/mycleancenter/current)" /opt/mycleancenter/previous.new || true
  sudo mv -Tf /opt/mycleancenter/previous.new /opt/mycleancenter/previous || true
fi

sudo ln -sfn "$NEW" /opt/mycleancenter/current.new
sudo mv -T /opt/mycleancenter/current.new /opt/mycleancenter/current

sudo systemctl restart mycleancenter
sudo systemctl status mycleancenter --no-pager -l
curl -sS -i http://127.0.0.1:8787/health
```

Falls `current` auf deinem Pi noch ein echter Ordner statt Symlink ist, gebe ich dir im endgültigen Befehl wieder die sichere Variante mit Ordner-Backup, damit die Aktivierung nicht erneut bei `mv: cannot overwrite directory` abbricht.

## Erwartetes Ergebnis
Danach sollten funktionieren:

- Kunden Detailseite
- Neues Angebot
- Neue Rechnung
- Neues Objekt
- Angebots-/Rechnungslisten
- Direkter Seiten-Reload auf diesen Routen

## Wenn es danach noch knallt
Dann brauchen wir nur noch diesen einen Diagnosebefehl, nicht 1000 Sachen:

```bash
sudo journalctl -u mycleancenter -n 120 --no-pager
```

Damit sieht man exakt, welche Route oder Datei noch crasht.