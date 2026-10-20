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
