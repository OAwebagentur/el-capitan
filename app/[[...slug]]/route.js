import { readFileSync } from "node:fs";
import { join } from "node:path";

// Load the mirrored documents ourselves rather than via `import ... json`,
// because Next's JSON-inlining mangles some escaped/emoji content.
const pages = JSON.parse(
  readFileSync(join(process.cwd(), "content", "pages.json"), "utf8")
);

// Serve the mirrored el-capitan.net documents byte-for-byte. Static assets in
// public/ (CSS, JS, images, fonts) are served by Next before this handler runs,
// so this only ever handles HTML page routes.
export const dynamic = "force-static";
export const dynamicParams = false;

function routeFromSlug(slug) {
  const parts = Array.isArray(slug) ? slug : [];
  if (parts.length === 0) return "/";
  return "/" + parts.join("/") + "/";
}

export function generateStaticParams() {
  return Object.keys(pages).map((route) => {
    const trimmed = route.replace(/^\/+|\/+$/g, "");
    return { slug: trimmed === "" ? [] : trimmed.split("/") };
  });
}

// Auf Seiten mit dem Buchungsformular unser eigenes Submit-Skript einklinken.
// Es faengt das Elementor-Formular ab und sendet die Anfrage an /api/buchung/,
// da die urspruengliche WordPress-"admin-ajax.php" im Mirror nicht existiert.
const FORM_SCRIPT = '<script src="/buchung-form.js" defer></script>';

// Das Kontaktpunkt-Tracking kommt auf JEDE Seite: Telefon- und
// E-Mail-Links stehen ueberall im gespiegelten HTML, nicht nur beim
// Formular. Es laeuft vor buchung-form.js, damit dort die Sitzungsdaten
// (window.oaTracking) schon bereitstehen — beide sind `defer`, die
// Reihenfolge im Dokument entscheidet.
const TRACKING_SCRIPT = '<script src="/oa-tracking.js" defer></script>';

// Der Ereignis-Endpoint ist kein Geheimnis; er steht als Standard fest im
// Skript. Nur wenn eine abweichende Adresse konfiguriert ist (Test gegen
// die lokale Portal-Instanz, Preview), wird sie hier vorangestellt.
function endpointScript() {
  const url = process.env.NEXT_PUBLIC_OA_EREIGNIS_ENDPOINT;
  if (!url) return "";
  return `<script>window.OA_EREIGNIS_ENDPOINT=${JSON.stringify(url)};</script>`;
}

function injectScripts(html) {
  let scripts = "";

  if (!html.includes("/oa-tracking.js")) {
    scripts += endpointScript() + TRACKING_SCRIPT;
  }
  if (html.includes('name="Buchungsformular"') && !html.includes("/buchung-form.js")) {
    scripts += FORM_SCRIPT;
  }

  if (!scripts) return html;
  return html.includes("</body>")
    ? html.replace("</body>", scripts + "</body>")
    : html + scripts;
}

export async function GET(_request, ctx) {
  const params = await ctx.params;
  const route = routeFromSlug(params.slug);
  const html = pages[route];
  if (typeof html !== "string") {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(injectScripts(html), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
