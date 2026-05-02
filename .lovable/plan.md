## Problem
Auf der Rechnungs-Detailseite steht in der Beträge-Box immer eine Zeile „Bezahlt: 0,00 €" — das wirkt, als sei die Rechnung schon bezahlt, obwohl noch nichts gezahlt wurde.

## Fix
`src/routes/rechnungen.$id.tsx` (Zeile 150):
- Zeile „Bezahlt" nur anzeigen, wenn tatsächlich etwas gezahlt wurde (`bezahlt > 0`).
- Label umbenennen zu **„Davon bezahlt"** — eindeutiger Bezug zum Brutto-Betrag darüber.

```tsx
{bezahlt > 0 && <Row label="Davon bezahlt" value={formatEUR(bezahlt)} />}
```

Die Zeile „Offen" bleibt immer sichtbar und zeigt den klaren Status.
