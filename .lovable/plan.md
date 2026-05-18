## Diagnose

Der Fehler **"Importing a module script failed"** mit URL `/werkzeuge/uebergabeprotokoll` ist **kein Code-Bug in der Route selbst** — die Imports der Route (`UebergabeProtokollForm`, `useProtokolle`) und der frisch erstellten `ProtokollHtmlPreview` sind alle sauber, alle Abhängigkeiten existieren.

Es handelt sich um einen klassischen **Chunk-Load-Error**: der Browser hält noch die alte SPA-Shell und versucht, einen Code-Chunk (`uebergabeprotokoll-XYZ.js`) zu laden, dessen URL nach dem letzten Build/HMR nicht mehr existiert.

Beleg dafür in den Console-Logs:
```
[vite] failed to connect to websocket … localhost:8080
```
HMR ist down → der Tab bekommt keine Reload-Signale → beim ersten Lazy-Import einer Route schlägt das Script-Fetch fehl → TanStack Router zeigt `errorComponent`.

Ein einfaches **F5 / Hard-Reload behebt es sofort** — aber das ist keine echte Lösung, denn dasselbe passiert deinen Endnutzern nach jedem System-Update auf dem Pi: der Browser hängt am alten `index.html`, lädt einen alten Chunk-Namen, kein Reload → genau dieser Fehler.

## Plan: Chunk-Load-Errors robust auffangen

### 1. Globaler Chunk-Error-Handler (Auto-Reload)
- Datei: `src/lib/chunkErrorReload.ts` (neu)
- Globaler `window.addEventListener("error", …)` + `unhandledrejection`-Listener.
- Triggert genau bei diesen Signalen:
  - `error.message` enthält `Importing a module script failed`
  - oder `Failed to fetch dynamically imported module`
  - oder `ChunkLoadError`
- Verhalten:
  - Beim **ersten Auftreten** in einer Tab-Session: `sessionStorage`-Flag setzen + `location.reload()`. Damit wird die neue `index.html` geladen, die auf die aktuellen Chunk-Hashes verweist.
  - Beim **zweiten Auftreten** (Flag bereits gesetzt): nicht erneut reloaden, sondern Toast „Aktualisierung fehlgeschlagen — bitte Seite manuell neu laden". Vermeidet Endlos-Reload-Loops.
- In `src/router.tsx` oder `src/routes/__root.tsx` einmalig importieren.

### 2. Route-Error-Komponente verbessern
- `defaultErrorComponent` im Router so erweitern, dass bei Chunk-Fehlern direkt ein **prominenter "Neu laden"-Button** + automatischer Reload nach 1 s erscheint, statt der generischen Fehlerseite mit „Technische Details".
- Erkennung über dieselben Strings wie oben.

### 3. Service-Worker / Cache-Header
- Sicherstellen, dass das Pi-Backend `index.html` **immer mit `Cache-Control: no-store`** ausliefert (das ist die Datei, die auf die korrekten Chunk-Hashes verweist).
- Assets unter `/assets/*` (gehashte Dateinamen) bekommen weiterhin `immutable, max-age=31536000`.
- Falls aktuell anders konfiguriert: `backend/src/` Static-Serve-Setup prüfen und anpassen.

### 4. Sofort-Fix für aktuelle Sitzung
- Du machst einmalig im Browser **Strg+Shift+R** (Hard-Reload) auf der Preview, danach läuft `/werkzeuge/uebergabeprotokoll` wieder.

## Was NICHT geändert wird
- `ProtokollHtmlPreview` / `ProtokollEditorLayout` — sind in Ordnung, kein Auslöser.
- `werkzeuge.uebergabeprotokoll.tsx` — sauberer Code, sauberer Import.
- Keine Refactorings am Live-Editor in diesem Fix — das Flicker-/Live-Thema bleibt separates Topic.

## Technische Details (für später)

`src/lib/chunkErrorReload.ts` (Skizze):
```ts
const FLAG = "mcc.chunkReloadedOnce";
const isChunkError = (msg?: string) =>
  !!msg && (
    msg.includes("Importing a module script failed") ||
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("ChunkLoadError")
  );

export function installChunkErrorReload() {
  const handle = (msg?: string) => {
    if (!isChunkError(msg)) return;
    if (sessionStorage.getItem(FLAG)) return; // schon einmal versucht
    sessionStorage.setItem(FLAG, "1");
    location.reload();
  };
  window.addEventListener("error", (e) => handle(e.message));
  window.addEventListener("unhandledrejection", (e) =>
    handle(e.reason?.message ?? String(e.reason))
  );
}
```

Reload-Flag in `__root.tsx` einmal nach erfolgreichem Mount löschen, damit beim nächsten echten Chunk-Fehler wieder ein Reload passiert.