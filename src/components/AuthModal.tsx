import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useLang } from "../context/LanguageContext";

type Tab = "signin" | "signup";

export function AuthModal() {
  const { modalOpen, closeModal, signIn, signUp } = useCustomerAuth();
  const { tr } = useLang();
  const [tab, setTab] = useState<Tab>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!modalOpen) return null;

  function reset() {
    setName(""); setEmail(""); setPassword("");
    setError(null); setSuccess(null);
  }

  function switchTab(t: Tab) { setTab(t); reset(); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (tab === "signin") {
      const err = await signIn(email, password);
      if (err) { setError(err); }
      else { closeModal(); reset(); }
    } else {
      if (!name.trim()) { setError(tr("auth_name_required")); setLoading(false); return; }
      const err = await signUp(email, password, name.trim());
      if (err) { setError(err); }
      else { setSuccess(tr("auth_confirm_msg")); }
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-5">

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy">
            {tab === "signin" ? tr("auth_signin") : tr("auth_signup")}
          </h2>
          <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-navy rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {(["signin", "signup"] as Tab[]).map((t) => (
            <button key={t} type="button" onClick={() => switchTab(t)}
              className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab === t ? "bg-white text-navy shadow-sm" : "text-gray-500 hover:text-navy"}`}>
              {t === "signin" ? tr("auth_signin") : tr("auth_signup")}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-500 px-3 py-2.5 bg-red-50 rounded-lg">{error}</p>}
        {success && <p className="text-sm text-green-700 px-3 py-2.5 bg-green-50 rounded-lg">{success}</p>}

        {!success && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {tab === "signup" && (
              <input
                required value={name} onChange={(e) => setName(e.target.value)}
                placeholder={tr("auth_name_placeholder")}
                className={inputCls}
              />
            )}
            <input
              required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={tr("auth_email_placeholder")}
              className={inputCls}
            />
            <input
              required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={tr("auth_password_placeholder")}
              minLength={6}
              className={inputCls}
            />
            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-60 mt-1"
            >
              {loading ? "…" : tab === "signin" ? tr("auth_signin_btn") : tr("auth_signup_btn")}
            </button>
          </form>
        )}

        <p className="text-xs text-center text-gray-400">
          {tab === "signin" ? tr("auth_no_account") : tr("auth_has_account")}
          <button type="button" onClick={() => switchTab(tab === "signin" ? "signup" : "signin")}
            className="text-navy font-semibold hover:underline">
            {tab === "signin" ? tr("auth_switch_signup") : tr("auth_switch_signin")}
          </button>
        </p>
      </div>
    </div>
  );
}

const inputCls = "px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full";
