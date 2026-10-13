import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const RATE_LIMIT_PER_HOUR = 10;
const BUCKET = "customer-uploads";

// Mapping from MIME type to canonical file extension.
// Only these three types are accepted.
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ── Parse multipart form data ────────────────────────────────────────────
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json({ error: "Expected multipart/form-data request" }, 400);
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ error: "Missing 'file' field in form data" }, 400);
    }

    // ── Validate declared MIME type ──────────────────────────────────────────
    const declaredType = file.type.toLowerCase();
    const ext = MIME_TO_EXT[declaredType];
    if (!ext) {
      return json(
        { error: "Unsupported file type. Use JPEG, PNG, or WebP." },
        400,
      );
    }

    // ── Validate file size (before reading bytes) ────────────────────────────
    if (file.size === 0) return json({ error: "File is empty." }, 400);
    if (file.size > MAX_FILE_SIZE) {
      return json({ error: "File too large. Maximum 5 MB." }, 413);
    }

    // ── Read file into memory ────────────────────────────────────────────────
    // Max 5 MB — safe to buffer entirely for magic byte validation.
    const fileBytes = new Uint8Array(await file.arrayBuffer());

    // ── Validate actual file content (magic bytes) ───────────────────────────
    // Prevents MIME type spoofing: a renamed PDF with image/jpeg MIME header
    // will fail here because its magic bytes don't match.
    const detectedType = detectMimeFromBytes(fileBytes);
    if (detectedType !== declaredType) {
      return json(
        { error: "File content does not match declared type." },
        400,
      );
    }

    // ── Rate limiting ────────────────────────────────────────────────────────
    // Hash the client IP before storing so raw IPs (PII) never touch the DB.
    const ip = extractIp(req);
    const ipHash = await sha256Hex(ip);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: withinLimit, error: rateErr } = await supabase.rpc(
      "check_upload_rate",
      { p_ip_hash: ipHash, p_limit: RATE_LIMIT_PER_HOUR },
    );

    if (rateErr) {
      console.error("Rate limit check error:", rateErr);
      return json({ error: "Service error. Please try again." }, 500);
    }
    if (!withinLimit) {
      return json(
        { error: "Too many uploads. Please try again next hour." },
        429,
      );
    }

    // ── Generate server-controlled storage path ──────────────────────────────
    // The client never influences the path; guessing an existing UUID is
    // computationally infeasible.
    const path = `${crypto.randomUUID()}.${ext}`;

    // ── Upload to storage via service role ───────────────────────────────────
    // upsert: false ensures an existing object at this path (UUID collision,
    // probability ~2^-122) is not overwritten — upload fails instead.
    const blob = new Blob([fileBytes], { type: declaredType });
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: declaredType, upsert: false });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return json({ error: "Upload failed. Please try again." }, 500);
    }

    // ── Create upload session ────────────────────────────────────────────────
    // Generate a cryptographically secure UUID token (CSPRNG via Web Crypto).
    // Only the SHA-256 hash is stored — the plaintext token is returned to the
    // client once and is never stored on the server.
    const token = crypto.randomUUID();
    const tokenHash = await sha256Hex(token);

    const { error: sessionErr } = await supabase
      .from("upload_sessions")
      .insert({ token_hash: tokenHash, path });

    if (sessionErr) {
      console.error("Session creation error:", sessionErr);
      // Best-effort cleanup: remove the orphaned storage object.
      await supabase.storage.from(BUCKET).remove([path]);
      return json({ error: "Upload failed. Please try again." }, 500);
    }

    // Return path (storage key) and plaintext token.
    // The token is the client's only credential for accessing this file.
    // The hash never leaves the server.
    return json({ path, token });
  } catch (err) {
    console.error("Unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function extractIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "anon";
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function detectMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A (8-byte signature)
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 &&
    bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF" at bytes 0-3, "WEBP" at bytes 8-11
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 &&
    bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 &&
    bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}
