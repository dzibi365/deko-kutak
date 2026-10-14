import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, ChevronDown, Copy, Check, X, Plus, FileText } from "lucide-react";

// ── Public types ──────────────────────────────────────────────────────────────

export type AiContent = {
  name_en?: string;
  name_bs?: string;
  description_en?: string;
  description_bs?: string;
};

type Props = {
  /** Current product name (EN preferred) — seeded into prompts. */
  productName: string;
  /** Current product category — seeded into prompts. */
  category: string;
  /** True when the form already has title/description content. */
  hasExistingContent: boolean;
  /** Called when admin clicks "Apply to Form" after reviewing the import. */
  onApply: (data: AiContent) => void;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PRODUCT_TYPES = [
  { value: "",              label: "— Select product type —" },
  { value: "wooden-album",  label: "Drveni foto-album" },
  { value: "wooden-sign",   label: "Drvena tabla / natpis" },
  { value: "candle",        label: "Svijeća" },
  { value: "bouquet",       label: "Buket / dekoracija" },
  { value: "magnet",        label: "Magnet" },
  { value: "keychain",      label: "Privjesak za ključeve" },
  { value: "frame",         label: "Okvir za slike" },
  { value: "gift-box",      label: "Poklon-kutija" },
  { value: "ornament",      label: "Ukrasni predmet" },
  { value: "other",         label: "Ostalo" },
];

const IMAGE_PROMPT_LABELS = [
  "Main Image — Studio",
  "Gallery 1 — Lifestyle",
  "Gallery 2 — Close-up Detail",
  "Gallery 3 — In Use",
  "Gallery 4 — Gift Presentation",
];

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildImagePrompts(params: {
  typeLabel: string;
  productName: string;
  category: string;
  notes: string;
  photoCount: number;
}): string[] {
  const { typeLabel, productName, category, notes, photoCount } = params;

  const refLine =
    photoCount > 0
      ? `I am attaching ${photoCount} reference photo${photoCount > 1 ? "s" : ""} of the actual product to this Gemini conversation. Use them as the primary visual reference.`
      : "No reference photos are attached. Use the product description below as the only reference.";

  const productDesc = [
    typeLabel,
    productName ? `"${productName}"` : "",
    category ? `(category: ${category})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const notesLine = notes.trim() ? `Additional details: ${notes.trim()}` : "";

  const critical = `CRITICAL — preserve these exactly as shown in the reference photo:
• Exact shape, proportions and dimensions of the product.
• All text, engravings, wording, logos, inscriptions — do not alter, remove, translate or reposition them.
• Exact material, color, texture and surface finish.
• Do NOT add any decoration, personalization or feature that is not visible in the reference.
• Do NOT substitute a different product. Only improve lighting, background and composition.`;

  const base = `${refLine}

Product: ${productDesc}${notesLine ? "\n" + notesLine : ""}

${critical}`;

  return [
    `${base}

Task: Generate ONE professional product photograph.
• Background: Clean white or very light neutral surface.
• Lighting: Soft, even studio lighting — no harsh shadows or reflections.
• Angle: Front-facing or slight 3/4, showing the full product.
• Composition: Product centered, filling ~80 % of the frame.
• Output: Square, 800 × 800 px, high resolution, no watermarks.`,

    `${base}

Task: Generate ONE lifestyle photograph.
• Setting: Styled home interior — wooden table, linen cloth, soft natural greenery nearby.
• Lighting: Warm, natural-looking window light or soft ambient.
• The product is the focal point; props are minimal and do not compete for attention.
• Output: Square, 800 × 800 px.`,

    `${base}

Task: Generate ONE close-up detail photograph.
• Focus on the most distinctive physical feature: engraving, texture, material grain, stitching, or print.
• Shallow depth of field: sharp on the chosen detail, background softly blurred.
• No busy background — plain surface or very soft bokeh only.
• Output: Square, 800 × 800 px.`,

    `${base}

Task: Generate ONE in-context or in-use photograph.
• Show the product as it would actually be used or received as a gift: album being browsed, candle lit in a cosy room, magnet on a fridge, frame hanging on a wall — adapt to the product type.
• Atmosphere: warm, personal, celebratory occasion.
• Output: Square, 800 × 800 px.`,

    `${base}

Task: Generate ONE gift-presentation photograph.
• Product placed next to or inside simple gift packaging: kraft paper, satin ribbon, a small handwritten card.
• Background: White or natural wood surface.
• Mood: Elegant, celebratory, premium handmade feel.
• Output: Square, 800 × 800 px.`,
  ];
}

function buildTextPrompt(params: {
  typeLabel: string;
  productName: string;
  category: string;
  notes: string;
}): string {
  const { typeLabel, productName, category, notes } = params;

  const context = [
    typeLabel ? `Product type: ${typeLabel}` : "",
    productName ? `Name hint: ${productName}` : "",
    category ? `Category: ${category}` : "",
    notes.trim() ? `Notes: ${notes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a bilingual copywriter for Deko Kutak (dekokutak.ba), a Bosnian handmade gifts webshop. Customers are primarily from Bosnia & Herzegovina and the wider region.

${context}

Return ONLY a valid JSON object — no markdown, no code fences, no explanation before or after the JSON. Use exactly these four keys:

{
  "name_en": "Product title in English. 20–70 characters. Specific and descriptive — never generic. Example: 'Personalised Wooden Wedding Photo Album'.",
  "name_bs": "Naziv na bosanskom. 20–70 znakova. Konkretan i opisni.",
  "description_en": "<p>Engaging description in English. 100–300 characters of plain-text equivalent. Mention material, occasion and personalization possibilities if confirmed in the notes. Warm, personal tone. Allowed HTML only: <p>, <strong>, <em>, <ul>, <li>.</p>",
  "description_bs": "<p>Opis na bosanskom. Isti sadržaj kao engleski, prilagođen lokalnom govoru i pravopisu.</p>"
}

Rules:
- Output ONLY the JSON object. Any text outside it will break the import.
- Do not invent personalizations, engravings or features not mentioned in the notes.
- name_en and name_bs must be plain text with no HTML tags.
- description_en and description_bs must be valid HTML using only the allowed tags above.
- Both languages are required — do not omit any field.`;
}

// ── HTML sanitizer ───────────────────────────────────────────────────────────
// Strips all tags except an explicit allowlist and removes all attributes.
// Applied to description fields before preview and apply.

const ALLOWED_TAGS = new Set(["p", "strong", "em", "ul", "ol", "li", "br"]);

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g, (match, tag: string) => {
      const t = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(t)) return "";
      return match.startsWith("</") ? `</${t}>` : `<${t}>`;
    });
}

// ── JSON import parser ────────────────────────────────────────────────────────

type ParseResult =
  | { ok: true; data: AiContent; warnings: string[] }
  | { ok: false; error: string };

function parseClaudeResponse(raw: string): ParseResult {
  let s = raw.trim();

  // Strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Extract the outermost JSON object
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, error: "No JSON object found. Make sure Claude returned only the JSON block." };
  }
  s = s.slice(start, end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "Response is not a JSON object." };
  }

  const obj = parsed as Record<string, unknown>;
  const warnings: string[] = [];
  const data: AiContent = {};

  for (const key of ["name_en", "name_bs", "description_en", "description_bs"] as const) {
    const raw = obj[key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string") {
      warnings.push(`"${key}" is not a string — skipped.`);
      continue;
    }
    const val = raw.trim();
    if (!val) {
      warnings.push(`"${key}" is empty — skipped.`);
      continue;
    }
    data[key] = val;
  }

  // Name fields must be plain text — strip any stray HTML tags
  for (const nameKey of ["name_en", "name_bs"] as const) {
    if (data[nameKey] && /<[^>]+>/.test(data[nameKey]!)) {
      data[nameKey] = data[nameKey]!.replace(/<[^>]*>/g, "").trim();
      warnings.push(`HTML tags stripped from "${nameKey}".`);
    }
  }

  // Description fields: sanitize to allowed tags only, strip all attributes
  for (const descKey of ["description_en", "description_bs"] as const) {
    if (data[descKey]) {
      const sanitized = sanitizeHtml(data[descKey]!);
      if (sanitized !== data[descKey]) {
        data[descKey] = sanitized;
        warnings.push(`Unsafe markup removed from "${descKey}".`);
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return {
      ok: false,
      error: "No valid fields found. Ensure Claude returned name_en, name_bs, description_en and description_bs.",
    };
  }

  return { ok: true, data, warnings };
}

// ── UI helpers ────────────────────────────────────────────────────────────────

const cls =
  "px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full";

function CopyButton({ id, text, copied, onCopy }: {
  id: string;
  text: string;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  const done = copied === id;
  return (
    <button
      type="button"
      onClick={() => onCopy(id, text)}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex-shrink-0 ${
        done
          ? "bg-green-50 text-green-600 border border-green-200"
          : "bg-gray-100 text-gray-600 hover:bg-navy hover:text-white border border-transparent"
      }`}
    >
      {done ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Copy className="w-3.5 h-3.5" strokeWidth={2} />}
      {done ? "Copied!" : "Copy"}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AiStudio({ productName, category, hasExistingContent, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [refPhotos, setRefPhotos] = useState<{ name: string; dataUrl: string }[]>([]);
  const [productType, setProductType] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Import section
  const [showImport, setShowImport] = useState(false);
  const [importRaw, setImportRaw] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  const photoRef = useRef<HTMLInputElement>(null);

  const typeLabel =
    PRODUCT_TYPES.find((t) => t.value === productType && t.value !== "")?.label ?? "";

  const imagePrompts = useMemo(
    () => buildImagePrompts({ typeLabel, productName, category, notes, photoCount: refPhotos.length }),
    [typeLabel, productName, category, notes, refPhotos.length]
  );

  const textPrompt = useMemo(
    () => buildTextPrompt({ typeLabel, productName, category, notes }),
    [typeLabel, productName, category, notes]
  );

  // Auto-parse whenever import text changes; reset confirm step
  useEffect(() => {
    setConfirmStep(false);
    if (!importRaw.trim()) { setParseResult(null); return; }
    setParseResult(parseClaudeResponse(importRaw));
  }, [importRaw]);

  async function handleCopy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setCopyError(null);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    } catch {
      setCopyError("Copy failed — please select the text and copy it manually (Ctrl+A, Ctrl+C).");
      setTimeout(() => setCopyError(null), 5000);
    }
  }

  function handlePhotoFiles(files: FileList | null) {
    if (!files) return;
    const slots = 3 - refPhotos.length;
    Array.from(files)
      .slice(0, slots)
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setRefPhotos((prev) => [
            ...prev,
            { name: file.name, dataUrl: e.target?.result as string },
          ]);
        };
        reader.readAsDataURL(file);
      });
    if (photoRef.current) photoRef.current.value = "";
  }

  function handleApply() {
    if (!parseResult?.ok) return;
    // First click when existing content exists: enter confirm step
    if (hasExistingContent && !confirmStep) {
      setConfirmStep(true);
      return;
    }
    // Confirmed (or no existing content): apply and reset
    onApply(parseResult.data);
    setShowImport(false);
    setImportRaw("");
    setParseResult(null);
    setConfirmStep(false);
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* ── Toggle header ── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-gray-50/80 hover:bg-gray-100 transition-colors text-left"
      >
        <Sparkles className="w-4 h-4 text-copper flex-shrink-0" strokeWidth={1.75} />
        <span className="text-sm font-semibold text-navy">AI Product Studio</span>
        <span className="hidden sm:block ml-1 text-xs text-gray-400">
          — Generate prompts for Gemini &amp; Claude
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 ml-auto flex-shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
          strokeWidth={2}
        />
      </button>

      {open && (
        <div className="px-4 py-5 flex flex-col gap-6 border-t border-gray-100">

          {/* Clipboard error banner */}
          {copyError && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" strokeWidth={2} />
              {copyError}
            </div>
          )}

          {/* ── 1. Reference photos ── */}
          <section className="flex flex-col gap-2">
            <p className="text-sm font-medium text-navy">Reference Photos</p>
            <p className="text-xs text-gray-400">
              Upload 1–3 original product photos for visual context. These stay local — not saved or uploaded.
              Attach the same photos to your Gemini chat before pasting the image prompts.
            </p>

            <div className="flex flex-wrap gap-2 mt-1">
              {refPhotos.map((p, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                  <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setRefPhotos((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 p-0.5 bg-white/90 border border-gray-200 rounded-md text-gray-500 hover:text-red-500 transition-colors shadow-sm"
                  >
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                </div>
              ))}

              {refPhotos.length < 3 && (
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  className="w-20 h-20 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-navy/40 hover:text-navy transition-colors flex-shrink-0"
                >
                  <Plus className="w-5 h-5" strokeWidth={1.75} />
                  <span className="text-[10px]">Add photo</span>
                </button>
              )}
            </div>
            <input
              ref={photoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handlePhotoFiles(e.target.files)}
            />
          </section>

          {/* ── 2. Product context ── */}
          <section className="flex flex-col gap-3">
            <p className="text-sm font-medium text-navy">Product Context</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">Product type</label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className={cls}
                >
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">Notes (optional)</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. engraved with couple names, walnut wood"
                  className={cls}
                />
              </div>
            </div>
            {!productName && !typeLabel && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                Enter a product name above or select a product type to improve prompt quality.
              </p>
            )}
          </section>

          {/* ── 3. Image prompts ── */}
          <section className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-navy">Gemini Image Prompts</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Open Gemini Advanced → attach your reference photos → paste one prompt per image generation.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {imagePrompts.map((prompt, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">{IMAGE_PROMPT_LABELS[i]}</span>
                    <CopyButton
                      id={`img-${i}`}
                      text={prompt}
                      copied={copied}
                      onCopy={handleCopy}
                    />
                  </div>
                  <textarea
                    readOnly
                    value={prompt}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 bg-gray-50 resize-none focus:outline-none font-mono leading-relaxed"
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ── 4. Claude text prompt ── */}
          <section className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-navy">Claude Text Prompt</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Paste this into Claude. Copy the JSON response and use the Import section below.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Prompt for Claude</span>
                <CopyButton
                  id="text-prompt"
                  text={textPrompt}
                  copied={copied}
                  onCopy={handleCopy}
                />
              </div>
              <textarea
                readOnly
                value={textPrompt}
                rows={7}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 bg-gray-50 resize-none focus:outline-none font-mono leading-relaxed"
                onFocus={(e) => e.target.select()}
              />
            </div>
          </section>

          {/* ── 5. Import Claude response ── */}
          <section className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowImport((s) => !s)}
              className="flex items-center gap-2 text-sm font-medium text-navy hover:text-copper transition-colors w-fit"
            >
              <FileText className="w-4 h-4" strokeWidth={1.75} />
              Import Claude Response
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showImport ? "" : "-rotate-90"}`}
                strokeWidth={2}
              />
            </button>

            {showImport && (
              <div className="flex flex-col gap-3 p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500">
                    Paste Claude&apos;s JSON response here
                  </label>
                  <textarea
                    value={importRaw}
                    onChange={(e) => setImportRaw(e.target.value)}
                    rows={6}
                    placeholder={'{\n  "name_en": "...",\n  "name_bs": "...",\n  "description_en": "<p>...</p>",\n  "description_bs": "<p>...</p>"\n}'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-700 bg-white resize-y focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition font-mono leading-relaxed"
                  />
                </div>

                {/* Error */}
                {parseResult && parseResult.ok === false && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                    <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" strokeWidth={2} />
                    {parseResult.error}
                  </div>
                )}

                {/* Preview */}
                {parseResult?.ok && (
                  <div className="flex flex-col gap-3">
                    {/* Warnings */}
                    {parseResult.warnings.length > 0 && (
                      <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 space-y-0.5">
                        {parseResult.warnings.map((w, i) => (
                          <p key={i}>⚠ {w}</p>
                        ))}
                      </div>
                    )}

                    {/* Field preview */}
                    <div className="flex flex-col gap-2 border border-gray-200 rounded-lg bg-white divide-y divide-gray-100 overflow-hidden">
                      {(["name_en", "name_bs", "description_en", "description_bs"] as const).map((key) => {
                        const val = parseResult.data[key];
                        if (!val) return null;
                        const plain = val.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
                        return (
                          <div key={key} className="px-3 py-2">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{key}</p>
                            <p className="text-xs text-navy line-clamp-2">{plain}</p>
                          </div>
                        );
                      })}
                    </div>

                    {confirmStep ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                          This will overwrite the existing title and description. Are you sure?
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmStep(false)}
                            className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleApply}
                            className="flex-1 py-2 bg-copper text-white text-sm font-semibold rounded-lg hover:bg-copper/90 transition-colors"
                          >
                            Confirm Overwrite
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {hasExistingContent && (
                          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                            Existing title and description will be overwritten. Review the preview above before applying.
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={handleApply}
                          className="w-full py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors"
                        >
                          Apply to Form
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
