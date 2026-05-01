Ich habe die Ursache gefunden: Die URL ändert sich, aber die Detailseite kann nicht sichtbar werden, weil die Listen-Routen (`/kunden`, `/angebote`, `/rechnungen`, `/objekte`) aktuell ihre Unterseiten (`/$id`) nicht per `<Outlet />` ausgeben. Deshalb bleibt optisch die Liste stehen. Zusätzlich ist das Senden-Icon in der Angebotsliste nur ein Link zur Detailseite statt ein Button, der direkt das E-Mail-Fenster öffnet.

Plan zur Reparatur:

1. Detailseiten wirklich anzeigen lassen
   - `src/routes/kunden.tsx`, `src/routes/angebote.tsx`, `src/routes/rechnungen.tsx`, `src/routes/objekte.tsx` so umbauen wie bereits bei `dauerauftraege.tsx`:
     - Wenn Pfad exakt `/kunden` ist: Liste anzeigen.
     - Wenn Pfad `/kunden/:id` ist: `<Outlet />` anzeigen.
   - Dasselbe für Angebote, Rechnungen und Objekte.
   - Ergebnis: Klick auf Kunde/Angebot/Rechnung/Objekt öffnet sichtbar die Detailseite, nicht nur eine andere URL.

2. Senden-Icon muss direkt ein Fenster öffnen
   - In der Angebotsliste das Senden-Icon von `<Link>` auf einen echten Button ändern.
   - Beim Klick:
     - Tabellenzeilen-Navigation stoppen,
     - URL nicht ändern,
     - `EmailVersandDialog` sofort öffnen.
   - Dafür wird das gewählte Angebot in State gespeichert und der Dialog direkt auf der Liste gerendert.

3. Rechnungen ebenfalls sauber machen
   - In der Rechnungsliste ebenfalls eine direkte E-Mail-Senden-Aktion ergänzen bzw. vereinheitlichen, damit Rechnungen genauso funktionieren.
   - Klick auf Senden öffnet das E-Mail-Fenster direkt, kein Umweg über Detailseite.

4. PDF/Kunde für den Dialog laden
   - Für das gewählte Angebot/Rechnung den passenden Kunden laden.
   - PDF-Blob wie in der Detailseite über `useAngebotPdf` bzw. `useRechnungPdf` erzeugen und an `EmailVersandDialog` übergeben.
   - Falls die PDF noch lädt, öffnet der Dialog trotzdem; der Versand kann weiterhin mit Anhang-Info arbeiten wie bisher.

5. Klick-Verhalten absichern
   - Aktionen in Tabellen und Mobile-Karten bekommen überall `stopPropagation()`/`preventDefault()`, damit ein Icon-Klick nie versehentlich die Zeile navigiert.
   - Row-Klick bleibt weiterhin Detail-Navigation.
   - Senden-Icon bleibt Senden-Fenster.
   - PDF-Icon bleibt PDF-Vorschau.
   - Löschen bleibt Löschdialog.

6. Kurz im Browser prüfen
   - Klick auf Kunde in Liste: Detailseite sichtbar.
   - Klick auf Angebot in Liste: Detailseite sichtbar.
   - Klick auf Senden-Icon in Angebotsliste: E-Mail-Fenster öffnet sofort, URL bleibt gleich.
   - Klick auf Senden-Icon in Rechnungsliste: E-Mail-Fenster öffnet sofort.
   - Keine störende Navigation beim Klick auf Icons.