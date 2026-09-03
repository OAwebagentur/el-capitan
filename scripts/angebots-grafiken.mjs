/* Angebots-Kacheln fuer die Startseite (Sektion "Unsere aktuellen Angebote").
 *
 * Die beiden Motive stammen aus den bestehenden Angebotsgrafiken des Hauses;
 * neu gesetzt werden nur die Flaechen mit Text: das Kopffeld, das Preis-Siegel
 * und der CTA. Die Deckflaechen sind so gelegt, dass der alte, ins Foto
 * gebrannte Text vollstaendig verdeckt ist (Messwerte siehe DECKUNG unten).
 *
 * sharp ist keine Abhaengigkeit dieses Projekts (die Seite liefert nur
 * statisches HTML aus). Aufruf daher mit einem vorhandenen sharp:
 *   NODE_PATH=<pfad-zu-node_modules> node scripts/angebots-grafiken.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Markenschrift (Montserrat) fuer librsvg sichtbar machen, BEVOR sharp laedt.
// Die mitgelieferte meta-ads-schermbeck/_assets/fonts.conf nutzt
// <dir prefix="default">; das ignoriert fontconfig 2.17 — deshalb wird hier
// eine Konfiguration mit absoluten Pfaden erzeugt.
const FONTDIR = path.join(ROOT, "scripts", "fonts");
const FCDIR = path.join(tmpdir(), "el-capitan-fontconfig");
mkdirSync(FCDIR, { recursive: true });
const FCFILE = path.join(FCDIR, "fonts.conf");
const slash = (p) => p.split(String.fromCharCode(92)).join("/");
writeFileSync(
  FCFILE,
  `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${slash(FONTDIR)}</dir>
  <cachedir>${slash(path.join(FCDIR, "cache"))}</cachedir>
</fontconfig>
`
);
// fontconfig liest FONTCONFIG_FILE beim Laden der nativen Bibliothek aus der
// echten Prozessumgebung — ein `process.env`-Setzen aus dem Skript heraus kommt
// dort unter Windows nicht an. Darum einmal mit gesetzter Variable neu starten.
if (!process.env.EC_FONTS_BEREIT) {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    stdio: "inherit",
    env: { ...process.env, FONTCONFIG_FILE: FCFILE, EC_FONTS_BEREIT: "1" },
  });
  if (r.error) {
    console.error("Neustart mit Schriftkonfiguration fehlgeschlagen:", r.error);
    process.exit(1);
  }
  process.exit(r.status ?? 1);
}
const sharp = require("sharp");

const OUT = path.join(ROOT, "public", "wp-content", "uploads", "2025", "09");
mkdirSync(OUT, { recursive: true });

// ---- Palette (aus den bisherigen Angebotsgrafiken gemessen) --------------
const GELB = "#F5BA00";
const BLAU = "#005AA1";
const TINTE = "#03203C";
const ORANGE = "#F2700A";
const NACHT = "#1E1330";
const WEISS = "#FFFFFF";

const H = "Montserrat";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Grobe Breitenschaetzungen; reichen zum Einpassen, das Ergebnis wird geprueft.
const breite = (t, size, w = 800) => t.length * (w >= 800 ? 0.60 : 0.56) * size;
// Versalien laufen deutlich breiter, dazu kommt die Laufweite.
const versalBreite = (t, size, ls) => t.length * (0.83 * size + ls);
function passend(t, size, max, w = 800) {
  let s = size;
  while (breite(t, s, w) > max && s > 12) s -= 1;
  return s;
}

function zeilen(lines, { x, erste, lh, size, max, farbe = WEISS, gewicht = 800 }) {
  const s = Math.min(size, ...lines.map((t) => passend(t, size, max, gewicht)));
  return lines
    .map(
      (t, i) =>
        `<text x="${x}" y="${erste + i * lh}" font-family="${H}" font-weight="${gewicht}" font-size="${s}" fill="${farbe}">${esc(t)}</text>`
    )
    .join("");
}

// Zackensiegel wie auf den bisherigen Kacheln.
function siegel(cx, cy, rAussen, rInnen, zacken, fuellung, rand, randBreite) {
  const pts = [];
  for (let i = 0; i < zacken * 2; i++) {
    const r = i % 2 === 0 ? rAussen : rInnen;
    const a = (Math.PI * i) / zacken - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${fuellung}" stroke="${rand}" stroke-width="${randBreite}" stroke-linejoin="round"/>`;
}

function mittigText(t, cx, y, size, farbe, gewicht = 800, max = null) {
  const s = max ? passend(t, size, max, gewicht) : size;
  return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${H}" font-weight="${gewicht}" font-size="${s}" fill="${farbe}">${esc(t)}</text>`;
}

// -------------------------------------------------------------- Kachel A
// DECKUNG (im 1024er Original gemessen): gelbes Kopffeld + Zackenstern reichen
// bis y=405, die Koepfe beginnen bei y=420 -> Kopffeld 0..415.
// Alter CTA-Kasten: ab x=725 / y=868 bis in die Ecke -> CTA randabfallend.
const kachelA = () => `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect x="0" y="0" width="1024" height="415" fill="${NACHT}"/>
  <rect x="0" y="409" width="1024" height="6" fill="${ORANGE}"/>
  <rect x="56" y="44" width="${Math.round(versalBreite("HALLOWEEN SPECIAL", 27, 1.5) + 52)}" height="52" rx="26" fill="${ORANGE}"/>
  <text x="${56 + 26}" y="81" font-family="${H}" font-weight="800" font-size="27" letter-spacing="1.5" fill="${WEISS}">HALLOWEEN SPECIAL</text>
  ${zeilen(["1 Nacht im", "Familienzimmer", "inkl. Frühstück", "+ 2 Tage Movie Park"], {
    x: 56, erste: 172, lh: 56, size: 48, max: 520,
  })}
  <text x="56" y="392" font-family="${H}" font-weight="600" font-size="26" fill="#E9DFF4">für 2 Erw. + 1 Kind oder 2 Erw. + 2 Kinder</text>
  ${siegel(792, 196, 176, 143, 16, ORANGE, WEISS, 7)}
  <text x="792" y="168" text-anchor="middle" font-family="${H}" font-weight="700" font-size="40" fill="${WEISS}">nur</text>
  <text x="792" y="268" text-anchor="middle" font-family="${H}" font-weight="800" font-size="94" fill="${WEISS}">299 €</text>
  <path d="M596 1024 L596 906 Q596 856 646 856 L1024 856 L1024 1024 Z" fill="${GELB}"/>
  ${mittigText("Jetzt", 810, 936, 52, TINTE)}
  ${mittigText("buchen", 810, 996, 52, TINTE)}
</svg>`;

// -------------------------------------------------------------- Kachel B
// DECKUNG: Kopfzeile + Headline reichen bis y=305, Koepfe ab y=315 -> 0..312.
// Alter CTA-Balken: x 90..920 / y 875..975 -> Balken 70..954 / 858..990.
const kachelB = () => `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect x="0" y="0" width="1024" height="312" fill="${BLAU}"/>
  <rect x="0" y="306" width="1024" height="6" fill="${GELB}"/>
  <rect x="56" y="30" width="${Math.round(versalBreite("NUR 15 MIN. ZUM MOVIE PARK", 24, 1.2) + 48)}" height="46" rx="23" fill="${GELB}"/>
  <text x="${56 + 24}" y="62" font-family="${H}" font-weight="800" font-size="24" letter-spacing="1.2" fill="${TINTE}">NUR 15 MIN. ZUM MOVIE PARK</text>
  ${zeilen(["Übernachtung im", "Vierbettzimmer", "inkl. Frühstück & Pool"], {
    x: 56, erste: 152, lh: 56, size: 48, max: 600,
  })}
  ${siegel(858, 158, 132, 107, 16, GELB, WEISS, 6)}
  <text x="858" y="132" text-anchor="middle" font-family="${H}" font-weight="700" font-size="32" fill="${TINTE}">nur</text>
  <text x="858" y="212" text-anchor="middle" font-family="${H}" font-weight="800" font-size="74" fill="${TINTE}">169 €</text>
  <rect x="70" y="812" width="884" height="178" rx="8" fill="${GELB}"/>
  ${mittigText("Täglich schwimmen bis 22:00 Uhr", 512, 868, 32, TINTE, 700, 800)}
  ${mittigText("Jetzt Angebot sichern", 512, 954, 60, BLAU, 800, 800)}
</svg>`;

const MOTIVE = [
  {
    name: "halloween-movie-park-angebot-capitan-1x1",
    foto: "public/wp-content/uploads/2025/08/bc86e1c4-8503-427c-a86d-32bac3509088.png",
    // Der alte Text steckt im Bild. Nur der Bildteil AB dieser Zeile wird
    // uebernommen und auf die Flaeche unter dem neuen Kopffeld gezogen —
    // so bleibt garantiert nichts vom alten Angebot stehen.
    fotoAb: 442,
    panel: 415,
    svg: kachelA,
  },
  {
    name: "uebernachtung-fruehstueck-pool-angebot-capitan-1x1",
    foto: "public/wp-content/uploads/2025/07/familienzeit-angebot-capitan-1x1-1.png",
    fotoAb: 326,
    panel: 312,
    svg: kachelB,
  },
];

for (const m of MOTIVE) {
  const quelle = await sharp(path.join(ROOT, m.foto)).resize(1024, 1024, { fit: "cover" }).toBuffer();
  const unten = await sharp(quelle)
    .extract({ left: 0, top: m.fotoAb, width: 1024, height: 1024 - m.fotoAb })
    .resize(1024, 1024 - m.panel, { fit: "fill" })
    .toBuffer();
  const basis = await sharp(quelle)
    .composite([{ input: unten, top: m.panel, left: 0 }])
    .toBuffer();
  const voll = await sharp(basis)
    .composite([{ input: Buffer.from(m.svg()), top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await sharp(voll).toFile(path.join(OUT, `${m.name}.png`));
  for (const g of [768, 300, 150]) {
    await sharp(voll).resize(g, g).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${m.name}-${g}x${g}.png`));
  }
  console.log("gebaut:", m.name);
}
