// ─── Types ────────────────────────────────────────────────────────────────────

export type GA4Item = {
  item_id: string;
  item_name: string;
  item_category: string;
  price: number;
  quantity: number;
};

export type OrderAnalyticsPayload = {
  subtotal: number;
  shippingCost: number;
  orderTotal: number;
  analyticsItems?: GA4Item[];
};

// ─── Global declaration ───────────────────────────────────────────────────────

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

// ─── Module state ─────────────────────────────────────────────────────────────

let analyticsEnabled = false;
let scriptInjected = false;

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

export function isPurchaseFired(orderNumber: string): boolean {
  try {
    return localStorage.getItem(`dk-analytics-purchase-${orderNumber}`) === "1";
  } catch {
    return false;
  }
}

export function markPurchaseFired(orderNumber: string): void {
  try {
    localStorage.setItem(`dk-analytics-purchase-${orderNumber}`, "1");
  } catch {}
}

export function buildGA4PurchasePayload(
  orderNumber: string,
  value: number,
  shipping: number,
  items: GA4Item[],
): Record<string, unknown> {
  return { transaction_id: orderNumber, currency: "BAM", value, shipping, items };
}

// ─── Cookie cleanup ───────────────────────────────────────────────────────────

function deleteGACookies(measurementId: string): void {
  // Expire the base _ga cookie and the measurement-ID-specific session cookie.
  // Best-effort: domain scoping may prevent deletion if the cookie was set on a
  // parent domain, but this covers the common same-domain case.
  const expire = "expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
  try { document.cookie = `_ga=; ${expire}`; } catch {}
  if (measurementId) {
    const tag = measurementId.replace(/^G-/, "");
    try { document.cookie = `_ga_${tag}=; ${expire}`; } catch {}
  }
}

// ─── Script injection ─────────────────────────────────────────────────────────

function injectScript(measurementId: string): void {
  if (scriptInjected) return;
  scriptInjected = true;

  window.dataLayer = window.dataLayer ?? [];
  // Do not overwrite an existing gtag (e.g. a test stub set beforehand).
  if (typeof window.gtag !== "function") {
    window.gtag = function (...args: unknown[]) {
      window.dataLayer.push(args);
    };
  }
  window.gtag("js", new Date());
  window.gtag("config", measurementId);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
}

// ─── Internal gtag wrapper ────────────────────────────────────────────────────

function safeGtag(event: string, params: Record<string, unknown>): void {
  if (!analyticsEnabled) return;
  try {
    window.gtag("event", event, params);
  } catch {}
}

// ─── Consent control ──────────────────────────────────────────────────────────

/**
 * Called by AnalyticsLoader whenever consent.analytics changes.
 * measurementId defaults to the build-time env var; pass explicitly in tests.
 */
export function setAnalyticsConsent(
  enabled: boolean,
  measurementId: string = import.meta.env.VITE_GA_MEASUREMENT_ID ?? "",
): void {
  if (enabled && measurementId) {
    analyticsEnabled = true;
    injectScript(measurementId);
  } else if (!enabled) {
    analyticsEnabled = false;
    try {
      if (typeof window !== "undefined" && typeof window.gtag === "function") {
        // analytics_storage: denied stops GA4 writing new cookies and sending
        // measurement hits. The already-loaded script may still contact GTM for
        // config; only never injecting the script prevents all network activity.
        window.gtag("consent", "update", { analytics_storage: "denied" });
      }
    } catch {}
    deleteGACookies(measurementId);
  }
  // enabled=true with blank measurementId: no-op — analyticsEnabled stays false.
}

// ─── Event trackers ───────────────────────────────────────────────────────────

export function trackViewItem(product: {
  id: number;
  name: string;
  name_en: string | null;
  category: string;
  price: number;
}): void {
  safeGtag("view_item", {
    currency: "BAM",
    value: product.price,
    items: [{
      item_id: String(product.id),
      item_name: product.name_en ?? product.name,
      item_category: product.category,
      price: product.price,
      quantity: 1,
    }],
  });
}

export function trackAddToCart(item: {
  id: number;
  name: string;
  name_en: string | null;
  category: string;
  price: number;
}): void {
  safeGtag("add_to_cart", {
    currency: "BAM",
    value: item.price,
    items: [{
      item_id: String(item.id),
      item_name: item.name_en ?? item.name,
      item_category: item.category,
      price: item.price,
      quantity: 1,
    }],
  });
}

export function trackBeginCheckout(items: GA4Item[], value: number): void {
  safeGtag("begin_checkout", { currency: "BAM", value, items });
}

export function trackPurchase(
  orderNumber: string,
  value: number,
  shipping: number,
  items: GA4Item[],
): void {
  if (!analyticsEnabled || isPurchaseFired(orderNumber)) return;
  safeGtag("purchase", buildGA4PurchasePayload(orderNumber, value, shipping, items));
  markPurchaseFired(orderNumber);
}

// ─── Test utilities ───────────────────────────────────────────────────────────

/** Reset module state between tests. Not for production use. */
export function _resetAnalyticsForTests(): void {
  analyticsEnabled = false;
  scriptInjected = false;
}

/** Expose current enabled flag for assertion in tests. */
export function _isSafeToTrack(): boolean {
  return analyticsEnabled;
}
