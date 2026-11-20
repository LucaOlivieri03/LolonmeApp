"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnthemPlayer } from "./AnthemPlayer";

const DESKTOP_NAV = [
  { href: "/", label: "Inicio" },
  { href: "/partidos", label: "Partidos" },
  { href: "/stats", label: "Stats" },
  { href: "/calendario", label: "Calendario" },
  { href: "/reglas", label: "Reglas" },
  { href: "/blog", label: "Blog" },
];

export function AppHeader() {
  const pathname = usePathname();
  const isAdminActive = pathname.startsWith("/admin");
  const isReglasActive = pathname.startsWith("/reglas");

  return (
    <header className="sticky top-0 z-40 border-b-2 border-gold-500 bg-pitch-800 text-paper">
      <div className="mx-auto flex h-15 max-w-5xl items-center justify-between gap-2 px-3 sm:px-5">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="group flex min-h-11 items-center gap-2.5 rounded-md focus-visible:outline-gold-400"
          >
            <img
              src="/assets/Logo.svg"
              alt="Escudo oficial LOLONMEBOL"
              className="h-9 w-9 shrink-0 object-contain transition-transform duration-200 group-hover:scale-105"
            />
            <span className="font-display text-2xl font-extrabold tracking-wide text-paper">
              LOLONMEBOL
            </span>
          </Link>

          <nav aria-label="Navegación de escritorio" className="hidden items-center gap-1 md:flex">
            {DESKTOP_NAV.map(({ href, label }) => {
              const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-15 items-center px-3 text-sm font-semibold transition-colors",
                    isActive
                      ? "text-white"
                      : "text-pitch-100/80 hover:text-white"
                  )}
                >
                  {label}
                  {isActive && (
                    <span className="absolute inset-x-2 bottom-0 h-1 bg-leather-500" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <AnthemPlayer />
          <Link
            href="/reglas"
            aria-label="Reglamento Oficial"
            aria-current={isReglasActive ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors md:hidden",
              isReglasActive
                ? "border-gold-400 bg-gold-500/20 text-gold-400"
                : "border-white/20 bg-pitch-900/60 text-pitch-50 hover:border-white/35 hover:bg-pitch-900"
            )}
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            <span className="hidden xs:inline">Reglas</span>
          </Link>
          <Link
            href="/admin"
            aria-label="Panel de Administración"
            aria-current={isAdminActive ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors",
              isAdminActive
                ? "border-leather-500 bg-leather-600 text-white"
                : "border-white/20 bg-pitch-900/60 text-pitch-50 hover:border-white/35 hover:bg-pitch-900"
            )}
          >
            <Shield className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
