import { describe, it, expect } from 'vitest';
import {
  genAddonId,
  newAddonGroup,
  newAddonOption,
  formatPriceAdj,
  validateAddonGroupsDraft,
  buildAddonGroupsPayload,
  addonGroupDraftFromDb,
  type AddonGroupDraft,
  type AddonOptionDraft,
} from '../addonGroups';
import type { AddonGroup } from '../supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validOption(overrides: Partial<AddonOptionDraft> = {}): AddonOptionDraft {
  return {
    id: 'opt-123-abc',
    label_en: 'Standard',
    label_bs: 'Standardno',
    price_adjustment: '0',
    text_required: false,
    ...overrides,
  };
}

function validGroup(overrides: Partial<AddonGroupDraft> = {}): AddonGroupDraft {
  return {
    id: 'grp-123-abc',
    label_en: 'Packaging',
    label_bs: 'Pakovanje',
    location: 'product_page',
    required: false,
    options: [validOption()],
    ...overrides,
  };
}

// ─── genAddonId ───────────────────────────────────────────────────────────────

describe('genAddonId', () => {
  it('returns a string starting with "grp-" for group prefix', () => {
    expect(genAddonId('grp')).toMatch(/^grp-/);
  });

  it('returns a string starting with "opt-" for option prefix', () => {
    expect(genAddonId('opt')).toMatch(/^opt-/);
  });

  it('generates unique IDs across successive calls', () => {
    const ids = Array.from({ length: 50 }, () => genAddonId('grp'));
    expect(new Set(ids).size).toBe(50);
  });

  it('stable ID format contains timestamp and random suffix', () => {
    const id = genAddonId('grp');
    // format: grp-<timestamp>-<6 chars>
    expect(id).toMatch(/^grp-\d+-[a-z0-9]{1,8}$/);
  });
});

// ─── newAddonGroup / newAddonOption ───────────────────────────────────────────

describe('newAddonGroup', () => {
  it('creates a group with auto-generated ID starting with "grp-"', () => {
    const g = newAddonGroup();
    expect(g.id).toMatch(/^grp-/);
  });

  it('starts with one option that has an auto-generated opt- ID', () => {
    const g = newAddonGroup();
    expect(g.options).toHaveLength(1);
    expect(g.options[0].id).toMatch(/^opt-/);
  });

  it('defaults to product_page location and required=false', () => {
    const g = newAddonGroup();
    expect(g.location).toBe('product_page');
    expect(g.required).toBe(false);
  });

  it('two calls produce different IDs (stable, not reused)', () => {
    const a = newAddonGroup();
    const b = newAddonGroup();
    expect(a.id).not.toBe(b.id);
  });
});

describe('newAddonOption', () => {
  it('creates an option with price_adjustment "0" and text_required false', () => {
    const o = newAddonOption();
    expect(o.price_adjustment).toBe('0');
    expect(o.text_required).toBe(false);
  });
});

// ─── formatPriceAdj ───────────────────────────────────────────────────────────

describe('formatPriceAdj', () => {
  it('returns "Included" for 0', () => {
    expect(formatPriceAdj(0)).toBe('Included');
  });

  it('returns "Included" for string "0"', () => {
    expect(formatPriceAdj('0')).toBe('Included');
  });

  it('returns "Included" for empty string', () => {
    expect(formatPriceAdj('')).toBe('Included');
  });

  it('formats positive number with + sign and 2 decimal places', () => {
    expect(formatPriceAdj(0.5)).toBe('+0.50 KM');
  });

  it('formats string "5.50" correctly', () => {
    expect(formatPriceAdj('5.50')).toBe('+5.50 KM');
  });

  it('formats whole number with trailing zeros', () => {
    expect(formatPriceAdj(10)).toBe('+10.00 KM');
  });
});

// ─── validateAddonGroupsDraft ─────────────────────────────────────────────────

describe('validateAddonGroupsDraft', () => {
  it('returns null for empty groups (null → valid DB state)', () => {
    expect(validateAddonGroupsDraft([], false)).toBeNull();
    expect(validateAddonGroupsDraft([], true)).toBeNull();
  });

  it('returns null for a valid single group', () => {
    expect(validateAddonGroupsDraft([validGroup()], false)).toBeNull();
  });

  it('returns null for two valid groups with distinct IDs', () => {
    const groups = [
      validGroup({ id: 'grp-1' }),
      validGroup({ id: 'grp-2' }),
    ];
    expect(validateAddonGroupsDraft(groups, false)).toBeNull();
  });

  it('rejects more than 10 groups', () => {
    const groups = Array.from({ length: 11 }, (_, i) =>
      validGroup({ id: `grp-${i}`, options: [validOption({ id: `opt-${i}` })] }),
    );
    expect(validateAddonGroupsDraft(groups, false)).toMatch(/Maximum 10/);
  });

  it('rejects a group with empty English label', () => {
    const err = validateAddonGroupsDraft([validGroup({ label_en: '' })], false);
    expect(err).toMatch(/English label/);
  });

  it('rejects a group with empty Bosnian label', () => {
    const err = validateAddonGroupsDraft([validGroup({ label_bs: '' })], false);
    expect(err).toMatch(/Bosnian label/);
  });

  it('rejects a group with whitespace-only English label', () => {
    const err = validateAddonGroupsDraft([validGroup({ label_en: '   ' })], false);
    expect(err).toMatch(/English label/);
  });

  it('rejects duplicate group IDs', () => {
    const groups = [validGroup({ id: 'same' }), validGroup({ id: 'same' })];
    const err = validateAddonGroupsDraft(groups, false);
    expect(err).toMatch(/Duplicate group ID/);
  });

  it('rejects personalization_modal group when requires_personalization is false', () => {
    const err = validateAddonGroupsDraft(
      [validGroup({ location: 'personalization_modal' })],
      false,
    );
    expect(err).toMatch(/Personalization Modal/);
    expect(err).toMatch(/Requires Personalization/);
  });

  it('accepts personalization_modal group when requires_personalization is true', () => {
    const err = validateAddonGroupsDraft(
      [validGroup({ location: 'personalization_modal' })],
      true,
    );
    expect(err).toBeNull();
  });

  it('accepts product_page group regardless of requires_personalization', () => {
    expect(validateAddonGroupsDraft([validGroup({ location: 'product_page' })], false)).toBeNull();
    expect(validateAddonGroupsDraft([validGroup({ location: 'product_page' })], true)).toBeNull();
  });

  it('rejects a group with no options', () => {
    const err = validateAddonGroupsDraft([validGroup({ options: [] })], false);
    expect(err).toMatch(/At least one option/);
  });

  it('rejects a group with more than 20 options', () => {
    const options = Array.from({ length: 21 }, (_, i) => validOption({ id: `opt-${i}` }));
    const err = validateAddonGroupsDraft([validGroup({ options })], false);
    expect(err).toMatch(/Maximum 20/);
  });

  it('rejects a group with duplicate option IDs', () => {
    const err = validateAddonGroupsDraft(
      [validGroup({ options: [validOption({ id: 'dup' }), validOption({ id: 'dup' })] })],
      false,
    );
    expect(err).toMatch(/Duplicate option ID/);
  });

  it('rejects an option with empty English label', () => {
    const err = validateAddonGroupsDraft(
      [validGroup({ options: [validOption({ label_en: '' })] })],
      false,
    );
    expect(err).toMatch(/English label/);
  });

  it('rejects an option with empty Bosnian label', () => {
    const err = validateAddonGroupsDraft(
      [validGroup({ options: [validOption({ label_bs: '' })] })],
      false,
    );
    expect(err).toMatch(/Bosnian label/);
  });

  it('rejects a negative price_adjustment', () => {
    const err = validateAddonGroupsDraft(
      [validGroup({ options: [validOption({ price_adjustment: '-1' })] })],
      false,
    );
    expect(err).toMatch(/positive/);
  });

  it('rejects price_adjustment > 99999', () => {
    const err = validateAddonGroupsDraft(
      [validGroup({ options: [validOption({ price_adjustment: '100000' })] })],
      false,
    );
    expect(err).toMatch(/99,999/);
  });

  it('rejects price_adjustment with more than 2 decimal places', () => {
    const err = validateAddonGroupsDraft(
      [validGroup({ options: [validOption({ price_adjustment: '5.123' })] })],
      false,
    );
    expect(err).toMatch(/2 decimal/);
  });

  it('accepts price_adjustment of "0"', () => {
    expect(
      validateAddonGroupsDraft([validGroup({ options: [validOption({ price_adjustment: '0' })] })], false),
    ).toBeNull();
  });

  it('accepts price_adjustment of "5.50"', () => {
    expect(
      validateAddonGroupsDraft([validGroup({ options: [validOption({ price_adjustment: '5.50' })] })], false),
    ).toBeNull();
  });

  it('accepts price_adjustment of "" (treated as 0)', () => {
    expect(
      validateAddonGroupsDraft([validGroup({ options: [validOption({ price_adjustment: '' })] })], false),
    ).toBeNull();
  });

  it('accepts price_adjustment of "99999"', () => {
    expect(
      validateAddonGroupsDraft([validGroup({ options: [validOption({ price_adjustment: '99999' })] })], false),
    ).toBeNull();
  });
});

// ─── buildAddonGroupsPayload ──────────────────────────────────────────────────

describe('buildAddonGroupsPayload', () => {
  it('returns null for empty groups (no addon_groups in DB)', () => {
    expect(buildAddonGroupsPayload([])).toBeNull();
  });

  it('converts a draft group to the correct AddonGroup shape', () => {
    const draft = validGroup({
      id: 'grp-test',
      label_en: ' Packaging ',
      label_bs: ' Pakovanje ',
      required: true,
      options: [
        validOption({ id: 'opt-1', label_en: ' Tulle ', label_bs: ' Tul ', price_adjustment: '0.50' }),
        validOption({ id: 'opt-2', label_en: 'None', label_bs: 'Bez', price_adjustment: '0', text_required: true }),
      ],
    });

    const result = buildAddonGroupsPayload([draft]);
    expect(result).not.toBeNull();
    const group = result![0];

    expect(group.id).toBe('grp-test');
    expect(group.label_en).toBe('Packaging');   // trimmed
    expect(group.label_bs).toBe('Pakovanje');   // trimmed
    expect(group.required).toBe(true);
    expect(group.options).toHaveLength(2);
    expect(group.options[0].price_adjustment).toBe(0.5);
    expect(group.options[0].text_required).toBeUndefined();  // false → omitted
    expect(group.options[1].price_adjustment).toBe(0);
    expect(group.options[1].text_required).toBe(true);
  });

  it('omits required field when false', () => {
    const result = buildAddonGroupsPayload([validGroup({ required: false })]);
    expect(result![0].required).toBeUndefined();
  });

  it('omits text_required field when false', () => {
    const result = buildAddonGroupsPayload([validGroup({ options: [validOption({ text_required: false })] })]);
    expect(result![0].options[0].text_required).toBeUndefined();
  });

  it('treats empty price_adjustment string as 0', () => {
    const result = buildAddonGroupsPayload([
      validGroup({ options: [validOption({ price_adjustment: '' })] }),
    ]);
    expect(result![0].options[0].price_adjustment).toBe(0);
  });
});

// ─── addonGroupDraftFromDb ────────────────────────────────────────────────────

describe('addonGroupDraftFromDb', () => {
  it('converts a DB AddonGroup to draft form', () => {
    const dbGroup: AddonGroup = {
      id: 'grp-db',
      label_en: 'Packaging',
      label_bs: 'Pakovanje',
      location: 'product_page',
      required: true,
      options: [
        { id: 'opt-db', label_en: 'Tulle', label_bs: 'Tul', price_adjustment: 0.5, text_required: true },
      ],
    };

    const draft = addonGroupDraftFromDb(dbGroup);
    expect(draft.id).toBe('grp-db');
    expect(draft.required).toBe(true);
    expect(draft.options[0].price_adjustment).toBe('0.5');
    expect(draft.options[0].text_required).toBe(true);
  });

  it('defaults required to false when absent', () => {
    const dbGroup: AddonGroup = {
      id: 'grp-x',
      label_en: 'G',
      label_bs: 'G',
      location: 'product_page',
      options: [{ id: 'o', label_en: 'A', label_bs: 'A', price_adjustment: 0 }],
    };
    const draft = addonGroupDraftFromDb(dbGroup);
    expect(draft.required).toBe(false);
  });

  it('defaults text_required to false when absent', () => {
    const dbGroup: AddonGroup = {
      id: 'grp-x',
      label_en: 'G',
      label_bs: 'G',
      location: 'product_page',
      options: [{ id: 'o', label_en: 'A', label_bs: 'A', price_adjustment: 0 }],
    };
    const draft = addonGroupDraftFromDb(dbGroup);
    expect(draft.options[0].text_required).toBe(false);
  });

  it('round-trips through buildAddonGroupsPayload', () => {
    const original: AddonGroup = {
      id: 'grp-rt',
      label_en: 'Colour',
      label_bs: 'Boja',
      location: 'personalization_modal',
      required: true,
      options: [
        { id: 'opt-rt1', label_en: 'Gold', label_bs: 'Zlatna', price_adjustment: 0.3 },
        { id: 'opt-rt2', label_en: 'Other', label_bs: 'Ostalo', price_adjustment: 0.5, text_required: true },
      ],
    };

    const draft = addonGroupDraftFromDb(original);
    const rebuilt = buildAddonGroupsPayload([draft])![0];

    expect(rebuilt.id).toBe(original.id);
    expect(rebuilt.label_en).toBe(original.label_en);
    expect(rebuilt.required).toBe(true);
    expect(rebuilt.options[0].price_adjustment).toBeCloseTo(0.3);
    expect(rebuilt.options[1].text_required).toBe(true);
  });
});

// ─── Legacy product behaviour ─────────────────────────────────────────────────

describe('legacy product (addon_groups = null)', () => {
  it('buildAddonGroupsPayload([]) returns null, not an empty array', () => {
    // Prevents CHECK constraint violation on products_addon_groups_valid
    expect(buildAddonGroupsPayload([])).toBeNull();
    expect(Array.isArray(buildAddonGroupsPayload([]))).toBe(false);
  });

  it('validateAddonGroupsDraft accepts empty groups (no save blocked for legacy)', () => {
    expect(validateAddonGroupsDraft([], false)).toBeNull();
  });
});
