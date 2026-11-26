export default function AppLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Cargando contenido"
      className="space-y-4"
    >
      <span className="sr-only">Cargando sección de LOLONMEBOL...</span>

      {/* Matchday / page header strip skeleton */}
      <div className="pitch-chalk-surface rounded-lg border border-pitch-900 px-4 py-4">
        <div className="h-6 w-48 rounded-sm bg-white/15 motion-safe:animate-pulse" />
        <div className="mt-2 h-3.5 w-72 max-w-full rounded-sm bg-white/10 motion-safe:animate-pulse" />
      </div>

      {/* Flat dossier primary surface skeleton */}
      <div className="rounded-lg border border-rule bg-surface p-4">
        <div className="flex items-center gap-2 border-b border-rule pb-3">
          <div className="h-9 w-28 rounded-md bg-surface-subtle motion-safe:animate-pulse" />
          <div className="h-9 w-24 rounded-md bg-surface-subtle motion-safe:animate-pulse" />
          <div className="h-9 w-20 rounded-md bg-surface-subtle motion-safe:animate-pulse" />
        </div>

        <div className="mt-3 space-y-2.5">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 rounded-md border border-rule/60 bg-paper/50 px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded-sm bg-surface-subtle motion-safe:animate-pulse" />
                <div className="h-4 w-32 rounded-sm bg-surface-subtle motion-safe:animate-pulse sm:w-44" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-10 rounded-sm bg-surface-subtle motion-safe:animate-pulse" />
                <div className="h-4 w-10 rounded-sm bg-surface-subtle motion-safe:animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
