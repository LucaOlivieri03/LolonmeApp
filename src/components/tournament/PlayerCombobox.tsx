"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlayerComboboxOption {
  id: string;
  displayName: string;
  position?: number;
  points?: number;
  pj?: number;
  stars?: number;
  subtitle?: string;
}

interface PlayerComboboxProps {
  options: PlayerComboboxOption[];
  value: string;
  onChange: (playerId: string) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}

function normalizeSearchText(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function PlayerCombobox({
  options,
  value,
  onChange,
  label,
  placeholder = "Seleccionar jugador...",
  searchPlaceholder = "Buscar jugador...",
  emptyMessage = "No se encontraron jugadores",
  className,
}: PlayerComboboxProps) {
  const listboxId = useId();
  const labelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedOption = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = normalizeSearchText(query);
    if (!q) return options;
    return options.filter((o) =>
      normalizeSearchText(o.displayName).includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;
    const currentIdx = filteredOptions.findIndex((o) => o.id === value);
    setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(timer);
  }, [isOpen, filteredOptions, value]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setQuery("");
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredOptions.length === 0 ? 0 : (prev + 1) % filteredOptions.length
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredOptions.length === 0
          ? 0
          : (prev - 1 + filteredOptions.length) % filteredOptions.length
      );
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredOptions[highlightedIndex];
      if (target) {
        handleSelect(target.id);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={cn("relative w-full", className)}
    >
      {label && (
        <label
          id={labelId}
          className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted"
        >
          {label}
        </label>
      )}

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-labelledby={label ? labelId : undefined}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2.5 rounded-md border px-3.5 py-2 text-left transition-colors",
          isOpen
            ? "border-pitch-800 bg-surface ring-2 ring-pitch-800/15"
            : "border-rule bg-paper hover:border-rule-strong"
        )}
      >
        {selectedOption ? (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {typeof selectedOption.position === "number" && (
                <span className="font-display inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-sm bg-pitch-800 px-1.5 text-xs font-extrabold text-white">
                  #{selectedOption.position}
                </span>
              )}
              <span className="truncate text-base font-bold text-ink sm:text-sm">
                {selectedOption.displayName}
              </span>
              {(selectedOption.stars ?? 0) > 0 && (
                <span className="inline-flex shrink-0 items-center gap-0.5">
                  {Array.from({ length: selectedOption.stars ?? 0 }).map(
                    (_, i) => (
                      <Star
                        key={i}
                        className="h-3.5 w-3.5 fill-gold-500 text-gold-600"
                      />
                    )
                  )}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {typeof selectedOption.points === "number" && (
                <span className="font-display rounded-sm border border-pitch-200 bg-pitch-50 px-2 py-0.5 text-xs font-extrabold text-pitch-800">
                  {selectedOption.points} pts
                </span>
              )}
              {typeof selectedOption.pj === "number" && (
                <span className="hidden rounded-sm bg-surface-subtle px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted xs:inline-block">
                  {selectedOption.pj} PJ
                </span>
              )}
              {selectedOption.subtitle && (
                <span className="text-xs font-semibold text-ink-muted">
                  {selectedOption.subtitle}
                </span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-sm font-medium text-ink-muted">
            {placeholder}
          </span>
        )}

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-ink-muted transition-transform",
            isOpen && "rotate-180 text-pitch-800"
          )}
        />
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop for bottom-sheet comfort */}
          <div
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-ink/45 sm:hidden"
          />

          <div
            className={cn(
              "z-50 flex flex-col overflow-hidden border border-rule bg-surface shadow-xl",
              "fixed inset-x-0 bottom-0 max-h-[78vh] rounded-t-xl pb-[env(safe-area-inset-bottom)]",
              "sm:absolute sm:inset-x-0 sm:top-full sm:bottom-auto sm:mt-1.5 sm:max-h-80 sm:rounded-lg sm:pb-0"
            )}
          >
            {/* Mobile Sheet Header + Search Bar */}
            <div className="border-b border-rule bg-surface-subtle p-2.5">
              <div className="mb-2 flex items-center justify-between sm:hidden">
                <span className="font-display text-sm font-bold uppercase tracking-wider text-ink">
                  {label ?? "Seleccionar Jugador"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Cerrar selector"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rule bg-surface text-ink-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="min-h-10 w-full rounded-md border border-rule bg-paper pr-8 pl-9 text-base text-ink placeholder:text-ink-muted focus:border-pitch-800 focus:outline-none sm:text-sm"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Limpiar búsqueda"
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-muted hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Options Listbox */}
            <ul
              id={listboxId}
              role="listbox"
              aria-label={label ?? "Lista de jugadores"}
              className="divide-y divide-rule/70 overflow-y-auto overscroll-contain p-1"
            >
              {filteredOptions.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-ink-muted">
                  {emptyMessage}
                </li>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.id === value;
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <li
                      key={opt.id}
                      id={`${listboxId}-opt-${opt.id}`}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => handleSelect(opt.id)}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                        isSelected
                          ? "bg-pitch-800 text-white"
                          : isHighlighted
                            ? "bg-pitch-50 text-ink"
                            : "text-ink hover:bg-surface-subtle"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {typeof opt.position === "number" && (
                          <span
                            className={cn(
                              "font-display inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-sm px-1 text-xs font-extrabold",
                              isSelected
                                ? "bg-gold-400 text-ink"
                                : opt.position === 1
                                  ? "bg-gold-500 text-ink"
                                  : "bg-surface-subtle text-ink-muted"
                            )}
                          >
                            #{opt.position}
                          </span>
                        )}
                        <span className="truncate font-bold">
                          {opt.displayName}
                        </span>
                        {(opt.stars ?? 0) > 0 && (
                          <span className="inline-flex shrink-0 items-center gap-0.5">
                            {Array.from({ length: opt.stars ?? 0 }).map(
                              (_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    "h-3.5 w-3.5",
                                    isSelected
                                      ? "fill-gold-400 text-gold-400"
                                      : "fill-gold-500 text-gold-600"
                                  )}
                                />
                              )
                            )}
                          </span>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {typeof opt.points === "number" && (
                          <span
                            className={cn(
                              "font-display rounded-sm px-2 py-0.5 text-xs font-extrabold",
                              isSelected
                                ? "bg-pitch-900 text-gold-400"
                                : "border border-pitch-200 bg-pitch-50 text-pitch-800"
                            )}
                          >
                            {opt.points} pts
                          </span>
                        )}
                        {typeof opt.pj === "number" && (
                          <span
                            className={cn(
                              "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
                              isSelected
                                ? "bg-pitch-900/70 text-pitch-100"
                                : "bg-surface-subtle text-ink-muted"
                            )}
                          >
                            {opt.pj} PJ
                          </span>
                        )}
                        {opt.subtitle && (
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              isSelected ? "text-pitch-100" : "text-ink-muted"
                            )}
                          >
                            {opt.subtitle}
                          </span>
                        )}
                        {isSelected && (
                          <Check className="h-4 w-4 shrink-0 text-gold-400" />
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
