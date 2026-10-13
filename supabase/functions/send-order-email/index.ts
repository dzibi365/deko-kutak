import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const SMTP_HOST = Deno.env.get("SMTP_HOST")!;
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") ?? "587");
const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASS = Deno.env.get("SMTP_PASS")!;
const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL")!;
const SMTP_FROM_NAME = Deno.env.get("SMTP_FROM_NAME") ?? "Deko Kutak";
// Optional — set to the storefront origin (e.g. https://dekokutak.ba).
// Used to generate an admin link in owner notification emails.
// If unset, the link is omitted and only the text indicator is shown.
const PUBLIC_SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") ?? "").replace(/\/$/, "");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Escapes the five characters with special meaning in HTML so that any
// customer-supplied value is rendered as literal text rather than markup.
// Apply to every untrusted string before embedding it in a template literal.
function h(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Track the claimed order ID so we can reset email_sent_at on SMTP failure,
  // allowing a retry with the same token.
  let claimedOrderId: number | null = null;

  try {
    const { emailToken, lang: rawLang } = await req.json();
    // Validate lang — default to Bosnian
    const lang: "en" | "bs" = rawLang === "en" ? "en" : "bs";

    // Reject obviously malformed tokens before touching the database.
    if (!emailToken || typeof emailToken !== "string") {
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }

    // Check email settings before claiming the token so we don't permanently
    // consume a token when email delivery is simply disabled in store settings.
    const { data: settings } = await supabase
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (!settings?.email_enabled) {
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }

    // Atomically claim the token.  The UPDATE only matches rows where the
    // token exists AND email_sent_at IS NULL, so concurrent duplicate requests
    // race safely: only one UPDATE wins; the other gets an empty result.
    // service_role bypasses RLS so this works for both guest and authenticated
    // orders.
    const { data: claimed } = await supabase
      .from("orders")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("email_token", emailToken)
      .is("email_sent_at", null)
      .select("*");

    const order = claimed?.[0];
    if (!order) {
      // Token not found, already used, or no matching row — always return
      // success to avoid leaking whether a given token corresponds to a real
      // order (prevents oracle-style enumeration).
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }

    claimedOrderId = order.id as number;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const storeName = settings.store_name ?? "Deko Kutak";
    const t = emailT[lang];

    // Send to customer
    await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: order.customer_email,
      subject: `${t.subject} ${order.order_number}`,
      html: customerEmail(order, settings, storeName, lang),
    });

    // Send to owner (always in Bosnian)
    if (settings.owner_email) {
      await transporter.sendMail({
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
        to: settings.owner_email,
        subject: `Nova narudžba — ${order.order_number} (${h(order.customer_name as string)})`,
        html: ownerEmail(order, storeName),
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    // Reset the claimed email_sent_at so a retry with the same token is possible
    // after a transient SMTP or network failure.
    if (claimedOrderId !== null) {
      await supabase
        .from("orders")
        .update({ email_sent_at: null })
        .eq("id", claimedOrderId);
    }
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors });
  }
});

// ─── Bilingual email strings ───────────────────────────────────────────────────

const emailT = {
  en: {
    subject: "DEKO KUTAK – Order Confirmation",
    heading: "Order Confirmed!",
    greeting: (name: string) => `Thank you, ${name}! We'll be in touch shortly.`,
    orderNumber: "Order Number",
    product: "Product",
    qty: "Qty",
    price: "Price",
    total: "Total",
    codTitle: "Cash on Delivery",
    codNote: "You will pay when your order arrives. No action needed now.",
    bankTitle: "Bank Transfer Details",
    bankHolder: "Account Holder",
    bankName: "Bank",
    bankIban: "IBAN",
    delivery: "Delivery Address",
    note: "Note",
    rights: "All rights reserved.",
  },
  bs: {
    subject: "DEKO KUTAK – Potvrda narudžbe",
    heading: "Narudžba potvrđena!",
    greeting: (name: string) => `Hvala vam, ${name}! Uskoro ćemo vas kontaktirati.`,
    orderNumber: "Broj narudžbe",
    product: "Proizvod",
    qty: "Kol.",
    price: "Cijena",
    total: "Ukupno",
    codTitle: "Plaćanje pouzećem",
    codNote: "Plaćanje se vrši prilikom preuzimanja narudžbe. Trenutno nije potrebno ništa dodatno poduzimati.",
    bankTitle: "Podaci za uplatu",
    bankHolder: "Nositelj računa",
    bankName: "Banka",
    bankIban: "IBAN",
    delivery: "Adresa dostave",
    note: "Napomena",
    rights: "Sva prava zadržana.",
  },
} as const;

// ─── Email templates ──────────────────────────────────────────────────────────

type OrderItem = {
  name: string;
  name_en?: string | null;
  name_bs?: string | null;
  quantity: number;
  price: number;
  customizations?: Record<string, string>;
};

// Matches storage paths generated by the customer-upload Edge Function.
// Format: <uuid-v4>.<jpg|jpeg|png|webp>
const STORAGE_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i;

function isImageUrl(val: string) {
  return val.startsWith("http") && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(val);
}

function isStoragePath(val: string) {
  return STORAGE_PATH_RE.test(val);
}

// adminOrdersUrl: pass the full URL to /admin/orders for owner emails;
// pass null for customer emails (no internal links in customer-facing copy).
function customizationsHtml(
  customizations: Record<string, string>,
  lang: "en" | "bs",
  adminOrdersUrl: string | null,
) {
  const entries = Object.entries(customizations).filter(([, v]) => v);
  if (entries.length === 0) return "";
  const rows = entries.map(([label, value]) => {
    // Legacy: inline image for publicly-accessible CDN URLs.
    // h() applied to label (used in alt attribute) and value (used in href/src).
    if (isImageUrl(value)) {
      return `<tr><td style="padding:4px 0;font-size:12px;color:#888;vertical-align:top;padding-right:8px;white-space:nowrap;">${h(label)}:</td><td style="padding:4px 0;"><a href="${h(value)}" style="display:inline-block;"><img src="${h(value)}" alt="${h(label)}" width="120" style="border-radius:8px;border:1px solid #e5e5e5;display:block;" /></a></td></tr>`;
    }
    // New private-upload paths: show text indicator; admin email adds panel link.
    // adminOrdersUrl is from PUBLIC_SITE_URL env var (admin-controlled), not user input.
    if (isStoragePath(value)) {
      const photoText = lang === "bs"
        ? "📷 Foto priložena uz narudžbu"
        : "📷 Photo attached to order";
      const linkHtml = adminOrdersUrl
        ? `<br><a href="${adminOrdersUrl}" style="font-size:11px;color:#1a2744;text-decoration:underline;margin-top:2px;display:inline-block;">Pogledaj fotografiju u admin panelu &rarr;</a>`
        : "";
      return `<tr><td style="padding:4px 0;font-size:12px;color:#888;vertical-align:top;padding-right:8px;white-space:nowrap;">${h(label)}:</td><td style="padding:4px 0;font-size:12px;color:#444;">${photoText}${linkHtml}</td></tr>`;
    }
    // Plain-text customization value — escape both label and value.
    return `<tr><td style="padding:2px 0;font-size:12px;color:#888;vertical-align:top;padding-right:8px;white-space:nowrap;">${h(label)}:</td><td style="padding:2px 0;font-size:12px;color:#444;">${h(value)}</td></tr>`;
  }).join("");
  return `<table style="border-collapse:collapse;margin-top:6px;">${rows}</table>`;
}

function itemsTable(items: OrderItem[], lang: "en" | "bs", adminOrdersUrl: string | null) {
  const t = emailT[lang];
  const rows = items.map((item) => {
    // Product names are stored client-side in the items JSONB and may have
    // been modified by a malicious client; escape them.
    const name = lang === "bs"
      ? (item.name_bs ?? item.name_en ?? item.name)
      : (item.name_en ?? item.name);
    return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0efe8;font-size:14px;color:#1a2744;vertical-align:top;">
        ${h(name)}
        ${item.customizations ? customizationsHtml(item.customizations, lang, adminOrdersUrl) : ""}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f0efe8;font-size:14px;color:#888;text-align:center;vertical-align:top;">×${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0efe8;font-size:14px;color:#1a2744;text-align:right;font-weight:600;vertical-align:top;">${(item.price * item.quantity).toFixed(2)} KM</td>
    </tr>`;
  }).join("");

  return `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.05em;padding-bottom:8px;text-align:left;font-weight:600;">${t.product}</th>
          <th style="font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.05em;padding-bottom:8px;text-align:center;font-weight:600;">${t.qty}</th>
          <th style="font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.05em;padding-bottom:8px;text-align:right;font-weight:600;">${t.price}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function paymentBlock(order: Record<string, unknown>, settings: Record<string, unknown>, lang: "en" | "bs") {
  const t = emailT[lang];
  if (order.payment_method === "bank_transfer") {
    return `
      <div style="background:#fffbf5;border:1px solid #f0e6d3;border-radius:12px;padding:20px;margin-top:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1a2744;text-transform:uppercase;letter-spacing:.05em;">${t.bankTitle}</p>
        ${settings.bank_account_holder ? `<p style="margin:4px 0;font-size:14px;color:#555;"><strong style="color:#1a2744;">${t.bankHolder}:</strong> ${settings.bank_account_holder}</p>` : ""}
        ${settings.bank_name ? `<p style="margin:4px 0;font-size:14px;color:#555;"><strong style="color:#1a2744;">${t.bankName}:</strong> ${settings.bank_name}</p>` : ""}
        ${settings.bank_iban ? `<p style="margin:8px 0 4px;font-size:14px;color:#555;"><strong style="color:#1a2744;">${t.bankIban}:</strong></p><p style="margin:0;font-size:16px;font-weight:700;color:#1a2744;font-family:monospace;letter-spacing:.05em;">${settings.bank_iban}</p>` : ""}
        ${settings.bank_note ? `<p style="margin:12px 0 0;font-size:13px;color:#888;">${settings.bank_note}</p>` : ""}
      </div>`;
  }
  return `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-top:24px;">
      <p style="margin:0;font-size:14px;color:#15803d;font-weight:600;">${t.codTitle}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#555;">${t.codNote}</p>
    </div>`;
}

function emailWrapper(storeName: string, content: string, lang: "en" | "bs") {
  const t = emailT[lang];
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table style="width:100%;border-collapse:collapse;padding:40px 20px;" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table style="width:100%;max-width:580px;border-collapse:collapse;" cellpadding="0" cellspacing="0">
          <tr><td style="background:#1a2744;padding:28px 40px;border-radius:16px 16px 0 0;">
            <span style="font-size:20px;font-weight:700;color:white;letter-spacing:-.01em;">${storeName}.</span>
          </td></tr>
          <tr><td style="background:white;padding:36px 40px;border-radius:0 0 16px 16px;">
            ${content}
          </td></tr>
          <tr><td style="padding:20px 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaa;">&copy; ${new Date().getFullYear()} ${storeName}. ${t.rights}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

function customerEmail(order: Record<string, unknown>, settings: Record<string, unknown>, storeName: string, lang: "en" | "bs") {
  const t = emailT[lang];
  const items = order.items as OrderItem[];
  // h() applied so that names like "O'Brien" or "<Test>" display as plain text.
  const firstName = h((order.customer_name as string).split(" ")[0]);
  return emailWrapper(storeName, `
    <h1 style="margin:0 0 6px;font-size:24px;color:#1a2744;font-weight:700;">${t.heading}</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#666;">${t.greeting(firstName)}</p>

    <div style="background:#f5f5f0;border-radius:10px;padding:16px 20px;margin-bottom:28px;display:inline-block;">
      <p style="margin:0;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">${t.orderNumber}</p>
      <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1a2744;letter-spacing:.02em;">${h(order.order_number as string)}</p>
    </div>

    ${itemsTable(items, lang, null)}

    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr>
        <td style="font-size:15px;color:#888;padding:12px 0 0;">${t.total}</td>
        <td style="font-size:20px;font-weight:700;color:#1a2744;padding:12px 0 0;text-align:right;">${(order.subtotal as number).toFixed(2)} KM</td>
      </tr>
    </table>

    ${paymentBlock(order, settings, lang)}

    <div style="border-top:1px solid #f0efe8;margin-top:28px;padding-top:20px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a2744;text-transform:uppercase;letter-spacing:.05em;">${t.delivery}</p>
      <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">${h(order.customer_address as string)}<br>${h(order.customer_city as string)}${order.customer_postal ? ` ${h(order.customer_postal as string)}` : ""}</p>
    </div>

    ${order.note ? `<div style="margin-top:20px;"><p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a2744;text-transform:uppercase;letter-spacing:.05em;">${t.note}</p><p style="margin:0;font-size:14px;color:#555;">${h(order.note as string)}</p></div>` : ""}
  `, lang);
}

function ownerEmail(order: Record<string, unknown>, storeName: string) {
  const items = order.items as OrderItem[];
  // Owner email stays in Bosnian
  return emailWrapper(storeName, `
    <h1 style="margin:0 0 6px;font-size:22px;color:#1a2744;font-weight:700;">Nova narudžba primljena</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#666;">Nova narudžba je zaprimljena u vašoj prodavnici.</p>

    <div style="background:#f5f5f0;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">Broj narudžbe</p>
      <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1a2744;">${h(order.order_number as string)}</p>
    </div>

    <div style="margin-bottom:24px;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1a2744;text-transform:uppercase;letter-spacing:.05em;">Kupac</p>
      <p style="margin:0;font-size:14px;color:#555;line-height:1.8;">
        <strong>${h(order.customer_name as string)}</strong><br>
        ${h(order.customer_email as string)}<br>
        ${order.customer_phone ? `${h(order.customer_phone as string)}<br>` : ""}
        ${h(order.customer_address as string)}, ${h(order.customer_city as string)}${order.customer_postal ? ` ${h(order.customer_postal as string)}` : ""}
      </p>
    </div>

    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1a2744;text-transform:uppercase;letter-spacing:.05em;">Stavke</p>
    ${itemsTable(items, "bs", PUBLIC_SITE_URL ? `${PUBLIC_SITE_URL}/admin/orders` : null)}

    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr>
        <td style="font-size:15px;color:#888;padding:12px 0 0;">Ukupno</td>
        <td style="font-size:20px;font-weight:700;color:#1a2744;padding:12px 0 0;text-align:right;">${(order.subtotal as number).toFixed(2)} KM</td>
      </tr>
    </table>

    <div style="border-top:1px solid #f0efe8;margin-top:20px;padding-top:16px;">
      <p style="margin:0;font-size:14px;color:#555;">
        <strong>Plaćanje:</strong> ${order.payment_method === "cod" ? "Pouzećem" : "Uplata na račun"}
      </p>
      ${order.note ? `<p style="margin:8px 0 0;font-size:14px;color:#555;"><strong>Napomena:</strong> ${h(order.note as string)}</p>` : ""}
    </div>
  `, "bs");
}
