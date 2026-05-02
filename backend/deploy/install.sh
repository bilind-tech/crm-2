#!/usr/bin/env bash
# MyCleanCenter — Pi-Installations-Skript.
# Idempotent: kann beliebig oft erneut ausgeführt werden.
# Erwartet: Raspberry Pi OS Lite (Bookworm oder neuer), root-Rechte.
#
#   sudo ./install.sh                 — Erstinstallation oder Reparatur
#   sudo ./install.sh --check         — nur prüfen, nichts ändern
#
set -euo pipefail

readonly APP_USER="mycleancenter"
readonly APP_GROUP="mycleancenter"
readonly APP_DIR="/opt/mycleancenter"
readonly DATA_DIR="/var/lib/mycleancenter"
readonly SERVICE_NAME="mycleancenter"

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SYSTEMD_UNIT="$SCRIPT_DIR/systemd/mycleancenter.service"
readonly SUDOERS_FILE="$SCRIPT_DIR/sudoers.d/mycleancenter"
readonly LOGROTATE_FILE="$SCRIPT_DIR/logrotate.conf"

CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

log() { printf "\033[1;36m[install]\033[0m %s\n" "$*"; }
ok()  { printf "\033[1;32m  ✓\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m  ⚠\033[0m %s\n" "$*"; }
err() { printf "\033[1;31m  ✗\033[0m %s\n" "$*" >&2; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    err "Bitte mit sudo ausführen: sudo $0"
    exit 1
  fi
}

ensure_user() {
  if id "$APP_USER" &>/dev/null; then
    ok "User $APP_USER existiert"
  else
    log "Lege System-User $APP_USER an"
    [[ $CHECK_ONLY -eq 1 ]] || useradd --system --shell /usr/sbin/nologin --home "$DATA_DIR" "$APP_USER"
    ok "User $APP_USER erstellt"
  fi
}

ensure_dirs() {
  local dirs=(
    "$APP_DIR"
    "$APP_DIR/releases"
    "$DATA_DIR"
    "$DATA_DIR/db"
    "$DATA_DIR/keys"
    "$DATA_DIR/uploads"
    "$DATA_DIR/logs"
    "$DATA_DIR/backups"
    "$DATA_DIR/backups/daily"
    "$DATA_DIR/backups/weekly"
    "$DATA_DIR/backups/monthly"
    "$DATA_DIR/backups/safety"
    "$DATA_DIR/backups/tmp"
  )
  for d in "${dirs[@]}"; do
    if [[ -d "$d" ]]; then
      ok "Verzeichnis $d vorhanden"
    else
      log "Erstelle $d"
      [[ $CHECK_ONLY -eq 1 ]] || mkdir -p "$d"
    fi
  done
  if [[ $CHECK_ONLY -eq 0 ]]; then
    chown -R "$APP_USER:$APP_GROUP" "$APP_DIR" "$DATA_DIR"
    chmod 0700 "$DATA_DIR/keys"
    chmod 0750 "$DATA_DIR"
    ok "Rechte gesetzt (keys/=0700, data/=0750)"
  fi
}

ensure_node() {
  if command -v node &>/dev/null; then
    local v
    v="$(node --version)"
    ok "Node vorhanden: $v"
    if [[ ! "$v" =~ ^v(20|22|24) ]]; then
      warn "Node-Version ist $v — empfohlen ist v20 LTS oder neuer."
    fi
  else
    log "Installiere Node.js 20 LTS via NodeSource"
    if [[ $CHECK_ONLY -eq 1 ]]; then
      warn "[--check] Node fehlt"
      return
    fi
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    ok "Node.js installiert: $(node --version)"
  fi
}

install_systemd_unit() {
  if [[ ! -f "$SYSTEMD_UNIT" ]]; then
    err "systemd-Unit fehlt: $SYSTEMD_UNIT"
    exit 2
  fi
  if [[ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]] \
     && cmp -s "$SYSTEMD_UNIT" "/etc/systemd/system/${SERVICE_NAME}.service"; then
    ok "systemd-Unit aktuell"
    return
  fi
  log "Installiere systemd-Unit nach /etc/systemd/system/${SERVICE_NAME}.service"
  if [[ $CHECK_ONLY -eq 1 ]]; then
    warn "[--check] Unit würde geschrieben"
    return
  fi
  install -m 0644 "$SYSTEMD_UNIT" "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
  ok "systemd-Unit installiert + enabled"
}

install_sudoers() {
  if [[ ! -f "$SUDOERS_FILE" ]]; then
    warn "sudoers-Datei fehlt: $SUDOERS_FILE"
    return
  fi
  local target="/etc/sudoers.d/mycleancenter"
  if [[ -f "$target" ]] && cmp -s "$SUDOERS_FILE" "$target"; then
    ok "sudoers-Eintrag aktuell"
    return
  fi
  log "Installiere sudoers-Eintrag"
  if [[ $CHECK_ONLY -eq 1 ]]; then
    warn "[--check] sudoers würde geschrieben"
    return
  fi
  install -m 0440 -o root -g root "$SUDOERS_FILE" "$target"
  visudo -cf "$target" >/dev/null
  ok "sudoers installiert + validiert"
}

install_logrotate() {
  if [[ ! -f "$LOGROTATE_FILE" ]]; then
    warn "logrotate-Datei fehlt: $LOGROTATE_FILE"
    return
  fi
  local target="/etc/logrotate.d/mycleancenter"
  if [[ -f "$target" ]] && cmp -s "$LOGROTATE_FILE" "$target"; then
    ok "logrotate-Config aktuell"
    return
  fi
  log "Installiere logrotate-Config"
  if [[ $CHECK_ONLY -eq 1 ]]; then
    warn "[--check] logrotate würde geschrieben"
    return
  fi
  install -m 0644 "$LOGROTATE_FILE" "$target"
  ok "logrotate installiert"
}

start_service() {
  if [[ $CHECK_ONLY -eq 1 ]]; then
    return
  fi
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    log "Service $SERVICE_NAME läuft bereits — Restart"
    systemctl restart "$SERVICE_NAME"
  else
    log "Starte Service $SERVICE_NAME"
    systemctl start "$SERVICE_NAME" || true
  fi
  sleep 2
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    ok "Service läuft"
  else
    warn "Service läuft nicht — prüfe: journalctl -u $SERVICE_NAME -n 50"
  fi
}

main() {
  require_root
  log "MyCleanCenter Setup startet (CHECK_ONLY=$CHECK_ONLY)"
  ensure_user
  ensure_dirs
  ensure_node
  install_systemd_unit
  install_sudoers
  install_logrotate
  if [[ -d "$APP_DIR/current" || -L "$APP_DIR/current" ]]; then
    start_service
  else
    warn "Kein Code unter $APP_DIR/current — Setup-Wizard kommt nach erstem Code-Deploy."
    warn "Lade die erste CRM-Version per Web-UI hoch oder per scp."
  fi
  log "Fertig."
}

main "$@"
