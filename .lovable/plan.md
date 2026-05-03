Ich setze das jetzt als echten, durchgängigen Workflow um – nicht nur „PDF erstellen“, sondern eigene Seiten, Live-Editor, Druck/PDF und Dokumenten-Archivierung wie bei Angeboten/Rechnungen.

Wichtigste Ursache, die ich gefunden habe: Die Route-Dateien existieren zwar, aber `/protokolle` ist aktuell nur eine Blatt-Seite. Dadurch werden Unterseiten wie `/protokolle/:id` und `/protokolle/:id/bearbeiten` nicht sauber wie bei `/angebote/:id` und `/rechnungen/:id` als Kind-Routen gerendert. Angebote/Rechnungen haben dafür extra ein Layout mit `<Outlet />`; Protokolle noch nicht. Außerdem muss die Abschluss-/Dokumenten-Kette robuster werden.

Plan:

1. Protokoll-Routing reparieren
   - `src/routes/protokolle.tsx` wird wie `angebote.tsx`/`rechnungen.tsx` zu einer Layout-Route umgebaut.
   - Wenn die URL genau `/protokolle` ist, wird die Liste angezeigt.
   - Wenn die URL `/protokolle/:id` oder `/protokolle/:id/bearbeiten` ist, wird per `<Outlet />` die echte Detail- oder Editor-Seite gerendert.
   - Ergebnis: Klick auf ein Protokoll öffnet zuverlässig seine eigene Seite statt hängen zu bleiben.

2. Detailseite stabil machen
   - `src/routes/protokolle.$id.tsx` bleibt die eigene Detailseite, wird aber robuster aufgebaut:
     - saubere Ladeanzeige wie bei Angeboten/Rechnungen,
     - NotFound-Zustand bei gelöschten/ungültigen Protokollen,
     - PDF-Vorschau rechts,
     - Buttons: PDF herunterladen, Drucken, Bearbeiten, Abschließen,
     - bei abgeschlossenen Protokollen Hinweis/Link zum Dokumenten-Archiv.
   - Wenn das Protokoll abgeschlossen ist und `dokumentId` gesetzt ist, soll die Detailseite bevorzugt das archivierte Dokument verwenden bzw. klar anzeigen, dass diese Version gespeichert wurde.

3. Editor-Route zuverlässig als Kindseite öffnen
   - `/protokolle/:id/bearbeiten` wird als echte Unterseite der Protokoll-Detailroute angezeigt.
   - Zurück-Navigation wird konsistent:
     - Zurück zur Detailseite des Protokolls,
     - nicht nur pauschal zur Protokollliste.
   - Live-Preview links/rechts bleibt erhalten.

4. Erstellen wie Angebot/Rechnung angleichen
   - Nach dem Erstellen soll nicht mehr „irgendwo“ ein leerer Datensatz entstehen.
   - Ablauf:
     - Button „Übergabe“/„Schlüssel“ öffnet Formular.
     - Pflichtdaten werden geprüft.
     - Danach wird ein Entwurf gespeichert.
     - Danach öffnet sich direkt der Editor oder die Detailseite nach dem gleichen Muster wie bei Belegen.
   - Die `/angebote/neu` und `/rechnungen/neu` Platzhalter können optional ebenfalls auf die echten Formulare weitergeleitet/angepasst werden, damit der globale „+ Neu“-Button nicht auf Platzhalterseiten landet.

5. Dokumente-Archivierung vervollständigen
   - Beim Abschließen wird die PDF wirklich als Dokument gespeichert:
     - Typ `protokoll`,
     - Kunde/Objekt verknüpft,
     - Dateiname gesetzt,
     - `dokumentId` im Protokoll gespeichert,
     - Dokumentenliste wird invalidiert/aktualisiert.
   - Im Mock/Demo-Modus wird die PDF als Data-URL gespeichert.
   - Im Pi-Modus wird die PDF an `/protokolle/:id/abschliessen` übertragen, dort auf der SSD abgelegt und in der `dokumente`-Tabelle verknüpft.

6. Pi-Backend prüfen und nachziehen
   - Sicherstellen, dass `POST /protokolle/:id/abschliessen` wirklich funktioniert.
   - Sicherstellen, dass die `protokolle`-Routen im Backend registriert sind.
   - Sicherstellen, dass die Migration `022_protokolle.sql` kompatibel zur bestehenden Dokumenten-Tabelle ist.
   - Abschluss darf keine E-Mail auslösen. Nur Speichern/Archivieren/Drive-Upload.

7. Google-Drive-/Dokumentenfluss konsistent halten
   - Protokoll-PDFs sollen wie Dokumente automatisch in die bestehende Drive-Queue kommen, soweit das Dokumenten-System das bereits für Dokumente macht.
   - Keine manuelle Mail, kein automatischer Mailversand.
   - In der UI bleibt der Status dezent wie bei bestehenden Dokumenten/Drive-Anzeigen.

8. Fehlerursache „Lade … hängt“ beheben
   - Die Protokoll-Unterseiten dürfen nicht dauerhaft im globalen Router-Ladezustand bleiben.
   - Ich passe die Route-Struktur so an, dass der Router Kindrouten korrekt rendert.
   - Falls noch Backend-Health im Demo-Modus unnötig blockiert, wird das Status-Polling so entschärft, dass es die Seiten nicht am Öffnen hindert.

9. Qualitätssicherung nach Umsetzung
   - Ich teste im Preview:
     - `/protokolle` öffnet Liste.
     - Neues Übergabeprotokoll anlegen → Editor öffnet.
     - Speichern/Autosave funktioniert.
     - Detailseite `/protokolle/:id` öffnet.
     - PDF-Vorschau erscheint.
     - Drucken/PDF-Download funktioniert.
     - Abschließen erzeugt Dokument.
     - Dokument erscheint unter `/dokumente`.
     - Schlüsselübergabe läuft identisch.
   - Ich prüfe zusätzlich Browser-Konsole/Netzwerk auf Fehler.

Technische Kernänderung:

```text
/protokolle                 -> Liste
/protokolle/:id             -> eigene Detailseite mit PDF/Print/Dokumentstatus
/protokolle/:id/bearbeiten  -> Live-Editor + Preview
```

und `src/routes/protokolle.tsx` bekommt denselben Parent-/Outlet-Aufbau wie Angebote/Rechnungen, damit die Unterseiten wirklich gerendert werden.