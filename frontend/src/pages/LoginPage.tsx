import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(username.trim(), password);
      navigate("/", { replace: true });
    } catch {
      setError("Login yoki parol noto'g'ri");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand to-brand-dark p-5">
      <div className="w-full max-w-sm rounded-2xl bg-white p-9 shadow-2xl">
        <h1 className="mb-1 text-center text-xl font-extrabold text-slate-800">
          Tizimga kirish
        </h1>
        <p className="mb-6 text-center text-sm text-slate-400">
          Davom etish uchun login va parolni kiriting
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-600">
              Login
            </label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Login"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-600">
              Parol
            </label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Parol"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-600">
              {error}
            </div>
          )}
          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? "Kirish..." : "Kirish"}
          </button>
        </form>
      </div>
    </div>
  );
}
