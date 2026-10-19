import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useParams, Navigate, Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, X as XIcon, ImageIcon, ExternalLink, Play } from "lucide-react";
import { Navbar, Footer } from "../components/Layout";
import { CartDrawer } from "../components/CartDrawer";
import { AuthModal } from "../components/AuthModal";
import { SiteMeta } from "../components/SiteMeta";
import { supabase } from "../lib/supabase";
import type { GalleryItem, GalleryImage, GalleryVideo } from "../lib/supabase";
import { useLang } from "../context/LanguageContext";
import { t } from "../i18n/translations";

type GalleryItemFull = GalleryItem & {
  gallery_categories: { name_en: string; name_bs: string } | null;
  products: { id: number; name: string; name_en: string | null } | null;
};

// Lightbox accepts plain url+caption entries (photos only).
type LightboxEntry = { url: string; caption: string };

// Discriminated union — image items open the photo lightbox; video items play inline.
type MediaItem =
  | { kind: "image"; url: string; caption: string }
  | { kind: "video"; url: string; poster: string | null; caption: string };

function localTitle(item: GalleryItem, lang: string) {
  return lang === "bs" ? (item.title_bs || item.title_en) : (item.title_en || item.title_bs);
}

function localDesc(item: GalleryItem, lang: string) {
  return lang === "bs"
    ? (item.description_bs || item.description_en || "")
    : (item.description_en || item.description_bs || "");
}

function GalleryLightboxModal({
  images,
  startIndex,
  onClose,
}: {
  images: LightboxEntry[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [dir, setDir] = useState<"left" | "right">("left");
  const touchStartX = useRef(0);

  function go(next: number, d: "left" | "right") { setDir(d); setIdx(next); }
  function prev() { if (idx > 0) go(idx - 1, "right"); }
  function next() { if (idx < images.length - 1) go(idx + 1, "left"); }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const caption = images[idx]?.caption;

  return (
    <motion.div
      className="fixed inset-0 z-[70] bg-black/95 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
        <span className="text-white/40 text-sm">{idx + 1} / {images.length}</span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
        >
          <XIcon className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      <div
        className="flex-1 relative overflow-hidden"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const diff = touchStartX.current - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
        }}
      >
        <AnimatePresence initial={false} custom={dir}>
          <motion.img
            key={idx}
            src={images[idx].url}
            alt={caption || ""}
            custom={dir}
            variants={{
              enter: (d: string) => ({ x: d === "left" ? "100%" : "-100%", opacity: 0.6 }),
              center: { x: 0, opacity: 1 },
              exit:  (d: string) => ({ x: d === "left" ? "-100%" : "100%", opacity: 0.6 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.8 }}
            className="absolute inset-0 w-full h-full object-contain"
          />
        </AnimatePresence>

        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              disabled={idx === 0}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors disabled:opacity-20 focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.75} />
            </button>
            <button
              onClick={next}
              disabled={idx === images.length - 1}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors disabled:opacity-20 focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>

      {caption && (
        <div className="flex-shrink-0 px-6 py-3 text-center text-sm text-white/70">
          {caption}
        </div>
      )}

      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 py-4 flex-shrink-0">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i, i > idx ? "left" : "right")}
              aria-label={`Go to image ${i + 1}`}
              className={`rounded-full transition-all duration-200 focus:outline-none ${
                i === idx ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/30 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function GalleryDetail() {
  const { id } = useParams<{ id: string }>();
  const { lang } = useLang();
  const tx = t[lang];

  const [item, setItem] = useState<GalleryItemFull | null | undefined>(undefined);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [videos, setVideos] = useState<GalleryVideo[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
    setImages([]);
    setVideos([]);
    if (!id) { setItem(null); return; }
    supabase
      .from("gallery_items")
      .select("*, gallery_categories(name_en, name_bs), products(id, name, name_en)")
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle()
      .then(({ data }) => setItem((data as GalleryItemFull) ?? null));

    supabase
      .from("gallery_images")
      .select("*")
      .eq("gallery_item_id", id)
      .order("display_order")
      .then(({ data }) => setImages((data as GalleryImage[]) ?? []));

    supabase
      .from("gallery_videos")
      .select("*")
      .eq("gallery_item_id", id)
      .order("display_order")
      .then(({ data }) => setVideos((data as GalleryVideo[]) ?? []));
  }, [id]);

  if (item === undefined) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
      </div>
    );
  }

  if (item === null) {
    return <Navigate to="/gallery" replace />;
  }

  const title = localTitle(item, lang);
  const desc = localDesc(item, lang);

  const catName = item.gallery_categories
    ? lang === "bs"
      ? (item.gallery_categories.name_bs || item.gallery_categories.name_en)
      : (item.gallery_categories.name_en || item.gallery_categories.name_bs)
    : null;

  const productName = item.products
    ? (item.products.name_en || item.products.name)
    : null;

  // cover → photos (display_order asc) → videos (display_order asc)
  const mediaItems: MediaItem[] = [
    ...(item.cover_image_url
      ? [{ kind: "image" as const, url: item.cover_image_url, caption: title }]
      : []),
    ...images.map((img) => ({
      kind: "image" as const,
      url: img.image_url,
      caption: lang === "bs"
        ? (img.caption_bs || img.caption_en || "")
        : (img.caption_en || img.caption_bs || ""),
    })),
    ...videos.map((vid) => ({
      kind: "video" as const,
      url: vid.video_url,
      poster: vid.poster_url ?? null,
      caption: lang === "bs"
        ? (vid.caption_bs || vid.caption_en || "")
        : (vid.caption_en || vid.caption_bs || ""),
    })),
  ];

  // Lightbox operates on photos only — compute a photo-only subset and map indices.
  const lightboxImages: LightboxEntry[] = mediaItems
    .filter((m): m is { kind: "image"; url: string; caption: string } => m.kind === "image")
    .map(({ url, caption }) => ({ url, caption }));

  const currentMedia = mediaItems[selectedIndex] ?? mediaItems[0] ?? null;

  function openLightbox(mediaIndex: number) {
    if (mediaItems[mediaIndex]?.kind !== "image") return;
    let lbIdx = 0;
    for (let i = 0; i < mediaIndex; i++) {
      if (mediaItems[i].kind === "image") lbIdx++;
    }
    setLightboxIndex(lbIdx);
    setLightboxOpen(true);
  }

  const mailtoSubject = encodeURIComponent(`Galerija: ${item.title_en} / ${item.title_bs}`);

  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col overflow-x-hidden">
      <SiteMeta
        title={`${title} — Deko Kutak`}
        description={desc || (lang === "bs" ? "Ručno rađeni predmet iz galerije Deko Kutak." : "Handmade item from the Deko Kutak gallery.")}
      />
      <Navbar />
      <CartDrawer />
      <AuthModal />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">

          {/* Back link */}
          <Link
            to="/gallery"
            className="inline-flex items-center gap-2 text-sm text-navy/50 hover:text-navy transition-colors focus:outline-none focus:underline"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            {tx.gallery_back}
          </Link>

          {/* Two-column portfolio layout */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14 items-start">

            {/* LEFT: media viewer — 3/5 on desktop, full width on mobile */}
            <div className="lg:col-span-3 flex flex-col gap-3">

              {/* Main viewer — photo opens lightbox, video plays inline */}
              {currentMedia ? (
                currentMedia.kind === "video" ? (
                  <div className="w-full bg-[#f2f1ef] rounded-2xl overflow-hidden flex items-center justify-center">
                    <video
                      key={currentMedia.url}
                      controls
                      preload="none"
                      playsInline
                      poster={currentMedia.poster ?? undefined}
                      className="w-full min-h-[240px] max-h-[560px] object-contain"
                    >
                      <source
                        src={currentMedia.url}
                        type={currentMedia.url.endsWith(".webm") ? "video/webm" : "video/mp4"}
                      />
                    </video>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openLightbox(selectedIndex)}
                    aria-label={lang === "bs" ? "Otvori u punom prikazu" : "Open full view"}
                    className="w-full bg-[#f2f1ef] rounded-2xl overflow-hidden flex items-center justify-center cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-copper/40"
                  >
                    <img
                      src={currentMedia.url}
                      alt={currentMedia.caption || title}
                      loading={selectedIndex === 0 ? "eager" : "lazy"}
                      className="w-full min-h-[240px] max-h-[560px] object-contain"
                    />
                  </button>
                )
              ) : (
                <div
                  className="w-full bg-[#f2f1ef] rounded-2xl flex items-center justify-center"
                  style={{ minHeight: 320 }}
                >
                  <ImageIcon className="w-12 h-12 text-navy/10" strokeWidth={0.75} />
                </div>
              )}

              {/* Caption — shown for additional images only, not the cover (title already in right column) */}
              {currentMedia?.caption && currentMedia.caption !== title && (
                <p className="text-sm text-navy/50 text-center px-2 leading-relaxed">
                  {currentMedia.caption}
                </p>
              )}

              {/* Thumbnail strip */}
              {mediaItems.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {mediaItems.map((media, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedIndex(i)}
                      aria-label={
                        media.caption ||
                        (media.kind === "video"
                          ? `Video ${i + 1}`
                          : `${lang === "bs" ? "Fotografija" : "Image"} ${i + 1}`)
                      }
                      aria-pressed={i === selectedIndex}
                      className={`flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-gray-100 transition-all focus:outline-none ${
                        i === selectedIndex
                          ? "ring-2 ring-copper ring-offset-2 ring-offset-cream"
                          : "ring-1 ring-transparent opacity-50 hover:opacity-100 hover:ring-navy/20"
                      }`}
                    >
                      {media.kind === "video" ? (
                        <div className="w-full h-full relative bg-navy/10 flex items-center justify-center">
                          {media.poster && (
                            <img
                              src={media.poster}
                              alt=""
                              loading="lazy"
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          )}
                          <div className="relative z-10 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                            <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" strokeWidth={0} />
                          </div>
                        </div>
                      ) : (
                        <img
                          src={media.url}
                          alt={media.caption || ""}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: title, description, CTA — 2/5 on desktop, full width on mobile */}
            <div className="lg:col-span-2 flex flex-col gap-5">

              {catName && (
                <span className="inline-flex items-center self-start px-3 py-1 rounded-full bg-copper/10 text-copper text-xs font-semibold uppercase tracking-widest">
                  {catName}
                </span>
              )}

              <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">{title}</h1>

              {desc && (
                <p className="text-navy/70 leading-relaxed whitespace-pre-line">{desc}</p>
              )}

              <hr className="border-gray-100" />

              {/* "I'd like something similar" CTA */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
                <div>
                  <h2 className="font-semibold text-navy mb-1">{tx.gallery_similar_cta_heading}</h2>
                  <p className="text-sm text-navy/60 leading-relaxed">{tx.gallery_similar_cta_sub}</p>
                </div>
                <a
                  href={`mailto:info@dekokutak.ba?subject=${mailtoSubject}`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-copper text-white font-semibold rounded-lg hover:bg-copper/90 transition-colors focus:outline-none focus:ring-2 focus:ring-copper/50 text-sm"
                >
                  {tx.gallery_similar_btn}
                </a>
              </div>

              {/* Related product */}
              {item.products && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-3">
                  <p className="text-xs text-navy/40 uppercase tracking-widest font-semibold">
                    {tx.gallery_related_label}
                  </p>
                  <p className="text-sm font-medium text-navy">{productName}</p>
                  <Link
                    to={`/products/${item.products.id}`}
                    className="inline-flex items-center gap-1.5 text-sm text-copper font-semibold hover:underline focus:outline-none focus:underline"
                  >
                    {tx.gallery_related_product}
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />

      <AnimatePresence>
        {lightboxOpen && (
          <GalleryLightboxModal
            images={lightboxImages}
            startIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
