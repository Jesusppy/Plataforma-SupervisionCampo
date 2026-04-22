const metrics = [
  { label: "Proyectos activos", value: "12", detail: "3 requieren seguimiento hoy" },
  { label: "Visitas registradas", value: "48", detail: "Incluyen fotos, audio y PDFs" },
  { label: "Plantillas listas", value: "5", detail: "Estructuras aprobadas por operación" },
  { label: "Reportes generados", value: "19", detail: "7 pendientes de exportación final" },
];

const workflowSteps = [
  "Crear el proyecto y documentar el contexto operativo.",
  "Registrar visitas de campo con evidencia multimedia en MinIO.",
  "Elegir una plantilla y definir instrucciones precisas para Gemini.",
  "Generar el borrador y exportarlo en HTML o PDF.",
];

export default function HomePage() {
  return (
    <div className="space-y-6 md:space-y-8">
      <section className="rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-sm md:px-8 md:py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Dashboard
        </p>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl">
          Centraliza visitas técnicas y transforma evidencia de campo en informes
          estructurados con IA multimodal.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
          Esta base de Next.js 15 está preparada para conectar los flujos de
          proyectos, visitas, plantillas y reportes sobre una arquitectura limpia.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
          >
            <p className="text-sm font-medium text-slate-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">
              {metric.value}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h3 className="text-xl font-semibold text-slate-950">
            Flujo base de la plataforma
          </h3>
          <ol className="mt-5 space-y-4">
            {workflowSteps.map((step, index) => (
              <li key={step} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-700">
                  {index + 1}
                </div>
                <p className="pt-1 text-sm leading-6 text-slate-700">{step}</p>
              </li>
            ))}
          </ol>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h3 className="text-xl font-semibold text-slate-950">
            Estado del alcance inicial
          </h3>
          <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
            <p>
              Backend base con FastAPI, SQLAlchemy asíncrono, Alembic y modelos
              de dominio ya definidos.
            </p>
            <p>
              Frontend preparado para crecer con rutas específicas para
              proyectos, plantillas y reportes.
            </p>
            <p>
              Siguiente fase natural: conectar formularios, endpoints CRUD y
              carga de archivos contra MinIO.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
