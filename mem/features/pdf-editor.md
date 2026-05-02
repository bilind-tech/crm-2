---
name: PDF-Editor (Live)
description: Eigene Route, links Live-Preview mit Click-to-Edit-Hotspots, rechts Tab-Editor, Autosave
type: feature
---

# PDF-Editor

## Routen (Frontend existiert)
- `/rechnungen/:id/bearbeiten`
- `/angebote/:id/bearbeiten`

## Layout
- **Links 60%:** Live-Preview im Sandbox-Iframe, lädt `GET /rechnungen/:id/preview` (HTML)
- **Rechts 40%:** Tab-Editor (Kopf, Positionen, Konditionen, Footer)
- **Click-to-Edit-Hotspots:** Klick auf Element in Preview → entsprechender Tab + Feld fokussiert

## Backend (Step 5)
- `GET /rechnungen/:id/preview` → HTML mit eingebetteten Daten + Template
- `GET /rechnungen/:id/pdf` → PDF (Puppeteer), Cache-Hit wenn `(docHash + templateVersion)` unverändert
- `PATCH /rechnungen/:id` → Autosave (debounced 800 ms im Frontend), invalidiert PDF-Cache
- Templates in `dokument_template` (typ, html, css, header_html, footer_html, version)

## WYSIWYG-Garantie
Preview und PDF rendern denselben HTML-String. Druck-CSS via `@media print` separat im Template.

## Mehrseiten-Verhalten
- `<tr>` mit `page-break-inside: avoid`
- Header/Footer als Puppeteer `headerTemplate` + `footerTemplate` → identisch auf jeder Seite
- Logo oben rechts in headerTemplate → erscheint auf jeder Seite
