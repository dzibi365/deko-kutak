import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_UPLOADS_PER_SESSION = 5;
const RATE_LIMIT_PER_HOUR = 10;
const BUCKET = "creation-requests";
// Short-lived URL so the customer can see a thumbnail while filling the form.
// Never stored server-side; expires before the session TTL.
const PREVIEW_URL_EXPIRY_SECONDS = 300;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const rawKey = form.get("idempotency_key");

    if (!(file instanceof File)) {
      return json({ error: "Missing 'file' field in form data" }, 400);
    }
    if (typeof rawKey !== "string" || !UUID_RE.test(rawKey)) {
      return json(
        { error: "Missing or invalid 'idempotency_key' (must be a UUID)" },
        400,
      );
    }
    const idempotencyKey = rawKey.toLowerCase();

    // ── Validate declared MIME type ──────────────────────────────────────────
    const declaredType = file.type.toLowerCase();
    const ext = MIME_TO_EXT[declaredType];
    if (!ext) {
      return json(
        { error: "Unsupported file type. Use JPEG, PNG, or WebP." },
        400,
      );
    }

    // ── Validate declared file size (before reading bytes) ───────────────────
    // Early rejection on obviously oversized files; the authoritative check
    // on actual bytes happens after file.arrayBuffer() below.
    if (file.size === 0) return json({ error: "File is empty." }, 400);
    if (file.size > MAX_FILE_SIZE) {
      return json({ error: "File too large. Maximum 5 MB." }, 413);
    }

    // ── Read file and perform authoritative size check ───────────────────────
    // file.size is from multipart headers and can be spoofed by a client that
    // manipulates the Content-Length of the part.  fileBytes.byteLength is the
    // actual number of bytes received, which is authoritative.
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    if (fileBytes.byteLength > MAX_FILE_SIZE) {
      return json({ error: "File too large. Maximum 5 MB." }, 413);
    }

    // ── Validate magic bytes ─────────────────────────────────────────────────
    // Prevents MIME spoofing: a renamed PDF with image/jpeg MIME header fails
    // here because its magic bytes don't match.
    const detectedType = detectMimeFromBytes(fileBytes);
    if (detectedType !== declaredType) {
      return json(
        { error: "File content does not match declared type." },
        400,
      );
    }

    // ── Supabase service-role client ─────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ── Feature flag gate ────────────────────────────────────────────────────
    // Checked before rate limiting so no counters are incremented and no
    // storage is written when the feature is administratively disabled.
    // A DB error is treated as disabled (fail-closed).
    const { data: flagRow, error: flagErr } = await supabase
      .from("store_settings")
      .select("custom_creation_enabled")
      .eq("id", 1)
      .single();

    if (flagErr || !flagRow?.custom_creation_enabled) {
      return json({ error: "Service not available." }, 503);
    }

    // ── Rate limiting ────────────────────────────────────────────────────────
    // IP extraction: Supabase Edge Functions (Deno Deploy) prepend the client
    // IP as the leftmost value in x-forwarded-for.  We use the leftmost entry,
    // consistent with the existing customer-upload function.
    //
    // Remaining uncertainty: if traffic passes through an intermediate CDN
    // before reaching Deno Deploy, the leftmost IP may be the CDN's egress
    // address rather than the end-user IP, causing all CDN-routed traffic to
    // share one rate-limit bucket.  For direct Supabase Edge Function calls
    // (no CDN in front), the leftmost IP is the true client IP.
    const ip = extractIp(req);
    const ipHash = await sha256Hex(ip);

    const { data: withinLimit, error: rateErr } = await supabase.rpc(
      "check_creation_upload_rate",
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

    // ── Per-session upload count (pre-insert gate) ───────────────────────────
    // This SELECT count is non-atomic with respect to the INSERT below.
    // Two concurrent requests could both read count < MAX and both proceed.
    // A post-insert compensating check (below) catches this race and rolls back
    // the surplus insert.  The RPC also enforces max 5 tokens at submit time,
    // providing a hard server-side limit regardless of any race here.
    const now = new Date().toISOString();
    const { count: preCount, error: countErr } = await supabase
      .from("creation_upload_sessions")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", idempotencyKey)
      .is("consumed_at", null)
      .gt("expires_at", now);
    if (countErr) {
      console.error("Upload count check error:", countErr);
      return json({ error: "Service error. Please try again." }, 500);
    }
    if ((preCount ?? 0) >= MAX_UPLOADS_PER_SESSION) {
      return json({ error: "Maximum 5 photos per submission." }, 422);
    }

    // ── Upload to private storage ────────────────────────────────────────────
    // Path is server-controlled: the client never influences it.
    // Sub-folder keyed to idempotency_key groups a session's photos together
    // and supports prefix-based cleanup.
    const fileUuid = crypto.randomUUID();
    const storagePath = `requests/${idempotencyKey}/${fileUuid}.${ext}`;

    const blob = new Blob([fileBytes], { type: declaredType });
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, blob, { contentType: declaredType, upsert: false });
    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return json({ error: "Upload failed. Please try again." }, 500);
    }

    // ── Create upload session ────────────────────────────────────────────────
    // Only the SHA-256 hash of the token is stored; the plaintext token is
    // returned once and never persisted.
    const token = crypto.randomUUID();
    const tokenHash = await sha256Hex(token);

    const { error: sessionErr } = await supabase
      .from("creation_upload_sessions")
      .insert({
        token_hash: tokenHash,
        idempotency_key: idempotencyKey,
        storage_path: storagePath,
        mime_type: declaredType,
        file_size: fileBytes.byteLength,
      });
    if (sessionErr) {
      console.error("Session creation error:", sessionErr);
      // Best-effort: remove the orphaned storage object before returning.
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return json({ error: "Upload failed. Please try again." }, 500);
    }

    // ── Post-insert concurrent-upload check ──────────────────────────────────
    // Re-count after our insert.  If two concurrent requests both passed the
    // pre-check and both inserted, the total exceeds MAX_UPLOADS_PER_SESSION.
    // The one that loses this check deletes its own session and storage object
    // so the final count converges to at most MAX_UPLOADS_PER_SESSION.
    //
    // Edge case: two concurrent 5th-file requests could both see count > MAX
    // and both roll back, leaving count at 4.  Either client can retry; one
    // will win the race on the next attempt.  This is preferable to allowing
    // count to permanently exceed MAX.
    const { count: postCount } = await supabase
      .from("creation_upload_sessions")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", idempotencyKey)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString());

    if ((postCount ?? 0) > MAX_UPLOADS_PER_SESSION) {
      // We were the surplus insert — roll back
      await supabase
        .from("creation_upload_sessions")
        .delete()
        .eq("token_hash", tokenHash);
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return json({ error: "Maximum 5 photos per submission." }, 422);
    }

    // ── Generate short-lived preview URL ─────────────────────────────────────
    // 5-minute signed URL so the customer can see a thumbnail while filling
    // the form.  Not stored anywhere; expires well before the session TTL.
    // A null preview_url (e.g. if signed URL generation fails) is safe —
    // the client should show a fallback placeholder instead.
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, PREVIEW_URL_EXPIRY_SECONDS);
    const previewUrl =
      !signErr && signed?.signedUrl ? signed.signedUrl : null;

    return json({ token, preview_url: previewUrl });
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

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 &&
    bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF" at 0-3, "WEBP" at 8-11
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
