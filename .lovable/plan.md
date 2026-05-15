# Fix: `npm ci` schlägt fehl — `backend/package-lock.json` out of sync

## Was passiert ist

Beim Hinzufügen von `imapflow` habe ich `bun add imapflow` benutzt — das hat **`backend/bun.lock`** aktualisiert, aber **`backend/package-lock.json`** unangetastet gelassen. Der Update-Flow auf dem Pi nutzt aber `npm ci` (strict — bricht ab, sobald lock und package.json nicht 1:1 zusammenpassen). Daher die Meldung „Missing: imapflow@1.3.3 from lock file".

Belegt: `grep imapflow backend/package-lock.json` → 0 Treffer. `package.json` und `bun.lock` haben es.

## Fix — exakt eine Aktion

`backend/package-lock.json` neu generieren, sodass es alle aktuellen Abhängigkeiten (inkl. `imapflow` + Transitive: `@zone-eu/mailsplit`, `libmime`, `libqp`, `libbase64`, `encoding-japanese`, `socks`, `ip-address`, `smart-buffer`, `pino@10`, `pino-abstract-transport`, `process-warning`, `thread-stream`, `real-require`) enthält.

Konkret:
```bash
cd backend
rm -f package-lock.json
npm install --package-lock-only --ignore-scripts
```
- `--package-lock-only` → schreibt nur die Lockfile, baut kein `node_modules` neu (schneller, deterministischer).
- `--ignore-scripts` → keine postinstall-Skripte aus den neuen Deps.

Danach `git`-mäßig sichtbar nur **eine geänderte Datei**: `backend/package-lock.json`. Kein Code-Touch, keine Schemaänderung, kein Daten-Risiko.

## Verifikation vor Auslieferung

1. `grep -c "\"imapflow\":" backend/package-lock.json` → ≥ 1
2. `cd backend && npm ci --ignore-scripts` lokal grün → exakt das, was auf dem Pi laufen wird.
3. `bun run typecheck` weiterhin grün (sollte unberührt sein).

## Was NICHT angefasst wird

- Kein TypeScript-Code, keine Migration, kein UI, keine Daten in `/var/lib/mycleancenter/`.
- `bun.lock` bleibt wie es ist (zeigt schon korrekt auf imapflow@1.3.3 — Versionen werden zwischen npm und bun konsistent gehalten).

## Auf dem Pi danach

Der nächste „MCC-Update"-Lauf zieht den neuen Code inkl. neuer `package-lock.json`, `npm ci` läuft sauber durch, Migration `024_email_imap_archive.sql` greift, IMAP-Append in den Strato-Sent-Ordner geht live. Kein zusätzlicher Eingriff am Pi nötig.

## Lehre für künftige Backend-Deps

Nach jedem `bun add ...` im `backend/`-Ordner muss `npm install --package-lock-only --ignore-scripts` direkt hinterher laufen, sonst kippt der Pi-Updater wieder. Ich werde das ab jetzt automatisch zusammen erledigen.