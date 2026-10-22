import { describe, it, expect } from "vitest";
import { buildEntries, urlEntry } from "../../../api/sitemap";

describe("urlEntry", () => {
  it("always includes <loc>", () => {
    const entry = urlEntry("https://dekokutak.ba/shop", {});
    expect(entry).toContain("<loc>https://dekokutak.ba/shop</loc>");
  });

  it("includes optional fields when provided", () => {
    const entry = urlEntry("https://dekokutak.ba/", {
      priority: "1.0",
      changefreq: "weekly",
      lastmod: "2026-01-01",
    });
    expect(entry).toContain("<priority>1.0</priority>");
    expect(entry).toContain("<changefreq>weekly</changefreq>");
    expect(entry).toContain("<lastmod>2026-01-01</lastmod>");
  });

  it("omits optional fields when absent", () => {
    const entry = urlEntry("https://dekokutak.ba/shop", {});
    expect(entry).not.toContain("<priority>");
    expect(entry).not.toContain("<changefreq>");
    expect(entry).not.toContain("<lastmod>");
  });
});

describe("buildEntries — no category query strings", () => {
  const today = "2026-01-01";

  it("never emits ?category= URLs", () => {
    const entries = buildEntries(
      [{ id: 1, created_at: "2026-01-01T00:00:00Z" }],
      [{ slug: "faq", updated_at: "2026-01-01T00:00:00Z" }],
      today
    );
    const joined = entries.join("\n");
    expect(joined).not.toContain("?category=");
    expect(joined).not.toContain("category=");
  });

  it("always includes homepage and /shop", () => {
    const entries = buildEntries([], [], today);
    const joined = entries.join("\n");
    expect(joined).toContain("<loc>https://dekokutak.ba/</loc>");
    expect(joined).toContain("<loc>https://dekokutak.ba/shop</loc>");
  });

  it("includes in-stock product URLs", () => {
    const entries = buildEntries(
      [{ id: 42, created_at: "2026-06-15T00:00:00Z" }],
      [],
      today
    );
    const joined = entries.join("\n");
    expect(joined).toContain("<loc>https://dekokutak.ba/products/42</loc>");
    expect(joined).toContain("<lastmod>2026-06-15</lastmod>");
  });

  it("maps known CMS slugs to dedicated routes", () => {
    const entries = buildEntries(
      [],
      [
        { slug: "faq",      updated_at: null },
        { slug: "privacy",  updated_at: null },
        { slug: "shipping", updated_at: null },
        { slug: "terms",    updated_at: null },
        { slug: "about",    updated_at: null },
      ],
      today
    );
    const joined = entries.join("\n");
    expect(joined).toContain("<loc>https://dekokutak.ba/faq</loc>");
    expect(joined).toContain("<loc>https://dekokutak.ba/privacy</loc>");
    expect(joined).toContain("<loc>https://dekokutak.ba/shipping</loc>");
    expect(joined).toContain("<loc>https://dekokutak.ba/terms</loc>");
    expect(joined).toContain("<loc>https://dekokutak.ba/about</loc>");
    expect(joined).not.toContain("/page/faq");
    expect(joined).not.toContain("/page/privacy");
  });

  it("maps unknown CMS slugs to /page/:slug", () => {
    const entries = buildEntries(
      [],
      [{ slug: "custom-slug", updated_at: null }],
      today
    );
    const joined = entries.join("\n");
    expect(joined).toContain("<loc>https://dekokutak.ba/page/custom-slug</loc>");
  });
});
