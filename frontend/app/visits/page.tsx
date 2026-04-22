"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiGet } from "../../lib/api-client";

type VisitAttachment = {
  id: string;
  attachment_type: string;
  file_name: string;
};

type VisitSummary = {
  id: string;
  project_id: string;
  visited_at: string;
  notes: string;
  ai_context: string | null;
  attachments: VisitAttachment[];
};

type FetchState = "loading" | "ready" | "error";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
});

function summarize(text: string, length = 160): string {
  return text.length <= length ? text : `${text.slice(0, length).trim()}...`;
}

export default function VisitsPage() {
  const [visits, setVisits] = useState<VisitSummary[]>([]);
  const [status, setStatus] = useState<FetchState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadVisits = async () => {
      setStatus("loading");
      setError(null);

      try {
        const response = await apiGet<VisitSummary[]>("/visits");
        if (cancelled) {
          return;
        }

        setVisits(response);
        setStatus("ready");
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setStatus("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar las visitas.",
        );
      }
    };

    void loadVisits();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">
            Visitas
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">
            Cronología de campo y evidencia asociada
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Revisa rápidamente qué visitas ya tienen fotos, PDFs o audios antes de lanzar una nueva generación con Gemini.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/visits/new"
            className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            Nueva visita
          </Link>
          <Link
            href="/reports/new"
            className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Generar desde visitas
          </Link>
        </div>
      </header>

      {status === "error" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
              <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : null}

      {status === "ready" && visits.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Sin visitas registradas</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Crea visitas desde la API o ejecuta la verificación completa para poblar el entorno con evidencia de prueba.
          </p>
        </div>
      ) : null}

      {status === "ready" && visits.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {visits.map((visit) => (
            <article
              key={visit.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                    Visita de campo
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    {dateFormatter.format(new Date(visit.visited_at))}
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {visit.attachments.length} adjuntos
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {summarize(visit.notes)}
              </p>

              <div className="mt-5 space-y-2 text-sm text-slate-500">
                <p>
                  <span className="font-semibold text-slate-800">Proyecto:</span> {visit.project_id}
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Contexto IA:</span>{" "}
                  {visit.ai_context ? summarize(visit.ai_context, 120) : "Sin contexto adicional."}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {visit.attachments.map((attachment) => (
                  <span
                    key={attachment.id}
                    className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-800"
                  >
                    {attachment.attachment_type}: {attachment.file_name}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}