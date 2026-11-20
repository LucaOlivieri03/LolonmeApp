import { MessageSquare, Sparkles } from "lucide-react";

export default function BlogPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-pitch-700/15 bg-white p-6 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-pitch-50 text-pitch-700">
          <MessageSquare className="h-6 w-6" />
        </div>
        <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-gold-100 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-gold-700">
          <Sparkles className="h-3 w-3" />
          Fase 2 — Comunidad
        </span>
        <h1 className="mt-2 text-xl font-black text-navy-900">
          Blog de Jugadores LOLONMEBOL
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          En la Fase 2 se habilitará el foro global por tópicos donde los jugadores podrán debatir fechas, postular jugadas y comentar, con lectura pública para invitados y moderación del Admin.
        </p>
      </div>
    </div>
  );
}
