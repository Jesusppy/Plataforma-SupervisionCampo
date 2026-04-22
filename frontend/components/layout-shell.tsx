"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "./app-shell";

type LayoutShellProps = {
  children: ReactNode;
};

const AUTHLESS_ROUTES = ["/login"];

function shouldUseBareLayout(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  return AUTHLESS_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function LayoutShell({ children }: LayoutShellProps) {
  const pathname = usePathname();

  if (shouldUseBareLayout(pathname)) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}