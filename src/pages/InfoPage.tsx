import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Navbar, Footer } from "../components/Layout";
import { CartDrawer } from "../components/CartDrawer";
import { AuthModal } from "../components/AuthModal";
import { RichDescription } from "../components/RichDescription";
import { SiteMeta } from "../components/SiteMeta";
import { useLang } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";

type PageData = {
  title_en: string | null;
  title_bs: string | null;
  content_en: string | null;
  content_bs: string | null;
};

type Props = { slug?: string };

export default function InfoPage({ slug: slugProp }: Props) {
  const { slug: slugParam } = useParams<{ slug: string }>();
  const slug = slugProp ?? slugParam ?? "";
  const { lang } = useLang();
  const [page, setPage] = useState<PageData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); return; }
    setPage(null);
    setNotFound(false);
    supabase
      .from("pages")
      .select("title_en, title_bs, content_en, content_bs")
      .eq("slug", slug)
      .eq("is_published", true)
      .single()
      .then(({ data }) => {
        if (data) setPage(data);
        else setNotFound(true);
      });
  }, [slug]);

  const title = page
    ? (lang === "bs" ? (page.title_bs || page.title_en) : (page.title_en || page.title_bs))
    : null;
  const content = page
    ? (lang === "bs" ? (page.content_bs || page.content_en) : (page.content_en || page.content_bs))
    : null;

  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col overflow-x-hidden">
      {title && <SiteMeta title={title} />}
      <Navbar />
      <CartDrawer />
      <AuthModal />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16">
        {notFound ? (
          <div className="text-center py-24">
            <p className="text-2xl font-semibold text-navy/60 mb-4">
              {lang === "bs" ? "Stranica nije pronađena" : "Page not found"}
            </p>
            <a href="/" className="text-sm text-copper hover:underline">
              {lang === "bs" ? "Nazad na početnu" : "Back to home"}
            </a>
          </div>
        ) : page === null ? (
          <div className="py-24 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-navy/20 border-t-navy animate-spin" />
          </div>
        ) : (
          <>
            {title && <h1 className="text-3xl font-semibold text-navy mb-8">{title}</h1>}
            {content ? (
              <RichDescription html={content} className="prose prose-navy max-w-none" />
            ) : (
              <p className="text-navy/40 italic">
                {lang === "bs" ? "Sadržaj uskoro…" : "Content coming soon…"}
              </p>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
