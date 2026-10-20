import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft, Plus, X as XIcon,
  AlertCircle, CheckCircle2, RotateCcw, Loader2, ImageIcon,
} from "lucide-react";
import { Navbar, Footer } from "../components/Layout";
import { CartDrawer } from "../components/CartDrawer";
import { AuthModal } from "../components/AuthModal";
import { SiteMeta } from "../components/SiteMeta";
import { supabase } from "../lib/supabase";
import { useLang } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { t } from "../i18n/translations";
import { validateCreationPhoto, uploadCreationPhoto } from "../lib/creationUpload";

declare global {
  interface Window {
    turnstile: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PHOTOS = 5;
const inputCls =
  "px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full";

type PhotoStatus = "uploading" | "done" | "error";

type PhotoItem = {
  id: string;
  file: File;
  status: PhotoStatus;
  token: string | null;
  previewUrl: string | null;
  objectUrl: string;
  errType: "upload_failed" | "too_large" | "invalid_type" | null;
};

type GalleryMeta = {
  id: number;
  cover_image_url: string | null;
  title_en: string;
  title_bs: string;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-navy/80">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function TurnstileWidget({
  siteKey,
  onSolve,
  onExpire,
}: {
  siteKey: string;
  onSolve: (token: string) => void;
  onExpire: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onSolveRef = useRef(onSolve);
  const onExpireRef = useRef(onExpire);
  onSolveRef.current = onSolve;
  onExpireRef.current = onExpire;

  useEffect(() => {
    function renderWidget() {
      if (!containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onSolveRef.current(token),
        "expired-callback": () => onExpireRef.current(),
        "error-callback": () => onExpireRef.current(),
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.getElementById(
        "cf-turnstile-script",
      ) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "cf-turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget, { once: true });
    }

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  return <div ref={containerRef} />;
}

function GalleryPreviewCard({
  item,
  lang,
  label,
  removeLabel,
  onRemove,
}: {
  item: GalleryMeta;
  lang: string;
  label: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  const title =
    lang === "bs"
      ? item.title_bs || item.title_en
      : item.title_en || item.title_bs;
  return (
    <div className="flex items-start gap-3 p-4 bg-copper/5 border border-copper/20 rounded-xl">
      {item.cover_image_url ? (
        <img
          src={item.cover_image_url}
          alt={title}
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-copper/10 flex items-center justify-center flex-shrink-0">
          <ImageIcon className="w-6 h-6 text-copper/40" strokeWidth={1.5} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-copper uppercase tracking-widest font-semibold mb-0.5">
          {label}
        </p>
        <p className="text-sm font-medium text-navy line-clamp-2">{title}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="text-navy/40 hover:text-navy/70 p-1 rounded transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-navy/20"
      >
        <XIcon className="w-4 h-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function PhotoCard({
  photo,
  retryLabel,
  removeLabel,
  onRetry,
  onRemove,
}: {
  photo: PhotoItem;
  retryLabel: string;
  removeLabel: string;
  onRetry: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
      <img
        src={photo.objectUrl}
        alt=""
        className={`w-full h-full object-cover transition-opacity ${
          photo.status === "uploading" ? "opacity-50" : ""
        }`}
      />

      {photo.status === "uploading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Loader2 className="w-5 h-5 text-white animate-spin" strokeWidth={2} />
        </div>
      )}

      {photo.status === "done" && (
        <div className="absolute bottom-1.5 right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
        </div>
      )}

      {photo.status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 gap-1.5">
          <AlertCircle className="w-5 h-5 text-red-300" strokeWidth={1.75} />
          {photo.errType === "upload_failed" && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1 text-white text-xs font-medium px-2 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors focus:outline-none"
            >
              <RotateCcw className="w-3 h-3" strokeWidth={2} />
              {retryLabel}
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors focus:outline-none"
      >
        <XIcon className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomCreation() {
  const { lang } = useLang();
  const tx = t[lang];
  const { custom_creation_enabled } = useSiteSettings();
  const [searchParams] = useSearchParams();

  // TEMPORARY TEST MODE: show form only to verified admins while
  // custom_creation_enabled=false. No secret embedded here — admin status
  // is read from the live Supabase Auth session.
  // REVERT after testing: remove isAdmin state and replace formEnabled
  // with custom_creation_enabled in the three JSX conditions below.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAdmin(user?.app_metadata?.role === "admin");
    });
  }, []);
  const formEnabled = isAdmin;

  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  // Idempotency key — stable per submission, rotated on edit-after-attempt
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [attempted, setAttempted] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);

  // Form fields
  const [form, setFormState] = useState({
    name: "", email: "", phone: "",
    productType: "", description: "", dims: "", quantity: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Photos
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gallery reference from URL param
  const [galleryItem, setGalleryItem] = useState<GalleryMeta | null>(null);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ refNumber: string } | null>(null);

  // Fetch gallery item if ?gallery_item_id= is present
  useEffect(() => {
    const galleryItemId = searchParams.get("gallery_item_id");
    if (!galleryItemId) return;
    supabase
      .from("gallery_items")
      .select("id, cover_image_url, title_en, title_bs")
      .eq("id", galleryItemId)
      .eq("is_published", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setGalleryItem(data as GalleryMeta);
      });
  }, [searchParams]);

  // Rotate key after an attempted submit — old photo tokens become invalid
  function rotateKey() {
    setPhotos((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.objectUrl);
      return [];
    });
    setIdempotencyKey(crypto.randomUUID());
    setAttempted(false);
    setTurnstileToken(null);
    setResetNotice(true);
  }

  function setField(key: keyof typeof form, value: string) {
    if (attempted) rotateKey();
    setResetNotice(false);
    setFormState((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  // ── Photo management ─────────────────────────────────────────────────────────

  async function doUpload(photoId: string, file: File, key: string) {
    try {
      const { token, previewUrl } = await uploadCreationPhoto(file, key);
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId ? { ...p, status: "done" as const, token, previewUrl } : p,
        ),
      );
    } catch {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId
            ? { ...p, status: "error" as const, errType: "upload_failed" }
            : p,
        ),
      );
    }
  }

  function addPhotos(files: FileList | File[]) {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    const toAdd = Array.from(files).slice(0, remaining);
    const key = idempotencyKey;

    for (const file of toAdd) {
      const id = crypto.randomUUID();
      const objectUrl = URL.createObjectURL(file);
      const validErr = validateCreationPhoto(file);

      if (validErr) {
        setPhotos((prev) => [
          ...prev,
          {
            id, file, status: "error" as const,
            token: null, previewUrl: null, objectUrl, errType: validErr,
          },
        ]);
      } else {
        setPhotos((prev) => [
          ...prev,
          {
            id, file, status: "uploading" as const,
            token: null, previewUrl: null, objectUrl, errType: null,
          },
        ]);
        doUpload(id, file, key);
      }
    }
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.objectUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function retryPhoto(id: string) {
    const photo = photos.find((p) => p.id === id);
    if (!photo) return;
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: "uploading" as const, token: null, errType: null }
          : p,
      ),
    );
    doUpload(id, photo.file, idempotencyKey);
  }

  // ── Drag and drop ────────────────────────────────────────────────────────────

  function onDragOver(e: DragEvent) { e.preventDefault(); setDragging(true); }
  function onDragLeave() { setDragging(false); }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) addPhotos(e.dataTransfer.files);
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = tx.custom_err_name;
    if (!EMAIL_RE.test(form.email.trim())) errs.email = tx.custom_err_email;
    if (!form.description.trim()) errs.description = tx.custom_err_description;
    if (!turnstileToken) errs.captcha = tx.custom_err_captcha;
    if (photos.some((p) => p.status === "uploading")) {
      errs.photos = tx.custom_err_photos_uploading;
    } else if (photos.some((p) => p.status === "error")) {
      errs.photos = tx.custom_err_photos_invalid;
    }

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    setAttempted(true);

    const uploadTokens = photos
      .filter((p) => p.token !== null)
      .map((p) => p.token!);

    const { data, error } = await supabase.functions.invoke(
      "submit-creation-request",
      {
        body: {
          idempotency_key: idempotencyKey,
          full_name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          product_type: form.productType.trim() || null,
          description: form.description.trim(),
          dims_colours_mats: form.dims.trim() || null,
          quantity: form.quantity.trim() || null,
          gallery_item_id: galleryItem?.id ?? null,
          lang,
          upload_tokens: uploadTokens,
          turnstile_token: turnstileToken,
        },
      },
    );

    setSubmitting(false);

    if (error) {
      const status =
        (error as { context?: { status?: number } }).context?.status ?? 0;
      let serverMsg: string | undefined;
      try {
        const body = await (
          error as { context?: { json?: () => Promise<{ error?: string }> } }
        ).context?.json?.();
        serverMsg = body?.error;
      } catch {}

      if (status === 503) setSubmitError(tx.custom_err_service);
      else if (status === 429) setSubmitError(tx.custom_err_rate_limit);
      else setSubmitError(serverMsg ?? tx.custom_err_generic);
      return;
    }

    const refNumber = (data as { ref_number?: string })?.ref_number;
    if (!refNumber) { setSubmitError(tx.custom_err_generic); return; }
    setSuccess({ refNumber });
  }

  function handleReset() {
    for (const p of photos) URL.revokeObjectURL(p.objectUrl);
    setPhotos([]);
    setFormState({ name: "", email: "", phone: "", productType: "", description: "", dims: "", quantity: "" });
    setIdempotencyKey(crypto.randomUUID());
    setAttempted(false);
    setTurnstileToken(null);
    setErrors({});
    setSubmitError(null);
    setSuccess(null);
    setResetNotice(false);
    setGalleryItem(null);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col overflow-x-hidden">
      <SiteMeta title={tx.custom_meta_title} />
      <Navbar />
      <CartDrawer />
      <AuthModal />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">

          {/* Back */}
          <Link
            to="/gallery"
            className="inline-flex items-center gap-2 text-sm text-navy/50 hover:text-navy transition-colors focus:outline-none focus:underline"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            {tx.custom_back}
          </Link>

          {/* Header */}
          <div className="mt-8 mb-8">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-copper/10 text-copper text-xs font-semibold uppercase tracking-widest mb-3">
              {tx.custom_badge}
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold leading-tight mb-3">
              {tx.custom_heading}
            </h1>
            <p className="text-navy/60 leading-relaxed max-w-xl">{tx.custom_intro}</p>
          </div>

          {/* Unavailable */}
          {!formEnabled && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <h2 className="text-xl font-semibold text-navy mb-3">
                {tx.custom_unavailable_heading}
              </h2>
              <p className="text-navy/60 leading-relaxed max-w-sm mx-auto">
                {tx.custom_unavailable_body}
              </p>
            </div>
          )}

          {/* Success */}
          {formEnabled && success && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-500" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-navy mb-2">
                  {tx.custom_success_heading}
                </h2>
                <p className="text-navy/60 leading-relaxed">{tx.custom_success_sub}</p>
              </div>
              <div className="mt-1 px-6 py-4 bg-gray-50 rounded-xl text-center">
                <p className="text-xs text-navy/40 uppercase tracking-widest font-semibold">
                  {tx.custom_success_ref}
                </p>
                <p className="text-lg font-mono font-semibold text-navy mt-1">
                  {success.refNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="mt-2 text-sm text-copper font-semibold hover:underline focus:outline-none focus:underline"
              >
                {tx.custom_success_new}
              </button>
            </div>
          )}

          {/* Form */}
          {formEnabled && !success && (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">

              {/* Gallery preview */}
              {galleryItem && (
                <GalleryPreviewCard
                  item={galleryItem}
                  lang={lang}
                  label={tx.custom_gallery_label}
                  removeLabel={tx.custom_gallery_remove}
                  onRemove={() => setGalleryItem(null)}
                />
              )}

              {/* Reset notice — shown after key rotation */}
              {resetNotice && (
                <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                  <AlertCircle
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    strokeWidth={1.75}
                  />
                  <span>{tx.custom_form_reset_notice}</span>
                </div>
              )}

              {/* Contact details */}
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
                <h2 className="font-semibold text-navy">{tx.custom_section_contact}</h2>
                <Field label={tx.custom_field_name} error={errors.name}>
                  <input
                    type="text"
                    className={inputCls}
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    autoComplete="name"
                    placeholder="Amina Karić"
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={tx.custom_field_email} error={errors.email}>
                    <input
                      type="email"
                      className={inputCls}
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      autoComplete="email"
                      placeholder="amina@example.com"
                    />
                  </Field>
                  <Field label={tx.custom_field_phone}>
                    <input
                      type="tel"
                      className={inputCls}
                      value={form.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                      autoComplete="tel"
                      placeholder="+387 61 000 000"
                    />
                  </Field>
                </div>
              </section>

              {/* Idea details */}
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
                <h2 className="font-semibold text-navy">{tx.custom_section_idea}</h2>
                <Field label={tx.custom_field_type}>
                  <input
                    type="text"
                    className={inputCls}
                    value={form.productType}
                    onChange={(e) => setField("productType", e.target.value)}
                    placeholder={
                      lang === "bs"
                        ? "npr. vjenčani poklon, ukrasna kutija…"
                        : "e.g. wedding gift, decorative box…"
                    }
                  />
                </Field>
                <Field label={tx.custom_field_description} error={errors.description}>
                  <textarea
                    className={`${inputCls} resize-none`}
                    rows={5}
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    placeholder={
                      lang === "bs" ? "Opišite svoju ideju…" : "Describe your idea…"
                    }
                  />
                </Field>
                <Field label={tx.custom_field_dims}>
                  <textarea
                    className={`${inputCls} resize-none`}
                    rows={3}
                    value={form.dims}
                    onChange={(e) => setField("dims", e.target.value)}
                  />
                </Field>
                <Field label={tx.custom_field_quantity}>
                  <input
                    type="text"
                    className={inputCls}
                    value={form.quantity}
                    onChange={(e) => setField("quantity", e.target.value)}
                    placeholder="1"
                  />
                </Field>
              </section>

              {/* Photos */}
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
                <h2 className="font-semibold text-navy">{tx.custom_section_photos}</h2>
                <p className="text-xs text-navy/50">{tx.custom_photos_hint}</p>

                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {photos.map((photo) => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        retryLabel={tx.custom_photo_retry}
                        removeLabel={tx.custom_photo_remove}
                        onRetry={() => retryPhoto(photo.id)}
                        onRemove={() => removePhoto(photo.id)}
                      />
                    ))}
                  </div>
                )}

                {errors.photos && (
                  <p className="text-xs text-red-500">{errors.photos}</p>
                )}

                {photos.length < MAX_PHOTOS ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                    }}
                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 transition-colors cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-navy/20 ${
                      dragging
                        ? "border-copper bg-copper/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Plus className="w-6 h-6 text-navy/30" strokeWidth={1.75} />
                    <p className="text-sm text-navy/50 text-center">
                      <span className="font-medium text-navy">{tx.custom_photos_add}</span>
                      {" "}{tx.custom_photos_or_drag}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) addPhotos(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-navy/50">{tx.custom_photos_limit}</p>
                )}
              </section>

              {/* Security check + submit */}
              <section className="flex flex-col gap-4">
                {siteKey ? (
                  <TurnstileWidget
                    key={idempotencyKey}
                    siteKey={siteKey}
                    onSolve={(token) => {
                      setTurnstileToken(token);
                      if (errors.captcha)
                        setErrors((e) => { const n = { ...e }; delete n.captcha; return n; });
                    }}
                    onExpire={() => setTurnstileToken(null)}
                  />
                ) : (
                  <p className="text-xs text-red-500">{tx.custom_turnstile_missing}</p>
                )}
                {errors.captcha && (
                  <p className="text-xs text-red-500">{errors.captcha}</p>
                )}

                <p className="text-xs text-navy/40 leading-relaxed">
                  {tx.custom_privacy}
                </p>

                {submitError && (
                  <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                    <AlertCircle
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                      strokeWidth={1.75}
                    />
                    <span>{submitError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-copper text-white font-semibold rounded-xl hover:bg-copper/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-copper/50 text-sm flex items-center justify-center gap-2"
                >
                  {submitting && (
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                  )}
                  {submitting ? tx.custom_submitting : tx.custom_submit}
                </button>
              </section>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
