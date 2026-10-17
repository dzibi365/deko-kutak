import { Trash2, Plus } from "lucide-react";
import {
  type AddonGroupDraft,
  type AddonOptionDraft,
  newAddonGroup,
  newAddonOption,
  formatPriceAdj,
} from "../../lib/addonGroups";

const inputCls =
  "px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full";

// ─── Option row ───────────────────────────────────────────────────────────────

function AddonOptionRow({
  opt,
  index,
  onChange,
  onRemove,
}: {
  opt: AddonOptionDraft;
  index: number;
  onChange: (patch: Partial<AddonOptionDraft>) => void;
  onRemove: () => void;
}) {
  const preview =
    opt.label_en || opt.label_bs
      ? `${opt.label_en || opt.label_bs}: ${formatPriceAdj(opt.price_adjustment || '0')}${opt.text_required ? ', requires text' : ''}`
      : null;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="grid grid-cols-[1fr_1fr_80px_auto_auto] gap-2 items-center">
        <input
          value={opt.label_en}
          onChange={(e) => onChange({ label_en: e.target.value })}
          placeholder="Label (EN)"
          className={inputCls}
        />
        <input
          value={opt.label_bs}
          onChange={(e) => onChange({ label_bs: e.target.value })}
          placeholder="Oznaka (BS)"
          className={inputCls}
        />
        <input
          type="number"
          min="0"
          max="99999"
          step="0.01"
          value={opt.price_adjustment}
          onChange={(e) => onChange({ price_adjustment: e.target.value })}
          placeholder="0.00"
          className={inputCls}
        />
        {/* text_required toggle */}
        <label
          title="Requires text input from customer"
          className="flex items-center gap-1 cursor-pointer select-none"
        >
          <div
            onClick={() => onChange({ text_required: !opt.text_required })}
            className={`rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${opt.text_required ? "bg-navy" : "bg-gray-200"}`}
            style={{ width: "30px", height: "18px" }}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${opt.text_required ? "translate-x-3" : "translate-x-0"}`}
            />
          </div>
          <span className="text-[10px] text-gray-400 whitespace-nowrap">text</span>
        </label>
        <button
          type="button"
          title="Remove option"
          onClick={onRemove}
          className="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      </div>
      {preview && (
        <p className="text-[11px] text-gray-400 pl-0.5">
          {opt.label_en || opt.label_bs}:{" "}
          <span className="font-medium text-gray-600">{formatPriceAdj(opt.price_adjustment || '0')}</span>
          {opt.text_required && (
            <span className="ml-1 text-amber-500">, requires text</span>
          )}
        </p>
      )}
    </div>
  );
}

// ─── Group card ───────────────────────────────────────────────────────────────

function AddonGroupCard({
  group,
  index,
  requiresPersonalization,
  onChange,
  onRemove,
}: {
  group: AddonGroupDraft;
  index: number;
  requiresPersonalization: boolean;
  onChange: (patch: Partial<AddonGroupDraft>) => void;
  onRemove: () => void;
}) {
  function updateOption(idx: number, patch: Partial<AddonOptionDraft>) {
    onChange({ options: group.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)) });
  }

  function removeOption(idx: number) {
    onChange({ options: group.options.filter((_, i) => i !== idx) });
  }

  function addOption() {
    onChange({ options: [...group.options, newAddonOption()] });
  }

  const modalWarning =
    group.location === "personalization_modal" && !requiresPersonalization;

  return (
    <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3 bg-gray-50/50">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-1">
          Group {index + 1}
        </span>
        {/* ID badge — auto-generated, read-only */}
        <span className="text-[9px] font-mono text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={group.id}>
          {group.id}
        </span>
        {/* Required toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <div
            onClick={() => onChange({ required: !group.required })}
            className={`rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${group.required ? "bg-navy" : "bg-gray-200"}`}
            style={{ width: "30px", height: "18px" }}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${group.required ? "translate-x-3" : "translate-x-0"}`}
            />
          </div>
          <span className="text-xs text-gray-500">Required</span>
        </label>
        <button
          type="button"
          title="Remove group"
          onClick={onRemove}
          className="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Bilingual labels */}
      <div className="grid grid-cols-2 gap-2">
        <input
          value={group.label_en}
          onChange={(e) => onChange({ label_en: e.target.value })}
          placeholder="Group label (EN)"
          className={inputCls}
        />
        <input
          value={group.label_bs}
          onChange={(e) => onChange({ label_bs: e.target.value })}
          placeholder="Oznaka grupe (BS)"
          className={inputCls}
        />
      </div>

      {/* Location */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          Display Location
        </span>
        <select
          value={group.location}
          onChange={(e) =>
            onChange({ location: e.target.value as "product_page" | "personalization_modal" })
          }
          className={inputCls}
        >
          <option value="product_page">Product Page</option>
          <option value="personalization_modal">Personalization Modal</option>
        </select>
        {modalWarning && (
          <p className="text-xs text-amber-600">
            ⚠ "Personalization Modal" requires the product's "Requires Personalization" toggle to be enabled.
          </p>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          Options
        </span>

        {group.options.length > 0 && (
          <div className="grid grid-cols-[1fr_1fr_80px_auto_auto] gap-2 px-0.5">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">EN</span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">BS</span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">+KM</span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Text</span>
            <span />
          </div>
        )}

        {group.options.map((opt, oi) => (
          <AddonOptionRow
            key={opt.id}
            opt={opt}
            index={oi}
            onChange={(patch) => updateOption(oi, patch)}
            onRemove={() => removeOption(oi)}
          />
        ))}

        {group.options.length < 20 && (
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1 self-start text-xs text-navy/60 hover:text-navy transition-colors mt-0.5"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Add option
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function AddonGroupsEditor({
  groups,
  requiresPersonalization,
  onChange,
}: {
  groups: AddonGroupDraft[];
  requiresPersonalization: boolean;
  onChange: (groups: AddonGroupDraft[]) => void;
}) {
  function updateGroup(idx: number, patch: Partial<AddonGroupDraft>) {
    onChange(groups.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  }

  function removeGroup(idx: number) {
    onChange(groups.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.length === 0 && (
        <p className="text-xs text-gray-300 text-center py-4 border border-dashed border-gray-200 rounded-xl">
          No groups yet. Click "Add Group" to create one.
        </p>
      )}

      {groups.map((grp, gi) => (
        <AddonGroupCard
          key={grp.id}
          group={grp}
          index={gi}
          requiresPersonalization={requiresPersonalization}
          onChange={(patch) => updateGroup(gi, patch)}
          onRemove={() => removeGroup(gi)}
        />
      ))}

      {groups.length < 10 && (
        <button
          type="button"
          onClick={() => onChange([...groups, newAddonGroup()])}
          className="flex items-center gap-1.5 self-start px-3 py-1.5 text-xs font-semibold text-navy border border-navy/20 rounded-lg hover:bg-navy hover:text-white hover:border-navy transition-colors"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          Add Group
        </button>
      )}

      <p className="text-xs text-gray-400">
        1–10 groups · 1–20 options each · IDs are auto-generated and stable
      </p>
    </div>
  );
}
