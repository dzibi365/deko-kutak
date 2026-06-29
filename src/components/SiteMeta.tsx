import { Helmet } from "react-helmet-async";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { useLang } from "../context/LanguageContext";

type Props = {
  /** Override page title. Rendered as "Override | Store Name" */
  title?: string;
  /** Override meta description for this specific page */
  description?: string;
};

export function SiteMeta({ title, description }: Props) {
  const { store_name, seo_title, seo_description_en, seo_description_bs, og_image, logo_url } = useSiteSettings();
  const { lang } = useLang();

  const siteName = seo_title || store_name;
  const pageTitle = title ? `${title} | ${siteName}` : siteName;
  const seoDesc = description
    ?? (lang === "bs" ? seo_description_bs || seo_description_en : seo_description_en || seo_description_bs)
    ?? "";
  const ogImg = og_image || logo_url || "";

  return (
    <Helmet>
      <title>{pageTitle}</title>
      {seoDesc && <meta name="description" content={seoDesc} />}

      {/* Open Graph */}
      <meta property="og:title" content={pageTitle} />
      {seoDesc && <meta property="og:description" content={seoDesc} />}
      <meta property="og:type" content="website" />
      {ogImg && <meta property="og:image" content={ogImg} />}

      {/* Twitter card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      {seoDesc && <meta name="twitter:description" content={seoDesc} />}
      {ogImg && <meta name="twitter:image" content={ogImg} />}
    </Helmet>
  );
}
