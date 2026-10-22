import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { useLang } from "../context/LanguageContext";

type Props = {
  /** Override page title. Rendered as "Override | Store Name" */
  title?: string;
  /** Override meta description for this specific page */
  description?: string;
  /**
   * Explicit canonical URL. When omitted, derived from the current pathname
   * (strips query params and hash) prefixed with the production origin.
   */
  canonicalUrl?: string;
  /** Schema.org JSON-LD object — safely serialized and injected as a script tag. */
  jsonLd?: Record<string, unknown>;
  /** og:type value. Defaults to "website". Pass "product" on product pages. */
  ogType?: string;
};

const PROD_BASE = "https://dekokutak.ba";

// Resolved at Vite build time. VITE_ALLOW_INDEXING=true is set only on the
// production Vercel project; staging (and local dev) defaults to noindex.
const ROBOTS = import.meta.env.VITE_ALLOW_INDEXING === "true"
  ? "index,follow"
  : "noindex,nofollow";

export function SiteMeta({ title, description, canonicalUrl, jsonLd, ogType = "website" }: Props) {
  const { store_name, seo_title, seo_description_en, seo_description_bs, og_image, logo_url } = useSiteSettings();
  const { lang } = useLang();
  const { pathname } = useLocation();

  const siteName = seo_title || store_name;
  const pageTitle = title ? `${title} | ${siteName}` : siteName;
  const seoDesc = description
    ?? (lang === "bs" ? seo_description_bs || seo_description_en : seo_description_en || seo_description_bs)
    ?? "";
  const ogImg = og_image || logo_url || "";

  // Canonical always points to the production origin so staging/preview
  // deployments don't fragment link equity. Noindex on staging prevents
  // those pages from being indexed regardless of the canonical value.
  const canonical = canonicalUrl ?? `${PROD_BASE}${pathname}`;

  // `</` inside a JSON-LD script would close the script tag in the HTML
  // parser before the JSON ends. Replace with the JSON-legal escape `<\/`.
  const jsonLdStr = jsonLd
    ? JSON.stringify(jsonLd).replace(/<\//g, "<\\/")
    : null;

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="robots" content={ROBOTS} />
      <link rel="canonical" href={canonical} />
      {seoDesc && <meta name="description" content={seoDesc} />}

      {/* Open Graph */}
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={ogType} />
      <meta property="og:locale" content={lang === "bs" ? "bs_BA" : "en_US"} />
      <meta property="og:title" content={pageTitle} />
      {seoDesc && <meta property="og:description" content={seoDesc} />}
      {ogImg && <meta property="og:image" content={ogImg} />}

      {/* Twitter card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      {seoDesc && <meta name="twitter:description" content={seoDesc} />}
      {ogImg && <meta name="twitter:image" content={ogImg} />}

      {/* Schema.org JSON-LD (product pages etc.) */}
      {jsonLdStr && (
        <script type="application/ld+json">{jsonLdStr}</script>
      )}
    </Helmet>
  );
}
