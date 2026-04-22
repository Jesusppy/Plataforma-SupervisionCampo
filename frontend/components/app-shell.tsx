"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { clearSession, hasActiveSession } from "../lib/auth";

type NavigationItem = {
  label: string;
  href: string;
  description: string;
};

const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/",
    description: "Vista general de la operación y actividad reciente.",
  },
  {
    label: "Proyectos",
    href: "/projects",
    description: "Gestión de proyectos, visitas y adjuntos asociados.",
  },
  {
    label: "Visitas",
    href: "/visits",
    description: "Seguimiento cronológico y revisión de evidencia por visita.",
  },
  {
    label: "Plantillas",
    href: "/templates",
    description: "Definición de estructuras e instrucciones para la IA.",
  },
  {
    label: "Reportes",
    href: "/reports",
    description: "Consulta y exportación de informes generados.",
  },
];

type AppShellProps = {
  children: ReactNode;
};

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(hasActiveSession());
  }, [pathname]);

  const handleLogout = () => {
    clearSession();
    setIsAuthenticated(false);
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-80 shrink-0 border-r border-slate-200 bg-slate-950 px-6 py-8 text-slate-100 lg:block">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Supervisión de Campo
            </p>
            <h1 className="text-2xl font-semibold">Centro de operaciones</h1>
            <p className="text-sm leading-6 text-slate-400">
              Plataforma para consolidar visitas técnicas, evidencia de campo y
              generación asistida de informes.
            </p>
          </div>

          <nav className="mt-10 space-y-3">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-2xl border px-4 py-4 transition ${
                  pathname && isActivePath(pathname, item.href)
                    ? "border-cyan-400/40 bg-slate-900 text-white"
                    : "border-slate-800 bg-slate-900/70 hover:border-cyan-400/40 hover:bg-slate-900"
                }`}
              >
                <p className="text-sm font-semibold text-slate-50">{item.label}</p>
                <p className="mt-1 text-sm leading-5 text-slate-400">
                  {item.description}
                </p>
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Plataforma de Supervisión de Campo
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  Gestión operativa y reportes con IA
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/reports/new"
                  className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Nuevo reporte
                </Link>
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Cerrar sesión
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100"
                  >
                    Iniciar sesión
                  </Link>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 px-6 py-8">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
