"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  hasActiveSession,
  persistSession,
  sanitizeNextPath,
  type TokenResponse,
} from "../../../lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type AuthMode = "login" | "register";

type FeedbackState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const sessionMessages: Record<string, string> = {
  "session-expired": "La sesión expiró. Ingresa de nuevo para continuar.",
};

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    return payload?.detail ?? `HTTP ${response.status}`;
  }

  return (await response.text().catch(() => "")) || `HTTP ${response.status}`;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = sanitizeNextPath(searchParams.get("next"));
  const sessionReason = searchParams.get("reason") ?? "";

  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ kind: "idle" });

  useEffect(() => {
    if (hasActiveSession()) {
      router.replace(nextPath);
    }
  }, [nextPath, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback({ kind: "idle" });

    const endpoint =
      mode === "login" ? `${API_BASE_URL}/auth/login/json` : `${API_BASE_URL}/auth/register`;
    const payload =
      mode === "login"
        ? { email: email.trim(), password }
        : { email: email.trim(), password, full_name: fullName.trim() || null };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const session = (await response.json()) as TokenResponse;
      persistSession(session);
      setFeedback({
        kind: "success",
        message:
          mode === "login"
            ? "Sesión iniciada correctamente. Redirigiendo..."
            : "Usuario creado y sesión iniciada. Redirigiendo...",
      });
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "No fue posible completar la autenticación.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_36%),linear-gradient(135deg,_#f8fafc,_#e2e8f0_52%,_#f8fafc)] px-6 py-10 text-slate-950">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-8 py-10 text-white shadow-2xl shadow-slate-950/15">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.28),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.2),_transparent_32%)]" />
          <div className="relative space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
                Plataforma de Supervisión de Campo
              </p>
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Acceso seguro para operaciones, evidencia y reportes asistidos por IA.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300">
                El token JWT queda compartido entre cliente y middleware para proteger
                rutas sensibles, adjuntar el bearer automáticamente y cortar sesiones expiradas.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <article className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  Seguridad
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  Middleware para proteger `projects`, `visits` y `reports`.
                </p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                  Evidencia
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  MinIO firmado para fotos, PDFs y audios usados por Gemini.
                </p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
                  Reportes
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  Exportación HTML/PDF con descarga segura por Blob.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="flex items-center">
          <div className="w-full rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl shadow-slate-200/60 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
                  Acceso
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-950">
                  {mode === "login" ? "Iniciar sesión" : "Crear usuario de acceso"}
                </h2>
              </div>
              <div className="rounded-full bg-slate-100 p-1 text-sm font-medium text-slate-700">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`rounded-full px-4 py-2 transition ${
                    mode === "login" ? "bg-slate-950 text-white" : "text-slate-600"
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className={`rounded-full px-4 py-2 transition ${
                    mode === "register" ? "bg-slate-950 text-white" : "text-slate-600"
                  }`}
                >
                  Registro
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {sessionMessages[sessionReason] ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {sessionMessages[sessionReason]}
                </div>
              ) : null}

              {mode === "register" ? (
                <div className="space-y-2">
                  <label htmlFor="full-name" className="text-sm font-medium text-slate-800">
                    Nombre completo
                  </label>
                  <input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Ej. Laura Pérez"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-800">
                  Correo
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tecnico@campo.com"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-800">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                />
              </div>

              <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
                <p>
                  Tras autenticarte serás redirigido a <span className="font-semibold text-slate-900">{nextPath}</span>.
                </p>
                <Link href="/" className="font-medium text-cyan-700 transition hover:text-cyan-900">
                  Volver al inicio
                </Link>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? "Procesando..."
                  : mode === "login"
                    ? "Entrar a la plataforma"
                    : "Crear usuario e ingresar"}
              </button>

              {feedback.kind === "success" ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {feedback.message}
                </div>
              ) : null}
              {feedback.kind === "error" ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {feedback.message}
                </div>
              ) : null}
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}