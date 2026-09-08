# PROGRESS.md — el-capitan

Neueste Eintraege zuerst.

## 2026-09-08 — Angebotskacheln klickbar, dirs21-Termin vorbelegt, deployed

Nachtrag von onur: Meta-Pixel bleibt wie gebrieft auf el-capitan.net (misst
den Klick, bevor der Besucher zu dirs21 wechselt — dort gibt es ohnehin
keinen Zugang, nichts angefasst). Neu: die beiden Angebotsbilder waren reine
`<img>` ohne Link — ein Angebot wirbt, niemand kann draufklicken.

| Punkt | Stand |
|---|---|
| Befund | Beide Bilder in "Unsere aktuellen Angebote" (Halloween + Übernachtung/Pool) waren unverlinkte `<img>`, bestaetigt onurs Verdacht. |
| Umsetzung | `public/angebotskachel-buchen.js` (neu, laeuft wie kontakt-form.js/oa-tracking.js) — packt jedes Bild in `img[src*="-angebot-capitan-1x1"]` in einen Link zu dirs21 (`target="_blank" rel="noopener"`) und setzt direkt darunter einen sichtbaren "Jetzt buchen"-Button. `content/pages.json` (byte-genauer Mirror) bleibt unangetastet — Entscheidung wie von onur bevorzugt: ein Eingriff, an einer Stelle, uebersteht `npm run scrape`. |
| Einbindung | `app/[[...slug]]/route.js` haengt das Skript nur auf Seiten mit Angebotskacheln ein (Marker `-angebot-capitan-1x1` im HTML). |
| Tracking | Beide neuen Links (Bild + Button) tragen dieselbe dirs21-Adresse wie die uebrigen Buchungs-Buttons — `public/buchungsklick-tracking.js` greift automatisch mit (Klick-Listener ist auf `a[href*="reservation.one.dirs21.de"]` delegiert, unabhaengig davon, ob der Link beim Laden schon da war). Verifiziert: Klick auf Bild UND Button loesen je `InitiateCheckout`/`begin_checkout` aus. |
| dirs21-Parameter | **Geprueft, funktioniert:** dirs21 nimmt `range=<check-in>,<check-out>` und `los=<naechte>` als URL-Parameter an und belegt Check-in/Check-out im Buchungswidget direkt vor — keine Buchung, reiner Seitenaufruf. Getestet mit `?range=2026-10-09,2026-10-10&los=1`, Ergebnis: Formular zeigt "09. Oktober 2026" / "10. Oktober 2026" vorbelegt, Gaeste-Feld bleibt beim Default (2 Erwachsene). |
| Entscheidung Gaeste-Parameter | Bewusst NICHT gesetzt. Die dirs21-URL akzeptiert zwar auch eine Gaeste-Belegung (`sets`-Parameter mit Zimmer-UUID + `occupancy`), aber das Halloween-Angebot deckt zwei Konstellationen ab ("2 Erw. + 1 Kind" ODER "2 Erw. + 2 Kinder") — eine davon zu erraten waere fuer die Haelfte der Besucher falsch vorbelegt. Datum ist eindeutig, Gaesteanzahl nicht; das Widget startet ohnehin bei 2 Erwachsenen, Besucher passen Kinder/Zimmer selbst im Picker an. |
| Halloween-Link | `https://reservation.one.dirs21.de/el-capitan/result?range=2026-10-30,2026-10-31&los=1` — Halloween-Wochenende, 1 Nacht (wie im Angebotstext), liegt im Festivalzeitraum (26.09.–08.11.2026). Bezieht sich auf den 2026er Termin; naechstes Jahr vor der Saison neu setzen oder Kachel dann ohnehin ersetzen. |
| Pool-Kachel-Link | Einfache dirs21-Basis-URL ohne Datum — das Angebot ist nicht saisonal, ein festes Datum waere falsch. |
| Verifiziert | `npm run build` gruen. Im Browser: beide Bilder verlinkt (Konsole gegengeprueft), Button liegt sichtbar direkt unter jeder Kachel (Positionscheck per Bounding-Box, horizontal zentriert, kein Layout-Bruch), keine Konsolenfehler. Klick-Test fuer beide neuen Linktypen bestaetigt Meta-/GA4-Ereignis, Navigation im Test unterbunden — keine Buchung ausgeloest. |
| Deploy | Committed und auf `main` gepusht -> Vercel-Auto-Deploy (Auftrag von onur). |

## 2026-09-07 (Nachtrag) — Buchungs-Buttons auf dirs21 umgestellt, Header auf 1 Button, deployed

Nachtrag von onur: Buttons fuehrten trotz Buchungshinweis noch zur
Kontaktanfrage statt zur dirs21-Buchungsstrecke. Hauptziel ist die
dirs21-Strecke.

| Punkt | Stand |
|---|---|
| Befund | 9 Buttons mit `href="#kontaktbereich"`/`/#kontaktbereich"` statt dirs21 gefunden (Kopfzeile x2 zusaetzlich zum Buchungs-Button, "Jetzt Angebot anfragen!", 4× "Jetzt Reservieren", Footer-Banner "Jetzt Anfragen") — trotz Beschriftung, die eine Buchung verspricht, und trotz "Bestpreisgarantie für Direktbucher" direkt daneben. |
| Kopfzeile | Zweiter Button ("Jetzt Anfragen" -> Kontaktformular) in beiden Kopfzeilen-Varianten (mobil + Desktop) komplett entfernt — es bleibt je Variante nur noch **ein** Button, der zu dirs21 fuehrt ("Direkt buchen" mobil / "Buchung" Desktop). |
| Uebrige Buttons | 6 Buttons ("Jetzt Angebot anfragen!", 4× "Jetzt Reservieren", Footer "Jetzt Anfragen") von `#kontaktbereich` auf `https://reservation.one.dirs21.de/el-capitan/result` umgestellt. |
| Bewusst unveraendert | "Erfahren Sie mehr" (Hero, verspricht keine Buchung) sowie die 4 Nav-Menuepunkte "Kontakt" (fuehren zum Formular-Abschnitt, nicht zur Buchung) und der Kontakt-Hinweisblock ("Sie haben eine Frage? … Formular") — das ist die echte Anfrage-Strecke und bleibt bestehen. |
| Umsetzung | Einmalige, gezielte String-Ersetzung direkt in `content/pages.json` (byte-genauer Mirror, kein HTML-Neubau) — Kopfzeilen-Button-Bloecke per Tiefenzaehlung entfernt, Buchungs-Buttons per `href`+Text-Match umgebogen. Kein Skript im Repo hinterlassen (Einmal-Migration). |
| Verifiziert | `npm run build` gruen. Im Browser (Desktop + Mobile-Emulation): Kopfzeile zeigt je nur noch 1 Button. Alle 10 verbliebenen `a.elementor-button`-Links per Konsole geprueft — 9× dirs21, 1× "Erfahren Sie mehr" bewusst auf `#kontaktbereich`. `public/buchungsklick-tracking.js` greift automatisch auch auf den neuen/umgebogenen Links (Selektor `a[href*="reservation.one.dirs21.de"]`), keine Anpassung noetig. |
| Deploy | Committed und auf `main` gepusht -> Vercel-Auto-Deploy ausgeloest (Auftrag von onur). |

## 2026-09-07 — Halloween-Kachel (Entwurf) + Buchungsklick-Tracking

Auftrag von onur (Sprachnachricht): Meta-Ads-Vorbereitung fuer Halloween-Buchungen
bis Movie-Park-Saisonende (26.09.–08.11.2026, "Legends Never Die"). Die
Meta-Kampagne selbst ist blockiert (fehlende Facebook-Seite/Zahlungsmethode) —
klaert onur direkt. Hier nur der unabhaengige Teil.

### Halloween-Kachel — 3 Entwuerfe, noch NICHT live

| Punkt | Stand |
|---|---|
| Auftrag | Nur Kachel 1 ("Halloween Special", 299 €) neu. Kachel 2 (169 €) unveraendert. |
| Bildquelle | Codex-CLI `image_gen`, reine Texterzeugung (kein Foto-Seed) — Nebel, Kuerbisse, Laternenlicht, herbstlich, ausdruecklich familienfreundlich. |
| Ausschluss | Keine Movie-Park-Marken/Logos, keine erfundenen Hotelaufnahmen, keine Personen, keine Gebaeude. |
| Bauplan | `scripts/angebots-grafiken.mjs` unveraendert — nur das Hintergrundmotiv der Kachel A wird ausgetauscht, Panel/Siegel/CTA/Text bleiben identisch. |
| Vorschau-Skript | `scripts/halloween-vorschau.mjs` (neu, nicht Teil des Produktiv-Builds) — wendet dieselbe Kachel-A-Konstruktion auf alle 3 Motive an. |
| Varianten | `halloween-kachel-vorschau/*-kachel.png` (1024×1024, fertige Kachel inkl. Text) + `halloween-kachel-vorschau/kontaktbogen.png` (alle 3 + alte Kachel + Kachel B nebeneinander) |
| — Variante 1 | Nebelpfad, warmes Orange, Kuerbisse konzentriert links/rechts unten. `variante-1-nebelpfad-warm-kachel.png` |
| — Variante 2 | Symmetrischer Weg, Lichterketten zwischen den Baeumen, am dichtesten mit Kuerbissen. `variante-2-lichterkette-symmetrisch-kachel.png` |
| — Variante 3 | Kuehlerer blau-violetter Nebel, traegt die Farbstimmung am ruhigsten zum dunklen Kopffeld. `variante-3-kuehler-nebel-kachel.png` |
| Status | Noch keine Variante produktiv. `public/wp-content/uploads/2025/09/halloween-movie-park-angebot-capitan-1x1*.png` zeigt weiterhin das alte Stockfoto (Familie/Pool/Achterbahn, ohne jeden Halloween-Bezug). |
| Naechster Schritt | onur waehlt eine Variante → `scripts/angebots-grafiken.mjs` MOTIVE-Eintrag auf das gewaehlte Quellbild umstellen, Skript regulaer laufen lassen (alle 4 Groessen), `halloween-kachel-vorschau/` danach loeschen. |

### Buchungsklick-Tracking — verdrahtet, lokal verifiziert, noch NICHT live

| Punkt | Stand |
|---|---|
| Ausgangslage | Meta-Pixel `1271626221221642` sendet bisher nur `PageView`. Gebucht wird extern auf `reservation.one.dirs21.de` — die Seite selbst sieht den Abschluss nie. |
| Neues Skript | `public/buchungsklick-tracking.js` (nach dem Muster von `public/kontakt-form.js`/`public/oa-tracking.js`) — HTML in `content/pages.json` bleibt unangetastet. |
| Einbindung | `app/[[...slug]]/route.js` haengt das Skript auf JEDER Seite an (dirs21-Links stehen in Kopfzeile, Hero, Menue, Formularhinweis). |
| Ausloeser | Klick (und Mittelklick) auf jeden `a[href*="reservation.one.dirs21.de"]` — kein `preventDefault`, haelt den Klick nie auf. |
| Meta-Ereignis | `fbq('track', 'InitiateCheckout', …)` — Standard-Ereignis statt Custom Event, damit Meta die Kampagnenoptimierung sofort einordnen kann. |
| GA4-Ereignis | `gtag('event', 'begin_checkout', …)` — von Google als empfohlenes Ecommerce-Ereignis dokumentiert, spiegelt den Meta-Namen. |
| Verifiziert | Lokal in der Browser-Konsole: Klick auf einen dirs21-Link loest beide Aufrufe zuverlaessig aus (Navigation fuer den Test unterbunden, NICHT abgeschickt). |
| Beobachtung | `fbq` ist auf der Seite durch den Cookie-Consent-Manager (CCM19) bis zur Einwilligung blockiert (`type="text/x-blocked-script"`) — bestehendes, korrektes Verhalten, betrifft auch das bisherige `PageView`. Das neue Skript prueft `typeof window.fbq === "function"` und wird nach Einwilligung automatisch mitgezogen. |
| Deploy | Noch nicht — `npm run build` laeuft durch, Code liegt lokal committed-bereit. |

### Sonstiges

- `npm run build` verifiziert (grün).
- Keine Testanfrage/-buchung ausgeloest (Vorgabe CLAUDE.md Umbrella-Root).
