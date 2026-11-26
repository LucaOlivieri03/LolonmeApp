"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, UserCircle2 } from "lucide-react";
import type { PlayerRole } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { AnthemPlayer } from "./AnthemPlayer";
import { ThemeSwitcher } from "./ThemeSwitcher";

const DESKTOP_NAV = [
  { href: "/", label: "Inicio" },
  { href: "/partidos", label: "Partidos" },
  { href: "/stats", label: "Stats" },
  { href: "/calendario", label: "Calendario" },
  { href: "/reglas", label: "Reglas" },
  { href: "/blog", label: "Blog" },
];

export interface AppHeaderProps {
  role?: PlayerRole;
  displayName?: string | null;
  isAuthenticated?: boolean;
}

export function AppHeader({
  role = "guest",
  displayName = null,
  isAuthenticated = false,
}: AppHeaderProps) {
  const pathname = usePathname();
  const isAdminActive = pathname.startsWith("/admin");
  const isPerfilActive = pathname.startsWith("/perfil");
  const canAccessAdmin = role === "admin" || role === "authorized";

  const profileLabel = isAuthenticated
    ? (displayName ?? "Mi Cuenta")
    : "Perfil";

  return (
    <header className="sticky top-0 z-40 border-b-2 border-gold-500 bg-pitch-800 text-paper">
      <div className="mx-auto flex h-15 max-w-5xl items-center justify-between gap-2 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-4 md:gap-6">
          <Link
            href="/"
            className="group flex min-h-11 min-w-0 items-center gap-2 rounded-md focus-visible:outline-gold-400"
          >
            <img
              src="/assets/Logo.svg"
              alt="Escudo oficial LOLONMEBOL"
              className="h-8 w-8 shrink-0 object-contain transition-transform duration-200 group-hover:scale-105 sm:h-9 sm:w-9"
            />
            <span className="font-display truncate text-xl font-extrabold tracking-wide text-paper sm:text-2xl">
              LOLONMEBOL
            </span>
          </Link>

          <nav
            aria-label="Navegación de escritorio"
            className="hidden items-center gap-1 md:flex"
          >
            {DESKTOP_NAV.map(({ href, label }) => {
              const isActive =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
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

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <AnthemPlayer />
          <ThemeSwitcher />
          <Link
            href="/perfil"
            aria-label={isAuthenticated ? `Mi Perfil (${profileLabel})` : "Mi Perfil"}
            aria-current={isPerfilActive ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition-colors sm:px-2.5",
              isPerfilActive
                ? "border-gold-400 bg-gold-500/20 text-gold-400"
                : isAuthenticated
                  ? "border-gold-400/50 bg-pitch-900/80 text-gold-300 hover:border-gold-400 hover:bg-pitch-900"
                  : "border-white/20 bg-pitch-900/60 text-pitch-50 hover:border-white/35 hover:bg-pitch-900"
            )}
          >
            <UserCircle2 className="h-4 w-4 shrink-0" />
            <span className="hidden max-w-[8.5rem] truncate sm:inline">
              {profileLabel}
            </span>
          </Link>
          {canAccessAdmin && (
            <Link
              href="/admin"
              aria-label="Panel de Administración"
              aria-current={isAdminActive ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition-colors sm:px-3",
                isAdminActive
                  ? "border-leather-500 bg-leather-600 text-white"
                  : "border-white/20 bg-pitch-900/60 text-pitch-50 hover:border-white/35 hover:bg-pitch-900"
              )}
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
