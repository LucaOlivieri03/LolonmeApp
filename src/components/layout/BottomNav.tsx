"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Home, MessageSquare, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/partidos", label: "Partidos", icon: Trophy },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/blog", label: "Blog", icon: MessageSquare },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-pitch-700/15 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <div className="mx-auto grid max-w-5xl grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition-colors",
                isActive
                  ? "text-pitch-700"
                  : "text-slate-500 hover:text-navy-800"
              )}
            >
              {isActive && (
                <span className="absolute top-0 h-0.5 w-10 rounded-full bg-pitch-700" />
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
