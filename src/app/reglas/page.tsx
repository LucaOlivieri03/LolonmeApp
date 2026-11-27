import type { ReactNode } from "react";
import Link from "next/link";
import { BarChart3, BookOpen, Star, Trophy } from "lucide-react";
import {
  ReglasInteractiveShell,
  type ReglasSectionKey,
  type ReglasSectionMeta,
} from "@/components/reglas/ReglasInteractiveShell";

const TIEBREAK_CRITERIA = [
  {
    rank: 1,
    title: "Mayor cantidad de Puntos (Pts)",
    detail: "Acumulado total de puntos en partidos computables para la tabla.",
  },
  {
    rank: 2,
    title: "Menor cantidad de Partidos Jugados (PJ)",
    detail:
      "A igualdad de puntos, prevalece quien los alcanzó en menos presentaciones.",
  },
  {
    rank: 3,
    title: "Historial directo entre ambos (V − D)",
    detail:
      "Balance neto de victorias menos derrotas enfrentándose en equipos rivales.",
  },
  {
    rank: 4,
    title: "Mayor porcentaje de victorias (PG%)",
    detail: "Proporción de triunfos sobre el total de partidos jugados en Liga.",
  },
  {
    rank: 5,
    title: "Mayor cantidad de MVPs",
    detail: "Total de distinciones oficiales como figura de la fecha.",
  },
  {
    rank: 6,
    title: "Orden alfabético",
    detail: "Criterio administrativo final por nombre oficial registrado.",
  },
];

const SECTIONS: ReglasSectionMeta[] = [
  {
    id: "estructura",
    label: "1. Estructura y competencias",
    shortLabel: "1. Estructura",
    title: "1. Estructura de la temporada y competencias",
  },
  {
    id: "puntajes",
    label: "2. Puntajes y desempates",
    shortLabel: "2. Puntajes",
    title: "2. Sistema de puntajes y criterios de desempate",
  },
  {
    id: "copa",
    label: "3. Formato Copa",
    shortLabel: "3. Copa",
    title: "3. Formato de la Copa",
  },
  {
    id: "lolonmebol",
    label: "4. LOLONMEBOL y estrellas",
    shortLabel: "4. Estrellas",
    title: "4. LOLONMEBOL y sistema de estrellas",
  },
  {
    id: "especiales",
    label: "5. Fechas especiales (F11)",
    shortLabel: "5. Especiales",
    title: "5. Fechas especiales y excepciones históricas",
  },
  {
    id: "rendimientos",
    label: "6. Rendimientos y estadísticas",
    shortLabel: "6. Stats y MVP",
    title: "6. Rendimientos, votación de MVP y estadísticas avanzadas",
  },
];

export default function ReglasPage() {
  const contents: Record<ReglasSectionKey, ReactNode> = {
    estructura: (
      <div className="space-y-4 p-4 sm:p-5">
        <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">
          Cada temporada anual (ej. 2025, 2026, 2027) se estructura en cuatro
          instancias oficiales con reglas de cómputo diferenciadas para la Tabla
          Anual, la Tabla Histórica y el registro estadístico individual.
        </p>

        <div>
          <p className="mb-1.5 text-right text-xs font-medium text-ink-muted sm:hidden">
            Deslizá la tabla →
          </p>
          <div className="overflow-x-auto border-y border-rule">
            <table className="w-full min-w-[540px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-rule bg-surface-subtle text-xs font-bold text-ink">
                  <th scope="col" className="px-3.5 py-2.5">Competencia / Evento</th>
                  <th scope="col" className="px-3.5 py-2.5">Descripción</th>
                  <th scope="col" className="px-3.5 py-2.5">Modalidad habitual</th>
                  <th scope="col" className="px-3.5 py-2.5">¿Suma en Tabla Anual?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule text-sm">
                <tr>
                  <td className="px-3.5 py-3 font-bold text-pitch-800">
                    Liga
                  </td>
                  <td className="px-3.5 py-3 text-ink">
                    Partidos semanales con equipos armados de forma rotativa
                    cada fecha. Puntaje individual.
                  </td>
                  <td className="px-3.5 py-3 font-semibold text-ink-muted">
                    F5 (base), F6 o F7
                  </td>
                  <td className="px-3.5 py-3 font-bold text-pitch-700">Sí</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-3 font-bold text-pitch-800">
                    Copa
                  </td>
                  <td className="px-3.5 py-3 text-ink">
                    Eliminación directa <strong>1 vs 1 entre capitanes</strong>{" "}
                    (ida y vuelta), disputada dentro de las fechas semanales.
                  </td>
                  <td className="px-3.5 py-3 font-semibold text-ink-muted">
                    F5 / F6 / F7
                  </td>
                  <td className="px-3.5 py-3 text-ink">
                    <strong className="text-pitch-700">
                      Sí, solo compañeros
                    </strong>{" "}
                    <span className="text-xs text-ink-muted">
                      (capitanes no suman)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-3.5 py-3 font-bold text-pitch-800">
                    LOLONMEBOL
                  </td>
                  <td className="px-3.5 py-3 text-ink">
                    Supercopa anual entre el <strong>Campeón de Liga</strong> y
                    el <strong>Campeón de Copa</strong>, disputada con la tabla
                    ya cerrada.
                  </td>
                  <td className="px-3.5 py-3 font-semibold text-ink-muted">
                    Partido definitorio
                  </td>
                  <td className="px-3.5 py-3 font-semibold text-ink-muted">
                    No <span className="text-xs">(tabla ya cerrada)</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-3.5 py-3 font-bold text-pitch-800">
                    Fechas especiales
                  </td>
                  <td className="px-3.5 py-3 text-ink">
                    Eventos conmemorativos (ej. <em>F11 Aniversario</em>,{" "}
                    <em>F11 Oktubre</em>, <em>F11 Despedida</em>), descansos y
                    fechas aplazadas.
                  </td>
                  <td className="px-3.5 py-3 font-semibold text-ink-muted">
                    F11 u otros
                  </td>
                  <td className="px-3.5 py-3 font-semibold text-ink-muted">
                    No{" "}
                    <span className="text-xs">
                      (salvo F11 Aniversario 2025)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ),
    puntajes: (
      <div className="space-y-6 p-4 sm:p-5">
        <div className="space-y-3">
          <h3 className="font-display text-lg font-bold tracking-wide text-pitch-800">
            Tabla de Puntos por Resultado y Rol
          </h3>
          <div>
            <p className="mb-1.5 text-right text-xs font-medium text-ink-muted sm:hidden">
              Deslizá la tabla →
            </p>
            <div className="overflow-x-auto border-y border-rule">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-rule bg-surface-subtle text-xs font-bold text-ink">
                    <th scope="col" className="px-3.5 py-2.5">Tipo de partido</th>
                    <th scope="col" className="px-3.5 py-2.5">Rol del jugador</th>
                    <th scope="col" className="px-3.5 py-2.5 text-center">Victoria</th>
                    <th scope="col" className="px-3.5 py-2.5 text-center">Empate</th>
                    <th scope="col" className="px-3.5 py-2.5 text-center">Derrota</th>
                    <th scope="col" className="px-3.5 py-2.5 text-center">
                      ¿Suma PJ en Liga?
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule text-sm">
                  <tr>
                    <td className="px-3.5 py-2.5 font-bold text-ink">
                      Liga
                    </td>
                    <td className="px-3.5 py-2.5 text-ink-muted">
                      Cualquier jugador
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-display text-base font-extrabold text-pitch-700 tabular-nums">
                      3 pts
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-display text-base font-bold text-ink tabular-nums">
                      1 pt
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-display text-base font-semibold text-ink-muted tabular-nums">
                      0 pts
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-pitch-700">
                      Sí
                    </td>
                  </tr>
                  <tr className="bg-pitch-50/40">
                    <td className="px-3.5 py-2.5 font-bold text-pitch-800">
                      Copa
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-pitch-800">
                      Compañero de equipo
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-display text-base font-extrabold text-pitch-700 tabular-nums">
                      4 pts
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-display text-base font-bold text-pitch-700 tabular-nums">
                      2 pts
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-display text-base font-semibold text-ink-muted tabular-nums">
                      0 pts
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-pitch-700">
                      Sí
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-bold text-ink">
                      Copa
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-leather-700">
                      Capitán del cruce
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-display text-base font-semibold text-ink-muted tabular-nums">
                      0 pts
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-display text-base font-semibold text-ink-muted tabular-nums">
                      0 pts
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-display text-base font-semibold text-ink-muted tabular-nums">
                      0 pts
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-crimson-600">
                      No
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-bold text-ink">
                      LOLONMEBOL
                    </td>
                    <td className="px-3.5 py-2.5 text-ink-muted">
                      Cualquier jugador
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-display text-base font-semibold text-ink-muted tabular-nums">
                      0 pts
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-display text-base font-semibold text-ink-muted tabular-nums">
                      0 pts
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-display text-base font-semibold text-ink-muted tabular-nums">
                      0 pts
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-crimson-600">
                      No
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-bold text-ink">
                      Fecha Especial (F11)
                    </td>
                    <td className="px-3.5 py-2.5 text-ink-muted">
                      Cualquier jugador
                    </td>
                    <td className="px-3.5 py-2.5 text-center text-ink-muted">
                      —
                    </td>
                    <td className="px-3.5 py-2.5 text-center text-ink-muted">
                      —
                    </td>
                    <td className="px-3.5 py-2.5 text-center text-ink-muted">
                      —
                    </td>
                    <td className="px-3.5 py-2.5 text-center text-xs font-semibold text-ink-muted">
                      No (configurable)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-md bg-pitch-50 px-4 py-3 text-sm text-pitch-900">
            <strong>Regla de Copa (4 / 2 / 0):</strong> Los puntos extra para
            los compañeros existen para incentivar la asistencia y máxima
            competitividad durante las llaves de Copa. Los dos capitanes se
            juegan el pase de ronda y no suman puntos ni PJ en la tabla de Liga
            en ese encuentro.
          </div>
        </div>

        <div className="space-y-3 border-t border-rule pt-5">
          <h3 className="font-display text-lg font-bold tracking-wide text-pitch-800">
            Los 6 Criterios de Desempate (Tabla Anual e Histórica)
          </h3>
          <p className="text-sm text-ink-muted">
            Se aplican en orden estricto de prioridad para ordenar la Tabla
            Anual y la Tabla Histórica acumulada:
          </p>

          <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {TIEBREAK_CRITERIA.map((item) => (
              <li
                key={item.rank}
                className="flex gap-3 rounded-md bg-paper p-3"
              >
                <span className="font-display flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-pitch-800 text-sm font-extrabold text-white">
                  {item.rank}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-bold text-ink">{item.title}</p>
                  <p className="text-xs leading-relaxed text-ink-muted">
                    {item.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-md bg-gold-50 p-4 text-sm text-ink">
          <p className="font-display text-base font-extrabold tracking-wide text-gold-700">
            Excepción por el 1.° puesto de la Liga (Partido Desempate)
          </p>
          <p className="mt-1 leading-relaxed text-ink">
            Si al finalizar el año existe{" "}
            <strong>empate en puntos entre el 1.° y el 2.° puesto</strong>, se
            desestiman todos los criterios automáticos anteriores y se disputa
            un <strong>partido desempate definitorio</strong> con el mismo
            formato de elección de equipos que la Copa (ej.{" "}
            <em>Pipo vs. Franchini, Fecha 45 de la Liga 2025</em>). Este
            encuentro cuenta como un partido más de Liga.
          </p>
        </div>
      </div>
    ),
    copa: (
      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2.5 rounded-md bg-paper p-4">
            <h3 className="font-display text-lg font-bold tracking-wide text-pitch-800">
              Clasificación al Corte (9 Jugadores)
            </h3>
            <ul className="space-y-2 text-sm leading-relaxed text-ink">
              <li>
                <strong>Momento de corte:</strong> A mitad de año (primera
                semana de julio, configurable en cada temporada).
              </li>
              <li>
                <strong>2 Cupos automáticos:</strong> Los{" "}
                <strong>2 finalistas de la LOLONMEBOL anterior</strong>{" "}
                clasifican siempre.
              </li>
              <li>
                <strong>7 Cupos por Tabla Anual:</strong> Los mejores 7 ubicados
                en la Tabla Anual al momento del corte.
              </li>
              <li>
                <strong>Liberación de cupos:</strong> Si uno o ambos finalistas
                anteriores ya están dentro del Top 7 al corte, liberan su cupo a
                los siguientes mejores ubicados en la tabla hasta completar los{" "}
                <strong>9 clasificados</strong>.
              </li>
            </ul>
          </div>

          <div className="space-y-2.5 rounded-md bg-paper p-4">
            <h3 className="font-display text-lg font-bold tracking-wide text-pitch-800">
              Distribución y Cuadro de Llaves (Ida y Vuelta)
            </h3>
            <ul className="space-y-2 text-sm leading-relaxed text-ink">
              <li>
                <strong>Fase Previa (2 jugadores):</strong> La disputan los{" "}
                <strong>
                  2 últimos clasificados de la tabla que NO sean los 2
                  finalistas de la LOLONMEBOL anterior
                </strong>
                .
              </li>
              <li>
                <strong>
                  Cuartos de Final (7 directos + Ganador Fase Previa):
                </strong>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 font-display text-sm font-bold text-pitch-800">
                  <span className="rounded-sm bg-surface px-2.5 py-1">
                    1.° vs Ganador Fase Previa
                  </span>
                  <span className="rounded-sm bg-surface px-2.5 py-1">
                    2.° vs 7.°
                  </span>
                  <span className="rounded-sm bg-surface px-2.5 py-1">
                    3.° vs 6.°
                  </span>
                  <span className="rounded-sm bg-surface px-2.5 py-1">
                    4.° vs 5.°
                  </span>
                </div>
              </li>
              <li>
                <strong>Semifinales y Final:</strong> Series a ida y vuelta
                definidas por marcador global de goles.
              </li>
            </ul>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md bg-pitch-50 p-4 text-sm text-pitch-900">
            <h4 className="font-display text-base font-extrabold tracking-wide text-pitch-800">
              Desempate por Ventaja Deportiva
            </h4>
            <p className="mt-1 leading-relaxed">
              En caso de <strong>empate en el marcador global</strong> tras los
              partidos de ida y vuelta en cualquier llave, avanza el capitán con{" "}
              <strong>
                mejor ubicación en la Tabla Anual al comenzar la Copa
              </strong>
              .
            </p>
          </div>

          <div className="rounded-md bg-leather-50 p-4 text-sm text-ink">
            <h4 className="font-display text-base font-extrabold tracking-wide text-leather-700">
              Casos Especiales: Bajas por Lesión y Reemplazos
            </h4>
            <ul className="mt-1 space-y-1 leading-relaxed">
              <li>
                • <strong>Antes de iniciar la Copa:</strong> Ingresa el
                siguiente mejor ubicado en la Tabla Anual al corte.
              </li>
              <li>
                • <strong>Con la Copa ya iniciada (ej. Semifinales):</strong>{" "}
                Ocupa la plaza vacante el{" "}
                <strong>
                  rival eliminado en la instancia inmediatamente anterior
                  (Cuartos)
                </strong>{" "}
                (ej. <em>Copa 2026: baja de Porpo por lesión → reingresó Pedro</em>
                ).
              </li>
            </ul>
          </div>
        </div>
      </div>
    ),
    lolonmebol: (
      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-md bg-paper p-4">
            <h3 className="font-display text-lg font-bold tracking-wide text-pitch-800">
              Supercopa Anual: LOLONMEBOL
            </h3>
            <ul className="space-y-2 text-sm leading-relaxed text-ink">
              <li>
                <strong>Protagonistas:</strong> Se enfrentan el{" "}
                <strong>Campeón de la Liga</strong> contra el{" "}
                <strong>Campeón de la Copa</strong>.
              </li>
              <li>
                <strong>Bicampeón Liga + Copa:</strong> Si un mismo jugador
                conquista tanto la Liga como la Copa en la misma temporada,
                disputa la LOLONMEBOL frente al{" "}
                <strong>Subcampeón de la Liga</strong>.
              </li>
              <li>
                <strong>Efecto en tablas:</strong> Se juega con la Liga anual ya
                cerrada; no suma puntos ni PJ para la Tabla Anual, pero otorga
                título oficial y estrella dorada.
              </li>
            </ul>
          </div>

          <div className="space-y-2 rounded-md bg-gold-50 p-4">
            <h3 className="font-display text-lg font-bold tracking-wide text-gold-700">
              Palmarés Oficial y Estrellas (
              <Star
                className="inline h-3.5 w-3.5 fill-gold-500 text-gold-500 align-[-2px]"
                aria-hidden="true"
              />
              )
            </h3>
            <p className="text-sm leading-relaxed text-ink">
              Cada jugador suma{" "}
              <strong>
                1 estrella oficial (
                <Star
                  className="inline h-3.5 w-3.5 fill-gold-500 text-gold-500 align-[-2px]"
                  aria-hidden="true"
                />
                )
              </strong>{" "}
              en su escudo e historial por cada título conquistado en cualquiera
              de las tres competencias mayores:
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="rounded-sm bg-surface p-2">
                <span className="font-display block text-base font-extrabold text-gold-700">
                  <Star
                    className="inline h-3.5 w-3.5 fill-gold-500 text-gold-500 align-[-2px]"
                    aria-hidden="true"
                  />{" "}
                  Liga
                </span>
                <span className="text-[11px] text-ink-muted">
                  Campeón anual
                </span>
              </div>
              <div className="rounded-sm bg-surface p-2">
                <span className="font-display block text-base font-extrabold text-gold-700">
                  <Star
                    className="inline h-3.5 w-3.5 fill-gold-500 text-gold-500 align-[-2px]"
                    aria-hidden="true"
                  />{" "}
                  Copa
                </span>
                <span className="text-[11px] text-ink-muted">
                  Campeón llaves
                </span>
              </div>
              <div className="rounded-sm bg-surface p-2">
                <span className="font-display block text-base font-extrabold text-gold-700">
                  <Star
                    className="inline h-3.5 w-3.5 fill-gold-500 text-gold-500 align-[-2px]"
                    aria-hidden="true"
                  />{" "}
                  LOLONMEBOL
                </span>
                <span className="text-[11px] text-ink-muted">
                  Supercopa final
                </span>
              </div>
            </div>
            <p className="pt-1 text-xs text-ink-muted">
              Referencia histórica validada:{" "}
              <strong>B. Aguzzi (3 títulos)</strong> = Copa 2025 + LOLONMEBOL
              2025 + Liga 2026; <strong>Pipo (1 título)</strong> = Liga 2025.
            </p>
          </div>
        </div>
      </div>
    ),
    especiales: (
      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-md bg-paper p-4">
            <h3 className="font-display text-lg font-bold tracking-wide text-pitch-800">
              Regla General para Fechas especiales (F11)
            </h3>
            <p className="text-sm leading-relaxed text-ink">
              Los encuentros conmemorativos de cancha grande (como{" "}
              <em>F11 Oktubre</em> o <em>F11 Despedida de Año</em>) forman parte
              del calendario oficial de la temporada:
            </p>
            <ul className="space-y-1.5 text-sm text-ink">
              <li>
                • <strong>No suman puntos ni PJ</strong> en la Tabla Anual ni en
                la Tabla Histórica de Liga (no suman en Tabla Anual).
              </li>
              <li>
                • <strong>No suman en estadísticas oficiales de Liga/Copa</strong>{" "}
                por defecto, para no alterar Química, Consistencia ni Historial
                con amistosos de cancha grande (configurable por partido desde
                Admin).
              </li>
            </ul>
          </div>

          <div className="space-y-2 rounded-md bg-leather-50 p-4">
            <h3 className="font-display text-lg font-bold tracking-wide text-leather-700">
              Excepción Histórica: F11 Aniversario 2025
            </h3>
            <p className="text-sm leading-relaxed text-ink">
              Por resolución oficial de la primera temporada, el partido{" "}
              <strong>F11 Aniversario 2025</strong> (Fecha 20 de la temporada
              2025) es la única fecha especial F11 que{" "}
              <strong>
                sí otorgó puntos oficiales para la Tabla Anual 2025 y la Tabla
                Histórica
              </strong>
              .
            </p>
            <p className="text-xs leading-relaxed text-ink-muted">
              El registro del torneo respeta esta excepción por configuración
              individual de partido (habilitado para sumar en Tabla Anual),
              permitiendo auditar cada temporada sin alterar el archivo
              histórico.
            </p>
          </div>
        </div>
      </div>
    ),
    rendimientos: (
      <div className="space-y-6 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-md bg-paper p-4">
            <h3 className="font-display text-lg font-bold tracking-wide text-pitch-800">
              Planilla de Rendimientos y Calificaciones (1 a 10)
            </h3>
            <ul className="space-y-2 text-sm leading-relaxed text-ink">
              <li>
                <strong>Producción ofensiva:</strong> Se registran{" "}
                <strong>Goles (G)</strong>, <strong>Asistencias (A)</strong> y{" "}
                <strong>Participaciones totales (G/A = G + A)</strong> en cada
                fecha.
              </li>
              <li>
                <strong>Calificaciones (escala 1 a 10):</strong> Notas numéricas
                con decimales por partido, que alimentan tanto el{" "}
                <strong>Promedio de Calificación</strong> como el acumulado
                anual.
              </li>
              <li>
                <strong>Votación de MVP y notas:</strong> Votan únicamente los
                jugadores que participaron en ese partido. El resultado es
                transparente y el Admin cierra el escrutinio (contando con
                facultad de ajuste o MVP compartido en casos excepcionales).
              </li>
            </ul>
          </div>

          <div className="space-y-2 rounded-md bg-paper p-4">
            <h3 className="font-display text-lg font-bold tracking-wide text-pitch-800">
              Impacto de los Capitanes de Copa en Estadísticas
            </h3>
            <p className="text-xs text-ink-muted">
              Aunque los dos capitanes de una llave de Copa no suman puntos ni
              PJ en la tabla de Liga durante su cruce, toda su actuación
              individual sí cuenta para el laboratorio estadístico:
            </p>
            <div className="overflow-x-auto rounded-sm bg-surface">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-rule bg-surface-subtle font-bold text-ink">
                    <th scope="col" className="px-3 py-2">Métrica registrada</th>
                    <th scope="col" className="px-3 py-2 text-center">
                      ¿Cuenta para el Capitán?
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  <tr>
                    <td className="px-3 py-2 font-semibold text-ink">
                      Pts y PJ en Tabla de Liga
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-crimson-600">
                      No
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-semibold text-ink">
                      Goles (G), Asistencias (A) y Calificación
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-pitch-700">
                      Sí
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-semibold text-ink">
                      MVP de la fecha
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-pitch-700">
                      Sí
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-semibold text-ink">
                      PJ Totales, Química, Wilson CT% e Historial
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-pitch-700">
                      Sí
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-rule pt-5">
          <h3 className="font-display text-lg font-bold tracking-wide text-pitch-800">
            Fórmulas del Laboratorio Estadístico (Química, Consistencia e
            Historial)
          </h3>
          <p className="text-sm text-ink-muted">
            Todas las métricas pueden consultarse filtradas por temporada y por
            modalidad de cancha (F5, F6, F7 o Todas) en la sección{" "}
            <Link
              href="/stats"
              className="font-semibold text-pitch-700 underline"
            >
              Stats / Lab Grupal
            </Link>
            .
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 rounded-md bg-paper p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display text-base font-extrabold text-pitch-800">
                  1. Química de Dupla (%)
                </h4>
                <code className="rounded-sm bg-surface px-2 py-0.5 text-xs font-bold text-pitch-800">
                  (V / PJ) × 100
                </code>
              </div>
              <p className="text-xs leading-relaxed text-ink-muted">
                Porcentaje puro de victorias compartiendo el mismo equipo. Los
                empates suman en Partidos Jugados (
                <code className="text-ink">PJ</code>), pero no en victorias (
                <code className="text-ink">V</code>). En los rankings de mejores
                y peores socios se exige un mínimo de 3 PJ juntos.
              </p>
            </div>

            <div className="space-y-1.5 rounded-md bg-paper p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display text-base font-extrabold text-pitch-800">
                  2. Consistencia (Wilson CT%)
                </h4>
                <code className="rounded-sm bg-surface px-2 py-0.5 text-xs font-bold text-pitch-800">
                  Wilson z = 1.28 (80%)
                </code>
              </div>
              <p className="text-xs leading-relaxed text-ink-muted">
                Límite inferior del intervalo de confianza de Wilson al 80% (
                <code className="text-ink">z = 1.28</code>). Modera porcentajes
                inflados por muestras chicas (ej. un 100% en 1 solo partido) y
                premia a las duplas que sostienen un alto porcentaje de
                victorias a lo largo de muchas fechas.
              </p>
            </div>

            <div className="space-y-1.5 rounded-md bg-paper p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display text-base font-extrabold text-pitch-800">
                  3. Efectividad Unificada (3 / 1 / 0)
                </h4>
                <code className="rounded-sm bg-surface px-2 py-0.5 text-xs font-bold text-pitch-800">
                  ((V×3 + E) / (PJ×3)) × 100
                </code>
              </div>
              <p className="text-xs leading-relaxed text-ink-muted">
                Métrica complementaria seleccionable en el Lab Grupal que
                pondera los empates como 1 punto sobre 3 posibles, homologando
                todos los partidos (Liga, Copa o F11) bajo la escala estándar
                3/1/0.
              </p>
            </div>

            <div className="space-y-1.5 rounded-md bg-paper p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display text-base font-extrabold text-pitch-800">
                  4. Historial Mano a Mano (V − D)
                </h4>
                <code className="rounded-sm bg-surface px-2 py-0.5 text-xs font-bold text-pitch-800">
                  Victorias − Derrotas
                </code>
              </div>
              <p className="text-xs leading-relaxed text-ink-muted">
                Balance neto cuando dos jugadores se enfrentan en equipos
                rivales (<code className="text-ink">+1</code> por triunfo,{" "}
                <code className="text-ink">-1</code> por derrota,{" "}
                <code className="text-ink">0</code> por empate). Funciona además
                como el 3.° criterio oficial de desempate en la Tabla Anual.
              </p>
            </div>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <header className="pitch-chalk-surface overflow-hidden rounded-lg border border-pitch-900 text-paper">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
          <div className="space-y-1">
            <h1 className="font-display flex items-center gap-2.5 text-2xl font-extrabold tracking-wide text-white sm:text-3xl">
              <BookOpen className="h-6 w-6 shrink-0 text-gold-400" />
              Reglamento Oficial · LOLONMEBOL
            </h1>
            <p className="max-w-2xl text-sm text-pitch-100">
              Especificación deportiva oficial para la Liga, Copa,
              LOLONMEBOL, criterios de desempate y cálculo de estadísticas
              avanzadas.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href="/stats"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-white/20 bg-pitch-900/60 px-3 text-xs font-semibold text-pitch-50 transition-colors hover:border-gold-400/60 hover:bg-pitch-900"
            >
              <BarChart3 className="h-3.5 w-3.5 text-gold-400" />
              Ver Lab Grupal
            </Link>
            <Link
              href="/partidos"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-white/20 bg-pitch-900/60 px-3 text-xs font-semibold text-pitch-50 transition-colors hover:border-gold-400/60 hover:bg-pitch-900"
            >
              <Trophy className="h-3.5 w-3.5 text-gold-400" />
              Ver Partidos
            </Link>
          </div>
        </div>
      </header>

      <ReglasInteractiveShell sections={SECTIONS} contents={contents} />
    </div>
  );
}
