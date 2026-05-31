import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Store, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/i18n/useT";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const t = useT();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(username.trim(), password);
      const user = useAuthStore.getState().user;
      navigate(user?.role === "super_admin" ? "/super" : "/", { replace: true });
    } catch {
      setError(t("login.error"));
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-dark p-5">
      {/* Atmosfera — animatsion gradient orblar */}
      <div className="pointer-events-none absolute inset-0 bg-dark-mesh" />
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand/30 blur-[120px] animate-float" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-[#00a3ff]/20 blur-[140px] animate-float" style={{ animationDelay: "2s" }} />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)", backgroundSize: "44px 44px" }}
      />

      {/* Til tanlash — yuqori o'ngda */}
      <div className="absolute right-5 top-5 z-10">
        <LanguageSwitcher dark />
      </div>

      {/* Kartochka */}
      <div className="relative w-full max-w-sm animate-scale-in">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-grad shadow-glow">
            <Store className="text-white" size={30} strokeWidth={2.2} />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-white">
            {t("login.title")}
          </h1>
          <p className="mt-1 text-sm text-white/55">{t("login.subtitle")}</p>
        </div>

        <div className="card-glass rounded-3xl border-white/15 bg-white/10 p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-white/70">{t("login.username")}</label>
              <input
                className="input border-white/15 bg-white/10 text-white placeholder:text-white/40 focus:bg-white/15 focus:ring-white/20"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("login.username")}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-white/70">{t("login.password")}</label>
              <input
                className="input border-white/15 bg-white/10 text-white placeholder:text-white/40 focus:bg-white/15 focus:ring-white/20"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("login.password")}
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <div className="animate-fade-in rounded-xl bg-status-unpaid/15 px-3 py-2.5 text-center text-sm font-semibold text-red-200 ring-1 ring-status-unpaid/30">
                {error}
              </div>
            )}
            <button
              type="submit"
              className="btn group w-full bg-white py-3 text-brand-dark hover:bg-white"
              disabled={loading}
            >
              {loading ? t("login.loading") : (
                <>
                  {t("login.submit")}
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-white/40">
          <ShieldCheck size={13} /> {t("login.secure")}
        </div>
      </div>
    </div>
  );
}
