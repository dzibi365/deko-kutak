import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const SMTP_HOST = Deno.env.get("SMTP_HOST")!;
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") ?? "587");
const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASS = Deno.env.get("SMTP_PASS")!;
const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL")!;
const SMTP_FROM_NAME = Deno.env.get("SMTP_FROM_NAME") ?? "Deko Kutak";
const PUBLIC_SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") ?? "").replace(/\/$/, "");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY");

const RATE_LIMIT_PER_HOUR = 3;
const MAX_UPLOAD_TOKENS = 5;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ── Parse request body ───────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // ── Extract and validate fields ──────────────────────────────────────────
    const idempotencyKey = str(body.idempotency_key);
    const fullName = str(body.full_name);
    const email = str(body.email);
    const phone = strOrNull(body.phone);
    const productType = strOrNull(body.product_type);
    const description = str(body.description);
    const dims = strOrNull(body.dims_colours_mats);
    const quantity = strOrNull(body.quantity);
    const galleryItemId = intOrNull(body.gallery_item_id);
    const lang = str(body.lang) === "en" ? "en" : "bs";
    const uploadTokens = parseUploadTokens(body.upload_tokens);
    const turnstileToken = str(body.turnstile_token);

    if (!idempotencyKey || !UUID_RE.test(idempotencyKey)) {
      return json({ error: "Missing or invalid 'idempotency_key'" }, 400);
    }
    if (!fullName.trim()) return json({ error: "Full name is required." }, 400);
    if (fullName.length > 200) return json({ error: "Full name too long." }, 400);
    if (!email.trim()) return json({ error: "Email address is required." }, 400);
    if (!EMAIL_RE.test(email) || email.length > 320) {
      return json({ error: "Invalid email address." }, 400);
    }
    if (!description.trim()) return json({ error: "Description is required." }, 400);
    if (description.length > 2000) return json({ error: "Description too long (max 2000 characters)." }, 400);
    if (phone && phone.length > 50) return json({ error: "Phone number too long." }, 400);
    if (productType && productType.length > 200) return json({ error: "Product type too long." }, 400);
    if (dims && dims.length > 500) return json({ error: "Dimensions/colours/materials too long." }, 400);
    if (quantity && quantity.length > 100) return json({ error: "Quantity field too long." }, 400);
    if (uploadTokens === null) {
      return json({ error: "Invalid upload_tokens format." }, 400);
    }
    if (uploadTokens.length > MAX_UPLOAD_TOKENS) {
      return json({ error: "Too many upload tokens. Maximum 5 allowed." }, 422);
    }
    if (!turnstileToken) {
      return json({ error: "CAPTCHA token is required." }, 400);
    }

    // ── Supabase service-role client ─────────────────────────────────────────
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // ── Feature flag gate (with temporary admin test bypass) ─────────────────
    // Normal path: checked before Turnstile and rate limiting so neither
    // Cloudflare API calls nor rate-limit counters are consumed when off.
    // A DB error is treated as disabled (fail-closed) in all paths.
    //
    // CREATION_ADMIN_TEST_MODE (staging-only Supabase secret):
    //   When true, non-admin callers are rejected regardless of flag state.
    //   Admin callers (verified server-side via auth.getUser) bypass the flag.
    //   Absent in production → this branch is unreachable there.
    //   REMOVE this block and restore the original gate after testing.
    const { data: flagRow, error: flagErr } = await supabase
      .from("store_settings")
      .select("custom_creation_enabled")
      .eq("id", 1)
      .single();

    const testMode = Deno.env.get("CREATION_ADMIN_TEST_MODE") === "true";

    if (testMode) {
      // Reject immediately on store_settings query error (fail-closed).
      if (flagErr) return json({ error: "Service not available." }, 503);
      // Verify admin JWT server-side — not from decoded client claims alone.
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
      if (!jwt) return json({ error: "Service not available." }, 503);
      const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
      if (authErr || !user || user.app_metadata?.role !== "admin") {
        return json({ error: "Service not available." }, 503);
      }
      // Verified admin. Turnstile, rate limit and all other checks remain active.
    } else if (flagErr || !flagRow?.custom_creation_enabled) {
      return json({ error: "Service not available." }, 503);
    }

    // ── Cloudflare Turnstile CAPTCHA verification ────────────────────────────
    if (!TURNSTILE_SECRET_KEY) {
      console.error("TURNSTILE_SECRET_KEY env var not set");
      return json({ error: "Service configuration error." }, 500);
    }
    const ip = extractIp(req);
    const captchaValid = await verifyTurnstile(turnstileToken, ip, TURNSTILE_SECRET_KEY);
    if (!captchaValid) {
      return json({ error: "CAPTCHA verification failed. Please try again." }, 400);
    }

    // ── Rate limiting ────────────────────────────────────────────────────────
    const ipHash = await sha256Hex(ip);
    const { data: withinLimit, error: rateErr } = await supabase.rpc(
      "check_creation_rate",
      { p_ip_hash: ipHash, p_limit: RATE_LIMIT_PER_HOUR },
    );
    if (rateErr) {
      console.error("Rate limit check error:", rateErr);
      return json({ error: "Service error. Please try again." }, 500);
    }
    if (!withinLimit) {
      return json(
        { error: "Too many submissions. Please try again next hour." },
        429,
      );
    }

    // ── Submit creation request via RPC ──────────────────────────────────────
    // The RPC is SECURITY DEFINER (service role only), runs atomically, and
    // handles idempotency via (idempotency_key, payload_hash).
    const { data: rows, error: rpcErr } = await supabase.rpc(
      "submit_creation_request",
      {
        p_idempotency_key: idempotencyKey.toLowerCase(),
        p_full_name: fullName,
        p_email: email,
        p_phone: phone,
        p_product_type: productType,
        p_description: description,
        p_dims_colours_mats: dims,
        p_quantity: quantity,
        p_gallery_item_id: galleryItemId,
        p_lang: lang,
        p_upload_tokens: uploadTokens.length > 0 ? uploadTokens : null,
      },
    );

    if (rpcErr) {
      return mapRpcError(rpcErr);
    }

    const row = (rows as Array<{ ref_number: string; already_submitted: boolean }>)?.[0];
    if (!row) {
      console.error("RPC returned no rows");
      return json({ error: "Service error. Please try again." }, 500);
    }

    const { ref_number: refNumber, already_submitted: alreadySubmitted } = row;

    // ── Send owner notification email ────────────────────────────────────────
    // Non-fatal: if email fails the request is already persisted in the DB.
    // We attempt to send even on retry (alreadySubmitted=true) in case the
    // previous attempt failed to deliver.
    try {
      const { data: settings } = await supabase
        .from("store_settings")
        .select("email_enabled, owner_email, store_name")
        .eq("id", 1)
        .single();

      if (settings?.email_enabled && settings.owner_email) {
        // Look up request_id (needed for the notification row)
        const { data: reqRow } = await supabase
          .from("creation_requests")
          .select("id")
          .eq("ref_number", refNumber)
          .single();

        if (reqRow?.id) {
          const requestId: number = reqRow.id;
          let notifId: number | null = null;

          if (alreadySubmitted) {
            // Re-attempt: claim_creation_notification handles 'failed' → retry;
            // returns NULL for 'sent' (no duplicate) or in-flight 'pending'.
            const { data } = await supabase.rpc(
              "claim_creation_notification",
              { p_creation_request_id: requestId, p_type: "owner_new_request" },
            );
            notifId = data ?? null;
          } else {
            // Fresh submission: the RPC created the notification as 'pending'.
            // claim_creation_notification returns NULL for rows created <2 min
            // ago, so query the row directly.
            const { data } = await supabase
              .from("creation_request_notifications")
              .select("id")
              .eq("creation_request_id", requestId)
              .eq("notification_type", "owner_new_request")
              .eq("status", "pending")
              .maybeSingle();
            notifId = data?.id ?? null;
          }

          if (notifId !== null) {
            const transporter = nodemailer.createTransport({
              host: SMTP_HOST,
              port: SMTP_PORT,
              secure: SMTP_PORT === 465,
              auth: { user: SMTP_USER, pass: SMTP_PASS },
            });
            const storeName: string = settings.store_name ?? "Deko Kutak";
            const ownerEmail: string = settings.owner_email;

            try {
              await transporter.sendMail({
                from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
                to: ownerEmail,
                subject: `Nova zahtjev za custom izradu — ${refNumber} (${fullName})`,
                html: buildOwnerEmail(storeName, {
                  refNumber,
                  fullName,
                  email,
                  phone,
                  productType,
                  description,
                  dims,
                  quantity,
                  galleryItemId,
                  lang,
                  photoCount: uploadTokens.length,
                }),
              });
              await supabase
                .from("creation_request_notifications")
                .update({ status: "sent" })
                .eq("id", notifId);
            } catch (mailErr) {
              console.error("Email send error:", mailErr);
              await supabase
                .from("creation_request_notifications")
                .update({ status: "failed", error_message: String(mailErr) })
                .eq("id", notifId);
            }
          }
        }
      }
    } catch (notifErr) {
      // Non-fatal: the request is safely persisted regardless of email outcome.
      console.error("Notification handling error:", notifErr);
    }

    return json({ ref_number: refNumber, already_submitted: alreadySubmitted });
  } catch (err) {
    console.error("Unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

// ─── RPC error mapper ─────────────────────────────────────────────────────────

function mapRpcError(err: { message?: string; code?: string }): Response {
  const msg = err.message ?? "";
  if (msg.includes("creation_requests_disabled")) {
    return json({ error: "Custom creation requests are not currently available." }, 503);
  }
  if (msg.includes("idempotency_conflict")) {
    return json(
      { error: "Submission data does not match the original request for this session ID." },
      409,
    );
  }
  if (msg.includes("concurrent_submission_conflict")) {
    return json({ error: "Submission conflict. Please try again." }, 409);
  }
  if (msg.includes("invalid_upload_token")) {
    return json({ error: "One or more photo uploads are invalid or expired." }, 422);
  }
  if (msg.includes("invalid_gallery_item")) {
    return json({ error: "Invalid gallery reference." }, 422);
  }
  if (msg.includes("too_many_upload_tokens")) {
    return json({ error: "Too many photo uploads. Maximum 5 allowed." }, 422);
  }
  // Validation errors caught server-side (shouldn't normally reach here
  // if the EF already validated inputs, but handles edge cases)
  if (err.code === "P0001") {
    return json({ error: "Invalid submission data." }, 400);
  }
  console.error("Unexpected RPC error:", err);
  return json({ error: "Service error. Please try again." }, 500);
}

// ─── Turnstile verification ───────────────────────────────────────────────────

async function verifyTurnstile(
  token: string,
  ip: string,
  secret: string,
): Promise<boolean> {
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: ip });
    const resp = await fetch(
      "https://challenges.cloudflare.com/turnstile/v1/siteverify",
      {
        method: "POST",
        body,
        headers: { "Accept": "application/json" },
      },
    );

    // Read body once as text; resp.json() throws on empty or non-JSON bodies.
    const rawText = await resp.text();

    if (!resp.ok || rawText.length === 0) {
      console.error(
        "Turnstile siteverify HTTP error:",
        resp.status,
        resp.headers.get("content-type") ?? "no content-type",
        "body_length:", rawText.length,
      );
      return false;
    }

    let data: { success?: boolean; "error-codes"?: string[] };
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error(
        "Turnstile siteverify JSON parse error:",
        resp.status,
        resp.headers.get("content-type") ?? "no content-type",
        "body_length:", rawText.length,
        parseErr,
      );
      return false;
    }

    if (!data?.success) {
      console.error(
        "Turnstile siteverify failed — http:", resp.status,
        "error-codes:", JSON.stringify(data?.["error-codes"] ?? []),
      );
    }
    return data?.success === true;
  } catch (err) {
    console.error("Turnstile network error:", err);
    return false;
  }
}

// ─── Owner notification email ─────────────────────────────────────────────────

type NotifData = {
  refNumber: string;
  fullName: string;
  email: string;
  phone: string | null;
  productType: string | null;
  description: string;
  dims: string | null;
  quantity: string | null;
  galleryItemId: number | null;
  lang: "en" | "bs";
  photoCount: number;
};

function buildOwnerEmail(storeName: string, d: NotifData): string {
  const adminUrl = PUBLIC_SITE_URL
    ? `${PUBLIC_SITE_URL}/admin/creation-requests`
    : null;

  const rows: string[] = [
    row("Broj zahtjeva", h(d.refNumber)),
    row("Ime i prezime", h(d.fullName)),
    row("Email", h(d.email)),
    d.phone ? row("Telefon", h(d.phone)) : "",
    d.productType ? row("Vrsta proizvoda", h(d.productType)) : "",
    row("Opis zahtjeva", `<span style="white-space:pre-wrap;">${h(d.description)}</span>`),
    d.dims ? row("Dimenzije / boje / materijali", `<span style="white-space:pre-wrap;">${h(d.dims)}</span>`) : "",
    d.quantity ? row("Količina", h(d.quantity)) : "",
    d.galleryItemId !== null
      ? row("Referentni rad iz Galerije", `#${d.galleryItemId}`)
      : "",
    d.photoCount > 0
      ? row("Priložene fotografije", `${d.photoCount} ${d.photoCount === 1 ? "fotografija" : "fotografija"}`)
      : "",
    row("Jezik zahtjeva", d.lang === "en" ? "Engleski" : "Bosanski"),
  ].filter(Boolean);

  const adminLink = adminUrl
    ? `<div style="margin-top:28px;">
        <a href="${h(adminUrl)}" style="display:inline-block;background:#1a2744;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">
          Pregledaj zahtjev u admin panelu &rarr;
        </a>
      </div>`
    : "";

  const content = `
    <h1 style="margin:0 0 6px;font-size:22px;color:#1a2744;font-weight:700;">Nova zahtjev za custom izradu</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#666;">Novi zahtjev je zaprimljen.</p>
    <table style="width:100%;border-collapse:collapse;">
      ${rows.join("\n")}
    </table>
    ${adminLink}
  `;

  return emailWrapper(storeName, content);
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 12px 8px 0;font-size:13px;color:#888;vertical-align:top;white-space:nowrap;width:40%;">${label}</td>
      <td style="padding:8px 0;font-size:14px;color:#1a2744;vertical-align:top;">${value}</td>
    </tr>`;
}

function emailWrapper(storeName: string, content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table style="width:100%;border-collapse:collapse;padding:40px 20px;" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table style="width:100%;max-width:580px;border-collapse:collapse;" cellpadding="0" cellspacing="0">
          <tr><td style="background:#1a2744;padding:28px 40px;border-radius:16px 16px 0 0;">
            <span style="font-size:20px;font-weight:700;color:white;letter-spacing:-.01em;">${h(storeName)}.</span>
          </td></tr>
          <tr><td style="background:white;padding:36px 40px;border-radius:0 0 16px 16px;">
            ${content}
          </td></tr>
          <tr><td style="padding:20px 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaa;">&copy; ${new Date().getFullYear()} ${h(storeName)}. Sva prava zadržana.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Supabase Edge Functions (Deno Deploy) set x-forwarded-for with the client
// IP as the leftmost entry.
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

// Escapes characters with special meaning in HTML so customer-supplied
// values render as literal text rather than markup.
function h(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  return typeof v === "string" ? v : null;
}

function intOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Returns parsed UUID array, empty array for null/undefined, or null if invalid.
function parseUploadTokens(v: unknown): string[] | null {
  if (v == null) return [];
  if (!Array.isArray(v)) return null;
  for (const t of v) {
    if (typeof t !== "string" || !UUID_RE.test(t)) return null;
  }
  return v as string[];
}
