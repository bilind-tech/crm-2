## Ziel
Der Hinweis „Stundenzettel-App verbietet das Einbetten“ soll im CRM nicht mehr fälschlich auftauchen, wenn die andere App eigentlich schon angepasst wurde.

## Ursache
Im CRM wird dieser Fehler aktuell nicht wirklich anhand der Header geprüft. Die Seite wartet 6 Sekunden auf `iframe.onLoad`; wenn das Event bis dahin nicht gekommen ist, zeigt sie automatisch die Meldung „verbietet das Einbetten“. Das kann falsch sein, z. B. bei langsamem Laden, Login-Screen, Cache, mDNS/IP-Wechsel oder wenn der Browser das `onLoad` anders behandelt.

## Plan

1. **Falsche Timeout-Fehlermeldung entfernen**
   - In `src/routes/stundenzettel.tsx` die Logik `headerBlocked` entfernen.
   - Die Meldung „Stundenzettel-App verbietet das Einbetten“ nicht mehr automatisch nach 6 Sekunden anzeigen.
   - Das iframe bleibt sichtbar, statt von der Fehlermeldung überdeckt zu werden.

2. **Neutralen Ladezustand statt harter Fehleranzeige einbauen**
   - Beim Wechsel/Reload der Stundenzettel-URL kurz „Stundenzettel wird geladen …“ anzeigen.
   - Wenn es länger dauert, keine Blocker-Diagnose behaupten, sondern nur dezent: „Falls die Ansicht leer bleibt, im neuen Tab öffnen.“
   - Der Button „In neuem Tab“ bleibt bestehen.

3. **Optionalen Diagnose-Hinweis sachlicher machen**
   - Falls weiterhin ein Hinweis nötig ist, nicht mehr behaupten „Header verbietet Einbetten“.
   - Stattdessen neutral formulieren: „Die eingebettete Ansicht konnte nicht bestätigt werden.“
   - Damit verschwindet genau der aktuelle falsche Fehlertext dauerhaft.

4. **Empfohlene Ziel-Konfiguration korrigieren**
   - In Texten/Checks nicht nur `http://mycleancenter.local` nennen, sondern auch den echten CRM-Origin mit Port berücksichtigen, z. B.:
     - `http://mycleancenter-pi.local:8787`
     - `http://mycleancenter.local:8787`
     - optional die lokale IP mit `:8787`
   - Hintergrund: `frame-ancestors` muss exakt die einbettende Origin erlauben; ohne Port kann es trotz „Fix“ weiterhin blockieren.

5. **Pi-Update-tauglich lassen**
   - Änderungen landen im normalen CRM-Code und werden beim nächsten CRM-Update/Setup auf den Pi übernommen.
   - Keine Änderung am Datenordner, keine Änderung an Stundenzettel-Daten, kein Cloud-Backend.

## Erwartetes Ergebnis
Die Stundenzettel-Seite im CRM zeigt nicht mehr automatisch diese falsche Header-Fehlermeldung. Entweder lädt die App im iframe, oder der Nutzer bekommt nur eine neutrale Lade-/Fallback-Option zum Öffnen im neuen Tab.