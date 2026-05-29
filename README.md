# El Capitan – Next.js Clone

Pixel-genauer 1:1-Clone von [el-capitan.eu](https://el-capitan.eu/) (El Capitan Hotel – Hotel Restaurant Lounge) als Next.js-Projekt.

## Aufbau

- **`content/pages.json`** – die gespiegelten HTML-Dokumente je Route (`/`, `/buchung/`, `/datenschutz/`, `/impressum/`), byte-identisch zur Originalseite, nur Domain auf root-relativ umgeschrieben.
- **`public/`** – alle Original-Assets (CSS, JS, Bilder, Fonts) unter ihren Originalpfaden (`/wp-content/...`, `/wp-includes/...`).
- **`app/[[...slug]]/route.js`** – Catch-all-Route-Handler, der das passende Dokument ausliefert. Statische Assets aus `public/` werden davor von Next bedient.
- **`scripts/scrape.mjs`** – der Scraper, der den Mirror neu erzeugen kann (`npm run scrape`).

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # Produktionsbuild
npm start
```

## Deployment

Über GitHub mit Vercel verbunden – jeder Push auf `main` löst ein Deployment aus.
