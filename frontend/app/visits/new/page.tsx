"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { ImageIcon, Music, FileText, X } from "lucide-react";

import { apiGet, apiPost } from "../../../lib/api-client";
import { Spinner } from "../../../components/spinner";

type AttachmentType = "photo" | "audio" | "pdf";

type ProjectOption = {
  id: string;
  name: string;
};

type VisitResponse = {
  id: string;
  project_id: string;
};

type UploadResponse = {
  id: string;
  file_name: string;
};

type UploadItem = {
  id: string;
  file: File;
  attachmentType: AttachmentType;
  previewUrl: string | null;
};

type FeedbackState =
  | { kind: "idle" }
  | { kind: "success"; message: string; visitId: string; projectId: string }
  | { kind: "error"; message: string };

function toLocalDatetimeValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const normalized = new Date(date.getTime() - offset * 60_000);
  return normalized.toISOString().slice(0, 16);
}

function guessAttachmentType(file: File): AttachmentType | null {
  if (file.type.startsWith("image/")) {
    return "photo";
  }
  if (file.type.startsWith("audio/")) {
    return "audio";
  }
  if (file.type === "application/pdf") {
    return "pdf";
  }
  return null;
}

function buildUploadItems(files: File[]): {
  accepted: UploadItem[];
  rejectedCount: number;
} {
  const accepted: UploadItem[] = [];
  let rejectedCount = 0;

  for (const file of files) {
    const attachmentType = guessAttachmentType(file);
    if (!attachmentType) {
      rejectedCount += 1;
      continue;
    }
    accepted.push({
      id: crypto.randomUUID(),
      file,
      attachmentType,
      previewUrl:
        attachmentType === "photo" && typeof URL !== "undefined"
          ? URL.createObjectURL(file)
          : null,
    });
  }

  return { accepted, rejectedCount };
}

function NewVisitPageContent() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId") ?? "";

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState(initialProjectId);
  const [visitedAt, setVisitedAt] = useState(toLocalDatetimeValue(new Date()));
  const [notes, setNotes] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      try {
        const response = await apiGet<ProjectOption[]>("/projects");
        if (cancelled) {
          return;
        }
        setProjects(response);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setProjectsError(
          error instanceof Error
            ? error.message
            : "No fue posible cargar los proyectos.",
        );
      }
    };

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProjectName = useMemo(
    () => projects.find((project) => project.id === selectedProject)?.name ?? null,
    [projects, selectedProject],
  );

  const registerFiles = (incomingFiles: File[]) => {
    const { accepted, rejectedCount } = buildUploadItems(incomingFiles);
    setUploads((current) => [...current, ...accepted]);
    if (rejectedCount > 0) {
      setFeedback({
        kind: "error",
        message:
          rejectedCount === 1
            ? "Se omitió 1 archivo porque solo se aceptan imágenes, audios o PDFs."
            : `Se omitieron ${rejectedCount} archivos porque solo se aceptan imágenes, audios o PDFs.`,
      });
      return;
    }
    setFeedback({ kind: "idle" });
  };

  const handleInputChange = (files: FileList | null) => {
    if (!files) {
      return;
    }
    registerFiles(Array.from(files));
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    registerFiles(Array.from(event.dataTransfer.files));
  };

  const updateAttachmentType = (uploadId: string, attachmentType: AttachmentType) => {
    setUploads((current) =>
      current.map((upload) =>
        upload.id === uploadId ? { ...upload, attachmentType } : upload,
      ),
    );
  };

  const removeUpload = (uploadId: string) => {
    setUploads((current) => {
      const target = current.find((upload) => upload.id === uploadId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((upload) => upload.id !== uploadId);
    });
  };

  useEffect(() => {
    return () => {
      uploads.forEach((upload) => {
        if (upload.previewUrl) {
          URL.revokeObjectURL(upload.previewUrl);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback({ kind: "idle" });

    try {
      const visit = await apiPost<VisitResponse>("/visits", {
        project_id: selectedProject,
        visited_at: new Date(visitedAt).toISOString(),
        notes: notes.trim(),
        ai_context: aiContext.trim() || null,
      });

      let uploadedCount = 0;
      for (const upload of uploads) {
        const formData = new FormData();
        formData.append("attachment_type", upload.attachmentType);
        formData.append("file", upload.file);
        formData.append("extracted_text", "");
        await apiPost<UploadResponse>(
          `/visits/${visit.id}/attachments/upload`,
          formData,
        );
        uploadedCount += 1;
      }

      setFeedback({
        kind: "success",
        message:
          uploadedCount > 0
            ? `Visita creada y ${uploadedCount} adjunto(s) cargado(s) correctamente.`
            : "Visita creada correctamente.",
        visitId: visit.id,
        projectId: visit.project_id,
      });
      setNotes("");
      setAiContext("");
      uploads.forEach((upload) => {
        if (upload.previewUrl) {
          URL.revokeObjectURL(upload.previewUrl);
        }
      });
      setUploads([]);
      setVisitedAt(toLocalDatetimeValue(new Date()));
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "No fue posible crear la visita y subir los adjuntos.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">
          Visitas
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">
          Registrar visita y evidencia
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Crea la visita y sube sus adjuntos contra el endpoint multipart del backend en el mismo flujo.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8"
      >
        {projectsError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
            {projectsError}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="visit-project" className="text-sm font-medium text-slate-800">
              Proyecto
            </label>
            <select
              id="visit-project"
              required
              value={selectedProject}
              onChange={(event) => setSelectedProject(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="" disabled>
                Selecciona un proyecto
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="visit-date" className="text-sm font-medium text-slate-800">
              Fecha y hora de visita
            </label>
            <input
              id="visit-date"
              type="datetime-local"
              required
              value={visitedAt}
              onChange={(event) => setVisitedAt(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
          </div>
        </div>

        {selectedProjectName ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
            Proyecto seleccionado: <span className="font-semibold text-slate-950">{selectedProjectName}</span>
          </div>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="visit-notes" className="text-sm font-medium text-slate-800">
            Notas de campo
          </label>
          <textarea
            id="visit-notes"
            rows={6}
            required
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Describe observaciones, hallazgos y contexto operativo."
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="visit-context" className="text-sm font-medium text-slate-800">
            Contexto adicional para IA
          </label>
          <textarea
            id="visit-context"
            rows={4}
            value={aiContext}
            onChange={(event) => setAiContext(event.target.value)}
            placeholder="Hipótesis, restricciones, contexto técnico o criterios de redacción."
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          />
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-800">Adjuntos</p>
            <p className="mt-1 text-sm text-slate-500">
              Arrastra imágenes, audios o PDFs, o selecciónalos manualmente.
            </p>
          </div>

          <label
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-10 text-center transition ${
              isDragging
                ? "border-cyan-500 bg-cyan-50"
                : "border-slate-300 bg-slate-50 hover:border-cyan-400 hover:bg-cyan-50/60"
            }`}
          >
            <input
              type="file"
              multiple
              accept="image/*,audio/*,application/pdf"
              className="hidden"
              onChange={(event) => handleInputChange(event.target.files)}
            />
            <p className="text-base font-semibold text-slate-900">
              Suelta archivos aquí o haz clic para seleccionarlos
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Tipos soportados: foto, audio y PDF.
            </p>
          </label>

          {uploads.length > 0 ? (
            <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-4">
              {uploads.some((upload) => upload.attachmentType === "photo") ? (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fotos
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {uploads
                      .filter((upload) => upload.attachmentType === "photo")
                      .map((upload) => (
                        <div
                          key={upload.id}
                          className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
                        >
                          {upload.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={upload.previewUrl}
                              alt={upload.file.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-400">
                              <ImageIcon className="h-8 w-8" />
                            </div>
                          )}
                          <button
                            type="button"
                            aria-label={`Quitar ${upload.file.name}`}
                            onClick={() => removeUpload(upload.id)}
                            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/75 text-white shadow-md transition hover:bg-rose-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent px-2 py-1.5">
                            <p className="truncate text-[11px] font-medium text-white">
                              {upload.file.name}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              {uploads.some((upload) => upload.attachmentType !== "photo") ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Otros adjuntos
                  </p>
                  {uploads
                    .filter((upload) => upload.attachmentType !== "photo")
                    .map((upload) => {
                      const TypeIcon =
                        upload.attachmentType === "audio" ? Music : FileText;
                      return (
                        <div
                          key={upload.id}
                          className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[auto_1fr_160px_auto] md:items-center"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600">
                            <TypeIcon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {upload.file.name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {(upload.file.size / 1024).toFixed(1)} KB ·{" "}
                              {upload.file.type || "tipo desconocido"}
                            </p>
                          </div>
                          <select
                            value={upload.attachmentType}
                            onChange={(event) =>
                              updateAttachmentType(
                                upload.id,
                                event.target.value as AttachmentType,
                              )
                            }
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                          >
                            <option value="photo">Foto</option>
                            <option value="audio">Audio</option>
                            <option value="pdf">PDF</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeUpload(upload.id)}
                            className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <X className="h-4 w-4" />
                            Quitar
                          </button>
                        </div>
                      );
                    })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/visits"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Volver a visitas
            </Link>
            <Link
              href="/projects"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Ver proyectos
            </Link>
          </div>
          <button
            type="submit"
            aria-busy={isSubmitting}
            disabled={isSubmitting || !selectedProject || notes.trim().length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Spinner className="h-4 w-4" />
                Guardando visita...
              </>
            ) : (
              "Crear visita y subir adjuntos"
            )}
          </button>
        </div>

        {feedback.kind === "success" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
            <p>{feedback.message}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/visits"
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Ver visitas
              </Link>
              <Link
                href={`/reports/new?projectId=${feedback.projectId}`}
                className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
              >
                Generar reporte
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

export default function NewVisitPage() {
  return (
    <Suspense fallback={<div className="space-y-8" />}>
      <NewVisitPageContent />
    </Suspense>
  );
}