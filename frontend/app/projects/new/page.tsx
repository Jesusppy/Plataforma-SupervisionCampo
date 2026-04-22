"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { apiPost } from "../../../lib/api-client";
import { Spinner } from "../../../components/spinner";

type ProjectResponse = {
  id: string;
  name: string;
};

type FeedbackState =
  | { kind: "idle" }
  | { kind: "success"; message: string; projectId: string }
  | { kind: "error"; message: string };

export default function NewProjectPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ kind: "idle" });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback({ kind: "idle" });

    try {
      const project = await apiPost<ProjectResponse>("/projects", {
        name: name.trim(),
        description: description.trim() || null,
      });
      setFeedback({
        kind: "success",
        message: `Proyecto \"${project.name}\" creado correctamente.`,
        projectId: project.id,
      });
      setName("");
      setDescription("");
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "No fue posible crear el proyecto.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">
          Proyectos
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">
          Crear proyecto operativo
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Registra el frente de trabajo que agrupará visitas, evidencia y reportes.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8"
      >
        <div className="space-y-2">
          <label htmlFor="project-name" className="text-sm font-medium text-slate-800">
            Nombre del proyecto
          </label>
          <input
            id="project-name"
            type="text"
            required
            minLength={3}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Supervisión vial tramo norte"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="project-description"
            className="text-sm font-medium text-slate-800"
          >
            Descripción
          </label>
          <textarea
            id="project-description"
            rows={6}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Contexto, alcance, cliente o notas de operación iniciales."
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/projects"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Volver a proyectos
            </Link>
          </div>
          <button
            type="submit"
            aria-busy={isSubmitting}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Spinner className="h-4 w-4" />
                Creando...
              </>
            ) : (
              "Crear proyecto"
            )}
          </button>
        </div>

        {feedback.kind === "success" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
            <p>{feedback.message}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href={`/visits/new?projectId=${feedback.projectId}`}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Registrar primera visita
              </Link>
              <Link
                href="/projects"
                className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
              >
                Ver proyectos
              </Link>
            </div>
          </div>
        ) : null}

        {feedback.kind === "error" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
            {feedback.message}
          </div>
        ) : null}
      </form>
    </div>
  );
}