/**
 * Focused tests for send-order-email paymentBlock and emailT translations.
 *
 * Run with:
 *   deno test --allow-env supabase/tests/send_order_email_test.ts
 */

import { assertEquals, assertStringIncludes, assertNotMatch } from "jsr:@std/assert";
import { emailT, paymentBlock } from "../functions/send-order-email/email-helpers.ts";

// ─── Translation string tests ─────────────────────────────────────────────────

Deno.test("EN bankAccount label is 'Transaction Account'", () => {
  assertEquals(emailT.en.bankAccount, "Transaction Account");
});

Deno.test("BS bankAccount label is 'Transakcijski račun'", () => {
  assertEquals(emailT.bs.bankAccount, "Transakcijski račun");
});

Deno.test("EN paymentRef label is 'Payment Reference'", () => {
  assertEquals(emailT.en.paymentRef, "Payment Reference");
});

Deno.test("BS paymentRef label is 'Svrha plaćanja'", () => {
  assertEquals(emailT.bs.paymentRef, "Svrha plaćanja");
});

// ─── paymentBlock HTML output ─────────────────────────────────────────────────

const baseOrder = {
  payment_method: "bank_transfer",
  order_number: "DEKO-2026-000099",
};

const baseSettings = {
  bank_account_holder: "DEKO KUTAK",
  bank_name: "BOSNA BANK INTERNATIONAL",
  bank_iban: "1413065320220947",
  bank_note: null,
  bank_transfer_note_bs: "BS napomena",
  bank_transfer_note_en: "EN note",
};

Deno.test("EN: renders 'Transaction Account' label", () => {
  const html = paymentBlock(baseOrder, baseSettings, "en");
  assertStringIncludes(html, "Transaction Account:");
});

Deno.test("BS: renders 'Transakcijski račun' label", () => {
  const html = paymentBlock(baseOrder, baseSettings, "bs");
  assertStringIncludes(html, "Transakcijski račun:");
});

Deno.test("EN: does not render 'IBAN' label", () => {
  const html = paymentBlock(baseOrder, baseSettings, "en");
  assertNotMatch(html, />\s*IBAN\s*:/);
});

Deno.test("BS: does not render 'IBAN' label", () => {
  const html = paymentBlock(baseOrder, baseSettings, "bs");
  assertNotMatch(html, />\s*IBAN\s*:/);
});

Deno.test("formats 16-digit account with spaces every 4 digits", () => {
  const html = paymentBlock(baseOrder, baseSettings, "en");
  assertStringIncludes(html, "1413 0653 2022 0947");
});

Deno.test("preserves non-16-digit account format as-is", () => {
  const html = paymentBlock(
    baseOrder,
    { ...baseSettings, bank_iban: "141-306-53202209-47" },
    "en",
  );
  assertStringIncludes(html, "141-306-53202209-47");
});

Deno.test("EN: renders order number as payment reference", () => {
  const html = paymentBlock(baseOrder, baseSettings, "en");
  assertStringIncludes(html, "Payment Reference:");
  assertStringIncludes(html, "DEKO-2026-000099");
});

Deno.test("BS: renders order number as payment reference", () => {
  const html = paymentBlock(baseOrder, baseSettings, "bs");
  assertStringIncludes(html, "Svrha plaćanja:");
  assertStringIncludes(html, "DEKO-2026-000099");
});

Deno.test("EN: uses EN bilingual note", () => {
  const html = paymentBlock(baseOrder, baseSettings, "en");
  assertStringIncludes(html, "EN note");
});

Deno.test("BS: uses BS bilingual note", () => {
  const html = paymentBlock(baseOrder, baseSettings, "bs");
  assertStringIncludes(html, "BS napomena");
});

Deno.test("falls back to bank_note when bilingual notes are null", () => {
  const settings = { ...baseSettings, bank_transfer_note_bs: null, bank_transfer_note_en: null, bank_note: "Fallback note" };
  const htmlEn = paymentBlock(baseOrder, settings, "en");
  const htmlBs = paymentBlock(baseOrder, settings, "bs");
  assertStringIncludes(htmlEn, "Fallback note");
  assertStringIncludes(htmlBs, "Fallback note");
});

Deno.test("renders no note section when all notes are null", () => {
  const settings = { ...baseSettings, bank_transfer_note_bs: null, bank_transfer_note_en: null, bank_note: null };
  const html = paymentBlock(baseOrder, settings, "en");
  assertNotMatch(html, /font-size:13px;color:#888/);
});

Deno.test("COD: renders COD block, no IBAN or account rows", () => {
  const html = paymentBlock({ ...baseOrder, payment_method: "cod" }, baseSettings, "en");
  assertStringIncludes(html, emailT.en.codTitle);
  assertNotMatch(html, /Transaction Account/);
  assertNotMatch(html, /IBAN/);
});

Deno.test("HTML-escapes account holder name", () => {
  const html = paymentBlock(baseOrder, { ...baseSettings, bank_account_holder: "<script>" }, "en");
  assertStringIncludes(html, "&lt;script&gt;");
});
