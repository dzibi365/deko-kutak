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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let notificationId: number | null = null;

  try {
    const { orderId, notificationType } = await req.json() as {
      orderId: number;
      notificationType: "shipped" | "delivered";
    };

    if (!orderId || !["shipped", "delivered"].includes(notificationType)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: cors });
    }

    // Fetch order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_email, lang")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: cors });
    }

    const lang: "en" | "bs" = order.lang === "en" ? "en" : "bs";

    // Check if email notifications are enabled
    const { data: settings } = await supabase
      .from("store_settings")
      .select("email_enabled, store_name")
      .eq("id", 1)
      .single();

    if (!settings?.email_enabled) {
      return new Response(JSON.stringify({ skipped: "email_disabled" }), { headers: cors });
    }

    // Idempotency guard: insert a pending record — UNIQUE(order_id, notification_type) prevents duplicates.
    // If a record already exists (sent or failed), insert returns 0 rows and we abort.
    const { data: inserted, error: insertErr } = await supabase
      .from("order_notifications")
      .insert({
        order_id: orderId,
        notification_type: notificationType,
        recipient_email: order.customer_email,
        lang,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      // UNIQUE conflict → notification already sent (or in progress)
      console.log(`Skipping duplicate notification: order ${orderId} / ${notificationType}`);
      return new Response(JSON.stringify({ skipped: "already_notified" }), { headers: cors });
    }

    notificationId = inserted.id;
    const storeName = settings.store_name ?? "Deko Kutak";
    const t = statusT[lang][notificationType];
    const firstName = order.customer_name.split(" ")[0];

    // Send the email
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: order.customer_email,
      subject: `${t.subject} ${order.order_number}`,
      html: statusEmail(storeName, order.order_number, firstName, t, lang),
    });

    // Mark as sent
    await supabase
      .from("order_notifications")
      .update({ status: "sent" })
      .eq("id", notificationId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("send-status-email error:", err);

    // Mark as failed if we got as far as creating the record
    if (notificationId !== null) {
      await supabase
        .from("order_notifications")
        .update({ status: "failed", error_message: String(err) })
        .eq("id", notificationId);
    }

    // Return 200 so the caller (admin panel) doesn't treat this as a hard error —
    // the order status change already succeeded before this was called.
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: cors,
    });
  }
});

// ─── Bilingual status strings ──────────────────────────────────────────────────

const statusT = {
  en: {
    shipped: {
      subject: "DEKO KUTAK – Your Order Has Shipped",
      heading: "Your order is on its way!",
      body: (name: string, orderNo: string) =>
        `Dear ${name}, your order <strong>${orderNo}</strong> has been shipped and should arrive at your address soon. Thank you for shopping with us!`,
    },
    delivered: {
      subject: "DEKO KUTAK – Your Order Has Been Delivered",
      heading: "Your order has been delivered!",
      body: (name: string, orderNo: string) =>
        `Dear ${name}, your order <strong>${orderNo}</strong> has been marked as delivered. We hope you enjoy your products. Thank you for choosing DEKO KUTAK!`,
    },
  },
  bs: {
    shipped: {
      subject: "DEKO KUTAK – Vaša narudžba je poslana",
      heading: "Vaša narudžba je na putu!",
      body: (name: string, orderNo: string) =>
        `Poštovani/a ${name}, vaša narudžba <strong>${orderNo}</strong> je poslana i uskoro bi trebala stići na vašu adresu. Hvala vam na povjerenju!`,
    },
    delivered: {
      subject: "DEKO KUTAK – Vaša narudžba je dostavljena",
      heading: "Vaša narudžba je dostavljena!",
      body: (name: string, orderNo: string) =>
        `Poštovani/a ${name}, vaša narudžba <strong>${orderNo}</strong> označena je kao dostavljena. Nadamo se da ste zadovoljni proizvodima. Hvala vam što ste odabrali DEKO KUTAK!`,
    },
  },
} as const;

type StatusStrings = {
  subject: string;
  heading: string;
  body: (name: string, orderNo: string) => string;
};

function statusEmail(
  storeName: string,
  orderNumber: string,
  firstName: string,
  t: StatusStrings,
  lang: "en" | "bs"
) {
  const rights = lang === "en" ? "All rights reserved." : "Sva prava zadržana.";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table style="width:100%;border-collapse:collapse;padding:40px 20px;" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table style="width:100%;max-width:580px;border-collapse:collapse;" cellpadding="0" cellspacing="0">
          <tr><td style="background:#1a2744;padding:28px 40px;border-radius:16px 16px 0 0;">
            <span style="font-size:20px;font-weight:700;color:white;letter-spacing:-.01em;">${storeName}.</span>
          </td></tr>
          <tr><td style="background:white;padding:36px 40px;border-radius:0 0 16px 16px;">
            <h1 style="margin:0 0 20px;font-size:24px;color:#1a2744;font-weight:700;">${t.heading}</h1>

            <div style="background:#f5f5f0;border-radius:10px;padding:16px 20px;margin-bottom:24px;display:inline-block;">
              <p style="margin:0;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">${lang === "en" ? "Order Number" : "Broj narudžbe"}</p>
              <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1a2744;letter-spacing:.02em;">${orderNumber}</p>
            </div>

            <p style="margin:0;font-size:15px;color:#555;line-height:1.7;">${t.body(firstName, orderNumber)}</p>
          </td></tr>
          <tr><td style="padding:20px 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaa;">&copy; ${new Date().getFullYear()} ${storeName}. ${rights}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}
