import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { Plus, Trash2, LayoutGrid } from "lucide-react";
import * as Icons from "lucide-react";
import { useState } from "react";
import type { NodeViewProps } from "@tiptap/react";

export interface Feature {
  icon: string;
  title: string;
  desc: string;
}

export interface GridData {
  cardColor: string;
  iconColor: string;
  iconTextColor: string;
  items: Feature[];
}

export const ICON_OPTIONS = [
  "Gift", "Star", "Heart", "Leaf", "Key", "KeyRound", "Package", "Truck",
  "Shield", "Award", "Sparkles", "Home", "Sun", "CheckCircle",
  "Box", "Tag", "Zap", "Clock", "Users", "Scissors", "Wrench",
  "Flame", "Layers", "Feather", "Droplets", "Ruler", "Ribbon",
  "Palette", "Lock", "MapPin", "PanelTop", "TreePine", "Compass", "Plane",
] as const;

const BG_PRESETS = [
  { label: "Warm beige",  card: "#faf7f4", icon: "#ede5db", text: "#7a5c3a" },
  { label: "Slate",       card: "#f1f5f9", icon: "#e2e8f0", text: "#374151" },
  { label: "Navy tint",   card: "#eef0f6", icon: "#dce0ee", text: "#1a1a2e" },
  { label: "Copper tint", card: "#fdf4ec", icon: "#f5e0c8", text: "#92430a" },
  { label: "Sage",        card: "#f0f5f0", icon: "#d8ebd8", text: "#2d6a2d" },
  { label: "Rose",        card: "#fdf0f0", icon: "#f5d8d8", text: "#8b2020" },
];

export const DEFAULT_GRID: GridData = {
  cardColor: BG_PRESETS[0].card,
  iconColor: BG_PRESETS[0].icon,
  iconTextColor: BG_PRESETS[0].text,
  items: [],
};

export function parseGridData(raw: string): GridData {
  try {
    const parsed = JSON.parse(raw);
    // Support old format: plain array of features
    if (Array.isArray(parsed)) {
      return { ...DEFAULT_GRID, items: parsed };
    }
    return { ...DEFAULT_GRID, ...parsed };
  } catch {
    return { ...DEFAULT_GRID };
  }
}

type AnyIconRecord = Record<string, React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>>;

function LucideIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Comp = (Icons as unknown as AnyIconRecord)[name];
  return Comp ? <Comp className={className} style={style} strokeWidth={1.75} /> : <Icons.Star className={className} style={style} strokeWidth={1.75} />;
}

function IconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200 hover:border-copper/50 hover:bg-copper/5 transition-colors"
        title="Choose icon"
      >
        <LucideIcon name={value} className="w-5 h-5 text-copper" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-12 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-2 w-[220px]">
            <div className="grid grid-cols-6 gap-1">
              {ICON_OPTIONS.map((name) => (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => { onChange(name); setOpen(false); }}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    value === name ? "bg-copper text-white" : "text-gray-500 hover:bg-gray-100 hover:text-navy"
                  }`}
                >
                  <LucideIcon name={name} className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BgColorPicker({ cardColor, iconColor, onChange }: {
  cardColor: string;
  iconColor: string;
  onChange: (card: string, icon: string, text: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        title="Card background color"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-200 bg-white hover:border-copper/40 transition-colors text-[11px] text-gray-500"
      >
        <div className="w-3.5 h-3.5 rounded-full border border-gray-300" style={{ backgroundColor: cardColor }} />
        Card color
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[180px]">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Background</p>
            <div className="flex flex-col gap-1.5">
              {BG_PRESETS.map((p) => (
                <button
                  key={p.card}
                  type="button"
                  onClick={() => { onChange(p.card, p.icon, p.text); setOpen(false); }}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors hover:bg-gray-50 ${
                    cardColor === p.card ? "ring-1 ring-copper bg-copper/5" : ""
                  }`}
                >
                  <div className="flex gap-1 flex-shrink-0">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.card, border: "1px solid rgba(0,0,0,0.08)" }} />
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.icon, border: "1px solid rgba(0,0,0,0.08)" }} />
                  </div>
                  <span className="text-gray-600">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FeatureCard({ feature, onChange, onDelete }: {
  feature: Feature;
  onChange: (f: Feature) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-3 p-3 bg-white rounded-xl border border-gray-200">
      <div className="flex-shrink-0 pt-0.5">
        <IconPicker value={feature.icon} onChange={(icon) => onChange({ ...feature, icon })} />
      </div>
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <input
          value={feature.title}
          onChange={(e) => onChange({ ...feature, title: e.target.value })}
          placeholder="Feature title"
          className="text-sm font-semibold border border-gray-200 rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-navy/20"
        />
        <textarea
          value={feature.desc}
          onChange={(e) => onChange({ ...feature, desc: e.target.value })}
          placeholder="Short description"
          rows={2}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 w-full resize-none focus:outline-none focus:ring-1 focus:ring-navy/20"
        />
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="self-start mt-0.5 p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function FeatureGridNodeView({ node, updateAttributes }: NodeViewProps) {
  const grid: GridData = parseGridData(node.attrs.grid as string);
  const { items, cardColor, iconColor, iconTextColor } = grid;

  const setGrid = (next: Partial<GridData>) =>
    updateAttributes({ grid: JSON.stringify({ ...grid, ...next }) });

  return (
    <NodeViewWrapper>
      <div className="border-2 border-dashed border-copper/25 rounded-xl p-4 my-3 bg-copper/[0.03]" contentEditable={false}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5 text-copper" strokeWidth={1.75} />
            <span className="text-[11px] font-semibold text-copper uppercase tracking-widest">Feature Grid</span>
          </div>
          <div className="flex items-center gap-2">
            <BgColorPicker
              cardColor={cardColor}
              iconColor={iconColor}
              onChange={(card, icon, text) => setGrid({ cardColor: card, iconColor: icon, iconTextColor: text })}
            />
            <button
              type="button"
              onClick={() => setGrid({ items: [...items, { icon: "Star", title: "", desc: "" }] })}
              className="flex items-center gap-1 text-[11px] font-medium text-copper hover:text-copper/70 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add feature
            </button>
          </div>
        </div>

        {/* Preview strip */}
        {items.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-hidden rounded-lg p-2" style={{ backgroundColor: cardColor }}>
            {items.slice(0, 2).map((f, i) => (
              <div key={i} className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center" style={{ backgroundColor: iconColor }}>
                  <LucideIcon name={f.icon} className="w-3.5 h-3.5" style={{ color: iconTextColor }} />
                </div>
                <span className="text-xs font-semibold text-navy truncate">{f.title || "Title"}</span>
              </div>
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">
            No features yet — click "Add feature" to start.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((f, i) => (
              <FeatureCard
                key={i}
                feature={f}
                onChange={(updated) => {
                  const next = [...items];
                  next[i] = updated;
                  setGrid({ items: next });
                }}
                onDelete={() => setGrid({ items: items.filter((_, j) => j !== i) })}
              />
            ))}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const FeatureGridExtension = Node.create({
  name: "featureGrid",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      grid: {
        default: JSON.stringify(DEFAULT_GRID),
        parseHTML: (el) => el.getAttribute("data-grid") || JSON.stringify(DEFAULT_GRID),
        renderHTML: (attrs) => ({ "data-grid": attrs.grid }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="feature-grid"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-type": "feature-grid" }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FeatureGridNodeView);
  },
});
