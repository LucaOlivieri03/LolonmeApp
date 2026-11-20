export default function HomePage() {
  return (
    <section className="pitch-stripes rounded-2xl p-6 text-white shadow-md">
      <div className="flex items-center gap-4">
        <img
          src="/assets/LogoLOLONMEBOL.svg"
          alt="LOLONMEBOL"
          className="h-16 w-16 shrink-0 rounded-xl bg-white/95 p-1.5 shadow-sm"
        />
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gold-400">
            Temporada Oficial
          </p>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            LOLONMEBOL Hub
          </h1>
          <p className="mt-1 text-sm text-white/90">
            Liga Anual, Tabla Histórica, Copa y Estadísticas en un solo lugar.
          </p>
        </div>
      </div>
    </section>
  );
}
