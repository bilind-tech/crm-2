#!/usr/bin/env bash
# MyCleanCenter — One-Liner Erstinstallation auf einem frisch geflashten Pi.
#
# Aufruf VOR Ort auf dem Pi (root erforderlich):
#
#   sudo bash bootstrap.sh /pfad/zu/mycleancenter-vX.Y.Z.zip
#
# Dieses Skript:
#   1. installiert Systempakete (git, curl, build-essential, python3, unzip, libsqlite3)
#   2. installiert Node.js 20 LTS via NodeSource (falls nicht vorhanden)
#   3. entpackt das Release-ZIP temporär, um an deploy/install.sh zu kommen
#   4. ruft install.sh --bootstrap=<zip> auf (legt User, Dirs, systemd, sudoers,
#      logrotate an, baut Native Module, startet Service)
#
# Daten unter /var/lib/mycleancenter/ werden NICHT angefasst.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Bitte mit sudo ausführen: sudo bash $0 <release.zip>" >&2
  exit 1
fi

ZIP="${1:-}"
if [[ -z "$ZIP" || ! -f "$ZIP" ]]; then
  echo "Usage: sudo bash $0 /pfad/zu/mycleancenter-vX.Y.Z.zip" >&2
  exit 2
fi

log() { printf "\033[1;36m[bootstrap]\033[0m %s\n" "$*"; }

log "Systempakete"
apt-get update
apt-get install -y curl ca-certificates unzip python3 make g++ build-essential libsqlite3-dev git avahi-daemon avahi-utils libnss-mdns

if ! command -v node >/dev/null 2>&1; then
  log "Installiere Node.js 20 LTS"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
log "Node-Version: $(node --version)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
log "Entpacke Release temporär nach $TMP"
unzip -q "$ZIP" -d "$TMP"

INSTALLER="$TMP/backend/deploy/install.sh"
if [[ ! -f "$INSTALLER" ]]; then
  echo "FEHLER: install.sh nicht im ZIP gefunden ($INSTALLER)" >&2
  exit 3
fi
chmod +x "$INSTALLER"

log "Übergebe an install.sh --bootstrap=$ZIP"
exec bash "$INSTALLER" --bootstrap="$ZIP"