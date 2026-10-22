import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { supabase, type ProductTag } from "../../lib/supabase";

type TagWithCount = ProductTag & { assignmentCount: number };
type DeleteState = { id: number; count: number } | null;

export default function ProductTags() {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameEn, setNameEn] = useState("");
  const [nameBs, setNameBs] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [tagsRes, assignRes] = await Promise.all([
      supabase.from("product_tags").select("*").order("name_en"),
      supabase.from("product_tag_assignments").select("tag_id"),
    ]);
    const countMap: Record<number, number> = {};
    for (const a of assignRes.data ?? []) {
      countMap[a.tag_id] = (countMap[a.tag_id] ?? 0) + 1;
    }
    setTags(
      (tagsRes.data ?? []).map((t) => ({ ...t, assignmentCount: countMap[t.id] ?? 0 }))
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const en = nameEn.trim();
    const bs = nameBs.trim();
    if (!en && !bs) return;
    setAdding(true);
    setError(null);
    const { error: err } = await supabase.from("product_tags").insert({
      name_en: en || bs,
      name_bs: bs || en,
    });
    setAdding(false);
    if (err) {
      setError(
        err.message.includes("unique")
          ? "A tag with that name already exists."
          : err.message
      );
      return;
    }
    setNameEn("");
    setNameBs("");
    load();
  }

  async function requestDelete(tag: TagWithCount) {
    setDeleteState({ id: tag.id, count: tag.assignmentCount });
  }

  async function confirmDelete() {
    if (!deleteState) return;
    setDeleting(true);
    setError(null);
    const { error: err } = await supabase
      .from("product_tags")
      .delete()
      .eq("id", deleteState.id);
    setDeleting(false);
    if (err) { setError(err.message); return; }
    setDeleteState(null);
    load();
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-navy mb-1">Product Tags</h1>
      <p className="text-sm text-gray-400 mb-8">
        Add bilingual tags to products for cross-category filtering in the shop.
      </p>

      <form onSubmit={handleAdd} className="flex flex-col gap-3 mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">EN</span>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="Tag name in English…"
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
            />
          </div>
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">BS</span>
            <input
              value={nameBs}
              onChange={(e) => setNameBs(e.target.value)}
              placeholder="Naziv tagа na bosanskom…"
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={adding || (!nameEn.trim() && !nameBs.trim())}
          className="self-start flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          Add Tag
        </button>
      </form>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {deleteState && (
        <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">
              {deleteState.count > 0
                ? `This tag is assigned to ${deleteState.count} product${deleteState.count !== 1 ? "s" : ""}. Deleting it will remove it from all of them.`
                : "Delete this tag?"}
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                onClick={() => setDeleteState(null)}
                disabled={deleting}
                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-400">Loading…</div>
        ) : tags.length === 0 ? (
          <div className="p-6 text-sm text-gray-400">No tags yet. Add one above.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy text-sm">{tag.name_en}</p>
                  <p className="text-sm text-gray-400">{tag.name_bs}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {tag.assignmentCount > 0
                    ? `${tag.assignmentCount} product${tag.assignmentCount !== 1 ? "s" : ""}`
                    : "unused"}
                </span>
                <button
                  onClick={() => requestDelete(tag)}
                  disabled={deleteState?.id === tag.id}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
