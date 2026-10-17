import type { CartItem } from "../context/CartContext";

export function buildOrderItems(
  items: CartItem[],
  lang: string,
): Record<string, unknown>[] {
  return items.map((item) => {
    const {
      uploadTokens: _tokens,
      cartKey: _cartKey,
      option_label_en,
      option_label_bs,
      addon_display,
      ...rest
    } = item;

    const extra: Record<string, string> = {};
    // Pre-populate with all keys already claimed by custom fields so addon
    // entries can detect and avoid collisions before the merge.
    const usedKeys = new Set<string>(Object.keys(rest.customizations ?? {}));

    // Variant label
    if (rest.option_id && (option_label_en || option_label_bs)) {
      const lbl =
        lang === "bs"
          ? option_label_bs || option_label_en || ""
          : option_label_en || option_label_bs || "";
      const variantKey = lang === "bs" ? "Varijanta" : "Variant";
      extra[variantKey] = lbl;
      // Mark variant key occupied so addons named "Variant"/"Varijanta" get (2).
      usedKeys.add(variantKey);
    }

    // Add-on labels — each key is guaranteed unique across variant, sibling
    // addons and custom field labels before the merge is written.
    if (addon_display?.length) {
      for (const s of addon_display) {
        const gLabel =
          lang === "bs"
            ? s.group_label_bs || s.group_label_en
            : s.group_label_en || s.group_label_bs;
        const oLabel =
          lang === "bs"
            ? s.option_label_bs || s.option_label_en
            : s.option_label_en || s.option_label_bs;
        const adj = s.price_adjustment > 0 ? ` (+${s.price_adjustment.toFixed(2)} KM)` : "";
        const txt = s.text_value ? `: ${s.text_value}` : "";

        let key = gLabel;
        let counter = 2;
        while (usedKeys.has(key)) {
          key = `${gLabel} (${counter++})`;
        }
        usedKeys.add(key);
        extra[key] = `${oLabel}${adj}${txt}`;
      }
    }

    const merged = { ...extra, ...(rest.customizations ?? {}) };
    const customizations = Object.keys(merged).length > 0 ? merged : undefined;

    return { ...rest, ...(customizations !== undefined ? { customizations } : {}) };
  });
}
