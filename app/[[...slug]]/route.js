import { readFileSync } from "node:fs";
import { join } from "node:path";

// Load the mirrored documents ourselves rather than via `import ... json`,
// because Next's JSON-inlining mangles some escaped/emoji content.
const pages = JSON.parse(
  readFileSync(join(process.cwd(), "content", "pages.json"), "utf8")
);

// Serve the mirrored el-capitan.eu documents byte-for-byte. Static assets in
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

export async function GET(_request, ctx) {
  const params = await ctx.params;
  const route = routeFromSlug(params.slug);
  const html = pages[route];
  if (typeof html !== "string") {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
