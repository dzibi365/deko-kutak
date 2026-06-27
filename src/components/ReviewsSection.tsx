import { useEffect, useState, type FormEvent } from "react";
import { Star, LogOut } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useLang } from "../context/LanguageContext";

type Review = {
  id: number;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export function ReviewsSection({ productId }: { productId: number }) {
  const { user, openModal, signOut } = useCustomerAuth();
  const { tr } = useLang();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const myReview = user ? reviews.find((r) => r.user_id === user.id) : null;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  async function fetchReviews() {
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    setReviews(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchReviews(); }, [productId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (rating === 0) { setFormError(tr("reviews_rating_required")); return; }
    setSubmitting(true);
    setFormError(null);

    const userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Customer";
    const { error } = await supabase.from("reviews").insert({
      product_id: productId,
      user_id: user.id,
      user_name: userName,
      rating,
      comment: comment.trim() || null,
    });

    if (error) { setFormError(error.message); }
    else { setRating(0); setComment(""); await fetchReviews(); }
    setSubmitting(false);
  }

  async function handleDelete() {
    if (!myReview) return;
    await supabase.from("reviews").delete().eq("id", myReview.id);
    await fetchReviews();
  }

  return (
    <div className="mt-16 border-t border-navy/10 pt-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold text-navy">{tr("reviews_title")}</h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2">
              <Stars value={avg} />
              <span className="text-sm text-navy/60">
                {avg.toFixed(1)} · {reviews.length} {reviews.length === 1 ? tr("reviews_avg_single") : tr("reviews_avg_plural")}
              </span>
            </div>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {user.user_metadata?.full_name || user.email}
            </span>
            <button onClick={signOut}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-navy transition-colors">
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
              {tr("reviews_signout")}
            </button>
          </div>
        )}
      </div>

      {/* Review form or login prompt */}
      {!user ? (
        <div className="bg-cream/60 border border-navy/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <p className="font-semibold text-navy mb-0.5">{tr("reviews_signin_prompt")}</p>
            <p className="text-sm text-navy/50">{tr("reviews_signin_sub")}</p>
          </div>
          <button onClick={openModal}
            className="flex-shrink-0 px-5 py-2.5 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy/90 transition-colors">
            {tr("reviews_signin_btn")}
          </button>
        </div>
      ) : myReview ? (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-5 flex items-start justify-between gap-4 mb-8">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-green-700">{tr("reviews_already_reviewed")}</p>
            <Stars value={myReview.rating} />
            {myReview.comment && <p className="text-sm text-gray-600 mt-1">"{myReview.comment}"</p>}
          </div>
          <button onClick={handleDelete}
            className="text-xs text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
            {tr("reviews_delete")}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col gap-4 mb-8 shadow-sm">
          <p className="font-semibold text-navy text-sm">{tr("reviews_write")}</p>

          {formError && <p className="text-xs text-red-500 px-3 py-2 bg-red-50 rounded-lg">{formError}</p>}

          {/* Star picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500">{tr("reviews_your_rating")}</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button"
                  onClick={() => setRating(s)}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  className="p-0.5 transition-transform hover:scale-110">
                  <Star
                    className={`w-7 h-7 transition-colors ${s <= (hovered || rating) ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200"}`}
                    strokeWidth={1}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <textarea
              value={comment} onChange={(e) => setComment(e.target.value)}
              rows={3} placeholder={tr("reviews_comment_placeholder")}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition resize-none w-full"
            />
          </div>

          <button type="submit" disabled={submitting}
            className="self-end px-5 py-2.5 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-60">
            {submitting ? tr("reviews_submitting") : tr("reviews_submit")}
          </button>
        </form>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse flex gap-4">
              <div className="w-10 h-10 rounded-full bg-cream/80 flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-4 w-32 bg-cream/80 rounded" />
                <div className="h-3 w-full bg-cream/80 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-navy/40 text-center py-8">{tr("reviews_no_reviews")}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {reviews.map((r) => (
            <div key={r.id} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-navy/10 flex-shrink-0 flex items-center justify-center font-semibold text-navy/60 text-sm">
                {r.user_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-navy">{r.user_name}</span>
                  <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                </div>
                <Stars value={r.rating} />
                {r.comment && <p className="text-sm text-navy/70 leading-relaxed mt-1">{r.comment}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-4 h-4 ${s <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200"}`}
          strokeWidth={1}
        />
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
