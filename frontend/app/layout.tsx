import type { Metadata } from "next";
import type { ReactNode } from "react";

import { LayoutShell } from "../components/layout-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plataforma de Supervision de Campo",
  description:
    "Aplicación para registrar visitas técnicas, consolidar evidencia y generar informes con IA.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
