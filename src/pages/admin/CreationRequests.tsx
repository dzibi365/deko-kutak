import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw, ExternalLink, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Photo = {
  id: number;
  storage_path: string;
  mime_type: string;
  display_order: number;
};

type Notification = {
  notification_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

type GalleryRef = {
  id: number;
  title_en: string;
  title_bs: string;
};

type CreationRequest = {
  id: number;
  ref_number: string;
  full_name: string;
  email: string;
  phone: string | null;
  product_type: string | null;
  description: string;
  dimensions_colours_materials: string | null;
  quantity: string | null;
  gallery_item_id: number | null;
  status: string;
  internal_notes: string | null;
  lang: string;
  created_at: string;
  updated_at: string;
  last_communication_at: string | null;
  linked_order_id: number | null;
  gallery_items: GalleryRef | null;
  creation_request_photos: Photo[];
  creation_request_notifications: Notification[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  "new", "in_progress", "quote_sent", "accepted", "completed", "rejected", "cancelled",
] as const;

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  in_progress: "In Progress",
  quote_sent: "Quote Sent",
  accepted: "Accepted",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  new:         "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  quote_sent:  "bg-purple-50 text-purple-700 border-purple-200",
  accepted:    "bg-indigo-50 text-indigo-700 border-indigo-200",
  completed:   "bg-green-50 text-green-700 border-green-200",
  rejected:    "bg-red-50 text-red-500 border-red-200",
  cancelled:   "bg-gray-100 text-gray-500 border-gray-200",
};

const NOTIF_STYLES: Record<string, string> = {
  sent:    "bg-green-50 text-green-700 border-green-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  failed:  "bg-red-50 text-red-600 border-red-200",
};

const inputCls =
  "px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full";

// ─── SignedCreationPhoto ──────────────────────────────────────────────────────

function SignedCreationPhoto({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const mountedRef = useRef(true);

  async function fetchUrl() {
    setLoading(true);
    setFailed(false);
    setUrl(null);

    const { data, error } = await supabase.functions.invoke("sign-creation-photo", {
      body: { storage_path: storagePath },
    });

    if (!mountedRef.current) return;

    if (error || !data?.url) {
      setFailed(true);
    } else {
      setUrl(data.url as string);
    }
    setLoading(false);
  }

  useEffect(() => {
    mountedRef.current = true;
    fetchUrl();
    return () => { mountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storagePath]);

  if (loading) {
    return <div className="w-24 h-24 rounded-xl bg-gray-100 animate-pulse flex-shrink-0" />;
  }

  if (failed || !url) {
    return (
      <div className="w-24 h-24 rounded-xl bg-red-50 border border-red-200 flex flex-col items-center justify-center gap-1.5 flex-shrink-0">
        <AlertCircle className="w-4 h-4 text-red-400" strokeWidth={1.75} />
        <button
          type="button"
          onClick={fetchUrl}
          className="text-xs text-red-500 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex-shrink-0 block"
      title="Open full size"
    >
      <img
        src={url}
        alt="Reference photo"
        className="w-24 h-24 object-cover rounded-xl border border-gray-200 hover:opacity-80 transition-opacity"
        onError={() => setFailed(true)}
      />
    </a>
  );
}

// ─── Row detail ───────────────────────────────────────────────────────────────

function RequestDetail({
  req,
  onSaved,
}: {
  req: CreationRequest;
  onSaved: () => void;
}) {
  const [pendingStatus, setPendingStatus] = useState(req.status);
  const [notes, setNotes] = useState(req.internal_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"ok" | "err" | null>(null);

  // Contact date state — separate save, does NOT affect status/notes.
  const [contactDate, setContactDate] = useState(
    req.last_communication_at
      ? req.last_communication_at.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [savingContact, setSavingContact] = useState(false);
  const [contactResult, setContactResult] = useState<"ok" | "err" | null>(null);

  // Order linkage — lookup by human-readable order_number, save linked_order_id.
  const [orderRef, setOrderRef] = useState("");
  const [linkingOrder, setLinkingOrder] = useState(false);
  const [linkResult, setLinkResult] = useState<"ok" | "not_found" | "err" | null>(null);

  // Reset when row changes
  useEffect(() => {
    setPendingStatus(req.status);
    setNotes(req.internal_notes ?? "");
    setContactDate(
      req.last_communication_at
        ? req.last_communication_at.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );
    setSaveResult(null);
    setContactResult(null);
    setOrderRef("");
    setLinkResult(null);
  }, [req.id, req.status, req.internal_notes, req.last_communication_at]);

  async function save() {
    setSaving(true);
    setSaveResult(null);
    // Intentionally ONLY updates status and internal_notes.
    // last_communication_at is saved separately via saveContact().
    const { error } = await supabase
      .from("creation_requests")
      .update({ status: pendingStatus, internal_notes: notes.trim() || null })
      .eq("id", req.id);
    setSaving(false);
    setSaveResult(error ? "err" : "ok");
    if (!error) onSaved();
  }

  async function saveContact() {
    setSavingContact(true);
    setContactResult(null);
    const { error } = await supabase
      .from("creation_requests")
      .update({ last_communication_at: `${contactDate}T00:00:00Z` })
      .eq("id", req.id);
    setSavingContact(false);
    setContactResult(error ? "err" : "ok");
    if (!error) onSaved();
  }

  async function linkOrder() {
    if (!orderRef.trim()) return;
    setLinkingOrder(true);
    setLinkResult(null);
    const { data: order, error: lookupErr } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", orderRef.trim())
      .maybeSingle();
    if (lookupErr) { setLinkResult("err"); setLinkingOrder(false); return; }
    if (!order) { setLinkResult("not_found"); setLinkingOrder(false); return; }
    const { error: saveErr } = await supabase
      .from("creation_requests")
      .update({ linked_order_id: order.id })
      .eq("id", req.id);
    setLinkingOrder(false);
    setLinkResult(saveErr ? "err" : "ok");
    if (!saveErr) { setOrderRef(""); onSaved(); }
  }

  async function unlinkOrder() {
    setLinkingOrder(true);
    const { error } = await supabase
      .from("creation_requests")
      .update({ linked_order_id: null })
      .eq("id", req.id);
    setLinkingOrder(false);
    if (!error) onSaved();
  }

  const isDirty = pendingStatus !== req.status || (notes.trim() || null) !== req.internal_notes;

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const notif = req.creation_request_notifications.find(
    (n) => n.notification_type === "owner_new_request",
  );

  return (
    <div className="border-t border-gray-100 px-5 py-5 flex flex-col gap-6 bg-gray-50/50">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: customer + request fields */}
        <div className="flex flex-col gap-5">
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Customer</p>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-navy">{req.full_name}</p>
              <a href={`mailto:${req.email}`} className="text-sm text-blue-600 hover:underline">{req.email}</a>
              {req.phone && <p className="text-sm text-gray-500">{req.phone}</p>}
              <p className="text-xs text-gray-400 mt-0.5">Lang: {req.lang.toUpperCase()} · Submitted: {fmt(req.created_at)}</p>
            </div>
          </section>

          {req.product_type && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Product Type</p>
              <p className="text-sm text-gray-700">{req.product_type}</p>
            </section>
          )}

          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{req.description}</p>
          </section>

          {req.dimensions_colours_materials && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Dimensions / Colours / Materials</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{req.dimensions_colours_materials}</p>
            </section>
          )}

          {req.quantity && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Quantity</p>
              <p className="text-sm text-gray-700">{req.quantity}</p>
            </section>
          )}

          {req.gallery_items && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Gallery Reference</p>
              <a
                href={`/gallery/${req.gallery_item_id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-copper hover:underline"
              >
                {req.gallery_items.title_en || req.gallery_items.title_bs}
                <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
              </a>
            </section>
          )}
        </div>

        {/* Right: status, notes, notifications */}
        <div className="flex flex-col gap-5">
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Status</p>
            <select
              value={pendingStatus}
              onChange={(e) => setPendingStatus(e.target.value)}
              disabled={saving}
              className={inputCls}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </section>

          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Internal Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              rows={4}
              placeholder="Notes visible to admins only…"
              className={`${inputCls} resize-none`}
            />
          </section>

          {isDirty && (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="py-2 px-4 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-60 self-start"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          )}

          {saveResult === "ok" && (
            <p className="text-xs text-green-600">Saved.</p>
          )}
          {saveResult === "err" && (
            <p className="text-xs text-red-500">Save failed — check console.</p>
          )}

          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Retention</p>
            <div className="flex flex-col gap-2.5">

              {/* Last contact */}
              <p className="text-xs text-gray-500">
                Last customer contact:{" "}
                <span className="font-medium text-navy">
                  {req.last_communication_at
                    ? fmt(req.last_communication_at)
                    : <span className="text-amber-600">Not recorded — clock runs from submission date</span>}
                </span>
              </p>

              {/* Deletion eligibility */}
              {req.linked_order_id ? (
                <p className="text-xs text-amber-600 font-medium">
                  Excluded from auto-deletion — linked to order ID {req.linked_order_id}.
                  Manual retention review required after{" "}
                  {(() => {
                    const base = req.last_communication_at ?? req.created_at;
                    const d = new Date(base);
                    d.setMonth(d.getMonth() + 12);
                    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                  })()}.
                </p>
              ) : (
                <p className="text-xs text-gray-400">
                  Auto-deletion eligible after:{" "}
                  {(() => {
                    const base = req.last_communication_at ?? req.created_at;
                    const d = new Date(base);
                    d.setMonth(d.getMonth() + 12);
                    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                  })()}
                </p>
              )}

              {/* Record customer contact */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={contactDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setContactDate(e.target.value)}
                  disabled={savingContact}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
                />
                <button
                  type="button"
                  onClick={saveContact}
                  disabled={savingContact || !contactDate}
                  className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-navy text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  {savingContact ? "Saving…" : "Record contact"}
                </button>
              </div>
              {contactResult === "ok" && <p className="text-xs text-green-600">Contact date recorded.</p>}
              {contactResult === "err" && <p className="text-xs text-red-500">Failed to save contact date.</p>}

              {/* Order linkage */}
              {req.linked_order_id ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={unlinkOrder}
                    disabled={linkingOrder}
                    className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 border border-red-200"
                  >
                    {linkingOrder ? "Unlinking…" : "Unlink order"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-gray-400">Link to a shop order (enter order number):</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={orderRef}
                      onChange={(e) => { setOrderRef(e.target.value); setLinkResult(null); }}
                      placeholder="e.g. DK-2026-001"
                      disabled={linkingOrder}
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-36"
                    />
                    <button
                      type="button"
                      onClick={linkOrder}
                      disabled={linkingOrder || !orderRef.trim()}
                      className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-navy text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
                    >
                      {linkingOrder ? "Linking…" : "Link order"}
                    </button>
                  </div>
                  {linkResult === "not_found" && <p className="text-xs text-red-500">No order found with that number.</p>}
                  {linkResult === "err" && <p className="text-xs text-red-500">Failed to link — check console.</p>}
                  {linkResult === "ok" && <p className="text-xs text-green-600">Order linked.</p>}
                </div>
              )}
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Owner Notification</p>
            {notif ? (
              <div className="flex flex-col gap-1">
                <span className={`self-start text-xs font-semibold px-2 py-0.5 rounded-full border ${NOTIF_STYLES[notif.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {notif.status.charAt(0).toUpperCase() + notif.status.slice(1)}
                </span>
                <p className="text-xs text-gray-400">{fmt(notif.created_at)}</p>
                {notif.error_message && (
                  <p className="text-xs text-red-500 mt-1 font-mono break-all">{notif.error_message}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No notification record.</p>
            )}
          </section>
        </div>
      </div>

      {/* Photos */}
      {req.creation_request_photos.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Reference Photos ({req.creation_request_photos.length})
          </p>
          <div className="flex flex-wrap gap-3">
            {req.creation_request_photos
              .slice()
              .sort((a, b) => a.display_order - b.display_order)
              .map((photo) => (
                <SignedCreationPhoto key={photo.id} storagePath={photo.storage_path} />
              ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Photos are signed with 60-second URLs — click to open full size before they expire.
          </p>
        </section>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CreationRequests() {
  const [requests, setRequests] = useState<CreationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function load() {
    setError(null);
    const { data, error: err } = await supabase
      .from("creation_requests")
      .select(`
        id, ref_number, full_name, email, phone, product_type,
        description, dimensions_colours_materials, quantity,
        gallery_item_id, status, internal_notes, lang,
        created_at, updated_at, last_communication_at, linked_order_id,
        gallery_items ( id, title_en, title_bs ),
        creation_request_photos ( id, storage_path, mime_type, display_order ),
        creation_request_notifications ( notification_type, status, error_message, created_at )
      `)
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setRequests((data ?? []) as unknown as CreationRequest[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const q = search.trim().toLowerCase();
  const filtered = requests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!q) return true;
    return (
      r.ref_number.toLowerCase().includes(q) ||
      r.full_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q)
    );
  });

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Custom Creation Requests</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {requests.length} total · {requests.filter((r) => r.status === "new").length} new
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-navy transition-colors px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
          Refresh
        </button>
      </div>

      {/* Search + filter */}
      <div className="mt-6 mb-4 flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Search by name, email or ref…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputCls} max-w-xs`}
        />
        <div className="flex flex-wrap gap-2">
          {["all", ...STATUS_OPTIONS].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                statusFilter === s
                  ? "bg-navy text-white border-navy"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="text-sm text-gray-400">Loading…</div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          Failed to load: {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
          {requests.length === 0
            ? "No custom creation requests yet."
            : "No requests match your search or filter."}
        </div>
      )}

      {/* List */}
      {!loading && !error && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map((req) => (
            <div key={req.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === req.id ? null : req.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-semibold text-navy text-sm">{req.ref_number}</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[req.status] ?? "bg-gray-100 text-gray-500"}`}
                    >
                      {STATUS_LABELS[req.status] ?? req.status}
                    </span>
                    {req.creation_request_photos.length > 0 && (
                      <span className="text-xs text-gray-400">
                        {req.creation_request_photos.length} photo{req.creation_request_photos.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {req.gallery_item_id && (
                      <span className="text-xs text-gray-400">Gallery ref</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{req.full_name} · {req.email}</p>
                </div>
                <div className="text-right flex-shrink-0 flex items-center gap-3">
                  <p className="text-xs text-gray-400">{fmt(req.created_at)}</p>
                  {expanded === req.id
                    ? <ChevronUp className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
                    : <ChevronDown className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
                  }
                </div>
              </div>

              {/* Detail */}
              {expanded === req.id && (
                <RequestDetail
                  req={req}
                  onSaved={load}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
