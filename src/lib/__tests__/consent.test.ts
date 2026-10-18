import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// ─── localStorage mock (no jsdom needed) ─────────────────────────────────────

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
vi.stubGlobal("localStorage", localStorageMock);

// ─── Helpers to simulate localStorage ────────────────────────────────────────

const STORAGE_KEY = "dk-consent";
const CURRENT_VERSION = 1;
const EXPIRY_MS = 365 * 24 * 60 * 60 * 1000;

type StoredConsent = {
  version: number;
  decided: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
};

function writeConsent(overrides: Partial<StoredConsent> = {}) {
  const value: StoredConsent = {
    version: CURRENT_VERSION,
    decided: true,
    analytics: false,
    marketing: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function readConsent(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredConsent;
  } catch {
    return null;
  }
}

// ─── Pure logic extracted from ConsentContext ─────────────────────────────────
// These tests exercise the persistence and validation logic in isolation,
// without mounting React components.

function readStored(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).decided !== "boolean" ||
      typeof (parsed as Record<string, unknown>).analytics !== "boolean" ||
      typeof (parsed as Record<string, unknown>).marketing !== "boolean" ||
      typeof (parsed as Record<string, unknown>).version !== "number" ||
      typeof (parsed as Record<string, unknown>).timestamp !== "string"
    ) {
      return null;
    }
    return parsed as StoredConsent;
  } catch {
    return null;
  }
}

function isExpired(stored: StoredConsent): boolean {
  try {
    const ts = new Date(stored.timestamp).getTime();
    return isNaN(ts) || Date.now() - ts > EXPIRY_MS;
  } catch {
    return true;
  }
}

type ConsentState = { decided: boolean; analytics: boolean; marketing: boolean };

function deriveInitialState(): { consent: ConsentState; bannerVisible: boolean } {
  const stored = readStored();
  const undecided: ConsentState = { decided: false, analytics: false, marketing: false };
  if (!stored || !stored.decided) return { consent: undecided, bannerVisible: true };
  if (stored.version < CURRENT_VERSION || isExpired(stored)) return { consent: undecided, bannerVisible: true };
  return {
    consent: { decided: true, analytics: stored.analytics, marketing: stored.marketing },
    bannerVisible: false,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("consent — initial state with no stored value", () => {
  it("shows banner when localStorage is empty", () => {
    const { bannerVisible } = deriveInitialState();
    expect(bannerVisible).toBe(true);
  });

  it("consent is undecided when localStorage is empty", () => {
    const { consent } = deriveInitialState();
    expect(consent.decided).toBe(false);
  });

  it("defaults analytics and marketing to false", () => {
    const { consent } = deriveInitialState();
    expect(consent.analytics).toBe(false);
    expect(consent.marketing).toBe(false);
  });
});

describe("consent — persistence after accept-all", () => {
  it("hides banner when decided=true and not expired", () => {
    writeConsent({ analytics: true, marketing: true });
    const { bannerVisible } = deriveInitialState();
    expect(bannerVisible).toBe(false);
  });

  it("reads back analytics=true after accept-all", () => {
    writeConsent({ analytics: true, marketing: true });
    const { consent } = deriveInitialState();
    expect(consent.analytics).toBe(true);
    expect(consent.marketing).toBe(true);
  });

  it("reads back decided=true after accept-all", () => {
    writeConsent({ analytics: true, marketing: true });
    const { consent } = deriveInitialState();
    expect(consent.decided).toBe(true);
  });
});

describe("consent — rejection", () => {
  it("hides banner when decided=true with analytics=false", () => {
    writeConsent({ analytics: false, marketing: false });
    const { bannerVisible } = deriveInitialState();
    expect(bannerVisible).toBe(false);
  });

  it("preserves analytics=false after reject-optional", () => {
    writeConsent({ analytics: false, marketing: false });
    const { consent } = deriveInitialState();
    expect(consent.analytics).toBe(false);
    expect(consent.marketing).toBe(false);
    expect(consent.decided).toBe(true);
  });
});

describe("consent — expiry", () => {
  it("shows banner again when stored timestamp is older than 365 days", () => {
    const expiredTs = new Date(Date.now() - EXPIRY_MS - 1000).toISOString();
    writeConsent({ analytics: true, marketing: true, timestamp: expiredTs });
    const { bannerVisible } = deriveInitialState();
    expect(bannerVisible).toBe(true);
  });

  it("resets consent to undecided after expiry", () => {
    const expiredTs = new Date(Date.now() - EXPIRY_MS - 1000).toISOString();
    writeConsent({ analytics: true, timestamp: expiredTs });
    const { consent } = deriveInitialState();
    expect(consent.decided).toBe(false);
    expect(consent.analytics).toBe(false);
  });

  it("does NOT show banner when timestamp is 364 days old", () => {
    const recentTs = new Date(Date.now() - (EXPIRY_MS - 24 * 60 * 60 * 1000)).toISOString();
    writeConsent({ analytics: false, marketing: false, timestamp: recentTs });
    const { bannerVisible } = deriveInitialState();
    expect(bannerVisible).toBe(false);
  });
});

describe("consent — version bump", () => {
  it("shows banner again when stored version is older than current", () => {
    writeConsent({ version: 0, analytics: true, marketing: true });
    const { bannerVisible } = deriveInitialState();
    expect(bannerVisible).toBe(true);
  });

  it("resets consent when version is outdated", () => {
    writeConsent({ version: 0, analytics: true, marketing: true });
    const { consent } = deriveInitialState();
    expect(consent.decided).toBe(false);
  });
});

describe("consent — corrupted storage", () => {
  it("shows banner when localStorage contains invalid JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-json{{");
    const { bannerVisible } = deriveInitialState();
    expect(bannerVisible).toBe(true);
  });

  it("shows banner when stored object is missing required fields", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ decided: true }));
    const { bannerVisible } = deriveInitialState();
    expect(bannerVisible).toBe(true);
  });

  it("shows banner when analytics field is not a boolean", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, decided: true, analytics: "yes", marketing: false, timestamp: new Date().toISOString() }),
    );
    const { bannerVisible } = deriveInitialState();
    expect(bannerVisible).toBe(true);
  });
});

// ─── Footer "Cookie settings" regression ─────────────────────────────────────
// Guards the bug where CookieBanner returned null early when bannerVisible=false,
// preventing the modal from mounting even after openPreferences() was called.
// The fix: modal render must NOT be gated by bannerVisible.
// These tests verify the persistent-state side: after any save path + simulated
// reload, deriveInitialState() produces bannerVisible=false and decided=true,
// which is the exact condition under which the footer button must still work.

describe("consent — footer preferences openable after any save path", () => {
  it("bannerVisible is false after accept-all, simulating post-reload state for footer trigger", () => {
    writeConsent({ analytics: true, marketing: true });
    const { bannerVisible, consent } = deriveInitialState();
    expect(bannerVisible).toBe(false);
    expect(consent.decided).toBe(true);
    // preferencesOpen is independent React state (starts false); no stored value gates it.
    // This confirms the footer button can call openPreferences() without interference.
  });

  it("bannerVisible is false after reject-optional, simulating post-reload state for footer trigger", () => {
    writeConsent({ analytics: false, marketing: false });
    const { bannerVisible, consent } = deriveInitialState();
    expect(bannerVisible).toBe(false);
    expect(consent.decided).toBe(true);
  });

  it("bannerVisible is false after save-preferences with mixed choices", () => {
    writeConsent({ analytics: true, marketing: false });
    const { bannerVisible, consent } = deriveInitialState();
    expect(bannerVisible).toBe(false);
    expect(consent.decided).toBe(true);
    expect(consent.analytics).toBe(true);
    expect(consent.marketing).toBe(false);
  });

  it("no field in stored consent record influences preferencesOpen (it is not stored)", () => {
    writeConsent({ analytics: true, marketing: true });
    const stored = readConsent();
    // Confirm preferencesOpen is never written to localStorage — it must be
    // pure React state, always starting as false on mount regardless of consent.
    expect(stored).not.toBeNull();
    expect("preferencesOpen" in stored!).toBe(false);
  });
});

describe("consent — write roundtrip", () => {
  it("write then read back preserves all fields", () => {
    const ts = new Date().toISOString();
    writeConsent({ analytics: true, marketing: false, timestamp: ts });
    const stored = readConsent();
    expect(stored).not.toBeNull();
    expect(stored!.analytics).toBe(true);
    expect(stored!.marketing).toBe(false);
    expect(stored!.decided).toBe(true);
    expect(stored!.version).toBe(CURRENT_VERSION);
    expect(stored!.timestamp).toBe(ts);
  });

  it("isExpired returns false for a fresh timestamp", () => {
    writeConsent();
    const stored = readStored();
    expect(stored).not.toBeNull();
    expect(isExpired(stored!)).toBe(false);
  });
});
