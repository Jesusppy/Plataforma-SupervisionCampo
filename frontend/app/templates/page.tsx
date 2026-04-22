"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiGet } from "../../lib/api-client";

type TemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  tone: string;
  sections: Array<Record<string, unknown>>;
  instructions: string | null;
  is_active: boolean;
};

type FetchState = "loading" | "ready" | "error";

function summarize(text: string | null, length = 150): string {
  if (!text) {
    return "Sin instrucciones adicionales.";
  }

  return text.length <= length ? text : `${text.slice(0, length).trim()}...`;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [status, setStatus] = useState<FetchState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      setStatus("loading");
      setError(null);

      try {
        const response = await apiGet<TemplateSummary[]>("/templates");
        if (cancelled) {
          return;
        }

        setTemplates(response);
        setStatus("ready");
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setStatus("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar las plantillas.",
        );
      }
    };

    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">
            Plantillas
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">
            Estructuras reutilizables por cliente y caso de uso
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Un mismo técnico puede trabajar para distintos clientes cambiando únicamente la plantilla, sin alterar el flujo operativo de visitas y evidencia.
          </p>
        </div>
        <Link
          href="/templates/new"
          className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Nueva plantilla
        </Link>
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
              <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : null}

      {status === "ready" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {templates.map((template) => (
            <article
              key={template.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                    Plantilla
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    {template.name}
                  </h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    template.is_active
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {template.is_active ? "Activa" : "Inactiva"}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {template.description || summarize(template.instructions)}
              </p>

              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tono
                  </dt>
                  <dd className="mt-2 text-sm font-semibold text-slate-900">{template.tone}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Secciones
                  </dt>
                  <dd className="mt-2 text-sm font-semibold text-slate-900">
                    {template.sections.length}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}