import { useCallback, useEffect, useRef, useState } from "react";
import { X, ShoppingBag, Upload, ChevronDown } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import { localName, type CustomField, type Product, type PriceOption, type AddonGroup } from "../lib/supabase";
import { uploadCustomerPhoto } from "../lib/customerUpload";
import { AddonGroupSelector } from "./AddonGroupSelector";
import {
  calcAddonSurcharge,
  buildAddonSelectionsPayload,
  validateAddonSelectionsState,
  type AddonSelectionState,
} from "../lib/addonGroups";

type Props = {
  product: Product;
  onClose: () => void;
  variantOption?: PriceOption;
  pageAddonSelections?: AddonSelectionState;
  pageGroups?: AddonGroup[];
};

export function PersonalizationModal({ product, onClose, variantOption, pageAddonSelections = {}, pageGroups = [] }: Props) {
  const { lang, tr } = useLang();
  const { addItem } = useCart();
  const fields = product.custom_fields ?? [];
  const modalGroups = (product.addon_groups ?? [] as AddonGroup[]).filter(
    (g) => g.location === "personalization_modal",
  );

  // All field values stored as strings. Image fields store the storage path (UUID.ext).
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
  // field id → plaintext token (keyed by field id, remapped to label on submit)
  const [uploadTokens, setUploadTokens] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [modalAddonSelections, setModalAddonSelections] = useState<AddonSelectionState>({});
  const [addonError, setAddonError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  const name = localName(product, lang);

  // Live unit price: base + page addon surcharge + modal addon surcharge
  const basePrice = variantOption?.price ?? product.price;
  const pageSurcharge = calcAddonSurcharge(pageAddonSelections, pageGroups);
  const modalSurcharge = calcAddonSurcharge(modalAddonSelections, modalGroups);
  const unitPrice = basePrice + pageSurcharge + modalSurcharge;
  const price = `${unitPrice.toFixed(2).replace(".", ",")} KM`;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while modal is open. iOS Safari ignores overflow:hidden on
  // body, so we use position:fixed + top offset to prevent page scroll entirely.
  useEffect(() => {
    const y = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${y}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, y);
    };
  }, []);

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
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setUploadErrors((prev) => ({ ...prev, [fieldId]: tr("upload_invalid_format") }));
      if (fileRefs.current[fieldId]) fileRefs.current[fieldId]!.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadErrors((prev) => ({ ...prev, [fieldId]: tr("upload_too_large") }));
      if (fileRefs.current[fieldId]) fileRefs.current[fieldId]!.value = "";
      return;
    }

    setUploadingFields((prev) => ({ ...prev, [fieldId]: true }));
    setUploadErrors((prev) => ({ ...prev, [fieldId]: "" }));

    try {
      const { path, token } = await uploadCustomerPhoto(file);
      setVal(fieldId, path);
      setUploadTokens((prev) => ({ ...prev, [fieldId]: token }));
      setFileNames((prev) => ({ ...prev, [fieldId]: file.name }));
    } catch {
      setUploadErrors((prev) => ({ ...prev, [fieldId]: tr("upload_failed") }));
    } finally {
      setUploadingFields((prev) => ({ ...prev, [fieldId]: false }));
      if (fileRefs.current[fieldId]) fileRefs.current[fieldId]!.value = "";
    }
  }

  function clearImageField(fieldId: string) {
    setVal(fieldId, "");
    setFileNames((prev) => ({ ...prev, [fieldId]: "" }));
    setUploadTokens((prev) => { const next = { ...prev }; delete next[fieldId]; return next; });
  }

  function validate(): boolean {
    const next: Record<string, boolean> = {};
    fields.forEach((f) => {
      if (!isEffectivelyRequired(f, values)) return;
      // image: check URL stored in values (empty = not uploaded)
      if (f.type === "image" && !values[f.id]) next[f.id] = true;
      else if (f.type === "checkbox" && values[f.id] !== "yes") next[f.id] = true;
      else if (f.type !== "checkbox" && f.type !== "image" && !values[f.id]?.trim()) next[f.id] = true;
    });
    setErrors(next);
    if (Object.keys(next).length > 0) return false;

    // Validate modal add-on groups
    const addonToken = validateAddonSelectionsState(modalAddonSelections, modalGroups);
    if (addonToken) {
      const [type, id] = addonToken.split(":");
      if (type === "required") {
        const grp = modalGroups.find((g) => g.id === id);
        const lbl = grp ? (lang === "bs" ? grp.label_bs || grp.label_en : grp.label_en || grp.label_bs) : id;
        setAddonError(`${tr("addon_select_required")} ${lbl}`);
      } else {
        setAddonError(tr("addon_text_required_msg"));
      }
      return false;
    }

    return true;
  }

  function handleScrollDown() {
    scrollRef.current?.scrollBy({ top: 200, behavior: "smooth" });
  }

  function handleSubmit() {
    if (!validate()) return;

    // Build customizations: key = localized label, value = field value string.
    // Image fields store the storage path (UUID.ext); tokens are passed separately.
    const customizations: Record<string, string> = {};
    const tokens: Record<string, string> = {};

    fields.forEach((f) => {
      const val = values[f.id];
      if (!val) return;
      const label = lang === "bs"
        ? (f.label_bs || f.label_en)
        : (f.label_en || f.label_bs);
      if (!label) return;

      // For bilingual select fields, the state holds the EN canonical value.
      // Convert it to the lang-appropriate display label for storage in the order.
      // Legacy select fields (no options_en/bs) store the value verbatim — unchanged.
      let displayVal = val;
      if (f.type === "select" && (f.options_en || f.options_bs)) {
        const optEN = f.options_en ?? f.options;
        const optBS = f.options_bs ?? f.options;
        const idx = optEN.indexOf(val);
        if (idx !== -1) displayVal = lang === "bs" ? (optBS[idx] || val) : val;
      }

      customizations[label] = displayVal;
      if (f.type === "image" && uploadTokens[f.id]) {
        tokens[label] = uploadTokens[f.id];
      }
    });

    // Merge page + modal addon selections for the cart payload
    const allGroups = [...pageGroups, ...modalGroups];
    const allSelections = { ...pageAddonSelections, ...modalAddonSelections };
    const addonPayload =
      allGroups.length > 0 ? buildAddonSelectionsPayload(allSelections, allGroups) : undefined;

    addItem(
      product,
      customizations,
      Object.keys(tokens).length > 0 ? tokens : undefined,
      variantOption,
      addonPayload,
    );
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
          No overflow-hidden here — that would hide the scrollbar.
        */}
        <div className="flex-auto min-h-0 flex flex-col">
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex-1 min-h-0 overflow-y-auto px-6 py-5"
          >
            <div className="flex flex-col gap-5">
          {(() => {
            const note = lang === "bs"
              ? (product.personalization_note_bs || product.personalization_note_en)
              : (product.personalization_note_en || product.personalization_note_bs);
            if (!note) return null;
            return (
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">{note}</p>
              </div>
            );
          })()}
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
                    {isEffectivelyRequired(field, values) && <span className="text-red-400 ml-1">*</span>}
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

                {field.type === "select" && (() => {
                  // options_en is the stable internal value (EN canonical).
                  // options_bs holds the BS display labels at matching indices.
                  // Legacy fields (no options_en/bs) fall back to options for both.
                  const optEN = field.options_en ?? field.options;
                  const optBS = field.options_bs ?? field.options;
                  const hasOpts = optEN.some((o) => o.trim());
                  if (!hasOpts) return null;
                  return (
                    <select
                      value={values[field.id] ?? ""}
                      onChange={(e) => setVal(field.id, e.target.value)}
                      className={fieldCls(hasError)}
                    >
                      <option value="">— {lang === "bs" ? "Odaberi" : "Select"} —</option>
                      {optEN.map((enOpt, i) => {
                        if (!enOpt.trim()) return null;
                        const display = lang === "bs" ? (optBS[i] || enOpt) : enOpt;
                        return <option key={i} value={enOpt}>{display}</option>;
                      })}
                    </select>
                  );
                })()}

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
                      {isEffectivelyRequired(field, values) && <span className="text-red-400 ml-1">*</span>}
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
                      accept="image/jpeg,image/png,image/webp"
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
            {/* Personalization-modal add-on groups */}
            {modalGroups.length > 0 && (
              <>
                <div className="border-t border-gray-100" />
                <AddonGroupSelector
                  groups={modalGroups}
                  selections={modalAddonSelections}
                  onChange={(next) => { setModalAddonSelections(next); setAddonError(null); }}
                />
              </>
            )}
            </div>{/* end flex flex-col gap-5 */}
          </div>{/* end scroll div */}

          {/* Reserved indicator strip — in-flow, never overlaps fields */}
          <div className="flex-shrink-0 h-10 flex items-center justify-center border-t border-gray-100">
            {hasMoreBelow && (
              <button
                type="button"
                onClick={handleScrollDown}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-copper hover:bg-copper/90 text-white text-xs font-semibold rounded-full shadow-sm transition-colors"
              >
                {tr("modal_more_options")}
                <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>{/* end fields wrapper */}

        {/* Footer — non-scrolling */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 flex flex-col gap-2">
          {addonError && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{addonError}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={Object.values(uploadingFields).some(Boolean)}
            className="w-full flex items-center justify-center gap-2.5 py-3 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-60"
          >
            <ShoppingBag className="w-4 h-4" strokeWidth={1.75} />
            {tr("product_add_to_cart")}
          </button>
        </div>
      </div>
    </div>
  );
}

function isEffectivelyRequired(field: CustomField, values: Record<string, string>): boolean {
  if (field.required) return true;
  if (field.required_if) {
    return (values[field.required_if.field_id] ?? "") === field.required_if.value;
  }
  return false;
}

function fieldCls(error: boolean) {
  return `px-3 py-2 border rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 transition w-full ${
    error
      ? "border-red-300 bg-red-50/50 focus:ring-red-200"
      : "border-gray-200 focus:ring-navy/20 focus:border-navy"
  }`;
}
