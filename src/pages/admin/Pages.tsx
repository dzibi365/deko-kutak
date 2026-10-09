import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, Edit, FileText, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { RichTextEditor } from "../../components/admin/RichTextEditor";

type Page = {
  id: number;
  slug: string;
  title_en: string | null;
  title_bs: string | null;
  content_en: string | null;
  content_bs: string | null;
  is_published: boolean;
  created_at: string;
};

type LangTab = "en" | "bs";

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const inputCls =
  "px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full";

const emptyForm = {
  title_en: "",
  title_bs: "",
  content_en: "",
  content_bs: "",
  slug: "",
  is_published: false,
};

export default function Pages() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Page | "new" | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [tab, setTab] = useState<LangTab>("en");
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("pages").select("*").order("created_at");
    setPages(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setForm({ ...emptyForm });
    setTab("en");
    setSlugManual(false);
    setError(null);
    setConfirmDelete(false);
    setEditing("new");
  }

  function openEdit(page: Page) {
    setForm({
      title_en: page.title_en ?? "",
      title_bs: page.title_bs ?? "",
      content_en: page.content_en ?? "",
      content_bs: page.content_bs ?? "",
      slug: page.slug,
      is_published: page.is_published,
    });
    setTab("en");
    setSlugManual(true);
    setError(null);
    setConfirmDelete(false);
    setEditing(page);
  }

  function close() {
    setEditing(null);
    setError(null);
    setConfirmDelete(false);
  }

  function setField(key: keyof typeof emptyForm, value: string | boolean) {
    if (key === "title_en" && editing === "new" && !slugManual) {
      setForm((f) => ({ ...f, title_en: value as string, slug: toSlug(value as string) }));
    } else {
      setForm((f) => ({ ...f, [key]: value }));
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.title_en.trim() && !form.title_bs.trim()) {
      setError("Enter a title in at least one language.");
      return;
    }
    if (!form.slug.trim()) {
      setError("Slug is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      slug: form.slug.trim(),
      title_en: form.title_en.trim() || null,
      title_bs: form.title_bs.trim() || null,
      content_en: form.content_en || null,
      content_bs: form.content_bs || null,
      is_published: form.is_published,
      updated_at: new Date().toISOString(),
    };

    const { error: err } =
      editing === "new"
        ? await supabase.from("pages").insert(payload)
        : await supabase.from("pages").update(payload).eq("id", (editing as Page).id);

    setSaving(false);
    if (err) { setError(err.message); return; }
    close();
    load();
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    if (editing === "new" || editing === null) return;
    setDeleting(true);
    await supabase.from("pages").delete().eq("id", (editing as Page).id);
    setDeleting(false);
    close();
    load();
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Pages</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage informational pages (Privacy Policy, FAQ, etc.)</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          New Page
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : pages.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">No pages yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {pages.map((page, i) => (
            <div
              key={page.id}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${
                i < pages.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy truncate">
                  {page.title_en || page.title_bs || <span className="text-gray-400 italic">Untitled</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">/{page.slug}</p>
              </div>
              <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                page.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                {page.is_published ? "Published" : "Draft"}
              </span>
              <button
                onClick={() => openEdit(page)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-navy border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Edit className="w-3.5 h-3.5" strokeWidth={1.75} />
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-8 px-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-navy">{editing === "new" ? "New Page" : "Edit Page"}</h2>
              <button type="button" onClick={close} className="p-1.5 text-gray-400 hover:text-navy rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">
              {error && <p className="text-sm text-red-500 px-4 py-3 bg-red-50 rounded-lg">{error}</p>}

              {/* Language tabs */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg self-start">
                {(["en", "bs"] as const).map((l) => (
                  <button key={l} type="button" onClick={() => setTab(l)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${tab === l ? "bg-white text-navy shadow-sm" : "text-gray-500 hover:text-navy"}`}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-navy">Title ({tab.toUpperCase()})</label>
                <input
                  value={tab === "en" ? form.title_en : form.title_bs}
                  onChange={(e) => setField(tab === "en" ? "title_en" : "title_bs", e.target.value)}
                  placeholder={tab === "en" ? "Privacy Policy" : "Politika privatnosti"}
                  className={inputCls}
                />
              </div>

              {/* Content */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-navy">Content ({tab.toUpperCase()})</label>
                <RichTextEditor
                  key={`${editing === "new" ? "new" : (editing as Page).id}-${tab}`}
                  value={tab === "en" ? form.content_en : form.content_bs}
                  onChange={(html) => setField(tab === "en" ? "content_en" : "content_bs", html)}
                  placeholder={tab === "en" ? "Write page content in English…" : "Napišite sadržaj stranice na bosanskom…"}
                />
              </div>

              {/* Slug */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-navy">Slug</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-400 flex-shrink-0">/</span>
                  <input
                    value={form.slug}
                    onChange={(e) => {
                      setSlugManual(true);
                      setField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
                    }}
                    placeholder="page-url"
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <p className="text-xs text-gray-400">URL-friendly identifier. Changing an already-published slug will break existing links.</p>
              </div>

              {/* Published toggle */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-navy">Published</p>
                  <p className="text-xs text-gray-400">Published pages are visible to visitors and appear in footer links.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setField("is_published", !form.is_published)}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${form.is_published ? "bg-navy" : "bg-gray-200"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_published ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <div>
                {editing !== "new" && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                      confirmDelete ? "bg-red-500 text-white hover:bg-red-600" : "text-red-500 hover:bg-red-50"
                    }`}
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                    {deleting ? "Deleting…" : confirmDelete ? "Confirm Delete" : "Delete"}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={close} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-navy transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Page"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
