"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Home, MessageSquare, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/partidos", label: "Partidos", icon: Trophy },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/blog", label: "Blog", icon: MessageSquare },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto grid max-w-5xl grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
                isActive
                  ? "text-pitch-800"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              {isActive && (
                <span className="absolute inset-x-3 top-0 h-[3px] bg-leather-600" />
              )}
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.4]")} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
