# Sidebar-Label „Sonstiges" + Protokolle automatisch als Dokument speichern

## 1. Sidebar: „Werkzeuge" → „Sonstiges"

**`src/components/layout/AppSidebar.tsx`** (Zeile 62) — nur das Label, Icon (`Wrench`) und Route (`/werkzeuge`) bleiben unverändert.

```ts
{ title: "Sonstiges", url: "/werkzeuge", icon: Wrench },
```

Routen, Hub-Seite und URL bleiben gleich, damit nichts kaputt geht (interne Links + Bookmarks bleiben gültig).

## 2. Protokolle landen automatisch in „Dokumente"

Heute werden PDFs aus „Übergabe-/Abnahmeprotokoll" und „Schlüsselübergabe" nur lokal heruntergeladen. Künftig wird zusätzlich ein Eintrag in der Dokumenten-Datenbank angelegt — mit Verknüpfung zu Kunde + Objekt und einem aussagekräftigen Titel/Dateinamen.

### Gemeinsamer Helfer

**Neu: `src/lib/dokumente/blobToDataUrl.ts`** — kleine Helper-Funktion, die ein PDF-Blob in eine `data:`-URL umwandelt (passt zum aktuellen Mock-Schema, wo `Dokument.url` eine Data-URL sein darf; im echten Pi-Backend wird der Mime-Type + Bytes vom Endpunkt entgegengenommen).

```ts
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
```

### Hook nutzen

In beiden Werkzeug-Routen wird `useCreateDokument()` aus `@/hooks/useApi` importiert und im erfolgreichen `handleErstellen`-Pfad zusätzlich zum Download aufgerufen.

**`src/routes/werkzeuge.uebergabeprotokoll.tsx`** — nach `downloadBlob(...)`:

```ts
await createDokument.mutateAsync({
  titel: `${artLabel(art)} – ${kundenAnzeige(kunde)} – ${formatDateDe(datum)}`,
  typ: "protokoll",
  kundeId: kunde.id,
  objektId: objekt?.id,
  dateiname: fname,
  mimeType: "application/pdf",
  groesseBytes: blob.size,
  url: await blobToDataUrl(blob),
  dokumentdatum: datum,
  steuerrelevant: false,
  hochgeladenAm: new Date().toISOString(),
  quelle: "upload",
});
toast.success("Im Bereich „Dokumente" gespeichert");
```

`artLabel` lokal: `uebergabe → "Übergabeprotokoll"`, `abnahme → "Abnahmeprotokoll"`, `beides → "Übergabe- & Abnahmeprotokoll"`.

**`src/routes/werkzeuge.schluesseluebergabe.tsx`** — analog mit Titel:

```
Schlüsselübergabe (Ausgabe|Rücknahme) – {Kundenname} – {Datum}
```

### Mock-Backend

`src/lib/mock/backend.ts` (Zeile 941ff `POST /dokumente`) akzeptiert bereits `Partial<Dokument>` und persistiert mit `persist()`. Keine Änderung nötig — die Einträge erscheinen sofort in `/dokumente` (Dokumente-Liste filtert nach Typ/Kunde/Objekt).

### Reihenfolge & Fehlerverhalten

- Erst PDF erzeugen, dann Download, dann Dokument-Eintrag — schlägt der Datenbank-Eintrag fehl, kommt eine Warnung (`toast.warning`), das PDF ist aber bereits beim User.
- Bei E-Mail-Variante (`PDF + per E-Mail senden`) gilt dasselbe Muster — kein automatischer Versand, nur Toast-Hinweis (Auto-Mail-Verbot bleibt unangetastet).

## 3. Effekt für den User

- Sidebar zeigt „Sonstiges" mit gleichem Schraubenschlüssel-Icon.
- Jedes erstellte Übergabe-/Abnahme- oder Schlüsselprotokoll erscheint anschließend automatisch unter **Dokumente** (Typ „protokoll") und beim jeweiligen Kunden im Tab „Belege" — sauber verknüpft mit Kunde und Objekt.

## Risiko

Klein. Keine Schema-Änderung, keine neuen Routen, kein Auto-Mail. Falls Speichern fehlschlägt, bleibt die bisherige Funktion (Download) erhalten.
