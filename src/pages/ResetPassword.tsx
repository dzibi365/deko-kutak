import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useLang } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";

export default function ResetPassword() {
  const { tr } = useLang();
  const { store_name, logo_url } = useSiteSettings();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Supabase sends the recovery token in the URL hash; onAuthStateChange
  // picks it up automatically and fires PASSWORD_RECOVERY.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError(tr("auth_reset_mismatch")); return; }
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); }
    else { setSuccess(true); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 font-sans text-navy">
      <a href="/" className="mb-10">
        {logo_url ? (
          <img src={logo_url} alt={store_name} className="h-16 w-auto object-contain" />
        ) : (
          <span className="text-2xl font-semibold tracking-tight">{store_name}.</span>
        )}
      </a>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm w-full max-w-sm p-8 flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-navy">{tr("auth_reset_title")}</h1>

        {success ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-green-700 px-3 py-2.5 bg-green-50 rounded-lg">{tr("auth_reset_success")}</p>
            <button onClick={() => navigate("/")}
              className="w-full py-2.5 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors text-sm">
              {tr("auth_signin")}
            </button>
          </div>
        ) : !ready ? (
          <p className="text-sm text-navy/40 text-center py-4">
            {tr("auth_reset_title")}…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {error && <p className="text-sm text-red-500 px-3 py-2.5 bg-red-50 rounded-lg">{error}</p>}
            <input
              required type="password" minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={tr("auth_reset_new")}
              className={inputCls}
            />
            <input
              required type="password" minLength={6}
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder={tr("auth_reset_confirm")}
              className={inputCls}
            />
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-60 mt-1 text-sm">
              {loading ? "…" : tr("auth_reset_btn")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inputCls = "px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full";
