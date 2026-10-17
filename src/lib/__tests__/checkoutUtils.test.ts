import { describe, it, expect } from 'vitest';
import { buildOrderItems } from '../checkoutUtils';
import type { CartItem } from '../../context/CartContext';

function baseItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    cartKey: 'test-key',
    id: 1,
    name: 'Poklon kutija',
    name_en: 'Gift Box',
    name_bs: 'Poklon Kutija',
    price: 25,
    image_url: null,
    category: 'gifts',
    quantity: 1,
    ...overrides,
  };
}

describe('buildOrderItems — field stripping', () => {
  it('strips cartKey from output', () => {
    const result = buildOrderItems([baseItem()], 'en');
    expect('cartKey' in result[0]).toBe(false);
  });

  it('strips uploadTokens from output', () => {
    const item = baseItem({ uploadTokens: { Photo: 'tok-abc' } });
    const result = buildOrderItems([item], 'en');
    expect('uploadTokens' in result[0]).toBe(false);
  });

  it('strips option_label_en and option_label_bs from output', () => {
    const item = baseItem({ option_id: 'opt-1', option_label_en: 'Small', option_label_bs: 'Mali' });
    const result = buildOrderItems([item], 'en');
    expect('option_label_en' in result[0]).toBe(false);
    expect('option_label_bs' in result[0]).toBe(false);
  });

  it('strips addon_display from output', () => {
    const item = baseItem({
      addon_display: [{
        group_id: 'grp-1', option_id: 'opt-1',
        group_label_en: 'Packaging', group_label_bs: 'Pakovanje',
        option_label_en: 'Standard', option_label_bs: 'Standardno',
        price_adjustment: 0,
      }],
    });
    const result = buildOrderItems([item], 'en');
    expect('addon_display' in result[0]).toBe(false);
  });

  it('keeps addon_selections in output (sent to server)', () => {
    const item = baseItem({
      addon_selections: [{ group_id: 'grp-1', option_id: 'opt-1' }],
    });
    const result = buildOrderItems([item], 'en');
    expect(result[0].addon_selections).toEqual([{ group_id: 'grp-1', option_id: 'opt-1' }]);
  });

  it('keeps option_id in output', () => {
    const item = baseItem({ option_id: 'opt-1', option_label_en: 'Small', option_label_bs: 'Mali' });
    const result = buildOrderItems([item], 'en');
    expect(result[0].option_id).toBe('opt-1');
  });
});

describe('buildOrderItems — variant label injection', () => {
  it('injects "Variant" key in EN when option_id and labels present', () => {
    const item = baseItem({ option_id: 'opt-1', option_label_en: 'Small', option_label_bs: 'Mali' });
    const result = buildOrderItems([item], 'en');
    const customizations = result[0].customizations as Record<string, string>;
    expect(customizations['Variant']).toBe('Small');
  });

  it('injects "Varijanta" key in BS when option_id and labels present', () => {
    const item = baseItem({ option_id: 'opt-1', option_label_en: 'Small', option_label_bs: 'Mali' });
    const result = buildOrderItems([item], 'bs');
    const customizations = result[0].customizations as Record<string, string>;
    expect(customizations['Varijanta']).toBe('Mali');
  });

  it('falls back to EN label when BS label is missing', () => {
    const item = baseItem({ option_id: 'opt-1', option_label_en: 'Small', option_label_bs: undefined });
    const result = buildOrderItems([item], 'bs');
    const customizations = result[0].customizations as Record<string, string>;
    expect(customizations['Varijanta']).toBe('Small');
  });

  it('does not inject variant key when option_id is absent', () => {
    const item = baseItem();
    const result = buildOrderItems([item], 'en');
    expect(result[0].customizations).toBeUndefined();
  });

  it('does not inject variant key when labels are absent', () => {
    const item = baseItem({ option_id: 'opt-1' });
    const result = buildOrderItems([item], 'en');
    expect(result[0].customizations).toBeUndefined();
  });
});

describe('buildOrderItems — addon label injection', () => {
  it('injects addon group label as key and option label as value in EN', () => {
    const item = baseItem({
      addon_display: [{
        group_id: 'grp-1', option_id: 'opt-1',
        group_label_en: 'Packaging', group_label_bs: 'Pakovanje',
        option_label_en: 'Premium', option_label_bs: 'Premium',
        price_adjustment: 0,
      }],
    });
    const result = buildOrderItems([item], 'en');
    const customizations = result[0].customizations as Record<string, string>;
    expect(customizations['Packaging']).toBe('Premium');
  });

  it('uses BS labels when lang is "bs"', () => {
    const item = baseItem({
      addon_display: [{
        group_id: 'grp-1', option_id: 'opt-1',
        group_label_en: 'Packaging', group_label_bs: 'Pakovanje',
        option_label_en: 'Premium', option_label_bs: 'Vrhunsko',
        price_adjustment: 0,
      }],
    });
    const result = buildOrderItems([item], 'bs');
    const customizations = result[0].customizations as Record<string, string>;
    expect(customizations['Pakovanje']).toBe('Vrhunsko');
  });

  it('appends (+X.XX KM) suffix when price_adjustment > 0', () => {
    const item = baseItem({
      addon_display: [{
        group_id: 'grp-1', option_id: 'opt-1',
        group_label_en: 'Packaging', group_label_bs: 'Pakovanje',
        option_label_en: 'Premium', option_label_bs: 'Vrhunsko',
        price_adjustment: 2.5,
      }],
    });
    const result = buildOrderItems([item], 'en');
    const customizations = result[0].customizations as Record<string, string>;
    expect(customizations['Packaging']).toBe('Premium (+2.50 KM)');
  });

  it('appends text_value with colon separator', () => {
    const item = baseItem({
      addon_display: [{
        group_id: 'grp-1', option_id: 'opt-1',
        group_label_en: 'Engraving', group_label_bs: 'Gravura',
        option_label_en: 'Custom text', option_label_bs: 'Prilagođeni tekst',
        price_adjustment: 0,
        text_value: 'Happy Birthday',
      }],
    });
    const result = buildOrderItems([item], 'en');
    const customizations = result[0].customizations as Record<string, string>;
    expect(customizations['Engraving']).toBe('Custom text: Happy Birthday');
  });

  it('combines price suffix and text_value', () => {
    const item = baseItem({
      addon_display: [{
        group_id: 'grp-1', option_id: 'opt-1',
        group_label_en: 'Engraving', group_label_bs: 'Gravura',
        option_label_en: 'Custom text', option_label_bs: 'Prilagođeni tekst',
        price_adjustment: 1,
        text_value: 'Hello',
      }],
    });
    const result = buildOrderItems([item], 'en');
    const customizations = result[0].customizations as Record<string, string>;
    expect(customizations['Engraving']).toBe('Custom text (+1.00 KM): Hello');
  });
});

describe('buildOrderItems — customizations merge', () => {
  it('preserves existing customizations on items', () => {
    const item = baseItem({ customizations: { Note: 'wrap it' } });
    const result = buildOrderItems([item], 'en');
    const customizations = result[0].customizations as Record<string, string>;
    expect(customizations['Note']).toBe('wrap it');
  });

  it('addon labels come before existing customizations in merge (addon key does not overwrite user text)', () => {
    const item = baseItem({
      addon_display: [{
        group_id: 'grp-1', option_id: 'opt-1',
        group_label_en: 'Color', group_label_bs: 'Boja',
        option_label_en: 'Red', option_label_bs: 'Crvena',
        price_adjustment: 0,
      }],
      customizations: { Color: 'user-override', Note: 'fragile' },
    });
    const result = buildOrderItems([item], 'en');
    const customizations = result[0].customizations as Record<string, string>;
    // customizations spread after extra, so user's value wins
    expect(customizations['Color']).toBe('user-override');
    expect(customizations['Note']).toBe('fragile');
  });

  it('omits customizations key entirely when no labels or customizations', () => {
    const item = baseItem();
    const result = buildOrderItems([item], 'en');
    expect('customizations' in result[0]).toBe(false);
  });

  it('handles multiple items correctly', () => {
    const items = [
      baseItem({ id: 1, option_id: 'opt-1', option_label_en: 'Small', option_label_bs: 'Mali' }),
      baseItem({ id: 2, customizations: { Message: 'Hello' } }),
    ];
    const result = buildOrderItems(items, 'en');
    expect((result[0].customizations as Record<string, string>)['Variant']).toBe('Small');
    expect((result[1].customizations as Record<string, string>)['Message']).toBe('Hello');
  });
});

describe('buildOrderItems — shipping-inclusive total comparison', () => {
  it('integer cents avoid float mismatch: Math.round(9.99 * 100) equals 999', () => {
    // Demonstrates why we use integer cents for total comparison.
    // 9.99 * 100 in IEEE-754 = 998.9999… → without rounding would be 998 not 999.
    expect(Math.round(9.99 * 100)).toBe(999);
    expect(Math.round(0.1 + 0.2) * 100).toBe(0);  // 0.1+0.2 = 0.30000000000000004
    expect(Math.round((0.1 + 0.2) * 100)).toBe(30);
  });
});

// ─── Collision avoidance ──────────────────────────────────────────────────────

function addonDisplay(
  groupLabel: string,
  optionLabel: string,
  priceAdj = 0,
  textValue?: string,
) {
  return {
    group_id: `grp-${groupLabel}`,
    option_id: `opt-${optionLabel}`,
    group_label_en: groupLabel,
    group_label_bs: `${groupLabel}-bs`,
    option_label_en: optionLabel,
    option_label_bs: `${optionLabel}-bs`,
    price_adjustment: priceAdj,
    ...(textValue !== undefined ? { text_value: textValue } : {}),
  };
}

describe('buildOrderItems — collision avoidance', () => {
  it('two addon groups with the same EN label get distinct keys "(2)" suffix', () => {
    const item = baseItem({
      addon_display: [
        addonDisplay('Packaging', 'Standard'),
        addonDisplay('Packaging', 'Premium'),
      ],
    });
    const result = buildOrderItems([item], 'en');
    const c = result[0].customizations as Record<string, string>;
    expect(c['Packaging']).toBe('Standard');
    expect(c['Packaging (2)']).toBe('Premium');
  });

  it('three addon groups with the same label get (2) and (3) suffixes', () => {
    const item = baseItem({
      addon_display: [
        addonDisplay('Color', 'Red'),
        addonDisplay('Color', 'Blue'),
        addonDisplay('Color', 'Green'),
      ],
    });
    const result = buildOrderItems([item], 'en');
    const c = result[0].customizations as Record<string, string>;
    expect(c['Color']).toBe('Red');
    expect(c['Color (2)']).toBe('Blue');
    expect(c['Color (3)']).toBe('Green');
  });

  it('addon label matching custom field label — both survive with distinct keys', () => {
    // Custom field uses "Packaging"; addon group also named "Packaging".
    // Addon must be renamed; custom field value must survive unchanged.
    const item = baseItem({
      customizations: { Packaging: 'user-gift-wrap', Note: 'fragile' },
      addon_display: [addonDisplay('Packaging', 'Premium')],
    });
    const result = buildOrderItems([item], 'en');
    const c = result[0].customizations as Record<string, string>;
    expect(c['Packaging']).toBe('user-gift-wrap');   // custom field wins as-is
    expect(c['Packaging (2)']).toBe('Premium');       // addon renamed
    expect(c['Note']).toBe('fragile');
  });

  it('addon label "Variant" renamed to "Variant (2)" when variant is present', () => {
    const item = baseItem({
      option_id: 'opt-1',
      option_label_en: 'Small',
      option_label_bs: 'Mali',
      addon_display: [addonDisplay('Variant', 'Gift box')],
    });
    const result = buildOrderItems([item], 'en');
    const c = result[0].customizations as Record<string, string>;
    expect(c['Variant']).toBe('Small');           // system variant key preserved
    expect(c['Variant (2)']).toBe('Gift box');    // addon renamed
  });

  it('addon label "Varijanta" renamed to "Varijanta (2)" in BS mode', () => {
    const item = baseItem({
      option_id: 'opt-1',
      option_label_en: 'Small',
      option_label_bs: 'Mali',
      addon_display: [{
        group_id: 'grp-x', option_id: 'opt-x',
        group_label_en: 'Variant-en', group_label_bs: 'Varijanta',
        option_label_en: 'Box', option_label_bs: 'Kutija',
        price_adjustment: 0,
      }],
    });
    const result = buildOrderItems([item], 'bs');
    const c = result[0].customizations as Record<string, string>;
    expect(c['Varijanta']).toBe('Mali');           // system variant key (BS)
    expect(c['Varijanta (2)']).toBe('Kutija');     // addon renamed
  });

  it('text_required value is preserved in a renamed key', () => {
    const item = baseItem({
      customizations: { Engraving: 'user text' },
      addon_display: [addonDisplay('Engraving', 'Custom', 1.5, 'Happy Birthday')],
    });
    const result = buildOrderItems([item], 'en');
    const c = result[0].customizations as Record<string, string>;
    expect(c['Engraving']).toBe('user text');
    expect(c['Engraving (2)']).toBe('Custom (+1.50 KM): Happy Birthday');
  });

  it('addon labels that do NOT collide remain unchanged', () => {
    const item = baseItem({
      customizations: { Note: 'fragile' },
      addon_display: [addonDisplay('Packaging', 'Standard')],
    });
    const result = buildOrderItems([item], 'en');
    const c = result[0].customizations as Record<string, string>;
    expect(c['Packaging']).toBe('Standard');
    expect(c['Note']).toBe('fragile');
    expect('Packaging (2)' in c).toBe(false);
  });

  it('addon label matching an existing (2) key goes to (3)', () => {
    // Two addons both named "Color", plus a custom field "Color (2)".
    // First addon → "Color"; second → "Color (2)" is taken → "Color (3)".
    const item = baseItem({
      customizations: { 'Color (2)': 'pre-existing' },
      addon_display: [
        addonDisplay('Color', 'Red'),
        addonDisplay('Color', 'Blue'),
      ],
    });
    const result = buildOrderItems([item], 'en');
    const c = result[0].customizations as Record<string, string>;
    expect(c['Color']).toBe('Red');
    expect(c['Color (2)']).toBe('pre-existing');  // custom field wins
    expect(c['Color (3)']).toBe('Blue');
  });
});
