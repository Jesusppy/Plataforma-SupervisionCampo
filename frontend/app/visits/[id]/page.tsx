"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FileText, ImageIcon, Music } from "lucide-react";

import { apiGet } from "../../../lib/api-client";

type AttachmentRead = {
  id: string;
  attachment_type: "photo" | "audio" | "pdf";
  file_name: string;
  object_key: string;
  bucket_name: string;
  file_url: string;
  content_type: string;
  extracted_text: string | null;
};

type VisitDetail = {
  id: string;
  project_id: string;
  visited_at: string;
  notes: string;
  ai_context: string | null;
  attachments: AttachmentRead[];
  created_at: string;
  updated_at: string;
};

type LoadState = "loading" | "ready" | "error";

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

export default function VisitDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const visitId = getRouteParam(params.id);

  const [status, setStatus] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [visit, setVisit] = useState<VisitDetail | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadVisit = async () => {
      if (!visitId) {
        setStatus("error");
        setError("No se recibió un identificador de visita válido.");
        return;
      }

      setStatus("loading");
      setError(null);

      try {
        const response = await apiGet<VisitDetail>(`/visits/${visitId}`);
        if (cancelled) {
          return;
        }
        setVisit(response);
        setStatus("ready");
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setStatus("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar el detalle de la visita.",
        );
      }
    };

    void loadVisit();

    return () => {
      cancelled = true;
    };
  }, [visitId]);

  const photos = useMemo(
    () => visit?.attachments.filter((attachment) => attachment.attachment_type === "photo") ?? [],
    [visit],
  );
  const others = useMemo(
    () => visit?.attachments.filter((attachment) => attachment.attachment_type !== "photo") ?? [],
    [visit],
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">
            Detalle de visita
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">
            {visit ? dateFormatter.format(new Date(visit.visited_at)) : "Cargando visita"}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Revisión completa de hallazgos de campo, contexto IA y evidencia multimedia del caso del técnico forestal.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/visits"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Volver a visitas
          </Link>
          {visit ? (
            <Link
              href={`/reports/new?projectId=${visit.project_id}`}
              className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Generar reporte
            </Link>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-7 w-56 animate-pulse rounded bg-slate-100" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
          <div className="h-56 animate-pulse rounded-3xl bg-slate-100" />
        </div>
      ) : null}

      {status === "ready" && visit ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Proyecto
              </p>
              <p className="mt-3 break-all text-sm font-semibold text-slate-950">
                {visit.project_id}
              </p>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Adjuntos
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">
                {visit.attachments.length}
              </p>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Actualizada
              </p>
              <p className="mt-3 text-sm font-semibold text-slate-950">
                {dateFormatter.format(new Date(visit.updated_at))}
              </p>
            </article>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
            <div className="border-b border-slate-100 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                Hallazgos
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Notas de campo
              </h2>
            </div>
            <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {visit.notes}
            </p>
            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-slate-900">Contexto adicional para IA</p>
              <p className="mt-2 whitespace-pre-wrap">
                {visit.ai_context || "Sin contexto adicional para IA."}
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
            <div className="border-b border-slate-100 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                Evidencia
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Fotografías de la visita ({photos.length})
              </h2>
            </div>

            {photos.length > 0 ? (
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
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                No hay evidencia fotográfica cargada en esta visita.
              </div>
            )}
          </section>

          {others.length > 0 ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                  Archivos complementarios
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Audio y PDF
                </h2>
              </div>
              <div className="mt-5 space-y-3">
                {others.map((attachment) => {
                  const Icon = attachment.attachment_type === "audio" ? Music : FileText;
                  return (
                    <a
                      key={attachment.id}
                      href={attachment.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {attachment.file_name}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                          {attachment.attachment_type}
                        </p>
                        {attachment.extracted_text ? (
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {attachment.extracted_text}
                          </p>
                        ) : null}
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}