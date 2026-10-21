// Pure template helpers — no external dependencies so they can be unit-tested
// without nodemailer or Supabase being present.

export function h(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const emailT = {
  en: {
    subject: "DEKO KUTAK – Order Confirmation",
    heading: "Order Confirmed!",
    greeting: (name: string) => `Thank you, ${name}! We'll be in touch shortly.`,
    orderNumber: "Order Number",
    product: "Product",
    qty: "Qty",
    price: "Price",
    subtotal: "Products total",
    shipping: "Shipping",
    shippingFree: "Free",
    total: "Total to pay",
    codTitle: "Cash on Delivery",
    codNote: "You will pay when your order arrives. No action needed now.",
    bankTitle: "Bank Transfer Details",
    bankHolder: "Account Holder",
    bankName: "Bank",
    bankAccount: "Transaction Account",
    paymentRef: "Payment Reference",
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
    subtotal: "Vrijednost proizvoda",
    shipping: "Dostava",
    shippingFree: "Besplatno",
    total: "Ukupno za plaćanje",
    codTitle: "Plaćanje pouzećem",
    codNote: "Plaćanje se vrši prilikom preuzimanja narudžbe. Trenutno nije potrebno ništa dodatno poduzimati.",
    bankTitle: "Podaci za uplatu",
    bankHolder: "Nositelj računa",
    bankName: "Banka",
    bankAccount: "Transakcijski račun",
    paymentRef: "Svrha plaćanja",
    delivery: "Adresa dostave",
    note: "Napomena",
    rights: "Sva prava zadržana.",
  },
} as const;

export function paymentBlock(
  order: Record<string, unknown>,
  settings: Record<string, unknown>,
  lang: "en" | "bs",
): string {
  const t = emailT[lang];
  if (order.payment_method === "bank_transfer") {
    const rawAccount = String(settings.bank_iban ?? "");
    const displayAccount = /^\d{16}$/.test(rawAccount)
      ? `${rawAccount.slice(0, 4)} ${rawAccount.slice(4, 8)} ${rawAccount.slice(8, 12)} ${rawAccount.slice(12)}`
      : rawAccount;
    const note = lang === "bs"
      ? (settings.bank_transfer_note_bs ?? settings.bank_note)
      : (settings.bank_transfer_note_en ?? settings.bank_note);
    return `
      <div style="background:#fffbf5;border:1px solid #f0e6d3;border-radius:12px;padding:20px;margin-top:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1a2744;text-transform:uppercase;letter-spacing:.05em;">${t.bankTitle}</p>
        ${settings.bank_account_holder ? `<p style="margin:4px 0;font-size:14px;color:#555;"><strong style="color:#1a2744;">${t.bankHolder}:</strong> ${h(String(settings.bank_account_holder))}</p>` : ""}
        ${settings.bank_name ? `<p style="margin:4px 0;font-size:14px;color:#555;"><strong style="color:#1a2744;">${t.bankName}:</strong> ${h(String(settings.bank_name))}</p>` : ""}
        ${rawAccount ? `<p style="margin:8px 0 4px;font-size:14px;color:#555;"><strong style="color:#1a2744;">${t.bankAccount}:</strong></p><p style="margin:0;font-size:16px;font-weight:700;color:#1a2744;font-family:monospace;letter-spacing:.05em;">${h(displayAccount)}</p>` : ""}
        ${order.order_number ? `<p style="margin:8px 0 0;font-size:14px;color:#555;"><strong style="color:#1a2744;">${t.paymentRef}:</strong> ${h(String(order.order_number))}</p>` : ""}
        ${note ? `<p style="margin:12px 0 0;font-size:13px;color:#888;">${h(String(note))}</p>` : ""}
      </div>`;
  }
  return `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-top:24px;">
      <p style="margin:0;font-size:14px;color:#15803d;font-weight:600;">${t.codTitle}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#555;">${t.codNote}</p>
    </div>`;
}
