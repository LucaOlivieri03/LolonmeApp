"use client";

import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorBoundaryProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-12">
      <section
        role="alert"
        className="w-full rounded-lg border border-rule bg-surface p-6 shadow-xs sm:p-8"
      >
        <div className="flex items-start gap-3">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-leather-700/25 bg-leather-50 text-leather-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-leather-700">
              Incidencia en el acta · LOLONMEBOL
            </p>
            <h1 className="font-display mt-1 text-2xl font-extrabold tracking-wide text-ink sm:text-3xl">
              No pudimos cargar esta sección
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Ocurrió un error inesperado al consultar los registros oficiales.
              Podés reintentar la carga o volver a la portada del campeonato.
            </p>
            {error.digest && (
              <p className="mt-2 font-mono text-xs text-ink-muted">
                Código de referencia: {error.digest}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-rule pt-4">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-pitch-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-800"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-rule bg-paper px-4 text-sm font-semibold text-ink transition-colors hover:border-rule-strong"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Volver al inicio
          </Link>
        </div>
      </section>
    </div>
  );
}
