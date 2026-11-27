import Link from "next/link";
import { FileSearch, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-12">
      <section className="w-full rounded-lg border border-rule bg-surface p-6 shadow-xs sm:p-8">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-pitch-700/25 bg-pitch-50 text-pitch-700">
            <FileSearch className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-leather-700">
              Error 404 · Expediente no encontrado
            </p>
            <h1 className="font-display mt-1 text-2xl font-extrabold tracking-wide text-ink sm:text-3xl">
              Esta página no figura en el boletín oficial
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              La dirección que intentaste abrir no existe o fue movida dentro
              del portal de LOLONMEBOL.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-rule pt-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-pitch-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-800"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Volver al inicio
          </Link>
        </div>
      </section>
    </div>
  );
}
