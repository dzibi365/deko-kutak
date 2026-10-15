import { GripVertical, Trash2, Plus } from "lucide-react";
import type { CustomField, CustomFieldType } from "../../lib/supabase";

// ─── Bilingual option row helpers ─────────────────────────────────────────────

type OptionRow = { en: string; bs: string };

/** Derive aligned [{ en, bs }] rows from a CustomField's option arrays.
 *  For legacy fields (only options[], no options_en/bs) both columns are
 *  pre-populated from options so the admin can see and translate them.
 *  Empty strings are preserved — the shift invariant is maintained by index. */
export function fieldToRows(field: CustomField): OptionRow[] {
  const en = field.options_en ?? field.options;
  const bs = field.options_bs ?? field.options;
  const len = Math.max(en.length, bs.length);
  return Array.from({ length: len }, (_, i) => ({ en: en[i] ?? "", bs: bs[i] ?? "" }));
}

/** Convert rows back to the three option arrays that live on CustomField.
 *  options is always kept in sync with options_en for backward compat. */
export function rowsToField(rows: OptionRow[]): Partial<CustomField> {
  const options_en = rows.map((r) => r.en);
  const options_bs = rows.map((r) => r.bs);
  return { options_en, options_bs, options: options_en };
}

export { type CustomField };

export const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "image", label: "Photo" },
];

export function newField(): CustomField {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label_en: "",
    label_bs: "",
    placeholder_en: "",
    placeholder_bs: "",
    type: "text",
    options: [],
    required: false,
  };
}

const inputCls =
  "px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full";

export function CustomFieldEditor({
  field, index, onChange, onRemove, dropdownFields,
}: {
  field: CustomField;
  index: number;
  onChange: (patch: Partial<CustomField>) => void;
  onRemove: () => void;
  dropdownFields: CustomField[];
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3 bg-gray-50/50">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" strokeWidth={1.75} />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-1">Field {index + 1}</span>

        {/* Required toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <div
            onClick={() => onChange({ required: !field.required })}
            className={`rounded-full transition-colors flex items-center px-0.5 ${field.required ? "bg-navy" : "bg-gray-200"}`}
            style={{ width: "30px", height: "18px" }}
          >
            <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${field.required ? "translate-x-3" : "translate-x-0"}`} />
          </div>
          <span className="text-xs text-gray-500">Required</span>
        </label>

        <button type="button" onClick={onRemove}
          className="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50">
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-4 gap-1">
        {FIELD_TYPES.map((t) => (
          <button key={t.value} type="button"
            onClick={() => onChange({ type: t.value })}
            className={`py-1.5 text-xs font-medium rounded-lg border transition-colors ${field.type === t.value ? "bg-navy text-white border-navy" : "border-gray-200 text-gray-500 hover:border-navy/30 hover:text-navy bg-white"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Labels */}
      <div className="grid grid-cols-2 gap-2">
        <input value={field.label_en} onChange={(e) => onChange({ label_en: e.target.value })}
          placeholder="Label (EN)" className={inputCls} />
        <input value={field.label_bs} onChange={(e) => onChange({ label_bs: e.target.value })}
          placeholder="Oznaka (BS)" className={inputCls} />
      </div>

      {/* Placeholders — only for text/textarea */}
      {(field.type === "text" || field.type === "textarea") && (
        <div className="grid grid-cols-2 gap-2">
          <input value={field.placeholder_en} onChange={(e) => onChange({ placeholder_en: e.target.value })}
            placeholder="Placeholder (EN)" className={inputCls} />
          <input value={field.placeholder_bs} onChange={(e) => onChange({ placeholder_bs: e.target.value })}
            placeholder="Placeholder (BS)" className={inputCls} />
        </div>
      )}

      {/* Conditional Required — only when there are dropdown siblings and field is not always-required */}
      {!field.required && dropdownFields.length > 0 && (() => {
        const rif = field.required_if;
        if (!rif) {
          return (
            <button
              type="button"
              onClick={() => onChange({ required_if: { field_id: dropdownFields[0].id, value: "" } })}
              className="flex items-center gap-1 self-start text-xs text-gray-400 hover:text-navy transition-colors"
            >
              <Plus className="w-3 h-3" strokeWidth={2} />
              Add conditional rule
            </button>
          );
        }
        const srcField = dropdownFields.find((df) => df.id === rif.field_id);
        const srcOptions = srcField
          ? (srcField.options_en ?? srcField.options).filter((o) => o.trim())
          : [];
        return (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Required when</span>
            <div className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
              <select
                value={rif.field_id}
                onChange={(e) => onChange({ required_if: { field_id: e.target.value, value: "" } })}
                className={inputCls}
              >
                {dropdownFields.map((df) => (
                  <option key={df.id} value={df.id}>{df.label_en || df.label_bs || "(Dropdown)"}</option>
                ))}
              </select>
              <select
                value={rif.value}
                onChange={(e) => onChange({ required_if: { ...rif, value: e.target.value } })}
                className={inputCls}
              >
                <option value="">— select option —</option>
                {srcOptions.map((o, i) => (
                  <option key={i} value={o}>{o}</option>
                ))}
              </select>
              <button
                type="button"
                title="Remove rule"
                onClick={() => onChange({ required_if: undefined })}
                className="p-1 text-gray-300 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* Options — bilingual row editor, only for select */}
      {field.type === "select" && (() => {
        const rows = fieldToRows(field);
        return (
          <div className="flex flex-col gap-2">
            {rows.length > 0 && (
              <div className="grid grid-cols-[1fr_1fr_28px] gap-2">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Options (EN)</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Opcije (BS)</span>
                <span />
              </div>
            )}
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
                <input
                  value={row.en}
                  onChange={(e) => {
                    const next = rows.map((r, j) => j === i ? { ...r, en: e.target.value } : r);
                    onChange(rowsToField(next));
                  }}
                  placeholder="e.g. Red"
                  className={inputCls}
                />
                <input
                  value={row.bs}
                  onChange={(e) => {
                    const next = rows.map((r, j) => j === i ? { ...r, bs: e.target.value } : r);
                    onChange(rowsToField(next));
                  }}
                  placeholder="npr. Crvena"
                  className={inputCls}
                />
                <button
                  type="button"
                  title="Remove option"
                  onClick={() => onChange(rowsToField(rows.filter((_, j) => j !== i)))}
                  className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange(rowsToField([...rows, { en: "", bs: "" }]))}
              className="flex items-center gap-1 self-start text-xs text-navy/60 hover:text-navy transition-colors mt-0.5"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              Add option
            </button>
          </div>
        );
      })()}
    </div>
  );
}

export function CustomFieldsList({
  fields,
  onChange,
}: {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
}) {
  function add() {
    onChange([...fields, newField()]);
  }

  function update(id: string, patch: Partial<CustomField>) {
    onChange(fields.map((f) => f.id === id ? { ...f, ...patch } : f));
  }

  function remove(id: string) {
    onChange(fields.filter((f) => f.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 && (
        <p className="text-xs text-gray-300 text-center py-4 border border-dashed border-gray-200 rounded-xl">
          No fields yet. Click "Add Field" to create one.
        </p>
      )}
      {fields.map((f, idx) => {
        const dropdownFields = fields.filter((other) => other.type === "select" && other.id !== f.id);
        return (
          <CustomFieldEditor
            key={f.id}
            field={f}
            index={idx}
            dropdownFields={dropdownFields}
            onChange={(patch) => update(f.id, patch)}
            onRemove={() => remove(f.id)}
          />
        );
      })}
      <button type="button" onClick={add}
        className="flex items-center gap-1.5 self-start px-3 py-1.5 text-xs font-semibold text-navy border border-navy/20 rounded-lg hover:bg-navy hover:text-white hover:border-navy transition-colors">
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Add Field
      </button>
    </div>
  );
}
