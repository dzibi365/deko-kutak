import { describe, it, expect } from "vitest";
import type { ProductTag } from "../supabase";

// ── Helpers (mirrors ProductGrid filter logic) ─────────────────────────────

type AssignmentRow = { tag_id: number };
type ProductWithTags = { id: number; name: string; product_tag_assignments?: AssignmentRow[] };

function filterByTag(products: ProductWithTags[], tagId: number | null): ProductWithTags[] {
  if (!tagId) return products;
  return products.filter((p) =>
    p.product_tag_assignments?.some((a) => a.tag_id === tagId) ?? false
  );
}

function localTagName(tag: ProductTag, lang: "en" | "bs"): string {
  return lang === "bs" ? tag.name_bs : tag.name_en;
}

// Deduplicate selected tag IDs (mirrors ProductForm save logic)
function deduplicateTagIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

// ── Tag filter ─────────────────────────────────────────────────────────────

describe("filterByTag", () => {
  const products: ProductWithTags[] = [
    { id: 1, name: "Wooden Frame", product_tag_assignments: [{ tag_id: 10 }, { tag_id: 20 }] },
    { id: 2, name: "Photo Box",    product_tag_assignments: [{ tag_id: 20 }] },
    { id: 3, name: "Plant Pot",    product_tag_assignments: [] },
    { id: 4, name: "Gift Set",     product_tag_assignments: undefined },
  ];

  it("returns all products when tagId is null", () => {
    expect(filterByTag(products, null)).toHaveLength(4);
  });

  it("returns only products assigned to the given tag", () => {
    const result = filterByTag(products, 10);
    expect(result.map((p) => p.id)).toEqual([1]);
  });

  it("returns multiple products sharing a tag", () => {
    const result = filterByTag(products, 20);
    expect(result.map((p) => p.id)).toEqual([1, 2]);
  });

  it("returns empty array when no products have the tag", () => {
    expect(filterByTag(products, 99)).toHaveLength(0);
  });

  it("treats missing product_tag_assignments as no tags", () => {
    const result = filterByTag(products, 10);
    expect(result.map((p) => p.id)).not.toContain(4);
  });
});

// ── Bilingual display ──────────────────────────────────────────────────────

describe("localTagName", () => {
  const tag: ProductTag = {
    id: 1,
    name_en: "Wedding",
    name_bs: "Vjenčanje",
    created_at: "2026-01-01T00:00:00Z",
  };

  it("returns name_en in English", () => {
    expect(localTagName(tag, "en")).toBe("Wedding");
  });

  it("returns name_bs in Bosnian", () => {
    expect(localTagName(tag, "bs")).toBe("Vjenčanje");
  });
});

// ── Tag ID deduplication ───────────────────────────────────────────────────

describe("deduplicateTagIds", () => {
  it("removes duplicate IDs", () => {
    expect(deduplicateTagIds([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
  });

  it("preserves order of first occurrence", () => {
    expect(deduplicateTagIds([5, 3, 5, 1])).toEqual([5, 3, 1]);
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateTagIds([])).toEqual([]);
  });

  it("no-ops when all IDs are already unique", () => {
    expect(deduplicateTagIds([10, 20, 30])).toEqual([10, 20, 30]);
  });
});

// ── Tag chip URL generation ────────────────────────────────────────────────

describe("tag shop URL", () => {
  it("uses tag ID (not name) in the query param", () => {
    const tag: ProductTag = { id: 42, name_en: "Gift", name_bs: "Poklon", created_at: "" };
    const url = `/shop?tag=${tag.id}`;
    expect(url).toBe("/shop?tag=42");
    expect(url).not.toContain("Gift");
  });
});
