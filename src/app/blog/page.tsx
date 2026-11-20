import Link from "next/link";
import { ArrowRight, MessageSquare } from "lucide-react";

export default function BlogPage() {
  return (
    <div className="space-y-5">
      <header className="border-b border-rule pb-4">
        <h1 className="font-display flex items-center gap-2 text-3xl font-extrabold tracking-wide text-ink">
          <MessageSquare className="h-6 w-6 text-pitch-700" />
          Blog de Jugadores
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Foro global por tópicos · Previsto para Fase 2
        </p>
      </header>

      <section className="rounded-lg border border-rule bg-surface p-6">
        <div className="max-w-xl space-y-3">
          <h2 className="font-display text-xl font-bold tracking-wide text-pitch-800">
            Vestuario abierto próximamente
          </h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            En la Fase 2 se habilitará el espacio global por tópicos para debatir fechas, postular jugadas del partido y comentar entre jugadores, con lectura pública para invitados y moderación del Admin.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href="/partidos"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-pitch-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-900"
            >
              Ver historial de partidos
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/stats"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-rule bg-paper px-4 text-sm font-semibold text-ink transition-colors hover:border-rule-strong"
            >
              Explorar Lab Grupal
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
