// El Capitan – Full-site mirror scraper.
// Crawls all internal pages of el-capitan.eu, downloads every same-domain asset
// (css/js/img/font/...) into public/ preserving the original path, parses CSS
// recursively for url()/@import refs, rewrites the el-capitan.eu domain to
// root-relative, and writes content/pages.json = { "<route>": "<full html>" }.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const ORIGIN = "https://el-capitan.eu";
const HOST = "el-capitan.eu";
const ROOT = process.cwd();
const PUBLIC = join(ROOT, "public");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ASSET_EXT =
  /\.(css|js|mjs|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|eot|mp4|webm|ogg|m4v|json)(\?|#|$)/i;

const visitedPages = new Set();
const pageQueue = [];
const pages = {}; // route -> html
const assetSet = new Set(); // absolute urls (el-capitan.eu) to download
const downloadedAssets = new Set();
const cssToParse = []; // {url, localPath}

function log(...a) {
  console.log(...a);
}

async function fetchRetry(url, { binary = false, tries = 3 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "*/*" },
        redirect: "follow",
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("HTTP " + res.status);
      }
      if (binary) return Buffer.from(await res.arrayBuffer());
      return await res.text();
    } catch (e) {
      if (i === tries - 1) {
        log("  ! fetch failed", url, e.message);
        return null;
      }
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
}

// Normalize a discovered href into a canonical page route (or null if not a page).
function toPageRoute(href, baseUrl) {
  let u;
  try {
    u = new URL(href, baseUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.hostname !== HOST) return null;
  // skip assets, admin, api, feeds
  const p = u.pathname;
  if (ASSET_EXT.test(p)) return null;
  if (
    /\/wp-(admin|content|includes|json)\//.test(p) ||
    /\/feed\/?$/.test(p) ||
    /\.(xml|php|txt)$/i.test(p) ||
    p.startsWith("/wp-login")
  )
    return null;
  // drop query and hash for page identity
  let route = u.pathname;
  if (!route.startsWith("/")) route = "/" + route;
  // normalize trailing slash to match WP (keep one trailing slash, except root)
  if (route !== "/" && !route.endsWith("/")) route += "/";
  return route;
}

function isSameHostUrl(s) {
  return (
    s.includes("//" + HOST + "/") ||
    s.includes("//" + HOST + '"') ||
    s.startsWith("/" + HOST) ||
    s.includes(HOST)
  );
}

// Extract all el-capitan.eu (absolute or protocol-relative) asset URLs + relative ones from a text blob.
function collectAssetUrls(text, baseUrl) {
  const found = new Set();
  // absolute / protocol-relative urls
  const reAbs = /(https?:)?\/\/el-capitan\.eu\/[^\s"'()<>\\]+/gi;
  let m;
  while ((m = reAbs.exec(text))) {
    found.add(m[0]);
  }
  return [...found];
}

function absolutize(u) {
  if (u.startsWith("//")) return "https:" + u;
  return u;
}

// Map an el-capitan.eu URL to a local public path (strip domain + query).
function urlToLocalPath(absUrl) {
  const u = new URL(absolutize(absUrl));
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith("/")) p += "index.html";
  return p; // root-relative, e.g. /wp-content/uploads/..png
}

function queueAsset(absUrl) {
  const clean = absolutize(absUrl).split("#")[0];
  if (!clean.includes(HOST)) return;
  const u = new URL(clean);
  if (u.hostname !== HOST) return;
  if (!ASSET_EXT.test(u.pathname)) return;
  assetSet.add(clean);
}

// Rewrite el-capitan.eu domain -> root-relative in any text.
function rewriteDomain(text) {
  return text
    .replaceAll("https://el-capitan.eu", "")
    .replaceAll("http://el-capitan.eu", "")
    .replaceAll("https:\\/\\/el-capitan.eu", "")
    .replaceAll("http:\\/\\/el-capitan.eu", "")
    .replaceAll("//el-capitan.eu", "");
}

async function crawlPage(route) {
  if (visitedPages.has(route)) return;
  visitedPages.add(route);
  const url = ORIGIN + route;
  log("PAGE", route);
  const html = await fetchRetry(url);
  if (html == null) {
    log("  ! page missing", route);
    return;
  }

  // collect assets referenced in page
  for (const a of collectAssetUrls(html, url)) queueAsset(a);

  // discover internal links
  const reHref = /href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = reHref.exec(html))) {
    const r = toPageRoute(m[1], url);
    if (r && !visitedPages.has(r) && !pageQueue.includes(r)) pageQueue.push(r);
  }
  // some menus use data-href / link in srcset of <a>? ignore.

  // store rewritten html
  pages[route] = rewriteDomain(html);
}

async function saveAsset(absUrl) {
  if (downloadedAssets.has(absUrl)) return;
  downloadedAssets.add(absUrl);
  const localPath = urlToLocalPath(absUrl);
  const dest = join(PUBLIC, localPath);
  const isCss = /\.css(\?|#|$)/i.test(absUrl);
  const isText = isCss; // we only need to re-parse css
  if (existsSync(dest) && !isCss) return;
  const data = await fetchRetry(absUrl, { binary: !isText });
  if (data == null) return;
  await mkdir(dirname(dest), { recursive: true });
  if (isText) {
    // parse css for url()/import, queue those assets, then rewrite domain
    const cssBase = absolutize(absUrl);
    const reUrl = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
    let mm;
    const cssAbs = [];
    while ((mm = reUrl.exec(data))) {
      const ref = mm[1].trim();
      if (ref.startsWith("data:")) continue;
      try {
        const abs = new URL(ref, cssBase).toString();
        if (abs.includes(HOST) && ASSET_EXT.test(new URL(abs).pathname)) {
          assetSet.add(abs.split("#")[0]);
          cssAbs.push(abs);
        }
      } catch {}
    }
    const reImport = /@import\s+(?:url\()?\s*['"]?([^'")\s]+)['"]?/gi;
    while ((mm = reImport.exec(data))) {
      try {
        const abs = new URL(mm[1].trim(), cssBase).toString();
        if (abs.includes(HOST) && /\.css/i.test(abs)) assetSet.add(abs.split("#")[0]);
      } catch {}
    }
    await writeFile(dest, rewriteDomain(data), "utf8");
  } else {
    await writeFile(dest, data);
  }
}

async function main() {
  pageQueue.push("/");
  // BFS crawl
  let guard = 0;
  while (pageQueue.length && guard < 200) {
    guard++;
    const route = pageQueue.shift();
    await crawlPage(route);
  }
  log(`Crawled ${Object.keys(pages).length} pages.`);

  // Download assets (multiple passes: css parsing may add more)
  let pass = 0;
  while (pass < 6) {
    pass++;
    const pending = [...assetSet].filter((u) => !downloadedAssets.has(u));
    if (!pending.length) break;
    log(`Asset pass ${pass}: ${pending.length} to download`);
    // simple concurrency
    const CONC = 8;
    for (let i = 0; i < pending.length; i += CONC) {
      await Promise.all(pending.slice(i, i + CONC).map(saveAsset));
    }
  }
  log(`Downloaded ${downloadedAssets.size} assets.`);

  // write pages.json
  await mkdir(join(ROOT, "content"), { recursive: true });
  await writeFile(
    join(ROOT, "content", "pages.json"),
    JSON.stringify(pages, null, 0),
    "utf8"
  );
  // write a route list for convenience
  await writeFile(
    join(ROOT, "content", "routes.json"),
    JSON.stringify(Object.keys(pages), null, 2),
    "utf8"
  );
  log("Routes:", Object.keys(pages).join(", "));
  log("DONE");
}

main();
