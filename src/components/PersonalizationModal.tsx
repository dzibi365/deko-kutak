import { useCallback, useEffect, useRef, useState } from "react";
import { X, ShoppingBag, Upload } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import { supabase, localName, type Product } from "../lib/supabase";

type Props = {
  product: Product;
  onClose: () => void;
};

export function PersonalizationModal({ product, onClose }: Props) {
  const { lang, tr } = useLang();
  const { addItem } = useCart();
  const fields = product.custom_fields ?? [];

  // All field values stored as strings. Image fields store the uploaded Supabase URL.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    fields.forEach((f) => { init[f.id] = ""; });
    return init;
  });
  // Display-only filenames for image fields
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  // Per-field upload spinners
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  const name = localName(product, lang);
  const price = `${product.price.toFixed(2).replace(".", ",")} KM`;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // More content below when scrollable height exceeds visible height by > 24px
    setHasMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 24);
  }, []);

  // Check on mount and whenever fields change
  useEffect(() => {
    checkScroll();
  }, [fields, checkScroll]);

  function setVal(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: false }));
  }

  async function handleImageFile(fieldId: string, file: File) {
    setUploadingFields((prev) => ({ ...prev, [fieldId]: true }));
    setUploadErrors((prev) => ({ ...prev, [fieldId]: "" }));

    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("customer-uploads")
      .upload(path, file, { upsert: false });

    if (uploadErr) {
      setUploadErrors((prev) => ({ ...prev, [fieldId]: uploadErr.message }));
      setUploadingFields((prev) => ({ ...prev, [fieldId]: false }));
      return;
    }

    const url = supabase.storage.from("customer-uploads").getPublicUrl(path).data.publicUrl;
    setVal(fieldId, url);
    setFileNames((prev) => ({ ...prev, [fieldId]: file.name }));
    setUploadingFields((prev) => ({ ...prev, [fieldId]: false }));
    if (fileRefs.current[fieldId]) fileRefs.current[fieldId]!.value = "";
  }

  function clearImageField(fieldId: string) {
    setVal(fieldId, "");
    setFileNames((prev) => ({ ...prev, [fieldId]: "" }));
  }

  function validate(): boolean {
    const next: Record<string, boolean> = {};
    fields.forEach((f) => {
      if (!f.required) return;
      // image: check URL stored in values (empty = not uploaded)
      if (f.type === "image" && !values[f.id]) next[f.id] = true;
      else if (f.type === "checkbox" && values[f.id] !== "yes") next[f.id] = true;
      else if (f.type !== "checkbox" && f.type !== "image" && !values[f.id]?.trim()) next[f.id] = true;
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;

    // Build customizations exactly as ProductDetail does:
    // key = localized label, value = field value string.
    // Only include fields with a non-empty value.
    const customizations: Record<string, string> = {};
    fields.forEach((f) => {
      const val = values[f.id];
      if (val) {
        const label = lang === "bs"
          ? (f.label_bs || f.label_en)
          : (f.label_en || f.label_bs);
        if (label) customizations[label] = val;
      }
    });

    addItem(product, customizations);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      {/*
        overflow-hidden is required: it makes max-h-[90dvh] a definite size
        so the flex algorithm can correctly distribute space to flex-auto children.
        Without it, flex items see the modal as unconstrained and flex-auto collapses.
      */}
      <div
        className="bg-white rounded-2xl w-full max-w-[540px] shadow-xl max-h-[90dvh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — non-scrolling */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="font-semibold text-navy text-base">{tr("modal_personalize_title")}</h2>
          <button
            onClick={onClose}
            aria-label={tr("modal_close")}
            className="p-2 text-gray-400 hover:text-navy rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Product summary — non-scrolling */}
        <div className="flex-shrink-0 flex items-center gap-4 px-6 py-4 bg-gray-50/60 border-b border-gray-100">
          {product.image_url && (
            <img
              src={product.image_url}
              alt={name}
              className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-gray-100"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-navy leading-snug line-clamp-2">{name}</p>
            <p className="text-sm font-semibold text-copper leading-snug mt-1">{price}</p>
          </div>
        </div>

        {/*
          Fields wrapper: flex-auto (flex-basis:auto, can grow+shrink) + min-h-0 (can shrink below content).
          flex flex-col makes it a flex container so the inner scroll div can use flex-1 reliably.
          relative positions the indicator overlay.
          No overflow-hidden here — that would hide the scrollbar.
        */}
        <div className="relative flex-auto min-h-0 flex flex-col">
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex-1 min-h-0 overflow-y-auto px-6 py-5"
          >
            <div className="flex flex-col gap-5">
          {fields.map((field) => {
            const label = lang === "bs"
              ? (field.label_bs || field.label_en)
              : (field.label_en || field.label_bs);

            const placeholder = lang === "bs"
              ? (field.placeholder_bs || field.placeholder_en || label)
              : (field.placeholder_en || field.placeholder_bs || label);

            const hasError = !!errors[field.id];
            const isUploading = !!uploadingFields[field.id];
            const uploadError = uploadErrors[field.id];

            return (
              <div key={field.id} className="flex flex-col gap-1.5">
                {field.type !== "checkbox" && (
                  <label className="text-sm font-medium text-navy">
                    {label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                )}

                {field.type === "text" && (
                  <input
                    type="text"
                    value={values[field.id] ?? ""}
                    onChange={(e) => setVal(field.id, e.target.value)}
                    placeholder={placeholder}
                    className={fieldCls(hasError)}
                  />
                )}

                {field.type === "textarea" && (
                  <textarea
                    value={values[field.id] ?? ""}
                    onChange={(e) => setVal(field.id, e.target.value)}
                    placeholder={placeholder}
                    rows={3}
                    className={`${fieldCls(hasError)} resize-none`}
                  />
                )}

                {field.type === "select" && field.options.length > 0 && (
                  <select
                    value={values[field.id] ?? ""}
                    onChange={(e) => setVal(field.id, e.target.value)}
                    className={fieldCls(hasError)}
                  >
                    <option value="">— {lang === "bs" ? "Odaberi" : "Select"} —</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {field.type === "checkbox" && (
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={values[field.id] === "yes"}
                      onChange={(e) => setVal(field.id, e.target.checked ? "yes" : "")}
                      className="w-4 h-4 accent-navy rounded"
                    />
                    <span className="text-sm text-navy/70">
                      {label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </span>
                  </label>
                )}

                {field.type === "image" && (
                  <>
                    {values[field.id] ? (
                      // Uploaded state: show filename + remove
                      <div className="flex items-center gap-2.5 px-3 py-2.5 border border-navy/20 rounded-lg bg-navy/5">
                        <Upload className="w-4 h-4 text-navy/50 flex-shrink-0" strokeWidth={1.75} />
                        <span className="text-sm text-navy flex-1 truncate">{fileNames[field.id]}</span>
                        <button
                          type="button"
                          onClick={() => clearImageField(field.id)}
                          className="p-0.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    ) : (
                      // Empty / uploading state
                      <button
                        type="button"
                        onClick={() => !isUploading && fileRefs.current[field.id]?.click()}
                        disabled={isUploading}
                        className={`flex items-center gap-2.5 px-3 py-2.5 border rounded-lg text-sm transition-colors text-left disabled:opacity-60 ${
                          hasError
                            ? "border-red-300 text-red-400 bg-red-50"
                            : "border-gray-200 text-gray-400 hover:border-navy/30 hover:text-navy"
                        }`}
                      >
                        {isUploading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
                            <span>{lang === "bs" ? "Učitavanje…" : "Uploading…"}</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                            <span className="truncate">{placeholder}</span>
                          </>
                        )}
                      </button>
                    )}
                    <input
                      ref={(el) => { fileRefs.current[field.id] = el; }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageFile(field.id, file);
                      }}
                    />
                    {uploadError && (
                      <p className="text-xs text-red-500">{uploadError}</p>
                    )}
                  </>
                )}

                {hasError && (
                  <p className="text-xs text-red-500">{tr("modal_required_field")}</p>
                )}
              </div>
            );
          })}
            </div>{/* end flex flex-col gap-5 */}
          </div>{/* end scroll div */}

          {/* Scroll indicator — overlays bottom of the scroll area */}
          {hasMoreBelow && (
            <div className="absolute bottom-0 left-0 right-0 h-14 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
              <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                <span className="text-xs text-navy/40 font-medium">
                  {tr("modal_more_options")} ↓
                </span>
              </div>
            </div>
          )}
        </div>{/* end fields wrapper */}

        {/* Footer — non-scrolling */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={handleSubmit}
            className="w-full flex items-center justify-center gap-2.5 py-3 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy/90 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" strokeWidth={1.75} />
            {tr("product_add_to_cart")}
          </button>
        </div>
      </div>
    </div>
  );
}

function fieldCls(error: boolean) {
  return `px-3 py-2 border rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 transition w-full ${
    error
      ? "border-red-300 bg-red-50/50 focus:ring-red-200"
      : "border-gray-200 focus:ring-navy/20 focus:border-navy"
  }`;
}
