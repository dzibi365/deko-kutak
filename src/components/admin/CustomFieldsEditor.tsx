import { GripVertical, Trash2, Plus } from "lucide-react";
import type { CustomField, CustomFieldType } from "../../lib/supabase";

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
  field, index, onChange, onRemove,
}: {
  field: CustomField;
  index: number;
  onChange: (patch: Partial<CustomField>) => void;
  onRemove: () => void;
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

      {/* Options — only for select */}
      {field.type === "select" && (
        <div className="flex flex-col gap-1">
          <input
            value={field.options.join(", ")}
            onChange={(e) => onChange({ options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            placeholder="Options, comma-separated (e.g. Red, Blue, Green)"
            className={inputCls}
          />
          {field.options.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {field.options.map((opt) => (
                <span key={opt} className="px-2 py-0.5 bg-navy/10 text-navy text-xs rounded-full">{opt}</span>
              ))}
            </div>
          )}
        </div>
      )}
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
      {fields.map((f, idx) => (
        <CustomFieldEditor
          key={f.id}
          field={f}
          index={idx}
          onChange={(patch) => update(f.id, patch)}
          onRemove={() => remove(f.id)}
        />
      ))}
      <button type="button" onClick={add}
        className="flex items-center gap-1.5 self-start px-3 py-1.5 text-xs font-semibold text-navy border border-navy/20 rounded-lg hover:bg-navy hover:text-white hover:border-navy transition-colors">
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Add Field
      </button>
    </div>
  );
}
