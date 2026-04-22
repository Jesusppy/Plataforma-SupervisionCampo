"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { apiGet, apiPost } from "../../../lib/api-client";
import { renderMarkdown } from "../../../lib/render-markdown";

type ProjectOption = {
  id: string;
  name: string;
};

type TemplateOption = {
  id: string;
  name: string;
  tone: string;
  is_active: boolean;
};

type GeneratedReport = {
  id: string;
  title: string;
  status: string;
  content_markdown: string | null;
};

type FetchStatus = "idle" | "loading" | "ready" | "error";

type GenerationStatus = "idle" | "generating" | "done" | "error";

export default function NewReportPage() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [resourcesStatus, setResourcesStatus] = useState<FetchStatus>("idle");
  const [resourcesError, setResourcesError] = useState<string | null>(null);

  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [title, setTitle] = useState("Borrador de informe");

  const [generationStatus, setGenerationStatus] =
    useState<GenerationStatus>("idle");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [report, setReport] = useState<GeneratedReport | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setResourcesStatus("loading");
      setResourcesError(null);
      try {
        const [projectList, templateList] = await Promise.all([
          apiGet<ProjectOption[]>("/projects"),
          apiGet<TemplateOption[]>("/templates"),
        ]);

        if (cancelled) return;
        setProjects(projectList);
        setTemplates(templateList.filter((template) => template.is_active));
        setResourcesStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setResourcesStatus("error");
        setResourcesError(
          error instanceof Error
            ? error.message
            : "No fue posible cargar proyectos y plantillas.",
        );
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(
    () =>
      selectedProject !== "" &&
      selectedTemplate !== "" &&
      title.trim().length > 0 &&
      generationStatus !== "generating",
    [selectedProject, selectedTemplate, title, generationStatus],
  );

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setGenerationStatus("generating");
    setGenerationError(null);
    setReport(null);

    try {
      const generated = await apiPost<GeneratedReport>(
        "/reports/generate-draft",
        {
          project_id: selectedProject,
          template_id: selectedTemplate,
          title: title.trim(),
          source_visit_ids: [],
        },
      );
      setReport(generated);
      setGenerationStatus("done");
    } catch (error) {
      setGenerationStatus("error");
      setGenerationError(
        error instanceof Error
          ? error.message
          : "No fue posible generar el borrador.",
      );
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">
          Reportes
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">
          Generar borrador con IA
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Selecciona un proyecto y una plantilla. La IA analizará las visitas y
          sus adjuntos para devolver un borrador estructurado.
        </p>
      </header>

      <form
        onSubmit={handleGenerate}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8"
      >
        {resourcesStatus === "error" ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {resourcesError}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="report-project"
              className="text-sm font-medium text-slate-800"
            >
              Proyecto
            </label>
            <select
              id="report-project"
              required
              value={selectedProject}
              onChange={(event) => setSelectedProject(event.target.value)}
              disabled={resourcesStatus !== "ready"}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="" disabled>
                {resourcesStatus === "loading"
                  ? "Cargando proyectos..."
                  : "Selecciona un proyecto"}
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="report-template"
              className="text-sm font-medium text-slate-800"
            >
              Plantilla
            </label>
            <select
              id="report-template"
              required
              value={selectedTemplate}
              onChange={(event) => setSelectedTemplate(event.target.value)}
              disabled={resourcesStatus !== "ready"}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="" disabled>
                {resourcesStatus === "loading"
                  ? "Cargando plantillas..."
                  : "Selecciona una plantilla"}
              </option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} · {template.tone}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="report-title"
            className="text-sm font-medium text-slate-800"
          >
            Título del borrador
          </label>
          <input
            id="report-title"
            type="text"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Endpoint: <code>POST /reports/generate-draft</code>
          </p>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generationStatus === "generating"
              ? "Generando..."
              : "Generar borrador"}
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
        {generationStatus === "idle" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-100" />
            <p className="text-sm font-medium text-slate-700">
              Aún no se ha generado un borrador.
            </p>
            <p className="max-w-md text-xs text-slate-500">
              Elige proyecto y plantilla, y presiona "Generar borrador" para
              comenzar.
            </p>
          </div>
        ) : null}

        {generationStatus === "generating" ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-600" />
            <p className="text-base font-semibold text-slate-900">
              Cargando... La IA está analizando los archivos.
            </p>
            <p className="max-w-md text-sm leading-6 text-slate-600">
              Estamos procesando las visitas, los PDFs, las fotos y los audios
              del proyecto seleccionado.
            </p>
          </div>
        ) : null}

        {generationStatus === "error" ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
            {generationError}
          </div>
        ) : null}

        {generationStatus === "done" && report ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                  Borrador generado
                </p>
                <h2 className="text-xl font-semibold text-slate-950">
                  {report.title}
                </h2>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                {report.status}
              </span>
            </div>
            {report.content_markdown ? (
              <article
                className="prose prose-slate max-w-none rounded-xl bg-slate-50 p-6 text-sm leading-7 text-slate-800"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(report.content_markdown),
                }}
              />
            ) : (
              <p className="text-sm text-slate-600">
                El backend no devolvió contenido en Markdown.
              </p>
            )}

            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
              <Link
                href={`/reports/${report.id}`}
                className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Abrir detalle del reporte
              </Link>
              <Link
                href="/reports"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Ver todos los reportes
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
