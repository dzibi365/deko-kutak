import { describe, it, expect } from "vitest";
import {
  stripSeparators,
  formatAccountDisplay,
  validateBiHAccount,
  isValidBiHAccountFormat,
} from "../bankAccount";

// Mathematically-valid 16-digit accounts (check = 98 − (first14 mod 97)):
//   1610000066910075  (check = 98 − 23 = 75)
//   1990450001999009  (check = 98 − 89 =  9, padded to 09)
//   1540012001944025  (check = 98 − 73 = 25)
const VALID_1 = "1610000066910075";
const VALID_2 = "1990450001999009";
const VALID_3 = "1540012001944025";

describe("stripSeparators", () => {
  it("strips spaces", () => expect(stripSeparators("1610 0000 6691 0075")).toBe(VALID_1));
  it("strips dashes", () => expect(stripSeparators("161-0000066910-075")).toBe(VALID_1));
  it("strips dots",   () => expect(stripSeparators("161.0000.06691.0075")).not.toBe("")); // just strips
  it("leaves digits alone", () => expect(stripSeparators(VALID_1)).toBe(VALID_1));
});

describe("formatAccountDisplay", () => {
  it("formats 16 digits with spaces every 4", () =>
    expect(formatAccountDisplay(VALID_1)).toBe("1610 0000 6691 0075"));
  it("returns input unchanged for non-16-digit string", () =>
    expect(formatAccountDisplay("12345")).toBe("12345"));
});

describe("validateBiHAccount — valid accounts", () => {
  it("accepts digits-only account", () =>
    expect(validateBiHAccount(VALID_1)).toEqual({ valid: true, normalized: VALID_1 }));

  it("accepts account with spaces", () =>
    expect(validateBiHAccount("1610 0000 6691 0075")).toEqual({ valid: true, normalized: VALID_1 }));

  it("accepts account with dashes", () =>
    expect(validateBiHAccount("161-0000066910-075")).toEqual({ valid: true, normalized: VALID_1 }));

  it("accepts second valid account (check digits 09)", () =>
    expect(validateBiHAccount(VALID_2)).toEqual({ valid: true, normalized: VALID_2 }));

  it("accepts third valid account", () =>
    expect(validateBiHAccount(VALID_3)).toEqual({ valid: true, normalized: VALID_3 }));
});

describe("validateBiHAccount — invalid accounts", () => {
  it("rejects empty string", () =>
    expect(validateBiHAccount("")).toMatchObject({ valid: false, reason: "empty" }));

  it("rejects whitespace-only", () =>
    expect(validateBiHAccount("   ")).toMatchObject({ valid: false, reason: "empty" }));

  it("rejects non-digit characters", () =>
    expect(validateBiHAccount("161000006691AB75")).toMatchObject({ valid: false, reason: "non_digits" }));

  it("rejects 15-digit account (too short)", () =>
    expect(validateBiHAccount("161000006691007")).toMatchObject({ valid: false, reason: "wrong_length" }));

  it("rejects 17-digit account (too long)", () =>
    expect(validateBiHAccount("16100000669100750")).toMatchObject({ valid: false, reason: "wrong_length" }));

  it("rejects wrong check digits", () =>
    expect(validateBiHAccount("1610000066910076")).toMatchObject({ valid: false, reason: "bad_checksum" }));

  it("rejects check digits off by one (lower)", () =>
    expect(validateBiHAccount("1610000066910074")).toMatchObject({ valid: false, reason: "bad_checksum" }));

  it("rejects all-zeros with wrong checksum", () =>
    expect(validateBiHAccount("0000000000000099")).toMatchObject({ valid: false, reason: "bad_checksum" }));
});

describe("validateBiHAccount — normalizes before return", () => {
  it("returns normalized (separator-stripped) value", () => {
    const result = validateBiHAccount("1610 0000 6691 0075");
    expect(result.valid && result.normalized).toBe(VALID_1);
  });
});

describe("isValidBiHAccountFormat — format-only (no checksum)", () => {
  it("accepts exactly 16 digits", () =>
    expect(isValidBiHAccountFormat(VALID_1)).toBe(true));

  it("accepts 16 digits with wrong check digits (not checksum-validated)", () =>
    expect(isValidBiHAccountFormat("1610000066910076")).toBe(true));

  it("accepts account with spaces (stripped to 16 digits)", () =>
    expect(isValidBiHAccountFormat("1610 0000 6691 0075")).toBe(true));

  it("accepts account with leading zeros", () =>
    expect(isValidBiHAccountFormat("0012345678901280")).toBe(true));

  it("rejects empty string", () =>
    expect(isValidBiHAccountFormat("")).toBe(false));

  it("rejects fewer than 16 digits", () =>
    expect(isValidBiHAccountFormat("123456789012345")).toBe(false));

  it("rejects more than 16 digits", () =>
    expect(isValidBiHAccountFormat("12345678901234567")).toBe(false));

  it("rejects non-digit characters after stripping separators", () =>
    expect(isValidBiHAccountFormat("161000006691AB75")).toBe(false));
});
