## Ziel
Sidebar-Eintrag „Stundenzettel" öffnet die externe App in neuem Tab statt eine interne Seite — mit einem ExternalLink-Pfeil ganz rechts.

## Änderungen

### `src/components/layout/AppSidebar.tsx`
- `NavItem`-Typ um optionales `external?: boolean` erweitern.
- Stundenzettel-Eintrag markieren: `{ title: "Stundenzettel", url: "/stundenzettel", icon: Clock, external: true }`.
- In `renderGroup` bei `item.external === true`:
  - Statt `<Link>` ein normales `<a>` rendern mit `href={url}`, `target="_blank"`, `rel="noopener noreferrer"`.
  - URL aus `useStundenzettelUrl()` (Backend-Wert). Wenn leer → auf `/stundenzettel` (interne Konfig-Seite) zurückfallen, damit der User die URL setzen kann.
  - Rechts (nach Title-`span`) `ExternalLink`-Icon (lucide) mit `ml-auto h-3.5 w-3.5 text-muted-foreground` einblenden, nur wenn `!collapsed`.
- `ExternalLink` zum Lucide-Import hinzufügen.
- Active-Highlight für externen Eintrag deaktivieren (immer `active = false`), da Tab-Wechsel.

### Keine weiteren Änderungen
- `src/routes/stundenzettel.tsx` bleibt bestehen als Fallback/Konfig (falls URL fehlt).
- Keine Backend-Änderungen.

## Verifikation
Build grün, in der Sidebar erscheint rechts neben „Stundenzettel" ein kleiner Pfeil; Klick öffnet die externe URL in neuem Tab; CRM bleibt auf aktueller Seite.