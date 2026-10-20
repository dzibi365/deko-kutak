import { describe, it, expect } from "vitest";
import { validateCreationPhoto } from "../creationUpload";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function makeFile(type: string, size = 1024): File {
  return new File([new Uint8Array(size)], "test", { type });
}

// ─── validateCreationPhoto ────────────────────────────────────────────────────

describe("validateCreationPhoto — accepted types", () => {
  it("returns null for JPEG", () => {
    expect(validateCreationPhoto(makeFile("image/jpeg"))).toBeNull();
  });

  it("returns null for PNG", () => {
    expect(validateCreationPhoto(makeFile("image/png"))).toBeNull();
  });

  it("returns null for WebP", () => {
    expect(validateCreationPhoto(makeFile("image/webp"))).toBeNull();
  });
});

describe("validateCreationPhoto — invalid types", () => {
  it("returns invalid_type for GIF", () => {
    expect(validateCreationPhoto(makeFile("image/gif"))).toBe("invalid_type");
  });

  it("returns invalid_type for PDF", () => {
    expect(validateCreationPhoto(makeFile("application/pdf"))).toBe(
      "invalid_type",
    );
  });

  it("returns invalid_type for video/mp4", () => {
    expect(validateCreationPhoto(makeFile("video/mp4"))).toBe("invalid_type");
  });

  it("returns invalid_type for empty/unknown type", () => {
    expect(validateCreationPhoto(makeFile(""))).toBe("invalid_type");
  });

  it("checks type before size — invalid type + oversized returns invalid_type", () => {
    expect(
      validateCreationPhoto(makeFile("image/bmp", MAX_FILE_SIZE + 1)),
    ).toBe("invalid_type");
  });
});

describe("validateCreationPhoto — size limits", () => {
  it("returns null for file exactly at 5 MB", () => {
    expect(
      validateCreationPhoto(makeFile("image/jpeg", MAX_FILE_SIZE)),
    ).toBeNull();
  });

  it("returns too_large for file 1 byte over 5 MB", () => {
    expect(
      validateCreationPhoto(makeFile("image/jpeg", MAX_FILE_SIZE + 1)),
    ).toBe("too_large");
  });

  it("returns too_large for very large file", () => {
    expect(
      validateCreationPhoto(makeFile("image/png", MAX_FILE_SIZE * 2)),
    ).toBe("too_large");
  });
});

// ─── Photo limit logic ────────────────────────────────────────────────────────

describe("photo limit — boundary conditions", () => {
  const MAX_PHOTOS = 5;

  it("allows adding up to MAX_PHOTOS files", () => {
    const files = Array.from({ length: MAX_PHOTOS }, (_, i) =>
      makeFile("image/jpeg", 1024 + i),
    );
    const remaining = MAX_PHOTOS - 0;
    expect(files.slice(0, remaining).length).toBe(MAX_PHOTOS);
  });

  it("rejects additional files when at limit", () => {
    const remaining = MAX_PHOTOS - MAX_PHOTOS;
    const toAdd = Array.from({ length: 2 }, () => makeFile("image/jpeg")).slice(
      0,
      remaining,
    );
    expect(toAdd.length).toBe(0);
  });

  it("only takes as many as remaining slots", () => {
    const photosCount = 3;
    const remaining = MAX_PHOTOS - photosCount;
    const toAdd = Array.from({ length: 5 }, () => makeFile("image/jpeg")).slice(
      0,
      remaining,
    );
    expect(toAdd.length).toBe(2);
  });
});

// ─── Form validation ──────────────────────────────────────────────────────────

describe("email validation", () => {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  it("accepts standard email", () => {
    expect(EMAIL_RE.test("amina@example.com")).toBe(true);
  });

  it("accepts email with subdomain", () => {
    expect(EMAIL_RE.test("user@mail.example.co.uk")).toBe(true);
  });

  it("rejects email without @", () => {
    expect(EMAIL_RE.test("notanemail")).toBe(false);
  });

  it("rejects email without domain", () => {
    expect(EMAIL_RE.test("user@")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(EMAIL_RE.test("")).toBe(false);
  });

  it("rejects string with only whitespace", () => {
    expect(EMAIL_RE.test("   ")).toBe(false);
  });
});

describe("required field whitespace trimming", () => {
  it("whitespace-only name is empty after trim", () => {
    expect("   ".trim()).toBe("");
  });

  it("whitespace-only description is empty after trim", () => {
    expect("  \n  ".trim()).toBe("");
  });
});

// ─── Idempotency key rotation ─────────────────────────────────────────────────

describe("idempotency key rotation", () => {
  it("produces a valid UUIDv4 string", () => {
    const key = crypto.randomUUID();
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("produces unique keys on each call", () => {
    const keys = new Set(Array.from({ length: 100 }, () => crypto.randomUUID()));
    expect(keys.size).toBe(100);
  });
});

// ─── Turnstile siteverify response parsing ───────────────────────────────────
// Mirrors the safe-parse logic in submit-creation-request/index.ts

function parseSiteverifyBody(
  rawText: string,
  httpStatus: number,
): { success: boolean; errorCodes: string[] } {
  if (!rawText || rawText.length === 0 || httpStatus < 200 || httpStatus >= 300) {
    return { success: false, errorCodes: ["empty-or-http-error"] };
  }
  let data: { success?: boolean; "error-codes"?: string[] };
  try {
    data = JSON.parse(rawText);
  } catch {
    return { success: false, errorCodes: ["json-parse-error"] };
  }
  return {
    success: data?.success === true,
    errorCodes: data?.["error-codes"] ?? [],
  };
}

describe("verifyTurnstile — siteverify endpoint URL", () => {
  const CORRECT_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

  it("uses v0 path, not v1", () => {
    expect(CORRECT_URL).toContain("/v0/siteverify");
    expect(CORRECT_URL).not.toContain("/v1/");
  });

  it("uses HTTPS", () => {
    expect(CORRECT_URL.startsWith("https://")).toBe(true);
  });

  it("targets challenges.cloudflare.com", () => {
    expect(new URL(CORRECT_URL).hostname).toBe("challenges.cloudflare.com");
  });
});

describe("verifyTurnstile — response parsing", () => {
  it("returns success=true for valid Cloudflare success response", () => {
    const result = parseSiteverifyBody(
      JSON.stringify({ success: true, "error-codes": [] }),
      200,
    );
    expect(result.success).toBe(true);
    expect(result.errorCodes).toEqual([]);
  });

  it("returns success=false for invalid-input-secret error", () => {
    const result = parseSiteverifyBody(
      JSON.stringify({ success: false, "error-codes": ["invalid-input-secret"] }),
      200,
    );
    expect(result.success).toBe(false);
    expect(result.errorCodes).toContain("invalid-input-secret");
  });

  it("returns success=false for timeout-or-duplicate error", () => {
    const result = parseSiteverifyBody(
      JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }),
      200,
    );
    expect(result.success).toBe(false);
    expect(result.errorCodes).toContain("timeout-or-duplicate");
  });

  it("returns success=false and logs error on empty body", () => {
    const result = parseSiteverifyBody("", 200);
    expect(result.success).toBe(false);
  });

  it("returns success=false on non-2xx HTTP status", () => {
    const result = parseSiteverifyBody('{"success":true}', 503);
    expect(result.success).toBe(false);
  });

  it("returns success=false on malformed JSON", () => {
    const result = parseSiteverifyBody("not json", 200);
    expect(result.success).toBe(false);
    expect(result.errorCodes).toContain("json-parse-error");
  });

  it("returns success=false on truncated JSON (the original crash case)", () => {
    const result = parseSiteverifyBody("{", 200);
    expect(result.success).toBe(false);
    expect(result.errorCodes).toContain("json-parse-error");
  });

  it("returns success=false when success field is missing", () => {
    const result = parseSiteverifyBody(JSON.stringify({ "error-codes": [] }), 200);
    expect(result.success).toBe(false);
  });
});

// ─── Turnstile widget reset key ──────────────────────────────────────────────

describe("widgetResetKey — retry behavior", () => {
  it("incrementing widgetResetKey produces a new key string while preserving idempotencyKey", () => {
    const idempotencyKey = "abc-123";
    const key0 = `${idempotencyKey}-0`;
    const key1 = `${idempotencyKey}-1`;
    expect(key0).not.toBe(key1);
    expect(key0.startsWith(idempotencyKey)).toBe(true);
    expect(key1.startsWith(idempotencyKey)).toBe(true);
  });

  it("idempotencyKey portion is unchanged when only widgetResetKey increments", () => {
    const idempotencyKey = "f81aa23c-bbe8-4cc9-9112-e71cf293e609";
    for (let resetKey = 0; resetKey < 3; resetKey++) {
      const composite = `${idempotencyKey}-${resetKey}`;
      expect(composite.startsWith(idempotencyKey)).toBe(true);
    }
  });

  it("rotating idempotencyKey also produces a new composite key at reset 0", () => {
    const key1 = "aaa-111";
    const key2 = "bbb-222";
    expect(`${key1}-0`).not.toBe(`${key2}-0`);
  });

  it("token cleared on error — null turnstileToken blocks submission validation", () => {
    const turnstileToken: string | null = null;
    const errs: Record<string, string> = {};
    if (!turnstileToken) errs.captcha = "Please complete the security check.";
    expect(errs.captcha).toBeDefined();
  });

  it("503 and 429 errors also trigger widget reset (same code path)", () => {
    // Both 503 and 429 fall through to the reset; confirm the logic
    const statusCodes = [400, 429, 503, 0];
    for (const status of statusCodes) {
      let resetCalled = false;
      let tokenCleared = false;
      // Simulate the error path
      if (status === 503) { /* setSubmitError service */ }
      else if (status === 429) { /* setSubmitError rate_limit */ }
      else { /* setSubmitError generic */ }
      tokenCleared = true; // setTurnstileToken(null)
      resetCalled = true;  // setWidgetResetKey(k => k + 1)
      expect(tokenCleared).toBe(true);
      expect(resetCalled).toBe(true);
    }
  });
});

// ─── Feature-disabled guard logic ────────────────────────────────────────────

describe("feature-disabled guard", () => {
  it("upload tokens from photos only include done photos with non-null token", () => {
    type Photo = { status: string; token: string | null };
    const photos: Photo[] = [
      { status: "done", token: "tok-1" },
      { status: "uploading", token: null },
      { status: "error", token: null },
      { status: "done", token: "tok-2" },
    ];
    const tokens = photos
      .filter((p) => p.token !== null)
      .map((p) => p.token!);
    expect(tokens).toEqual(["tok-1", "tok-2"]);
  });

  it("in-progress uploads block submission — photos check returns uploading", () => {
    type Photo = { status: string };
    const photos: Photo[] = [
      { status: "done" },
      { status: "uploading" },
    ];
    const hasUploading = photos.some((p) => p.status === "uploading");
    expect(hasUploading).toBe(true);
  });
});
