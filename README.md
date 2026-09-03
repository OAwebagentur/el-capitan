# El Capitan – Next.js Clone

Pixel-genauer 1:1-Clone von [el-capitan.net](https://el-capitan.net/) (El Capitan Hotel – Hotel Restaurant Lounge) als Next.js-Projekt.

## Aufbau

- **`content/pages.json`** – die gespiegelten HTML-Dokumente je Route (`/`, `/datenschutz/`, `/impressum/`), byte-identisch zur Originalseite, nur Domain auf root-relativ umgeschrieben.
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

## Buchung und Kontakt

Gebucht wird **ausschliesslich ueber dirs21**
(`https://reservation.one.dirs21.de/el-capitan/result`). Alle Buchungs-Buttons
(Kopfzeile, Hero „Direkt buchen", Menuepunkt „Buchung", Hinweis ueber dem
Formular) zeigen dorthin; `/buchung` und `/buchung/*` sind 301-Weiterleitungen
in die Buchungsstrecke (`next.config.mjs`).

Die frühere Seite `/buchung/` mit eigenem Formular und ibelsa-Widget gibt es
nicht mehr. Das Formular im Kontaktbereich der Startseite ist seit dem
03.09.2026 eine **reine Kontaktanfrage** (Name, E-Mail, Telefon, Nachricht,
Datenschutz) — `public/kontakt-form.js` faengt es ab und schickt es an
`/api/buchung/` (Route-Name aus Kompatibilitaetsgruenden unveraendert).

## Angebotskacheln

`scripts/angebots-grafiken.mjs` baut die beiden Kacheln der Sektion „Unsere
aktuellen Angebote" nach `public/wp-content/uploads/2025/09/` (1024/768/300/150).
Motive sind die bisherigen Angebotsfotos; Kopffeld, Preissiegel und CTA werden
neu gesetzt und decken den alten, ins Bild gebrannten Text ab. sharp ist keine
Abhaengigkeit des Projekts, deshalb mit vorhandenem sharp aufrufen:

```bash
NODE_PATH=<pfad-zu-node_modules-mit-sharp> node scripts/angebots-grafiken.mjs
```
