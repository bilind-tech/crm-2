## Ziel

Zwei Verbesserungen rund um den Kunden-Detail-Bereich:

1. **Objekt-Schnellanlage** im Kundenkontext — nur Name eingeben.
2. **Ansprechpartner-Tab** voll funktional: anlegen, primären festlegen, löschen.

---

## 1. Objekt-Schnellanlage (nur Name)

**Datei:** `src/components/forms/ObjektForm.tsx`

Neuer Prop `kompakt?: boolean`. Wenn `true`, zeigt das Formular nur:
- **Bezeichnung *** (Pflicht)

Kunde-Select wird ausgeblendet (`defaultKundeId` ist gesetzt). Alle weiteren Felder (Typ, Adresse, m², Frequenz, Zugang, Reinigungstage) entfallen. Beim Speichern werden Defaults gesendet:
- `typ: "buero"`
- `frequenz: "auf_abruf"`
- `reinigungstage: []`
- `status: "aktiv"`

Vollform bleibt für QuickCreate / Objekt-Detail unverändert.

**Datei:** `src/routes/kunden.$id.tsx` (Zeile 358) — `<ObjektForm kompakt onClose={…} defaultKundeId={k.id} />`.

---

## 2. Ansprechpartner-Tab: Anlegen + Primär wechseln

**Neue Datei:** `src/components/kunden/AnsprechpartnerTab.tsx`

Funktionen:
- **Liste** aller Ansprechpartner mit Name, Position, E-Mail, Telefon und Primär-Badge.
- Pro Eintrag: Buttons **„Als primär"** (nur wenn nicht primär) und **„Löschen"** (mit Bestätigungs-Dialog).
- **„+ Neuer Ansprechpartner"** öffnet Inline-Formular mit:
  - Anrede (Herr / Frau / Divers / —)
  - Vorname, Nachname *
  - Position
  - E-Mail, Telefon
  - Checkbox „Als primären Ansprechpartner setzen" (auto-aktiv wenn noch keiner existiert)

**Logik:**
- Speichern → `useCreateAnsprechpartner`. Wenn primär: alle anderen via `useUpdateAnsprechpartner` auf `primaer: false`, neuen auf `primaer: true`.
- „Als primär setzen": gleiche Routine.
- „Löschen" → `useDeleteAnsprechpartner`. War der gelöschte primär und es gibt weitere → ersten Verbleibenden auf primär setzen.
- Toasts für jede Aktion.

**Datei:** `src/routes/kunden.$id.tsx` — Tab-Inhalt `ansprechpartner` (Zeile 165–187) durch `<AnsprechpartnerTab kundeId={k.id} liste={k.ansprechpartner} />` ersetzen.

---

## 3. Auto-Auswahl in Angebot/Rechnung

Keine Codeänderung nötig. Der `AnsprechpartnerPicker` wählt bereits den primären (oder ersten) Ansprechpartner automatisch — durch (2) ist sichergestellt, dass es immer einen primären gibt.

---

## Geänderte / neue Dateien

- `src/components/forms/ObjektForm.tsx` — `kompakt`-Prop
- `src/routes/kunden.$id.tsx` — `kompakt` durchreichen, Ansprechpartner-Tab ersetzen
- `src/components/kunden/AnsprechpartnerTab.tsx` — **neu**

---

## Hinweise

- Keine Sparkles / Deko-Icons. Standard `bg-background` / `bg-card`, kein Gradient.
- Alle benötigten Hooks (`useCreateAnsprechpartner`, `useUpdateAnsprechpartner`, `useDeleteAnsprechpartner`, `useCreateObjekt`) existieren — keine Backend-Änderung.
