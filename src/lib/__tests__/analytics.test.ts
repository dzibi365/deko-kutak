import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildGA4PurchasePayload,
  isPurchaseFired,
  markPurchaseFired,
  trackPurchase,
  trackViewItem,
  trackAddToCart,
  trackBeginCheckout,
  setAnalyticsConsent,
  _resetAnalyticsForTests,
  _isSafeToTrack,
  type GA4Item,
} from "../analytics";

// ─── sessionStorage mock ──────────────────────────────────────────────────────

const ssStore: Record<string, string> = {};
vi.stubGlobal("sessionStorage", {
  getItem: (k: string) => ssStore[k] ?? null,
  setItem: (k: string, v: string) => { ssStore[k] = v; },
  removeItem: (k: string) => { delete ssStore[k]; },
  clear: () => { Object.keys(ssStore).forEach((k) => delete ssStore[k]); },
});

// ─── localStorage mock ────────────────────────────────────────────────────────

const lsStore: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => lsStore[k] ?? null,
  setItem: (k: string, v: string) => { lsStore[k] = v; },
  removeItem: (k: string) => { delete lsStore[k]; },
  clear: () => { Object.keys(lsStore).forEach((k) => delete lsStore[k]); },
});

// ─── window / document mock ───────────────────────────────────────────────────
// gtag is pre-stubbed so injectScript does NOT overwrite it (it checks
// typeof window.gtag !== "function" before assigning).

const gtagCalls: unknown[][] = [];
const mockGtag = (...args: unknown[]) => { gtagCalls.push([...args]); };

vi.stubGlobal("window", {
  dataLayer: [],
  gtag: mockGtag,
});
const cookieJar: string[] = [];
vi.stubGlobal("document", {
  createElement: () => ({ async: false, src: "" }),
  head: { appendChild: vi.fn() },
  get cookie() { return cookieJar.join("; "); },
  set cookie(v: string) { cookieJar.push(v); },
});

// ─── Reset between tests ──────────────────────────────────────────────────────

beforeEach(() => {
  _resetAnalyticsForTests();
  gtagCalls.length = 0;
  Object.keys(ssStore).forEach((k) => delete ssStore[k]);
  Object.keys(lsStore).forEach((k) => delete lsStore[k]);
  cookieJar.length = 0;
});

// ─── buildGA4PurchasePayload ──────────────────────────────────────────────────

describe("buildGA4PurchasePayload", () => {
  const items: GA4Item[] = [
    { item_id: "7", item_name: "Bear Box", item_category: "Kids' Corner", price: 29.99, quantity: 2 },
  ];

  it("sets transaction_id from orderNumber", () => {
    const p = buildGA4PurchasePayload("DK-2026-00001", 65.98, 5.00, items);
    expect(p.transaction_id).toBe("DK-2026-00001");
  });

  it("sets currency to BAM", () => {
    const p = buildGA4PurchasePayload("DK-2026-00001", 65.98, 5.00, items);
    expect(p.currency).toBe("BAM");
  });

  it("sets value and shipping exactly", () => {
    const p = buildGA4PurchasePayload("DK-2026-00001", 65.98, 5.00, items);
    expect(p.value).toBe(65.98);
    expect(p.shipping).toBe(5.00);
  });

  it("passes items array through unchanged", () => {
    const p = buildGA4PurchasePayload("DK-2026-00001", 65.98, 5.00, items);
    expect(p.items).toEqual(items);
  });

  it("works with zero shipping (free shipping)", () => {
    const p = buildGA4PurchasePayload("DK-2026-00002", 50.00, 0, items);
    expect(p.shipping).toBe(0);
  });

  it("works with empty items array", () => {
    const p = buildGA4PurchasePayload("DK-2026-00003", 0, 0, []);
    expect(p.items).toEqual([]);
  });
});

// ─── Purchase deduplication ───────────────────────────────────────────────────

describe("isPurchaseFired / markPurchaseFired", () => {
  it("returns false for an unknown order number", () => {
    expect(isPurchaseFired("DK-2026-99999")).toBe(false);
  });

  it("returns true after markPurchaseFired", () => {
    markPurchaseFired("DK-2026-00010");
    expect(isPurchaseFired("DK-2026-00010")).toBe(true);
  });

  it("does not affect other order numbers", () => {
    markPurchaseFired("DK-2026-00011");
    expect(isPurchaseFired("DK-2026-00012")).toBe(false);
  });

  it("idempotent — marking twice keeps it fired", () => {
    markPurchaseFired("DK-2026-00013");
    markPurchaseFired("DK-2026-00013");
    expect(isPurchaseFired("DK-2026-00013")).toBe(true);
  });
});

// ─── Consent gating ───────────────────────────────────────────────────────────

describe("setAnalyticsConsent — enabled flag", () => {
  it("starts disabled after reset", () => {
    expect(_isSafeToTrack()).toBe(false);
  });

  it("enables tracking when called with true and a measurement ID", () => {
    setAnalyticsConsent(true, "G-TESTTEST1");
    expect(_isSafeToTrack()).toBe(true);
  });

  it("does NOT enable tracking when measurementId is blank", () => {
    setAnalyticsConsent(true, "");
    expect(_isSafeToTrack()).toBe(false);
  });

  it("disables tracking when called with false", () => {
    setAnalyticsConsent(true, "G-TESTTEST1");
    setAnalyticsConsent(false, "G-TESTTEST1");
    expect(_isSafeToTrack()).toBe(false);
  });

  it("sends consent update to gtag when disabling", () => {
    setAnalyticsConsent(true, "G-TESTTEST1");
    gtagCalls.length = 0; // clear injection calls
    setAnalyticsConsent(false, "G-TESTTEST1");
    expect(gtagCalls.some(([cmd]) => cmd === "consent")).toBe(true);
  });
});

// ─── Consent withdrawal — cookie cleanup ──────────────────────────────────────

describe("setAnalyticsConsent — cookie cleanup on withdrawal", () => {
  it("expires _ga cookie on revocation", () => {
    setAnalyticsConsent(true, "G-TESTTEST1");
    setAnalyticsConsent(false, "G-TESTTEST1");
    expect(cookieJar.some((c) => c.startsWith("_ga=") && c.includes("1970"))).toBe(true);
  });

  it("expires measurement-ID-specific _ga_* cookie on revocation", () => {
    setAnalyticsConsent(true, "G-TESTTEST1");
    setAnalyticsConsent(false, "G-TESTTEST1");
    // G-TESTTEST1 → tag suffix is TESTTEST1
    expect(cookieJar.some((c) => c.startsWith("_ga_TESTTEST1=") && c.includes("1970"))).toBe(true);
  });

  it("does NOT touch cookies when disabling with blank measurementId", () => {
    // blank ID means script was never injected, no _ga_* cookie to clear
    setAnalyticsConsent(false, "");
    expect(cookieJar.some((c) => c.startsWith("_ga_"))).toBe(false);
    // _ga base cookie deletion still runs (harmless if cookie doesn't exist)
    expect(cookieJar.some((c) => c.startsWith("_ga="))).toBe(true);
  });
});

// ─── trackViewItem payload ────────────────────────────────────────────────────

describe("trackViewItem", () => {
  beforeEach(() => { setAnalyticsConsent(true, "G-TESTTEST1"); gtagCalls.length = 0; });

  it("fires view_item event", () => {
    trackViewItem({ id: 23, name: "Wooden Album", name_en: "Wooden Wedding Album", category: "Wedding", price: 39.99 });
    expect(gtagCalls.some(([, name]) => name === "view_item")).toBe(true);
  });

  it("uses name_en when available", () => {
    trackViewItem({ id: 23, name: "Drveni Album", name_en: "Wooden Wedding Album", category: "Wedding", price: 39.99 });
    const call = gtagCalls.find(([, name]) => name === "view_item");
    const params = call?.[2] as Record<string, unknown>;
    const items = params?.items as GA4Item[];
    expect(items?.[0]?.item_name).toBe("Wooden Wedding Album");
  });

  it("falls back to name when name_en is null", () => {
    trackViewItem({ id: 1, name: "Drveni Album", name_en: null, category: "Wedding", price: 39.99 });
    const call = gtagCalls.find(([, name]) => name === "view_item");
    const params = call?.[2] as Record<string, unknown>;
    const items = params?.items as GA4Item[];
    expect(items?.[0]?.item_name).toBe("Drveni Album");
  });

  it("sets currency to BAM", () => {
    trackViewItem({ id: 1, name: "A", name_en: null, category: "Wedding", price: 10 });
    const call = gtagCalls.find(([, name]) => name === "view_item");
    const params = call?.[2] as Record<string, unknown>;
    expect(params?.currency).toBe("BAM");
  });

  it("does NOT fire when analytics is disabled", () => {
    setAnalyticsConsent(false, "G-TESTTEST1");
    gtagCalls.length = 0;
    trackViewItem({ id: 1, name: "A", name_en: null, category: "Wedding", price: 10 });
    expect(gtagCalls.some(([, name]) => name === "view_item")).toBe(false);
  });
});

// ─── trackAddToCart payload ───────────────────────────────────────────────────

describe("trackAddToCart", () => {
  beforeEach(() => { setAnalyticsConsent(true, "G-TESTTEST1"); gtagCalls.length = 0; });

  it("fires add_to_cart event", () => {
    trackAddToCart({ id: 7, name: "Bear Box", name_en: "Bear Box EN", category: "Kids' Corner", price: 24.99 });
    expect(gtagCalls.some(([, name]) => name === "add_to_cart")).toBe(true);
  });

  it("sets item_id as string", () => {
    trackAddToCart({ id: 7, name: "Bear Box", name_en: null, category: "Kids' Corner", price: 24.99 });
    const call = gtagCalls.find(([, name]) => name === "add_to_cart");
    const params = call?.[2] as Record<string, unknown>;
    const items = params?.items as GA4Item[];
    expect(items?.[0]?.item_id).toBe("7");
  });

  it("does NOT fire when analytics is disabled", () => {
    setAnalyticsConsent(false, "G-TESTTEST1");
    gtagCalls.length = 0;
    trackAddToCart({ id: 7, name: "A", name_en: null, category: "Kids' Corner", price: 10 });
    expect(gtagCalls.some(([, name]) => name === "add_to_cart")).toBe(false);
  });
});

// ─── trackBeginCheckout payload ───────────────────────────────────────────────

describe("trackBeginCheckout", () => {
  beforeEach(() => { setAnalyticsConsent(true, "G-TESTTEST1"); gtagCalls.length = 0; });

  const items: GA4Item[] = [
    { item_id: "23", item_name: "Wedding Album", item_category: "Wedding", price: 39.99, quantity: 1 },
  ];

  it("fires begin_checkout event", () => {
    trackBeginCheckout(items, 44.99);
    expect(gtagCalls.some(([, name]) => name === "begin_checkout")).toBe(true);
  });

  it("passes value and currency", () => {
    trackBeginCheckout(items, 44.99);
    const call = gtagCalls.find(([, name]) => name === "begin_checkout");
    const params = call?.[2] as Record<string, unknown>;
    expect(params?.value).toBe(44.99);
    expect(params?.currency).toBe("BAM");
  });

  it("does NOT fire when analytics is disabled", () => {
    setAnalyticsConsent(false, "G-TESTTEST1");
    gtagCalls.length = 0;
    trackBeginCheckout(items, 44.99);
    expect(gtagCalls.some(([, name]) => name === "begin_checkout")).toBe(false);
  });

  // Dedup (once per visit, re-fires on checkout re-entry) is the caller's
  // responsibility via a useRef in Checkout.tsx. This test documents that the
  // module itself does NOT suppress repeated calls — each call that passes the
  // consent gate fires an event.
  it("fires on every call — dedup is Checkout component's responsibility", () => {
    trackBeginCheckout(items, 44.99);
    trackBeginCheckout(items, 44.99);
    const fired = gtagCalls.filter(([, name]) => name === "begin_checkout");
    expect(fired).toHaveLength(2);
  });
});

// ─── trackPurchase deduplication ─────────────────────────────────────────────

describe("trackPurchase", () => {
  beforeEach(() => { setAnalyticsConsent(true, "G-TESTTEST1"); gtagCalls.length = 0; });

  const items: GA4Item[] = [
    { item_id: "24", item_name: "Forever Together Album", item_category: "Wedding", price: 49.99, quantity: 1 },
  ];

  it("fires purchase event on first call", () => {
    trackPurchase("DK-2026-00020", 54.99, 5.00, items);
    expect(gtagCalls.some(([, name]) => name === "purchase")).toBe(true);
  });

  it("does NOT fire on second call for same order number", () => {
    trackPurchase("DK-2026-00021", 54.99, 5.00, items);
    gtagCalls.length = 0;
    trackPurchase("DK-2026-00021", 54.99, 5.00, items);
    expect(gtagCalls.some(([, name]) => name === "purchase")).toBe(false);
  });

  it("marks order as fired in localStorage", () => {
    trackPurchase("DK-2026-00022", 54.99, 5.00, items);
    expect(isPurchaseFired("DK-2026-00022")).toBe(true);
  });

  it("does NOT fire when analytics is disabled", () => {
    setAnalyticsConsent(false, "G-TESTTEST1");
    gtagCalls.length = 0;
    trackPurchase("DK-2026-00023", 54.99, 5.00, items);
    expect(gtagCalls.some(([, name]) => name === "purchase")).toBe(false);
  });

  it("does NOT mark order as fired when analytics is disabled", () => {
    setAnalyticsConsent(false, "G-TESTTEST1");
    trackPurchase("DK-2026-00024", 54.99, 5.00, items);
    // Analytics disabled → early return → markPurchaseFired is never called
    expect(isPurchaseFired("DK-2026-00024")).toBe(false);
  });

  it("dedup persists across calls (simulates new tab / new session)", () => {
    trackPurchase("DK-2026-00025", 54.99, 5.00, items);
    // Simulate a new session by resetting module state but keeping localStorage
    _resetAnalyticsForTests();
    setAnalyticsConsent(true, "G-TESTTEST1");
    gtagCalls.length = 0;
    trackPurchase("DK-2026-00025", 54.99, 5.00, items);
    expect(gtagCalls.some(([, name]) => name === "purchase")).toBe(false);
  });
});
