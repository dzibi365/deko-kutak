import { useLang } from "../context/LanguageContext";
import type { AddonGroup } from "../lib/supabase";
import type { AddonSelectionState } from "../lib/addonGroups";

type Props = {
  groups: AddonGroup[];
  selections: AddonSelectionState;
  onChange: (next: AddonSelectionState) => void;
};

const optBtnCls = (selected: boolean) =>
  `flex items-center justify-between w-full px-4 py-2.5 rounded-xl border-2 text-left transition-colors ${
    selected ? "border-navy bg-navy/5" : "border-gray-200 hover:border-gray-300"
  }`;

export function AddonGroupSelector({ groups, selections, onChange }: Props) {
  const { lang, tr } = useLang();

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      {groups.map((grp) => {
        const groupLabel =
          lang === "bs" ? grp.label_bs || grp.label_en : grp.label_en || grp.label_bs;
        const sel = selections[grp.id];

        return (
          <div key={grp.id} className="flex flex-col gap-2">
            {/* Group label + required indicator */}
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-navy">{groupLabel}</p>
              {grp.required && <span className="text-red-400 text-xs">*</span>}
            </div>

            {/* Options */}
            <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={groupLabel}>
              {grp.options.map((opt) => {
                const optLabel =
                  lang === "bs" ? opt.label_bs || opt.label_en : opt.label_en || opt.label_bs;
                const isSelected = sel?.option_id === opt.id;
                const priceLabel =
                  opt.price_adjustment === 0
                    ? tr("addon_included")
                    : `+${opt.price_adjustment.toFixed(2)} KM`;

                return (
                  <div key={opt.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        const next = { ...selections };
                        if (isSelected && !grp.required) {
                          delete next[grp.id];
                        } else {
                          next[grp.id] = { option_id: opt.id };
                        }
                        onChange(next);
                      }}
                      className={optBtnCls(isSelected)}
                    >
                      <span className="text-sm text-navy">{optLabel}</span>
                      <span
                        className={`text-sm font-semibold ${
                          opt.price_adjustment === 0 ? "text-gray-400" : "text-copper"
                        }`}
                      >
                        {priceLabel}
                      </span>
                    </button>

                    {/* text_required input — only for the selected option */}
                    {isSelected && opt.text_required && (
                      <div className="mt-1.5 ml-4 flex flex-col gap-0.5">
                        <input
                          type="text"
                          value={sel?.text_value ?? ""}
                          onChange={(e) =>
                            onChange({
                              ...selections,
                              [grp.id]: { option_id: opt.id, text_value: e.target.value },
                            })
                          }
                          maxLength={200}
                          placeholder={tr("addon_text_placeholder")}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
                        />
                        <p className="text-[10px] text-gray-400 text-right">
                          {sel?.text_value?.length ?? 0}/200
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
