import { useEffect, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { supabase, type FieldGroup, type CustomField } from "../../lib/supabase";
import { CustomFieldsList } from "../../components/admin/CustomFieldsEditor";

export default function FieldGroups() {
  const [groups, setGroups] = useState<FieldGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FieldGroup | null>(null);
  const [editName, setEditName] = useState("");
  const [editFields, setEditFields] = useState<CustomField[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("field_groups").select("*").order("name");
    setGroups(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    const { error: err } = await supabase.from("field_groups").insert({ name: newName.trim(), fields: [] });
    setAdding(false);
    if (err) { setError(err.message); return; }
    setNewName("");
    load();
  }

  function openEdit(group: FieldGroup) {
    setEditing(group);
    setEditName(group.name);
    setEditFields(group.fields);
    setError(null);
  }

  function closeEdit() {
    setEditing(null);
    setEditName("");
    setEditFields([]);
  }

  async function handleSave() {
    if (!editing || !editName.trim()) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("field_groups")
      .update({ name: editName.trim(), fields: editFields })
      .eq("id", editing.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeEdit();
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this field group?")) return;
    setDeletingId(id);
    await supabase.from("field_groups").delete().eq("id", id);
    setDeletingId(null);
    load();
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-navy mb-1">Field Groups</h1>
      <p className="text-sm text-gray-400 mb-8">Create reusable sets of customer input fields and apply them to products in one click.</p>

      {/* Add group form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Group name (e.g. Personalization, Size & Color)…"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          Add Group
        </button>
      </form>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {/* Groups list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-400">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="p-6 text-sm text-gray-400">No field groups yet. Add one above.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {groups.map((group) => (
              <div key={group.id}>
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-navy text-sm">{group.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {group.fields.length} field{group.fields.length !== 1 ? "s" : ""}
                      {group.fields.length > 0 && (
                        <span className="ml-1 text-gray-300">
                          · {group.fields.map((f) => f.label_en || f.label_bs).filter(Boolean).join(", ")}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => editing?.id === group.id ? closeEdit() : openEdit(group)}
                    className="p-1.5 text-gray-400 hover:text-navy hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {editing?.id === group.id ? <X className="w-4 h-4" strokeWidth={1.75} /> : <Pencil className="w-4 h-4" strokeWidth={1.75} />}
                  </button>
                  <button
                    onClick={() => handleDelete(group.id)}
                    disabled={deletingId === group.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>

                {/* Inline editor */}
                {editing?.id === group.id && (
                  <div className="px-5 pb-5 flex flex-col gap-4 border-t border-gray-100 bg-gray-50/40">
                    <div className="pt-4">
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">Group Name</label>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-3 block">Fields</label>
                      <CustomFieldsList fields={editFields} onChange={setEditFields} />
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <div className="flex gap-2 justify-end">
                      <button onClick={closeEdit}
                        className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleSave} disabled={saving || !editName.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-50">
                        <Check className="w-4 h-4" strokeWidth={2} />
                        {saving ? "Saving…" : "Save Group"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
