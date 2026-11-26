"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Shield, UserCircle2 } from "lucide-react";
import type { PlayerRole } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { AnthemPlayer } from "./AnthemPlayer";
import { ThemeSwitcher } from "./ThemeSwitcher";

function NavLinkPendingIndicator() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-2 bottom-0 h-1 bg-gold-400 motion-safe:animate-pulse"
    />
  );
}

function ActionLinkPendingDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400 motion-safe:animate-pulse"
    />
  );
}

const DESKTOP_NAV = [
  { href: "/", label: "Inicio", soon: false },
  { href: "/partidos", label: "Partidos", soon: false },
  { href: "/stats", label: "Stats", soon: false },
  { href: "/calendario", label: "Calendario", soon: false },
  { href: "/reglas", label: "Reglas", soon: false },
  { href: "/blog", label: "Blog", soon: true },
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
      <div className="mx-auto flex h-15 max-w-7xl items-center justify-between gap-2 px-3 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3 lg:gap-5 xl:gap-6">
          <Link
            href="/"
            className="group flex min-h-11 shrink-0 items-center gap-1.5 rounded-md focus-visible:outline-gold-400 sm:gap-2"
          >
            <img
              src="/assets/Logo.svg"
              alt="Escudo oficial LOLONMEBOL"
              width={36}
              height={36}
              className="h-7 w-7 shrink-0 object-contain transition-transform duration-200 group-hover:scale-105 sm:h-9 sm:w-9"
            />
            <span className="font-display whitespace-nowrap text-lg font-extrabold tracking-wide text-white sm:text-xl lg:text-2xl">
              LOLONMEBOL
            </span>
          </Link>

          <nav
            aria-label="Navegación de escritorio"
            className="hidden items-center gap-0.5 md:flex lg:gap-1"
          >
            {DESKTOP_NAV.map(({ href, label, soon }) => {
              const isActive =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-15 items-center gap-1 whitespace-nowrap px-2 text-sm font-semibold transition-colors lg:px-2.5 xl:px-3",
                    isActive
                      ? "text-white"
                      : "text-pitch-100/80 hover:text-white"
                  )}
                >
                  <span>{label}</span>
                  {soon && (
                    <span className="rounded-sm border border-gold-400/40 bg-pitch-900/80 px-1 py-px text-[9px] font-bold tracking-wider text-gold-400 uppercase">
                      Pronto
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute inset-x-2 bottom-0 h-1 bg-leather-500" />
                  )}
                  <NavLinkPendingIndicator />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 lg:gap-2">
          <AnthemPlayer />
          <ThemeSwitcher />
          <Link
            href="/perfil"
            title={isAuthenticated ? `Mi Perfil (${profileLabel})` : "Mi Perfil"}
            aria-label={isAuthenticated ? `Mi Perfil (${profileLabel})` : "Mi Perfil"}
            aria-current={isPerfilActive ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition-colors lg:px-2.5",
              isPerfilActive
                ? "border-gold-400 bg-gold-500/20 text-gold-400"
                : isAuthenticated
                  ? "border-gold-400/50 bg-pitch-900/80 text-gold-400 hover:border-gold-400 hover:bg-pitch-900"
                  : "border-white/20 bg-pitch-900/60 text-pitch-50 hover:border-white/35 hover:bg-pitch-900"
            )}
          >
            <UserCircle2 className="h-4 w-4 shrink-0" />
            <span className="hidden max-w-[6.5rem] truncate lg:inline xl:max-w-[8.5rem]">
              {profileLabel}
            </span>
            <ActionLinkPendingDot />
          </Link>
          {canAccessAdmin && (
            <Link
              href="/admin"
              title="Panel de Administración"
              aria-label="Panel de Administración"
              aria-current={isAdminActive ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition-colors lg:px-2.5 xl:px-3",
                isAdminActive
                  ? "border-leather-500 bg-leather-600 text-white"
                  : "border-white/20 bg-pitch-900/60 text-pitch-50 hover:border-white/35 hover:bg-pitch-900"
              )}
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span className="hidden lg:inline">Admin</span>
              <ActionLinkPendingDot />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
