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

export const ICON_OPTIONS = [
  "Gift", "Star", "Heart", "Leaf", "Key", "KeyRound", "Package", "Truck",
  "Shield", "Award", "Sparkles", "Home", "Sun", "CheckCircle",
  "Box", "Tag", "Zap", "Clock", "Users", "Scissors", "Wrench",
  "Flame", "Layers", "Feather", "Droplets", "Ruler", "Ribbon",
  "Palette", "Lock", "MapPin", "PanelTop", "TreePine",
] as const;

type AnyIconRecord = Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>;

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const Comp = (Icons as unknown as AnyIconRecord)[name];
  return Comp ? <Comp className={className} strokeWidth={1.75} /> : <Icons.Star className={className} strokeWidth={1.75} />;
}

function IconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200 hover:border-copper/50 hover:bg-copper/5 transition-colors"
        title="Choose icon"
      >
        <LucideIcon name={value} className="w-5 h-5 text-copper" />
      </button>

      {/* Popover grid */}
      {open && (
        <>
          {/* Backdrop */}
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
                    value === name
                      ? "bg-copper text-white"
                      : "text-gray-500 hover:bg-gray-100 hover:text-navy"
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

function FeatureCard({
  feature, onChange, onDelete,
}: {
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
  const features: Feature[] = (node.attrs.features as Feature[]) || [];

  const update = (next: Feature[]) => updateAttributes({ features: next });

  return (
    <NodeViewWrapper>
      <div className="border-2 border-dashed border-copper/25 rounded-xl p-4 my-3 bg-copper/[0.03]" contentEditable={false}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5 text-copper" strokeWidth={1.75} />
            <span className="text-[11px] font-semibold text-copper uppercase tracking-widest">Feature Grid</span>
          </div>
          <button
            type="button"
            onClick={() => update([...features, { icon: "Star", title: "", desc: "" }])}
            className="flex items-center gap-1 text-[11px] font-medium text-copper hover:text-copper/70 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add feature
          </button>
        </div>

        {features.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">
            No features yet — click "Add feature" to start.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {features.map((f, i) => (
              <FeatureCard
                key={i}
                feature={f}
                onChange={(updated) => {
                  const next = [...features];
                  next[i] = updated;
                  update(next);
                }}
                onDelete={() => update(features.filter((_, j) => j !== i))}
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
      features: {
        default: [],
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute("data-features") || "[]");
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({
          "data-features": JSON.stringify(attrs.features ?? []),
        }),
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
