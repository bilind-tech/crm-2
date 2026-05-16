## Was wirklich passiert

Du greifst per SSH-Tunnel als `http://localhost:8787` auf den Pi zu. Der Pi liefert dort den **echten** Production-Build aus — also nicht der Lovable-Vorschau-Mock. Trotzdem aktiviert das Frontend bei dir den lokalen Vorschau-Mock, weil `isLocalPreviewFallbackAllowed()` in `src/lib/api/backendUrl.ts` schon dann `true` zurückgibt, wenn der Hostname „localhost" lautet — **ohne** zu prüfen, ob es ein PROD-Build ist.

Daraus folgt diese Kettenreaktion:

1. Beim Seitenstart setzt `refreshMe()` in `src/lib/auth.tsx` (Zeile 59) den User stillschweigend auf `{ id: "preview-user" }` und Modus auf `logged-in` — **ohne** dass eine echte Login-Session am Pi existiert.
2. `GET /einstellungen/google-drive` wird vom Mock beantwortet (`previewGoogleDrive`), also siehst du eine schöne, scheinbar funktionierende Drive-Seite.
3. Sobald du auf **„Mit Google verbinden"** klickst, geht das `PATCH /einstellungen/google-drive` (zum Speichern von Client-ID/Secret) **nicht** durch den Mock — `localPreviewMutate` kennt diesen Pfad nicht und gibt `null` zurück. Der echte Request läuft, der Pi prüft die Session, findet keine — und antwortet `401 unauthenticated`.

Das ist exakt der rote Toast, den du siehst. Google war nie beteiligt. Deine Client-ID, das Secret und der Web-Application-Typ sind alle korrekt.

## Fix

Genau eine Datei wird geändert: `src/lib/api/backendUrl.ts`.

In `isLocalPreviewFallbackAllowed()` ganz am Anfang ergänzen, dass Production-Builds **niemals** den Mock-Fallback verwenden — selbst wenn der Hostname zufällig `localhost` ist (Pi via Tunnel). Der Mock bleibt weiterhin aktiv für:

- die Lovable-Vorschau (`*.lovable.app`, `*.lovableproject.com`)
- den Dev-Server (`bun run dev` lokal am Entwickler-Rechner)

```ts
export function isLocalPreviewFallbackAllowed(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  // Lovable-Preview/Published — immer Mock.
  if (host.endsWith(".lovableproject.com") || host.endsWith(".lovable.app")) return true;
  // PROD-Build (vom Pi ausgeliefert) NIE mocken — auch nicht via localhost-Tunnel.
  if (import.meta.env.PROD) return false;
  // Dev-Server am Entwickler-Rechner darf weiter mocken.
  const fromEnv = (import.meta.env.VITE_API_BASE_URL ?? "").toString().trim();
  if (fromEnv) return false;
  return import.meta.env.DEV || host === "localhost" || host === "127.0.0.1";
}
```

Mehr ist nicht nötig — `refreshMe()` und der piClient verzweigen automatisch in den richtigen Pfad, sobald die Funktion `false` zurückgibt:

- `/auth/me` wird tatsächlich angefragt → 401 → LockScreen erscheint → du gibst dein Pi-Passwort ein → echte Session-Cookie steht.
- Danach geht **„Mit Google verbinden"** wie geplant: PATCH speichert ID/Secret, POST `/connect` liefert die `authorizeUrl`, du landest bei Google, bestätigst, kommst zurück, und Drive zeigt „verbunden".

## Nach dem Deploy — was du tun musst

1. Neuen Pi-Build hochladen (Update-Mechanismus wie bisher).
2. Tunnel öffnen: `ssh -L 8787:localhost:8787 pi@…`
3. Browser: `http://localhost:8787` öffnen → **LockScreen erscheint** (anders als vorher).
4. Pi-Passwort eingeben → Einstellungen → Google Drive → Verbinden klicken → Google-Login → fertig.
5. In der Google Cloud Console im OAuth-Client unter **Authorized redirect URIs** muss exakt `http://localhost:8787/einstellungen/google-drive/callback` stehen (nichts anderes, keinen Trailing-Slash).

## Zur Frage „nur Client-ID ohne Secret"

Geht für deinen Anwendungsfall nicht. Das andere Programm hat den Browser-Token-Flow (Google Identity Services) genutzt — der liefert nur ein 1-Stunden-Access-Token und **kein** Refresh-Token. Der Pi muss aber jederzeit selbständig PDFs hochladen, auch wenn dein Browser zu ist. Dafür braucht der Server zwingend einen Refresh-Token, und Google gibt den nur raus, wenn der Code-Tausch **mit Client-Secret** läuft. Das Secret bleibt sicher: es liegt AES-GCM-verschlüsselt im SQLite-Setting auf dem Pi und wird nie ans Frontend zurückgegeben.

## Scope

- Eine einzige Code-Änderung in `src/lib/api/backendUrl.ts`.
- Kein Backend-Code, kein Daten-Verzeichnis, keine Migrationen, keine Mails.
- Verhalten in Lovable-Preview bleibt 1:1 wie vorher.
