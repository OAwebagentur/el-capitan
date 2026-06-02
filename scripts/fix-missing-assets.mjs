// Targeted, ADDITIVE fixer for the el-capitan.eu mirror.
//
// The base scraper (scripts/scrape.mjs) only downloads assets whose literal
// el-capitan.eu URL appears in the HTML/CSS. Two classes of runtime assets are
// therefore missed, which breaks interactive logic in the local mirror:
//
//   1. Elementor / Elementor-Pro webpack CHUNKS. Their hashed filenames live in
//      the webpack runtime JS and are requested at runtime (form handler,
//      nested-accordion, nested-tabs, nav-menu, gallery, lightbox, popup, ...).
//      Missing -> 404 -> the booking/contact form, accordions, mobile menu,
//      galleries and lightbox silently do nothing.
//   2. Google Fonts .woff2 files, which Elementor serves from a THIRD-PARTY host
//      (general.cloudmeshsolutions.com), not el-capitan.eu.
//
// This script downloads only what's missing and rewrites the google-fonts CSS to
// local paths. It does NOT touch any other CSS (e.g. the user's edited post-5.css)
// and never re-scrapes pages.

import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const ORIGIN = "https://el-capitan.eu";
const ROOT = process.cwd();
const PUBLIC = join(ROOT, "public");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchBin(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, redirect: "follow" });
      if (!res.ok) return res.status === 404 ? null : Promise.reject(new Error("HTTP " + res.status));
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (i === 2) { console.log("  ! fail", url, e.message); return null; }
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
}

async function save(localPath, buf) {
  const dest = join(PUBLIC, localPath);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
}

// Extract webpack chunk filenames from a runtime file. Chunks come in two shapes:
//   named:    "form.71055747203b48a65a24.bundle.min.js"
//   nameless: "397f2d183c19202777d6.bundle.min.js"
// Capture both; a wrong guess just yields a harmless 404.
function chunkNames(text) {
  const set = new Set();
  for (const re of [
    /[a-z][a-z0-9_-]*\.[a-f0-9]{20}\.bundle\.min\.js/gi, // named (name starts with a letter)
    /(?<![a-z0-9_.-])[a-f0-9]{20}\.bundle\.min\.js/gi, // bare hash
  ]) {
    let m;
    while ((m = re.exec(text))) set.add(m[0]);
  }
  return [...set];
}

let added = 0;
let skipped = 0;

async function getIfMissing(localPath, absUrl) {
  if (existsSync(join(PUBLIC, localPath))) { skipped++; return; }
  const buf = await fetchBin(absUrl);
  if (buf == null) { console.log("  404", absUrl); return; }
  await save(localPath, buf);
  added++;
  console.log("  +", localPath);
}

async function main() {
  // --- 1. Elementor core chunks ---
  const coreRuntime = await readFile(
    join(PUBLIC, "wp-content/plugins/elementor/assets/js/webpack.runtime.min.js"), "utf8");
  const coreBase = "/wp-content/plugins/elementor/assets/js/";
  console.log("Elementor core chunks:");
  for (const name of chunkNames(coreRuntime)) {
    await getIfMissing(coreBase + name, ORIGIN + coreBase + name);
  }

  // --- 2. Elementor-Pro chunks ---
  const proRuntime = await readFile(
    join(PUBLIC, "wp-content/plugins/elementor-pro/assets/js/webpack-pro.runtime.min.js"), "utf8");
  const proBase = "/wp-content/plugins/elementor-pro/assets/js/";
  console.log("Elementor-Pro chunks:");
  for (const name of chunkNames(proRuntime)) {
    await getIfMissing(proBase + name, ORIGIN + proBase + name);
  }

  // --- 3. Standalone libs + conditional CSS loaded at runtime by frontend.min.js ---
  console.log("Standalone libs / conditional css:");
  const extras = [
    "/wp-content/plugins/elementor/assets/lib/dialog/dialog.min.js",
    "/wp-content/plugins/elementor/assets/lib/share-link/share-link.min.js",
    "/wp-content/plugins/elementor/assets/css/conditionals/dialog.min.css",
    "/wp-content/plugins/elementor/assets/css/conditionals/lightbox.min.css",
  ];
  for (const p of extras) await getIfMissing(p, ORIGIN + p);

  // --- 4. Cross-domain Google Fonts: download + localise the CSS ---
  console.log("Google fonts (cross-domain) localisation:");
  const fontCssDir = join(PUBLIC, "wp-content/uploads/elementor/google-fonts/css");
  const cssFiles = (await readdir(fontCssDir)).filter((f) => f.endsWith(".css"));
  const reFontUrl = /url\((https?:\/\/[^)'"]+\.woff2?)\)/gi;
  for (const f of cssFiles) {
    const cssPath = join(fontCssDir, f);
    let css = await readFile(cssPath, "utf8");
    const urls = new Set();
    let m;
    while ((m = reFontUrl.exec(css))) urls.add(m[1]);
    for (const u of urls) {
      const local = "/" + new URL(u).pathname.replace(/^\/+/, ""); // same path layout
      await getIfMissing(local, u);
      css = css.split(u).join(local); // rewrite absolute -> root-relative
    }
    await writeFile(cssPath, css, "utf8");
    console.log("  rewrote", f, "(" + urls.size + " font urls)");
  }

  console.log(`\nDONE. added=${added} skipped(existing)=${skipped}`);
}

main();
