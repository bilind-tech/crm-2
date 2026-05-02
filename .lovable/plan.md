## Warum „Einbettung blockiert" gerade erscheint

Die Meldung ist **technisch korrekt, aber unspezifisch** und führt in die Irre. Es gibt drei mögliche Ursachen — und nur eine davon kannst du in der Stundenzettel-App selbst beheben:

1. **Du bist gerade in der Lovable-Cloud-Vorschau** (`*.lovable.app`).
   Eine LAN-Adresse wie `http://mycleancenter.local:4001` ist von dort **technisch nicht erreichbar** — sie liegt in deinem Heim-Netz, der Cloud-Browser sitzt im Internet. Das hat nichts mit iframes zu tun. **Sobald das CRM auf dem Pi läuft, ist diese Hürde automatisch weg.**

2. **Mixed Content**: Die Vorschau läuft über `https://`, deine Stundenzettel-App über `http://`. Browser blockieren das. Auf dem Pi laufen später beide unter derselben `http://`-Origin — auch das löst sich von selbst.

3. **Echte Header-Blockade**: Die Stundenzettel-App sendet `X-Frame-Options: DENY` oder eine restriktive CSP. **Nur das** muss in der Stundenzettel-App selbst gefixt werden.

Es gibt **keine Möglichkeit**, diese Browser-Sicherheitsregeln im CRM zu umgehen — das wäre eine Schwachstelle und Browser lassen es nicht zu.

## Was ich ändere

**`src/routes/stundenzettel.tsx`** — komplette Neuschreibung der Hindernis-Logik:

- Vor dem Mount des iframes wird das Umfeld analysiert: aktuelle Origin (`https?:`, `*.lovable.app`?), Ziel-URL (LAN-Host? `http:`?).
- Bei erkennbarer Hürde (Fall 1 oder 2) erscheint **sofort** die richtige Erklärung statt 6 s zu warten und „Einbettung blockiert" zu zeigen.
- Bei Fall 1 („LAN aus Cloud") steht klar: „Funktioniert erst auf dem Pi — die Adresse bleibt gespeichert, sobald das CRM dort läuft, ist alles gut." Plus Button „In neuem Tab" für jetzt.
- Bei Fall 2 („Mixed Content") wird die Lösung erklärt (HTTPS für die App oder beide über dieselbe Origin auf dem Pi).
- Nur wenn das Umfeld ok ist, wird der iframe gemountet. Schlägt der Load fehl (Timeout 6 s ohne `onload`), zeigt die Seite Fall 3 mit konkretem Beispiel-Header für die Stundenzettel-App:
  ```
  Content-Security-Policy: frame-ancestors 'self' http://mycleancenter.local
  ```
  und dem Hinweis, kein `X-Frame-Options: DENY` zu setzen.

Damit weißt du **auf einen Blick**, ob es an deinem Setup liegt (jetzt, nicht behebbar bis zur Pi-Inbetriebnahme) oder an der Stundenzettel-App (jetzt fixbar mit einem Header).

**Memory** `mem://features/stundenzettel-iframe.md` ergänze ich, damit ich diese drei Fälle nicht jedes Mal neu erkläre.

## Was sich nicht ändert

- Die URL bleibt in den Einstellungen gespeichert.
- Der Button „In neuem Tab" bleibt überall verfügbar — das ist die saubere Notlösung in der Cloud-Preview.
- Auf dem Pi später: keine UI-Änderung nötig, nur korrekter CSP-Header in der Stundenzettel-App und alles läuft eingebettet.

## Wenn du jetzt schon eine Lösung „eingebettet in der Cloud-Preview" willst

Das geht nur, wenn die Stundenzettel-App **öffentlich über HTTPS** erreichbar ist (z. B. via Cloudflare-Tunnel von deinem Pi nach außen) **und** sie `frame-ancestors` für die Lovable-Domain erlaubt. Sag Bescheid, dann ergänze ich eine Anleitung dafür — aber das ist Aufwand für eine reine Vorschau-Komfortfunktion. Auf dem produktiven Pi-Setup brauchst du das nicht.
