import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const SMTP_HOST = Deno.env.get("SMTP_HOST")!;
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") ?? "587");
const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASS = Deno.env.get("SMTP_PASS")!;
const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL")!;
const SMTP_FROM_NAME = Deno.env.get("SMTP_FROM_NAME") ?? "Deko Kutak";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { orderNumber } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [{ data: order }, { data: settings }] = await Promise.all([
      supabase.from("orders").select("*").eq("order_number", orderNumber).single(),
      supabase.from("store_settings").select("*").eq("id", 1).single(),
    ]);

    if (!order) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: cors });
    if (!settings?.email_enabled) return new Response(JSON.stringify({ skipped: true }), { headers: cors });

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const storeName = settings.store_name ?? "Deko Kutak";

    // Send to customer
    await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: order.customer_email,
      subject: `Order confirmed — ${order.order_number}`,
      html: customerEmail(order, settings, storeName),
    });

    // Send to owner
    if (settings.owner_email) {
      await transporter.sendMail({
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
        to: settings.owner_email,
        subject: `New order — ${order.order_number} (${order.customer_name})`,
        html: ownerEmail(order, storeName),
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors });
  }
});

// ─── Email templates ──────────────────────────────────────────────────────────

function itemsTable(items: Array<{ name: string; name_en?: string; quantity: number; price: number }>) {
  const rows = items.map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0efe8;font-size:14px;color:#1a2744;">${item.name_en ?? item.name}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0efe8;font-size:14px;color:#888;text-align:center;">×${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0efe8;font-size:14px;color:#1a2744;text-align:right;font-weight:600;">${(item.price * item.quantity).toFixed(2)} KM</td>
    </tr>`).join("");

  return `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.05em;padding-bottom:8px;text-align:left;font-weight:600;">Product</th>
          <th style="font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.05em;padding-bottom:8px;text-align:center;font-weight:600;">Qty</th>
          <th style="font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.05em;padding-bottom:8px;text-align:right;font-weight:600;">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function paymentBlock(order: Record<string, unknown>, settings: Record<string, unknown>) {
  if (order.payment_method === "bank_transfer") {
    return `
      <div style="background:#fffbf5;border:1px solid #f0e6d3;border-radius:12px;padding:20px;margin-top:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1a2744;text-transform:uppercase;letter-spacing:.05em;">Bank Transfer Details</p>
        ${settings.bank_account_holder ? `<p style="margin:4px 0;font-size:14px;color:#555;"><strong style="color:#1a2744;">Account Holder:</strong> ${settings.bank_account_holder}</p>` : ""}
        ${settings.bank_name ? `<p style="margin:4px 0;font-size:14px;color:#555;"><strong style="color:#1a2744;">Bank:</strong> ${settings.bank_name}</p>` : ""}
        ${settings.bank_iban ? `<p style="margin:8px 0 4px;font-size:14px;color:#555;"><strong style="color:#1a2744;">IBAN:</strong></p><p style="margin:0;font-size:16px;font-weight:700;color:#1a2744;font-family:monospace;letter-spacing:.05em;">${settings.bank_iban}</p>` : ""}
        ${settings.bank_note ? `<p style="margin:12px 0 0;font-size:13px;color:#888;">${settings.bank_note}</p>` : ""}
      </div>`;
  }
  return `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-top:24px;">
      <p style="margin:0;font-size:14px;color:#15803d;font-weight:600;">Cash on Delivery</p>
      <p style="margin:6px 0 0;font-size:13px;color:#555;">You will pay when your order arrives. No action needed now.</p>
    </div>`;
}

function emailWrapper(storeName: string, content: string) {
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
            <p style="margin:0;font-size:12px;color:#aaa;">&copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

function customerEmail(order: Record<string, unknown>, settings: Record<string, unknown>, storeName: string) {
  const items = order.items as Array<{ name: string; name_en?: string; quantity: number; price: number }>;
  return emailWrapper(storeName, `
    <h1 style="margin:0 0 6px;font-size:24px;color:#1a2744;font-weight:700;">Order Confirmed!</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#666;">Thank you, ${(order.customer_name as string).split(" ")[0]}! We'll be in touch shortly.</p>

    <div style="background:#f5f5f0;border-radius:10px;padding:16px 20px;margin-bottom:28px;display:inline-block;">
      <p style="margin:0;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">Order Number</p>
      <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1a2744;letter-spacing:.02em;">${order.order_number}</p>
    </div>

    ${itemsTable(items)}

    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr>
        <td style="font-size:15px;color:#888;padding:12px 0 0;">Total</td>
        <td style="font-size:20px;font-weight:700;color:#1a2744;padding:12px 0 0;text-align:right;">${(order.subtotal as number).toFixed(2)} KM</td>
      </tr>
    </table>

    ${paymentBlock(order, settings)}

    <div style="border-top:1px solid #f0efe8;margin-top:28px;padding-top:20px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a2744;text-transform:uppercase;letter-spacing:.05em;">Delivery Address</p>
      <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">${order.customer_address}<br>${order.customer_city}${order.customer_postal ? ` ${order.customer_postal}` : ""}</p>
    </div>

    ${order.note ? `<div style="margin-top:20px;"><p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a2744;text-transform:uppercase;letter-spacing:.05em;">Note</p><p style="margin:0;font-size:14px;color:#555;">${order.note}</p></div>` : ""}
  `);
}

function ownerEmail(order: Record<string, unknown>, storeName: string) {
  const items = order.items as Array<{ name: string; name_en?: string; quantity: number; price: number }>;
  return emailWrapper(storeName, `
    <h1 style="margin:0 0 6px;font-size:22px;color:#1a2744;font-weight:700;">New Order Received</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#666;">A new order has been placed on your store.</p>

    <div style="background:#f5f5f0;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">Order Number</p>
      <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1a2744;">${order.order_number}</p>
    </div>

    <div style="margin-bottom:24px;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1a2744;text-transform:uppercase;letter-spacing:.05em;">Customer</p>
      <p style="margin:0;font-size:14px;color:#555;line-height:1.8;">
        <strong>${order.customer_name}</strong><br>
        ${order.customer_email}<br>
        ${order.customer_phone ? `${order.customer_phone}<br>` : ""}
        ${order.customer_address}, ${order.customer_city}${order.customer_postal ? ` ${order.customer_postal}` : ""}
      </p>
    </div>

    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1a2744;text-transform:uppercase;letter-spacing:.05em;">Items</p>
    ${itemsTable(items)}

    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr>
        <td style="font-size:15px;color:#888;padding:12px 0 0;">Total</td>
        <td style="font-size:20px;font-weight:700;color:#1a2744;padding:12px 0 0;text-align:right;">${(order.subtotal as number).toFixed(2)} KM</td>
      </tr>
    </table>

    <div style="border-top:1px solid #f0efe8;margin-top:20px;padding-top:16px;">
      <p style="margin:0;font-size:14px;color:#555;">
        <strong>Payment:</strong> ${order.payment_method === "cod" ? "Cash on Delivery" : "Bank Transfer"}
      </p>
      ${order.note ? `<p style="margin:8px 0 0;font-size:14px;color:#555;"><strong>Note:</strong> ${order.note}</p>` : ""}
    </div>
  `);
}
