## Problem

Im `EmailVersandDialog` ist beim Öffnen der Tab „Visuell" aktiv, aber das contentEditable-Feld ist leer. Erst nach Wechsel auf „HTML" und zurück erscheint der Inhalt.

## Ursache

Der Sync-Effect in `src/components/email/EmailVersandDialog.tsx` (Zeile 220–229) hängt nur an `mode`:

- Beim Öffnen wird `setMode("visuell")` aufgerufen, der Mode ist aber bereits `"visuell"` → Effect feuert nicht.
- Das contentEditable-Div wird erst nach dem ersten Render gemountet, danach wird `bodyHtml` via `setBodyHtml(standardVorlage.koerperHtml)` gesetzt — aber der Effect läuft nicht erneut, weil `bodyHtml`/`open` nicht in den Dependencies stehen.
- Beim Tab-Wechsel auf „HTML" und zurück ändert sich `mode` → Effect läuft → `innerHTML` wird gesetzt.

## Fix

Eine gezielte Änderung in `src/components/email/EmailVersandDialog.tsx`:

Dependencies des Sync-Effects um `open`, `bodyHtml` und `ctx` erweitern, damit das contentEditable-Div auch beim initialen Öffnen und nach Vorlagenwechsel befüllt wird. Die bestehende `innerHTML !== aufgeloest` Guard verhindert, dass die Caret-Position beim Tippen springt (User-Eingaben werden in `bodyHtml` gespiegelt → resultierendes `innerHTML` ist identisch → kein Re-Write).

```ts
useEffect(() => {
  if (mode !== "visuell") return;
  if (!visuellRef.current) return;
  const aufgeloest = replacePlaceholders(bodyHtml, ctx);
  if (visuellRef.current.innerHTML !== aufgeloest) {
    visuellRef.current.innerHTML = aufgeloest;
  }
}, [mode, open, bodyHtml, ctx]);
```

## Out of Scope

Keine Änderung an Backend, Vorlagen-Logik, Placeholder-Resolver oder am HTML-/Vorschau-Tab.
