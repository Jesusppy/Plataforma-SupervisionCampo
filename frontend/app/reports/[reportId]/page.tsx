"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Spinner } from "../../../components/spinner";
import { apiGet, downloadFile } from "../../../lib/api-client";
import { renderMarkdown } from "../../../lib/render-markdown";

type ReportDetail = {
  id: string;
  title: string;
  status: string;
  project_id: string;
  template_id: string | null;
  llm_model: string | null;
  source_visit_ids: string[];
  content_markdown: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  visits: Array<{ id: string }>;
  reports: Array<{ id: string }>;
};

type TemplateSummary = {
  id: string;
  name: string;
  tone: string;
  sections: Array<Record<string, unknown>>;
};

type AttachmentRead = {
  id: string;
  visit_id: string;
  attachment_type: "photo" | "audio" | "pdf";
  file_name: string;
  file_url: string;
  content_type: string;
};

type VisitRead = {
  id: string;
  project_id: string;
  attachments: AttachmentRead[];
};

type LoadState = "loading" | "ready" | "error";
type ExportFormat = "pdf" | "html";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function buildFallbackName(title: string, format: ExportFormat): string {
  const baseName = title.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
  return `${baseName || "reporte"}.${format}`;
}

export default function ReportDetailPage() {
  const params = useParams<{ reportId: string | string[] }>();
  const reportId = getRouteParam(params.reportId);

  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [photos, setPhotos] = useState<AttachmentRead[]>([]);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadReport = async () => {
      if (!reportId) {
        setState("error");
        setError("No se recibió un identificador de reporte válido.");
        return;
      }

      setState("loading");
      setError(null);

      try {
        const reportResponse = await apiGet<ReportDetail>(`/reports/${reportId}`);
        const [projectResponse, templateResponse] = await Promise.all([
          apiGet<ProjectDetail>(`/projects/${reportResponse.project_id}`),
          reportResponse.template_id
            ? apiGet<TemplateSummary>(`/templates/${reportResponse.template_id}`)
            : Promise.resolve(null),
        ]);

        const visitIds =
          reportResponse.source_visit_ids.length > 0
            ? reportResponse.source_visit_ids
            : projectResponse.visits.map((visit) => visit.id);

        const visitResults = await Promise.all(
          visitIds.map((visitId) =>
            apiGet<VisitRead>(`/visits/${visitId}`).catch(() => null),
          ),
        );

        if (cancelled) {
          return;
        }

        const collectedPhotos = visitResults
          .filter((visit): visit is VisitRead => visit !== null)
          .flatMap((visit) => visit.attachments)
          .filter((attachment) => attachment.attachment_type === "photo");

        setReport(reportResponse);
        setProject(projectResponse);
        setTemplate(templateResponse);
        setPhotos(collectedPhotos);
        setState("ready");
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setState("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar el detalle del reporte.",
        );
      }
    };

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const handleExport = async (format: ExportFormat) => {
    if (!report) {
      return;
    }

    setExporting(format);
    setError(null);

    try {
      await downloadFile(
        `/reports/${report.id}/export?format=${format}`,
        buildFallbackName(report.title, format),
      );
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "No fue posible exportar el reporte.",
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">
            Detalle de reporte
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">
            {report?.title || "Cargando reporte"}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Revisa el borrador multimodal, confirma su contexto de proyecto y exporta el entregable final en PDF o HTML.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/reports"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Volver a reportes
          </Link>
          <Link
            href="/reports/new"
            className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Nuevo reporte
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {state === "loading" ? (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="h-7 w-56 animate-pulse rounded bg-slate-100" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl bg-slate-50 p-4">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                <div className="mt-3 h-5 w-32 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-3xl bg-slate-100" />
        </div>
      ) : null}

      {state === "ready" && report ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Estado
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-950">{report.status}</p>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Proyecto
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-950">
                {project?.name || report.project_id}
              </p>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Plantilla
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-950">
                {template?.name || "Sin plantilla"}
              </p>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Visitas fuente
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-950">
                {report.source_visit_ids.length || project?.visits.length || 0}
              </p>
            </article>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-100 pb-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                  Exportación segura
                </p>
                <h2 className="text-2xl font-semibold text-slate-950">
                  Descarga del entregable final
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">
                  El cliente genera un Blob local con la respuesta binaria para preservar nombre, tipo MIME y descarga consistente en navegador.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleExport("pdf")}
                  aria-busy={exporting === "pdf"}
                  disabled={exporting !== null || !report.content_markdown}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exporting === "pdf" ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Exportando PDF...
                    </>
                  ) : (
                    "Exportar PDF"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("html")}
                  aria-busy={exporting === "html"}
                  disabled={exporting !== null || !report.content_markdown}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exporting === "html" ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Exportando HTML...
                    </>
                  ) : (
                    "Exportar HTML"
                  )}
                </button>
              </div>
            </div>

            <dl className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Generado
                </dt>
                <dd className="mt-2 text-sm font-semibold text-slate-900">
                  {report.generated_at
                    ? dateFormatter.format(new Date(report.generated_at))
                    : "Pendiente"}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Modelo
                </dt>
                <dd className="mt-2 text-sm font-semibold text-slate-900">
                  {report.llm_model || "No indicado"}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tono
                </dt>
                <dd className="mt-2 text-sm font-semibold text-slate-900">
                  {template?.tone || "Sin tono"}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Secciones
                </dt>
                <dd className="mt-2 text-sm font-semibold text-slate-900">
                  {template?.sections.length ?? 0}
                </dd>
              </div>
            </dl>
          </section>

          {photos.length > 0 ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                  Evidencia multimedia
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Evidencia fotográfica ({photos.length})
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Fotografías cargadas a MinIO desde las visitas asociadas.
                </p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {photos.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
                  >
                    <img
                      src={photo.file_url}
                      alt={photo.file_name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent px-2 py-1.5">
                      <p className="truncate text-[11px] font-medium text-white">
                        {photo.file_name}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
            <div className="border-b border-slate-100 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                Contenido
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Markdown generado por Gemini
              </h2>
            </div>

            {report.content_markdown ? (
              <article
                className="prose prose-slate mt-6 max-w-none rounded-3xl bg-slate-50 p-4 text-sm leading-7 text-slate-800 md:p-6"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(report.content_markdown),
                }}
              />
            ) : (
              <p className="mt-6 text-sm leading-6 text-slate-600">
                El reporte aún no tiene contenido utilizable para exportación.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
