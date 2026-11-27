"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemeKey = "estadio" | "salvia" | "diario";

const THEMES: Array<{
  key: ThemeKey;
  label: string;
  description: string;
  swatch: string;
  accent: string;
}> = [
  {
    key: "estadio",
    label: "Estadio",
    description: "Noche de cancha",
    swatch: "#0b1410",
    accent: "#57c98a",
  },
  {
    key: "salvia",
    label: "Salvia",
    description: "Césped y marfil",
    swatch: "#dce6df",
    accent: "#0a4a28",
  },
  {
    key: "diario",
    label: "Diario",
    description: "Papel deportivo",
    swatch: "#e6e0d0",
    accent: "#c86e0e",
  },
];

const VALID_THEMES = new Set<string>(THEMES.map((t) => t.key));
const THEME_COOKIE = "lolonme-theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readThemeCookie(): ThemeKey | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${THEME_COOKIE}=`));
  const value = match?.split("=")[1];
  return value && VALID_THEMES.has(value) ? (value as ThemeKey) : null;
}

function applyTheme(theme: ThemeKey) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

export interface ThemeSwitcherProps {
  initialTheme?: ThemeKey;
}

export function ThemeSwitcher({
  initialTheme = "estadio",
}: ThemeSwitcherProps) {
  const [active, setActive] = useState<ThemeKey>(initialTheme);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("theme");
    const currentAttr = document.documentElement.dataset.theme;
    const fromCookie = readThemeCookie();

    let resolved: ThemeKey = initialTheme;
    if (param && VALID_THEMES.has(param)) {
      resolved = param as ThemeKey;
    } else if (fromCookie) {
      resolved = fromCookie;
    } else if (currentAttr && VALID_THEMES.has(currentAttr)) {
      resolved = currentAttr as ThemeKey;
    }

    if (resolved !== initialTheme) {
      setActive(resolved);
    }
    if (
      document.documentElement.dataset.theme !== resolved ||
      fromCookie !== resolved
    ) {
      applyTheme(resolved);
    }
  }, [initialTheme]);

  useEffect(() => {
    if (!open) return;

    const activeIdx = Math.max(
      0,
      THEMES.findIndex((t) => t.key === active)
    );
    itemRefs.current[activeIdx]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Home" ||
        event.key === "End"
      ) {
        event.preventDefault();
        const focusedIdx = itemRefs.current.findIndex(
          (el) => el === document.activeElement
        );
        let nextIdx = focusedIdx >= 0 ? focusedIdx : activeIdx;
        if (event.key === "ArrowDown") {
          nextIdx = (nextIdx + 1) % THEMES.length;
        } else if (event.key === "ArrowUp") {
          nextIdx = (nextIdx - 1 + THEMES.length) % THEMES.length;
        } else if (event.key === "Home") {
          nextIdx = 0;
        } else if (event.key === "End") {
          nextIdx = THEMES.length - 1;
        }
        itemRefs.current[nextIdx]?.focus();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, active]);

  const handleSelect = (theme: ThemeKey) => {
    setActive(theme);
    applyTheme(theme);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const currentTheme = THEMES.find((t) => t.key === active) ?? THEMES[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Cambiar tema visual (actual: ${currentTheme.label})`}
        title={`Tema: ${currentTheme.label}`}
        className={cn(
          "inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition-colors",
          open
            ? "border-gold-400 bg-pitch-900 text-gold-400"
            : "border-white/20 bg-pitch-900/60 text-pitch-50 hover:border-white/35 hover:bg-pitch-900"
        )}
      >
        <Palette className="h-4 w-4 shrink-0" />
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-sm border border-white/40"
          style={{ backgroundColor: currentTheme.swatch }}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Seleccionar tema visual"
          className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-rule-strong bg-surface p-1.5 text-ink"
        >
          <p className="px-2.5 py-1.5 text-[11px] font-bold tracking-wider text-ink-muted uppercase">
            Tema visual
          </p>
          <div className="space-y-1">
            {THEMES.map((theme, idx) => {
              const isSelected = theme.key === active;
              return (
                <button
                  key={theme.key}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => handleSelect(theme.key)}
                  className={cn(
                    "flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors",
                    isSelected
                      ? "bg-pitch-50 text-ink"
                      : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-rule-strong"
                      style={{ backgroundColor: theme.swatch }}
                      aria-hidden="true"
                    >
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ backgroundColor: theme.accent }}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-ink">
                        {theme.label}
                      </span>
                      <span className="block truncate text-[11px] text-ink-muted">
                        {theme.description}
                      </span>
                    </span>
                  </span>
                  {isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-pitch-800" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
