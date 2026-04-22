"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiGet } from "../../lib/api-client";

type ReportSummary = {
  id: string;
  title: string;
  status: string;
  llm_model: string | null;
  content_markdown: string | null;
  generated_at: string | null;
  created_at: string;
};

type FetchState = "loading" | "ready" | "error";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
});

function summarize(text: string | null, length = 150): string {
  if (!text) {
    return "Sin contenido generado aún.";
  }

  const compact = text.replace(/[#*_`>-]/g, "").replace(/\s+/g, " ").trim();
  return compact.length <= length ? compact : `${compact.slice(0, length).trim()}...`;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [status, setStatus] = useState<FetchState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadReports = async () => {
      setStatus("loading");
      setError(null);

      try {
        const response = await apiGet<ReportSummary[]>("/reports");
        if (cancelled) {
          return;
        }

        setReports(response);
        setStatus("ready");
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setStatus("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar los reportes.",
        );
      }
    };

    void loadReports();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">
            Reportes
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">
            Reportes generados y listos para exportar
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Accede al detalle de cada borrador, revisa el Markdown generado y exporta el resultado en PDF o HTML desde una descarga segura basada en Blob.
          </p>
        </div>
        <Link
          href="/reports/new"
          className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Nuevo reporte
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
              <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : null}

      {status === "ready" && reports.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">No hay reportes todavía</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Genera el primer borrador para habilitar el flujo de exportación PDF/HTML y la validación de la evidencia multimodal.
          </p>
        </div>
      ) : null}

      {status === "ready" && reports.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {reports.map((report) => (
            <article
              key={report.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                    Borrador
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    {report.title}
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  {report.status}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {summarize(report.content_markdown)}
              </p>

              <dl className="mt-5 space-y-2 text-sm text-slate-500">
                <div className="flex items-center justify-between gap-3">
                  <dt>Generado</dt>
                  <dd className="font-medium text-slate-700">
                    {report.generated_at
                      ? dateFormatter.format(new Date(report.generated_at))
                      : "Pendiente"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Creado</dt>
                  <dd className="font-medium text-slate-700">
                    {dateFormatter.format(new Date(report.created_at))}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Modelo</dt>
                  <dd className="font-medium text-slate-700">
                    {report.llm_model || "No definido"}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/reports/${report.id}`}
                  className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Abrir detalle
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}