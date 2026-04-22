"use client";

import { useState, type FormEvent } from "react";

import { apiPost } from "../../../lib/api-client";

type Tone = "formal" | "sencillo" | "tecnico";

type FeedbackState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const toneOptions: ReadonlyArray<{ value: Tone; label: string }> = [
  { value: "formal", label: "Formal" },
  { value: "sencillo", label: "Sencillo" },
  { value: "tecnico", label: "Técnico" },
];

export default function NewTemplatePage() {
  const [name, setName] = useState("");
  const [tone, setTone] = useState<Tone>("tecnico");
  const [instructions, setInstructions] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ kind: "idle" });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback({ kind: "idle" });

    try {
      const created = await apiPost<{ id: string; name: string }>(
        "/templates",
        {
          name: name.trim(),
          tone,
          instructions: instructions.trim() || null,
          sections: [],
          is_active: true,
        },
      );
      setFeedback({
        kind: "success",
        message: `Plantilla "${created.name}" creada correctamente (ID: ${created.id}).`,
      });
      setName("");
      setInstructions("");
      setTone("tecnico");
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "No fue posible crear la plantilla.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">
          Plantillas
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">
          Crear nueva plantilla de informe
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Define el tono y las instrucciones base que la IA seguirá al generar
          el borrador del informe.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div className="space-y-2">
          <label htmlFor="template-name" className="text-sm font-medium text-slate-800">
            Nombre
          </label>
          <input
            id="template-name"
            type="text"
            required
            minLength={3}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Informe semanal de obra"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="template-tone" className="text-sm font-medium text-slate-800">
            Tono
          </label>
          <select
            id="template-tone"
            value={tone}
            onChange={(event) => setTone(event.target.value as Tone)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
          >
            {toneOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="template-instructions"
            className="text-sm font-medium text-slate-800"
          >
            Instrucciones (System Prompt)
          </label>
          <textarea
            id="template-instructions"
            rows={8}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Describe cómo debe comportarse la IA: estructura, formato, secciones obligatorias..."
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Los cambios se guardarán en el backend mediante <code>POST /templates</code>.
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Guardando..." : "Crear plantilla"}
          </button>
        </div>

        {feedback.kind === "success" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {feedback.message}
          </div>
        ) : null}
        {feedback.kind === "error" ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {feedback.message}
          </div>
        ) : null}
      </form>
    </div>
  );
}
