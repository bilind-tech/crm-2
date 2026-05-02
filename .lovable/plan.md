## Problem

1. **Mobile**: Tippt man auf dem Handy auf das „+"-Schnellaktions-Menü → „Neuer Kunde", landet man auf der Route `/kunden/neu`. Diese Route ist eine separate, stark abgespeckte Seite (`src/routes/kunden.neu.tsx`) — sie zeigt nur Stammdaten und hat **weder Kürzel-Feld noch Dauerauftrag-Konfiguration**. Auf dem Desktop wird stattdessen die volle `KundeForm` in einem SlideOver geöffnet (mit Tabs, Kürzel, Vorschau usw.). Dadurch ist auf dem Handy gar kein Dauerauftrag beim Kunden anlegbar.

2. **Kürzel-Eindeutigkeit**: An keiner Stelle (Backend, KundeForm, KundeBearbeitenDialog) wird geprüft, ob ein Kürzel bereits von einem anderen Kunden verwendet wird. Doppelte Kürzel sind heute möglich und führen zu kollidierenden Belegnummern.

3. **Konzept-Klärung „Dauerauftrag beim Kunden"**: Ein `Dauerauftrag` ist im Datenmodell ein eigenes Objekt mit `kundeId`, Positionen, Stichtag usw. — also nicht ein Boolean am Kunden. „Dauerauftrag direkt beim Kunden anlegen" bedeutet: nach dem Anlegen des Kunden direkt einen `Dauerauftrag` für diesen Kunden mit-anlegen können (Frequenz, Stichtag, Bezeichnung, optional erste Position). Das spart den Umweg „Kunde anlegen → in Dauerauftragsliste wechseln → neu anlegen".

## Lösung

### A) Mobile-Routen-Bug beheben

`src/routes/kunden.neu.tsx` durch eine Wrapper-Route ersetzen, die genau dieselbe `KundeForm` rendert wie der Desktop-SlideOver (volle Tabs inklusive zukünftigem Dauerauftrag-Tab). Damit ist der Mobile-Flow identisch zum Desktop.

- Statt einer eigenen mini-Card: zentrierter Container, oben Header „Neuer Kunde", darunter `<KundeForm onClose={() => navigate({ to: "/kunden" })} />`.
- `QuickCreate` bleibt auf `/kunden/neu` — die Route führt jetzt einfach zur vollen Form.

### B) Kürzel-Eindeutigkeit erzwingen

Drei Schichten, damit es nirgends durchrutscht:

1. **Backend (`src/lib/mock/backend.ts`)**
   - Hilfsfunktion `kuerzelExistiert(kuerzel: string, exceptId?: string): boolean` (case-insensitive, getrimmt).
   - In `POST /kunden`: Wenn `k.kuerzel` gesetzt → prüfen, bei Konflikt `throw new ApiError("Kürzel «XYZ» wird bereits von Kunde {nummer} ({name}) verwendet.", 409)`.
   - In `PATCH /kunden/:id`: gleiche Prüfung mit `exceptId = id`.
   - Neuer Endpoint `GET /kunden/kuerzel-frei?kuerzel=XYZ&exceptId=…` → `{ frei: boolean, kunde?: { id, nummer, name } }` für Live-Validierung in der UI.

2. **Hook (`src/hooks/useApi.ts`)**
   - Neuer Hook `useKuerzelFrei(kuerzel: string, exceptId?: string)` mit Debounce (z. B. 300 ms), aktiviert sobald Kürzel ≥ 3 Zeichen hat.

3. **UI (`KundeForm` und `KundeBearbeitenDialog`)**
   - Live-Hinweis unter dem Kürzel-Feld: grün „✓ Kürzel frei" oder rot „✗ Bereits vergeben an {Kunde}".
   - Submit-Button ist disabled, solange ein Konflikt sichtbar ist.
   - Toast-Fallback, falls der Server beim Speichern doch 409 zurückgibt (Race Condition).

### C) Dauerauftrag direkt im Kunden-Anlageflow

In `KundeForm` einen neuen Tab **„Dauerauftrag (optional)"** hinzufügen — sowohl auf Desktop als auch Mobile (gleiche Form-Komponente, daher beides automatisch).

Inhalt des Tabs:
- Schalter „Dauerauftrag für diesen Kunden anlegen" (default aus).
- Wenn an:
  - Bezeichnung (z. B. „Monatliche Unterhaltsreinigung")
  - Frequenz (monatlich / quartalsweise / halbjährlich / jährlich) — `DauerauftragFrequenz`
  - Stichtag (Monatstag 1–28 oder „Letzter des Monats")
  - Laufzeit-Beginn (default: heute)
  - Modus (Entwurf / Vollautomatisch) — default aus DA-Einstellungen
  - Optional: erste Position (Bezeichnung + Menge + Einzelpreis), darf leer bleiben
  - Hinweis: „Positionen kannst du später ergänzen."

Im `submit()`:
1. Erst `useCreateKunde` → erhaltene `kunde.id` merken.
2. Wenn Dauerauftrag-Schalter aktiv → `useCreateDauerauftrag` mit `kundeId: kunde.id` + den Tab-Feldern aufrufen.
3. Toasts kombinieren („Kunde + Dauerauftrag angelegt"), Navigation wie bisher zur Kunden-Detailseite.
4. Fehlerfall: Wenn Kunde angelegt wurde, der Dauerauftrag aber scheitert → Kunde bleibt bestehen, Toast „Kunde angelegt, Dauerauftrag konnte nicht angelegt werden" + Link zur Dauerauftragsliste.

### D) Memory-Update

Eine neue Memory-Datei `mem://features/kuerzel-eindeutigkeit` mit der Regel: „Kunden-Kürzel sind systemweit eindeutig (case-insensitive). Backend lehnt Duplikate mit 409 ab. UI prüft live und blockiert Submit." → in `mem://index.md` referenzieren.

## Betroffene Dateien

- `src/routes/kunden.neu.tsx` — komplett ersetzen durch Wrapper für `KundeForm`.
- `src/components/forms/KundeForm.tsx` — neuer Tab „Dauerauftrag", Live-Kürzel-Validierung, erweiterter `submit()`.
- `src/components/forms/KundeBearbeitenDialog.tsx` — Live-Kürzel-Validierung.
- `src/lib/mock/backend.ts` — Eindeutigkeitsprüfung in POST/PATCH `/kunden`, neuer GET `/kunden/kuerzel-frei`.
- `src/hooks/useApi.ts` — neuer Hook `useKuerzelFrei`.
- `mem://features/kuerzel-eindeutigkeit` (neu) + `mem://index.md` (Eintrag hinzufügen).

## Ergebnis

- Auf dem Handy öffnet „+ Neuer Kunde" jetzt das volle Formular inkl. Kürzel, Vorschau-Belegnummer und Dauerauftrag-Tab — identisch zur Desktop-Version.
- Beim Anlegen oder Bearbeiten kann ein Kürzel niemals doppelt vergeben werden: Live-Hinweis im Feld + harter Backend-Block (409).
- Wer beim Kunden-Anlegen direkt einen monatlichen Dauerauftrag mit-anlegen will, macht das in einem Schritt; das System legt Kunde und Dauerauftrag in einem Submit an.
