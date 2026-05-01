## Ziel

1. Der "Vom Handy scannen"-Dialog ist auf dem PC kaputt (Inhalt wird oben/unten abgeschnitten, sieht "geklatscht" aus).
2. Alle primären Action-Buttons (Desktop + Mobile-Upload-Seite) sollen den gleichen blauen Premium-Stil wie der "+ Neu"-Button bekommen.
3. Auf der Handy-Upload-Seite (`/m/upload/$session`) soll man neben "Foto aufnehmen" auch **Bilder/PDFs aus der Mediathek/Dateien** hochladen können — funktional auch auf dem Raspberry-Pi-LAN.

---

## 1. HandyScanDialog reparieren (`src/components/dokumente/HandyScanDialog.tsx`)

Problem auf dem Screenshot: der Dialog-Content rendert ohne Scroll und ohne Höhenbegrenzung — Header und Footer werden vom Viewport abgeschnitten, die QR-Karte hängt halb ins Leere.

Fix:
- `DialogContent` mit `max-h-[90vh] flex flex-col` und der innere Bereich `flex-1 overflow-y-auto`.
- QR-Karte etwas kleiner (`size={220}`) und gleichmäßige Innen-Paddings, damit der Dialog auf 1080p sauber zentriert ist.
- "Sitzung beenden" als richtigen `<Button variant="outline">` und in einem klar abgesetzten Footer (`border-t … pt-3`).

## 2. Einheitlicher Premium-Blue-Button-Stil

Wir nutzen den existierenden `PrimaryAction` aus `src/components/layout/PrimaryAction.tsx` (genau das blaue Gradient des "+ Neu"-Buttons) und führen einen kleinen Bruder ein.

- **Neue Variante** `PrimaryAction` akzeptiert optional `variant?: "solid" | "soft"` und `size?: "md" | "lg"` für die Mobile-Vollbreite-Variante (gleiche blaue Optik, nur größer + `w-full justify-center`).
- Verwenden:
  - **`src/routes/dokumente.tsx`**: "Vom Handy scannen" und "Dokument hochladen" werden beide `PrimaryAction`-Instanzen (gleicher Stil, "Vom Handy scannen" mit Icon `Smartphone`).
  - **`src/components/dokumente/DokumentUploader.tsx`** (compact-Branch): Button durch `PrimaryAction` ersetzen.
  - **`src/routes/m.upload.$session.tsx`**: "Foto aufnehmen", "Aus Galerie/Dateien wählen" und "Alle hochladen" benutzen die gleiche blaue Optik (`size="lg"`, full-width). "Alle hochladen" bekommt eine leicht abgesetzte Erfolgs-Variante (Häkchen-Icon) — bleibt aber im selben blauen Spektrum.

So entsteht visuelle Konsistenz vom Desktop-Header bis hin zur Handy-Seite.

## 3. Handy-Upload erweitern (`src/routes/m.upload.$session.tsx`)

Bisher: nur ein `<input capture="environment">` → öffnet zwingend die Kamera.

Neu: **zwei** versteckte Inputs + zwei sichtbare Buttons:

```text
┌────────────────────────────────┐
│  [📷  Foto aufnehmen]          │  → input#camera (capture="environment", accept="image/*")
│  [🖼  Aus Galerie / Dateien]   │  → input#picker  (accept="image/*,application/pdf", multiple, KEIN capture)
└────────────────────────────────┘
```

- Beim Klick auf "Aus Galerie / Dateien" öffnet iOS/Android den nativen File-Picker (Fotos, Dateien, iCloud, Drive, Downloads…).
- Verarbeitung in derselben `onCapture`-Logik, aber:
  - PDFs werden **nicht** komprimiert; `fileToDataUrl` direkt nutzen.
  - `mimeType` aus `file.type` übernehmen (`image/jpeg`, `image/png`, `application/pdf` …).
  - `typ`: `dokumentTypAusMime(file.type)` aus `lib/dokument/upload.ts` (`bild` / `rechnung` / `sonstiges`).
  - Vorschau-Grid: PDFs zeigen ein `FileText`-Icon + Dateiname statt `<img>`.
  - Größenlimit `MAX_BYTES` (20 MB) anwenden, ansonsten Toast-Fehler pro Datei.
- "Noch ein Foto" wird zu zwei kontextuellen Buttons (Kamera + Galerie), die immer beide sichtbar bleiben.

## 4. Raspberry-Pi-Kompatibilität

Es ändert sich nichts an der Transport-Schicht:
- Upload geht weiterhin über `useUploadDateienToSession(token)` → das ist bereits dieselbe Mock-/Backend-API, die der Pi später bedient.
- Die Erweiterung ist rein client-seitig (zusätzlicher File-Input, Mime-/Größen-Handling). Kein neuer Endpoint nötig.
- Zur Sicherheit prüfen wir in `useUploadDateienToSession`/`backend.ts`, dass ein Eintrag mit beliebigem `mimeType` (insb. `application/pdf`) korrekt gespeichert wird — falls dort bisher hardcoded `image/jpeg` angenommen wird, wird das angepasst.

## Geänderte Dateien

- `src/components/dokumente/HandyScanDialog.tsx` — Layout-Fix, scrollbarer Content, neuer Footer.
- `src/components/layout/PrimaryAction.tsx` — `size` + optional `w-full`-Support.
- `src/components/dokumente/DokumentUploader.tsx` — compact-Button auf `PrimaryAction` umstellen.
- `src/routes/dokumente.tsx` — beide Header-Buttons als `PrimaryAction`.
- `src/routes/m.upload.$session.tsx` — zweiter File-Input (Galerie/Dateien), PDF-Support, neue Button-Optik, PDF-Vorschau.
- ggf. `src/lib/mock/backend.ts` / `src/hooks/useApi.ts` — Mime-Type-Pass-Through für Session-Upload prüfen.

## Akzeptanzkriterien

- Auf Desktop @1920×1080 ist der "Vom Handy scannen"-Dialog vollständig sichtbar, vertikal zentriert, mit klarem Header/Inhalt/Footer.
- Alle primären Buttons auf der Dokumente-Seite und auf der Mobile-Upload-Seite haben dieselbe blaue Premium-Optik wie der "+ Neu"-Button.
- Auf dem Handy: zwei Buttons — "Foto aufnehmen" (Kamera) und "Aus Galerie / Dateien" (öffnet nativen Picker, akzeptiert Bilder + PDF, mehrere Dateien).
- Hochgeladene PDFs erscheinen in der Vorschau-Liste mit Datei-Icon und werden mit korrektem Mime-Type an die Session übertragen.
