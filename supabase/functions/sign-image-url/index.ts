import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Path must be a lowercase UUID v4 with a known image extension.
// This format is enforced server-side by the customer-upload function.
const VALID_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i;

// Token must be a UUID v4 (the format customer-upload issues via crypto.randomUUID).
const VALID_TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 15-minute signed URL TTL — short enough to limit exposure if a URL leaks,
// long enough that normal page load / image rendering never races the expiry.
const SIGNED_URL_EXPIRY_SECONDS = 900;

const BUCKET = "customer-uploads";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ── Parse request body ───────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (typeof body !== "object" || body === null) {
      return json({ error: "Invalid request body" }, 400);
    }

    const { path, token } = body as Record<string, unknown>;

    // ── Strict format validation ─────────────────────────────────────────────
    // Return 403 (not 400) for bad formats — don't reveal whether the path or
    // token format is the issue; uniform 403 prevents targeted enumeration.
    if (typeof path !== "string" || !VALID_PATH_RE.test(path)) {
      return json({ error: "Access denied" }, 403);
    }
    if (typeof token !== "string" || !VALID_TOKEN_RE.test(token)) {
      return json({ error: "Access denied" }, 403);
    }

    // ── Hash the submitted token ─────────────────────────────────────────────
    // The DB stores SHA-256(token), never the plaintext token.  Compute the
    // hash here and query by hash — the plaintext never touches the DB.
    const tokenHash = await sha256Hex(token);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ── Validate session in a single query ───────────────────────────────────
    // Conditions checked atomically:
    //   1. token_hash matches (credential is known)
    //   2. path matches (credential owns the requested file — not a different file)
    //   3. revoked_at IS NULL (not administratively revoked)
    //   4. expires_at > now() (not expired after 7-day TTL)
    //
    // All failure modes return the same 403 — the caller cannot distinguish
    // "wrong token", "expired", "revoked", or "path mismatch" from each other.
    const now = new Date().toISOString();
    const { data: session, error: lookupErr } = await supabase
      .from("upload_sessions")
      .select("id")
      .eq("token_hash", tokenHash)
      .eq("path", path)
      .is("revoked_at", null)
      .gt("expires_at", now)
      .maybeSingle();

    if (lookupErr) {
      console.error("Session lookup error:", lookupErr);
      return json({ error: "Service error" }, 500);
    }

    if (!session) {
      return json({ error: "Access denied" }, 403);
    }

    // ── Issue signed read URL ────────────────────────────────────────────────
    // Service role is required to sign URLs on a private bucket.  Using it
    // here also means this function will continue to work after the bucket
    // is switched from public to private in a later phase.
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

    if (signErr || !signed?.signedUrl) {
      console.error("Signed URL generation error:", signErr);
      return json({ error: "Failed to generate access URL" }, 500);
    }

    return json({ url: signed.signedUrl });
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

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
