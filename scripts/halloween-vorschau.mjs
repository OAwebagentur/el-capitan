/* Vorschau-Skript fuer die Halloween-Kachel-Auswahl (NICHT Teil des
 * Produktiv-Builds). Wendet dieselbe Kachel-A-Konstruktion aus
 * angebots-grafiken.mjs (Kopffeld, Preissiegel, CTA) auf mehrere
 * Codex-generierte Halloween-Motive an, damit onur die Varianten nebeneinander
 * sehen kann, BEVOR eine davon die produktive Datei ersetzt.
 *
 * Aufruf wie angebots-grafiken.mjs:
 *   NODE_PATH=<pfad-zu-node_modules> node scripts/halloween-vorschau.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FONTDIR = path.join(ROOT, "scripts", "fonts");
const FCDIR = path.join(tmpdir(), "el-capitan-fontconfig-vorschau");
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

const QUELLORDNER = path.join(ROOT, "halloween-kachel-vorschau", "quellbilder");
const OUT = path.join(ROOT, "halloween-kachel-vorschau");
mkdirSync(OUT, { recursive: true });

// ---- Palette (identisch zu angebots-grafiken.mjs) -------------------------
const ORANGE = "#F2700A";
const NACHT = "#1E1330";
const GELB = "#F5BA00";
const WEISS = "#FFFFFF";
const TINTE = "#03203C";

const H = "Montserrat";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const breite = (t, size, w = 800) => t.length * (w >= 800 ? 0.60 : 0.56) * size;
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

// Kachel A -- 1:1 aus angebots-grafiken.mjs uebernommen.
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

const FOTO_AB = 442; // wie im Produktiv-Skript: nur der untere Bildteil wird verwendet.
const PANEL = 415;

const dateien = readdirSync(QUELLORDNER).filter((f) => f.endsWith(".png")).sort();
for (const datei of dateien) {
  const name = path.basename(datei, ".png");
  const quelle = await sharp(path.join(QUELLORDNER, datei)).resize(1024, 1024, { fit: "cover" }).toBuffer();
  const unten = await sharp(quelle)
    .extract({ left: 0, top: FOTO_AB, width: 1024, height: 1024 - FOTO_AB })
    .resize(1024, 1024 - PANEL, { fit: "fill" })
    .toBuffer();
  const basis = await sharp(quelle).composite([{ input: unten, top: PANEL, left: 0 }]).toBuffer();
  const voll = await sharp(basis)
    .composite([{ input: Buffer.from(kachelA()), top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await sharp(voll).toFile(path.join(OUT, `${name}-kachel.png`));
  console.log("gebaut:", name);
}

// Kontaktbogen: alle Kacheln + zum Vergleich die alte Kachel A und Kachel B nebeneinander.
const kachelDateien = readdirSync(OUT).filter((f) => f.endsWith("-kachel.png")).sort();
const referenzen = [
  path.join(ROOT, "public/wp-content/uploads/2025/09/halloween-movie-park-angebot-capitan-1x1.png"),
  path.join(ROOT, "public/wp-content/uploads/2025/09/uebernachtung-fruehstueck-pool-angebot-capitan-1x1.png"),
];
const alle = [...kachelDateien.map((f) => path.join(OUT, f)), ...referenzen];
const GROESSE = 340;
const SPALTEN = 3;
const ZEILEN = Math.ceil(alle.length / SPALTEN);
const bogen = sharp({
  create: {
    width: SPALTEN * GROESSE,
    height: ZEILEN * GROESSE,
    channels: 3,
    background: "#111111",
  },
});
const composite = [];
for (let i = 0; i < alle.length; i++) {
  const buf = await sharp(alle[i]).resize(GROESSE, GROESSE).toBuffer();
  composite.push({ input: buf, left: (i % SPALTEN) * GROESSE, top: Math.floor(i / SPALTEN) * GROESSE });
}
await bogen.composite(composite).png().toFile(path.join(OUT, "kontaktbogen.png"));
console.log("Kontaktbogen:", path.join(OUT, "kontaktbogen.png"));
console.log("Reihenfolge im Kontaktbogen:", [...kachelDateien, "ALT: halloween (aktuell live)", "Kachel B (unveraendert, zum Vergleich)"]);
