import type { AddonGroup, AddonOption } from './supabase';

export type { AddonGroup, AddonOption };

export type AddonOptionDraft = {
  id: string;
  label_en: string;
  label_bs: string;
  price_adjustment: string;
  text_required: boolean;
};

export type AddonGroupDraft = {
  id: string;
  label_en: string;
  label_bs: string;
  location: 'product_page' | 'personalization_modal';
  required: boolean;
  options: AddonOptionDraft[];
};

export function genAddonId(prefix: 'grp' | 'opt'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newAddonOption(): AddonOptionDraft {
  return {
    id: genAddonId('opt'),
    label_en: '',
    label_bs: '',
    price_adjustment: '0',
    text_required: false,
  };
}

export function newAddonGroup(): AddonGroupDraft {
  return {
    id: genAddonId('grp'),
    label_en: '',
    label_bs: '',
    location: 'product_page',
    required: false,
    options: [newAddonOption()],
  };
}

export function formatPriceAdj(adj: number | string): string {
  const n = typeof adj === 'string' ? parseFloat(adj.trim() || '0') : adj;
  if (isNaN(n) || n === 0) return 'Included';
  return `+${n.toFixed(2)} KM`;
}

export function validateAddonGroupsDraft(
  groups: AddonGroupDraft[],
  requiresPersonalization: boolean,
): string | null {
  if (groups.length === 0) return null;
  if (groups.length > 10) return `Maximum 10 add-on groups allowed (currently ${groups.length}).`;

  const groupIds = new Set<string>();

  for (let gi = 0; gi < groups.length; gi++) {
    const grp = groups[gi];
    const glabel = `Add-on Group ${gi + 1}`;

    if (!grp.id.trim()) return `${glabel}: ID is missing.`;
    if (groupIds.has(grp.id)) return `Duplicate group ID "${grp.id}".`;
    groupIds.add(grp.id);

    if (!grp.label_en.trim()) return `${glabel}: English label is required.`;
    if (!grp.label_bs.trim()) return `${glabel}: Bosnian label is required.`;

    if (grp.location !== 'product_page' && grp.location !== 'personalization_modal')
      return `${glabel}: Invalid location.`;

    if (grp.location === 'personalization_modal' && !requiresPersonalization)
      return `${glabel}: "Personalization Modal" location requires the product's "Requires Personalization" toggle to be enabled first.`;

    if (grp.options.length === 0) return `${glabel}: At least one option is required.`;
    if (grp.options.length > 20)
      return `${glabel}: Maximum 20 options allowed (currently ${grp.options.length}).`;

    const optIds = new Set<string>();

    for (let oi = 0; oi < grp.options.length; oi++) {
      const opt = grp.options[oi];
      const olabel = `${glabel}, Option ${oi + 1}`;

      if (!opt.id.trim()) return `${olabel}: ID is missing.`;
      if (optIds.has(opt.id)) return `${olabel}: Duplicate option ID "${opt.id}".`;
      optIds.add(opt.id);

      if (!opt.label_en.trim()) return `${olabel}: English label is required.`;
      if (!opt.label_bs.trim()) return `${olabel}: Bosnian label is required.`;

      const adjStr = opt.price_adjustment.trim();
      const adj = adjStr === '' ? 0 : parseFloat(adjStr);

      if (isNaN(adj)) return `${olabel}: Price adjustment must be a number (e.g. 0 or 5.50).`;
      if (adj < 0) return `${olabel}: Price adjustment must be 0 or a positive value.`;
      if (adj > 99999) return `${olabel}: Price adjustment must not exceed 99,999 KM.`;

      if (adjStr !== '' && !/^\d+(\.\d{1,2})?$/.test(adjStr))
        return `${olabel}: Price adjustment must have at most 2 decimal places (e.g. 5.50).`;
    }
  }

  return null;
}

export function buildAddonGroupsPayload(groups: AddonGroupDraft[]): AddonGroup[] | null {
  if (groups.length === 0) return null;
  return groups.map((grp) => {
    const group: AddonGroup = {
      id: grp.id,
      label_en: grp.label_en.trim(),
      label_bs: grp.label_bs.trim(),
      location: grp.location,
      options: grp.options.map((opt) => {
        const adjStr = opt.price_adjustment.trim();
        const option: AddonOption = {
          id: opt.id,
          label_en: opt.label_en.trim(),
          label_bs: opt.label_bs.trim(),
          price_adjustment: adjStr === '' ? 0 : (parseFloat(adjStr) || 0),
        };
        if (opt.text_required) option.text_required = true;
        return option;
      }),
    };
    if (grp.required) group.required = true;
    return group;
  });
}

// ─── Customer-facing selection types ─────────────────────────────────────────

/** Minimal selection sent to the server (no client prices) */
export type AddonSelection = {
  group_id: string;
  option_id: string;
  text_value?: string;
};

/** Cart display snapshot — stripped before DB submission */
export type AddonSelectionDisplay = {
  group_id: string;
  option_id: string;
  group_label_en: string;
  group_label_bs: string;
  option_label_en: string;
  option_label_bs: string;
  price_adjustment: number;
  text_value?: string;
};

/** Live selection state on the page: group_id → current pick */
export type AddonSelectionState = Record<string, { option_id: string; text_value?: string }>;

/** Sum of price_adjustments for every currently-selected add-on */
export function calcAddonSurcharge(state: AddonSelectionState, groups: AddonGroup[]): number {
  let total = 0;
  for (const [groupId, sel] of Object.entries(state)) {
    const grp = groups.find((g) => g.id === groupId);
    const opt = grp?.options.find((o) => o.id === sel.option_id);
    if (opt) total += opt.price_adjustment;
  }
  return total;
}

/**
 * Convert AddonSelectionState into the two arrays stored in CartItem:
 * - selections: lean server payload (group_id, option_id, text_value?)
 * - display: cart display snapshot with labels and surcharge
 * Groups are processed in definition order so the cart preserves order.
 */
export function buildAddonSelectionsPayload(
  state: AddonSelectionState,
  groups: AddonGroup[],
): { selections: AddonSelection[]; display: AddonSelectionDisplay[] } {
  const selections: AddonSelection[] = [];
  const display: AddonSelectionDisplay[] = [];

  for (const grp of groups) {
    const sel = state[grp.id];
    if (!sel) continue;
    const opt = grp.options.find((o) => o.id === sel.option_id);
    if (!opt) continue;
    const textVal = opt.text_required && sel.text_value?.trim() ? sel.text_value.trim() : undefined;

    selections.push({ group_id: grp.id, option_id: opt.id, ...(textVal ? { text_value: textVal } : {}) });
    display.push({
      group_id: grp.id,
      option_id: opt.id,
      group_label_en: grp.label_en,
      group_label_bs: grp.label_bs,
      option_label_en: opt.label_en,
      option_label_bs: opt.label_bs,
      price_adjustment: opt.price_adjustment,
      ...(textVal ? { text_value: textVal } : {}),
    });
  }

  return { selections, display };
}

/** Stable cart-key fragment encoding the selected combination */
export function addonSelectionCartKey(display: AddonSelectionDisplay[]): string {
  return [...display]
    .sort((a, b) => a.group_id.localeCompare(b.group_id))
    .map((s) => `${s.group_id}:${s.option_id}${s.text_value ? `:${s.text_value}` : ''}`)
    .join('|');
}

/**
 * Returns null if all required groups are selected and all text_required
 * options have non-blank text.  Otherwise returns a typed error token:
 *   "required:<group_id>"
 *   "text_required:<option_id>:<group_id>"
 */
export function validateAddonSelectionsState(
  state: AddonSelectionState,
  groups: AddonGroup[],
): string | null {
  for (const grp of groups) {
    const sel = state[grp.id];
    if (grp.required && !sel) return `required:${grp.id}`;
    if (sel) {
      const opt = grp.options.find((o) => o.id === sel.option_id);
      if (opt?.text_required && !sel.text_value?.trim()) {
        return `text_required:${opt.id}:${grp.id}`;
      }
    }
  }
  return null;
}

// ─── Admin draft utilities (unchanged) ───────────────────────────────────────

export function addonGroupDraftFromDb(grp: AddonGroup): AddonGroupDraft {
  return {
    id: grp.id,
    label_en: grp.label_en,
    label_bs: grp.label_bs,
    location: grp.location,
    required: grp.required ?? false,
    options: grp.options.map((opt) => ({
      id: opt.id,
      label_en: opt.label_en,
      label_bs: opt.label_bs,
      price_adjustment: String(opt.price_adjustment),
      text_required: opt.text_required ?? false,
    })),
  };
}
