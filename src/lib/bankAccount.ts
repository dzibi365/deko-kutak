/** Removes spaces, dashes and dots from a raw account string. */
export function stripSeparators(raw: string): string {
  return raw.replace(/[\s\-.]/g, "");
}

/**
 * Formats 16 normalized digits for display with spaces every 4 digits.
 * Falls back to raw input if not exactly 16 digits.
 */
export function formatAccountDisplay(digits: string): string {
  if (digits.length !== 16) return digits;
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12)}`;
}

export type AccountValidation =
  | { valid: true; normalized: string }
  | { valid: false; reason: "empty" | "non_digits" | "wrong_length" | "bad_checksum" };

/**
 * Validates a BiH 16-digit domestic transaction account (transakcijski račun).
 *
 * Format: 16 decimal digits after stripping visual separators (spaces, dashes, dots).
 * Check digits: positions 15–16 satisfy the ISO 7064 MOD 97-10 constraint:
 *   last_2_digits === String(98 - (first_14_digits mod 97)).padStart(2, "0")
 */
export function validateBiHAccount(raw: string): AccountValidation {
  if (!raw || !raw.trim()) return { valid: false, reason: "empty" };

  const n = stripSeparators(raw);

  if (!/^\d+$/.test(n)) return { valid: false, reason: "non_digits" };
  if (n.length !== 16) return { valid: false, reason: "wrong_length" };

  let r = 0;
  for (const d of n.slice(0, 14)) r = (r * 10 + +d) % 97;
  const expected = String(98 - r).padStart(2, "0");

  if (n.slice(14) !== expected) return { valid: false, reason: "bad_checksum" };

  return { valid: true, normalized: n };
}

/**
 * Returns true when the account is non-empty and has exactly 16 digits (after
 * stripping separators). Does NOT check the last-2-digit checksum, because the
 * exact algorithm used by BiH banks is unconfirmed; a false rejection would
 * silently block the admin from saving their real account number.
 */
export function isValidBiHAccountFormat(raw: string): boolean {
  if (!raw || !raw.trim()) return false;
  const n = stripSeparators(raw);
  return /^\d{16}$/.test(n);
}
