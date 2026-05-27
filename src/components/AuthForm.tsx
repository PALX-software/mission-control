import { FormEvent, useState } from "react";
import { useAuth } from "../hooks/useAuth";

type Props = {
  onError: (msg: string) => void;
};

export function AuthForm({ onError }: Props) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const fn = mode === "login" ? signIn : signUp;
    const { error } = await fn(email, password);
    setLoading(false);
    if (error) onError(error.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-panel p-8">
        <h1 className="mb-6 text-center text-xl font-bold">Mission Control</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-accent px-3 py-2 font-semibold text-black disabled:opacity-50"
          >
            {loading ? "Cargando…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-400">
          {mode === "login" ? "¿Sin cuenta?" : "¿Ya tienes cuenta?"}{" "}
          <button
            type="button"
            className="text-accent underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Crear cuenta" : "Iniciar sesión"}
          </button>
        </p>
      </div>
    </div>
  );
}
