"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiGet } from "../../lib/api-client";

type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type FetchState = "loading" | "ready" | "error";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [status, setStatus] = useState<FetchState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      setStatus("loading");
      setError(null);

      try {
        const response = await apiGet<ProjectSummary[]>("/projects");
        if (cancelled) {
          return;
        }

        setProjects(response);
        setStatus("ready");
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setStatus("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar los proyectos.",
        );
      }
    };

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">
            Proyectos
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">
            Portafolio operativo protegido por middleware
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Este tablero consolida los proyectos activos y sirve como punto de entrada para registrar visitas y disparar reportes con IA.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/projects/new"
            className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            Nuevo proyecto
          </Link>
          <Link
            href="/visits"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Ver visitas
          </Link>
          <Link
            href="/reports/new"
            className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Generar reporte
          </Link>
        </div>
      </header>

      {status === "error" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="h-8 w-40 animate-pulse rounded-full bg-slate-100" />
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-slate-100 p-5">
                <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {status === "ready" && projects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Aún no hay proyectos</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Ejecuta el script maestro de verificación o crea un proyecto desde la API para empezar a capturar visitas.
          </p>
        </div>
      ) : null}

      {status === "ready" && projects.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <article
              key={project.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                Proyecto
              </p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">{project.name}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {project.description || "Sin descripción operativa registrada."}
              </p>
              <dl className="mt-6 space-y-2 text-sm text-slate-500">
                <div className="flex items-center justify-between gap-3">
                  <dt>Creado</dt>
                  <dd className="font-medium text-slate-700">
                    {dateFormatter.format(new Date(project.created_at))}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Actualizado</dt>
                  <dd className="font-medium text-slate-700">
                    {dateFormatter.format(new Date(project.updated_at))}
                  </dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/visits/new?projectId=${project.id}`}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Nueva visita
                </Link>
                <Link
                  href="/visits"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Revisar visitas
                </Link>
                <Link
                  href="/reports/new"
                  className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500"
                >
                  Generar borrador
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}