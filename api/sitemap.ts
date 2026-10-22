import type { IncomingMessage, ServerResponse } from "http";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://dekokutak.ba";

export default async function handler(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (process.env.VITE_ALLOW_INDEXING !== "true") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const sb = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const [{ data: products }, { data: categories }, { data: pages }] =
    await Promise.all([
      sb.from("products").select("id, created_at").eq("in_stock", true).order("id"),
      sb.from("categories").select("name, name_en").order("name"),
      sb.from("pages").select("slug, updated_at").eq("is_published", true).order("slug"),
    ]);

  const today = new Date().toISOString().slice(0, 10);

  // Some CMS page slugs map to dedicated routes rather than /page/:slug.
  // These are only included when is_published=true (already filtered by the
  // pages query above). Others fall through to the generic /page/:slug URL.
  const FIXED_ROUTES: Record<string, { url: string; priority: string }> = {
    faq:      { url: `${BASE}/faq`,      priority: "0.5" },
    shipping: { url: `${BASE}/shipping`, priority: "0.4" },
    privacy:  { url: `${BASE}/privacy`,  priority: "0.3" },
    terms:    { url: `${BASE}/terms`,    priority: "0.3" },
    about:    { url: `${BASE}/about`,    priority: "0.5" },
  };

  const entries: string[] = [
    urlEntry(`${BASE}/`,     { priority: "1.0", changefreq: "weekly",  lastmod: today }),
    urlEntry(`${BASE}/shop`, { priority: "0.9", changefreq: "daily" }),
    ...(products ?? []).map((p) =>
      urlEntry(`${BASE}/products/${p.id}`, {
        lastmod:    p.created_at?.slice(0, 10) ?? today,
        priority:   "0.8",
        changefreq: "weekly",
      })
    ),
    ...(categories ?? []).map((c) =>
      urlEntry(`${BASE}/shop?category=${encodeURIComponent(c.name_en ?? c.name)}`, {
        priority:   "0.7",
        changefreq: "weekly",
      })
    ),
    ...(pages ?? []).map((p) => {
      const fixed = FIXED_ROUTES[p.slug];
      return urlEntry(fixed ? fixed.url : `${BASE}/page/${encodeURIComponent(p.slug)}`, {
        lastmod:    p.updated_at?.slice(0, 10) ?? today,
        priority:   fixed ? fixed.priority : "0.5",
        changefreq: "monthly",
      });
    }),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join("\n") +
    `\n</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.end(xml);
}

function urlEntry(
  loc: string,
  opts: { priority?: string; changefreq?: string; lastmod?: string }
): string {
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    opts.lastmod    ? `    <lastmod>${opts.lastmod}</lastmod>`           : null,
    opts.changefreq ? `    <changefreq>${opts.changefreq}</changefreq>` : null,
    opts.priority   ? `    <priority>${opts.priority}</priority>`       : null,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}
