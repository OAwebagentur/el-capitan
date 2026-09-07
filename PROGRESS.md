# PROGRESS.md — el-capitan

Neueste Eintraege zuerst.

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
