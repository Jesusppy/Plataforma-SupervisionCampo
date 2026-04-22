"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  FileStack,
  FileText,
  Menu,
  X,
  LogOut,
  LogIn,
  Plus,
  type LucideIcon,
} from "lucide-react";

import { clearSession, hasActiveSession } from "../lib/auth";

type NavigationItem = {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
};

const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/",
    description: "Vista general de la operación y actividad reciente.",
    icon: LayoutDashboard,
  },
  {
    label: "Proyectos",
    href: "/projects",
    description: "Gestión de proyectos, visitas y adjuntos asociados.",
    icon: FolderKanban,
  },
  {
    label: "Visitas",
    href: "/visits",
    description: "Seguimiento cronológico y revisión de evidencia por visita.",
    icon: ClipboardList,
  },
  {
    label: "Plantillas",
    href: "/templates",
    description: "Definición de estructuras e instrucciones para la IA.",
    icon: FileStack,
  },
  {
    label: "Reportes",
    href: "/reports",
    description: "Consulta y exportación de informes generados.",
    icon: FileText,
  },
];

type AppShellProps = {
  children: ReactNode;
};

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    setIsAuthenticated(hasActiveSession());
    setIsMobileNavOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    clearSession();
    setIsAuthenticated(false);
    router.push("/login");
    router.refresh();
  };

  const renderNavItems = (variant: "desktop" | "mobile") => (
    <nav className={variant === "desktop" ? "mt-10 space-y-3" : "mt-6 space-y-2"}>
      {navigationItems.map((item) => {
        const active = pathname ? isActivePath(pathname, item.href) : false;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setIsMobileNavOpen(false)}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition ${
              active
                ? "border-cyan-400/40 bg-slate-900 text-white"
                : "border-slate-800 bg-slate-900/70 text-slate-100 hover:border-cyan-400/40 hover:bg-slate-900"
            }`}
          >
            <Icon
              className={`mt-0.5 h-5 w-5 shrink-0 ${
                active ? "text-cyan-300" : "text-slate-400"
              }`}
            />
            <div>
              <p className="text-sm font-semibold text-slate-50">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {item.description}
              </p>
            </div>
          </Link>
        );
      })}
    </nav>
  );

  const sidebarContent = (
    <>
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
      {renderNavItems("desktop")}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-80 shrink-0 border-r border-slate-200 bg-slate-950 px-6 py-8 text-slate-100 lg:block">
          {sidebarContent}
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-6 md:py-4">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  aria-label="Abrir menú"
                  onClick={() => setIsMobileNavOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-500 md:text-sm">
                    Plataforma de Supervisión de Campo
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-900 md:text-lg">
                    Gestión operativa y reportes con IA
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <Link
                  href="/reports/new"
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800 md:px-4 md:text-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Nuevo reporte</span>
                </Link>
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 md:px-4 md:text-sm"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Cerrar sesión</span>
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100 md:px-4 md:text-sm"
                  >
                    <LogIn className="h-4 w-4" />
                    <span className="hidden sm:inline">Iniciar sesión</span>
                  </Link>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
      </div>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-80 max-w-[85%] flex-col overflow-y-auto bg-slate-950 px-6 py-6 text-slate-100 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  Supervisión de Campo
                </p>
                <h1 className="text-lg font-semibold">Centro de operaciones</h1>
              </div>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setIsMobileNavOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderNavItems("mobile")}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
