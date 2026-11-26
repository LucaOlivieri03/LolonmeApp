"use client";

import {
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  HelpCircle,
  Star,
  Swords,
  User,
  Users,
  X,
} from "lucide-react";
import { PlayerCombobox } from "@/components/tournament/PlayerCombobox";
import type { MatchModality, Season } from "@/lib/types/domain";
import type {
  StatsActivePlayerOption,
  StatsCompetitionFilter,
  StatsLabSummary,
  StatsProfileSummary,
} from "@/lib/types/view-models";
import { cn } from "@/lib/utils";

const LabSubgroupChart = dynamic(
  () => import("./StatsCharts").then((m) => m.LabSubgroupChart),
  {
    ssr: false,
    loading: () => (
      <div className="mt-4 h-36 w-full animate-pulse rounded-md border border-rule bg-paper" />
    ),
  }
);

const TeammatesChart = dynamic(
  () => import("./StatsCharts").then((m) => m.TeammatesChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 w-full animate-pulse rounded-md border border-rule bg-paper" />
    ),
  }
);

const RivalsChart = dynamic(
  () => import("./StatsCharts").then((m) => m.RivalsChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 w-full animate-pulse rounded-md border border-rule bg-paper" />
    ),
  }
);

export type StatsTab = "player" | "lab";

type MetricKey =
  | "chemistry"
  | "wilson"
  | "effectiveness310"
  | "h2h"
  | "pgPct"
  | "avgRating"
  | "minThreshold";

interface MetricDefinition {
  key: MetricKey;
  title: string;
  description: string;
  formula: string;
  example: string;
}

const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  chemistry: {
    key: "chemistry",
    title: "Química (%)",
    description:
      "Porcentaje directo de victorias cuando los jugadores seleccionados comparten el mismo equipo.",
    formula: "Química (%) = (V / PJ) × 100",
    example:
      "Ejemplo: si dos jugadores compartieron equipo en 5 partidos y ganaron 4, su Química es (4 / 5) × 100 = 80,0%.",
  },
  wilson: {
    key: "wilson",
    title: "Consistencia (Wilson CT%)",
    description:
      "Índice de efectividad ajustado por tamaño de muestra que evita que rachas cortas (ej. 1 de 1) superen a duplas o grupos probados en muchos partidos.",
    formula:
      "Cota inferior de Wilson (z = 1.28, 80% de confianza): ((p + z²/(2n) − z · √(p(1−p)/n + z²/(4n²))) / (1 + z²/n)) × 100, con p = V / PJ y n = PJ",
    example:
      "Ejemplo: 1 victoria en 1 PJ (100% bruto) arroja Wilson CT% = 37,9%, mientras que 8 victorias en 10 PJ (80% bruto) alcanza Wilson CT% = 60,0%.",
  },
  effectiveness310: {
    key: "effectiveness310",
    title: "Efectividad (Liga 3/1/0 · Copa 4/2/0)",
    description:
      "Porcentaje de puntos obtenidos sobre el máximo posible: Liga y LOLONMEBOL puntúan 3/1/0, y Copa puntúa 4/2/0 (contando igual para los capitanes).",
    formula:
      "Efectividad (%) = (∑ puntos obtenidos / ∑ puntos máximos posibles) × 100",
    example:
      "Ejemplo: 1 victoria en Liga (3/3) y 1 empate en Copa (2/4) suman 5 de 7 puntos posibles: (5 / 7) × 100 = 71,4%.",
  },
  h2h: {
    key: "h2h",
    title: "Historial Mano a Mano (V − D)",
    description:
      "Diferencia neta de victorias menos derrotas cuando dos jugadores se enfrentan en equipos rivales (los empates no alteran el balance).",
    formula: "Balance Mano a Mano = V_jugador − V_rival",
    example:
      "Ejemplo: si en 6 cruces como rivales ganaste 4, empataron 1 y perdiste 1, el balance es 4 − 1 = +3.",
  },
  pgPct: {
    key: "pgPct",
    title: "PG% (Porcentaje de Victorias)",
    description:
      "Proporción de partidos ganados por el jugador sobre el total de partidos computados en la tabla seleccionada.",
    formula: "PG% = (PG / PJ) × 100",
    example:
      "Ejemplo: con 12 victorias en 20 partidos jugados en tabla, PG% = (12 / 20) × 100 = 60%.",
  },
  avgRating: {
    key: "avgRating",
    title: "Calif. Prom (Calificación Promedio)",
    description:
      "Promedio aritmético de las puntuaciones individuales recibidas por el jugador en las fechas con calificación registrada.",
    formula:
      "Calif. Prom = (∑ calificaciones registradas) / N_partidos_calificados",
    example:
      "Ejemplo: si recibió puntajes de 7.5, 8.0 y 8.5 en tres fechas calificadas, su Calif. Prom es 24.0 / 3 = 8,00.",
  },
  minThreshold: {
    key: "minThreshold",
    title: "Umbral mínimo de 3 PJ",
    description:
      "Filtro de estabilidad estadística aplicado al padrón activo y a los rankings de Mejores socios e Historial vs rivales para descartar cruces aislados.",
    formula:
      "Condición de inclusión: PJ_totales ≥ 3 (padrón activo) · PJ_juntos ≥ 3 (socios) · PJ_enfrentados ≥ 3 (rivales)",
    example:
      "Ejemplo: una dupla con 2 victorias en 2 PJ juntos aún no ingresa al ranking de Mejores socios hasta disputar su 3.º partido compartido.",
  },
};

function MetricFormulaButton({
  metricKey,
  openMetrics,
  onToggle,
  label = "Fórmula",
}: {
  metricKey: MetricKey;
  openMetrics: Record<string, boolean>;
  onToggle: (key: MetricKey) => void;
  label?: string;
}) {
  const def = METRIC_DEFINITIONS[metricKey];
  const isOpen = Boolean(openMetrics[metricKey]);

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-label={`${isOpen ? "Ocultar" : "Ver"} fórmula de ${def.title}`}
      onClick={() => onToggle(metricKey)}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors",
        isOpen
          ? "border-pitch-800 bg-pitch-50 text-pitch-800"
          : "border-rule bg-paper text-ink-muted hover:border-pitch-700 hover:text-ink"
      )}
    >
      <HelpCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

function MetricFormulaPanel({
  metricKey,
  openMetrics,
}: {
  metricKey: MetricKey;
  openMetrics: Record<string, boolean>;
}) {
  if (!openMetrics[metricKey]) return null;
  const def = METRIC_DEFINITIONS[metricKey];

  return (
    <div className="mt-2 space-y-1 rounded-md bg-paper p-3 text-left text-xs text-ink">
      <p className="font-semibold text-pitch-800">{def.title}</p>
      <p className="leading-relaxed text-ink-muted">{def.description}</p>
      <p className="pt-0.5 font-mono text-[11px] font-semibold text-pitch-800">
        {def.formula}
      </p>
      <p className="text-ink-muted">{def.example}</p>
    </div>
  );
}

interface ChemistryVerdict {
  label: string;
  badgeClass: string;
}

function getChemistryVerdict(
  pct: number,
  matchesTogether: number
): ChemistryVerdict | null {
  if (matchesTogether < 2) return null;
  if (pct >= 75) {
    return {
      label: "Dupla de Selección",
      badgeClass: "border-pitch-200 bg-pitch-50 text-pitch-800",
    };
  }
  if (pct >= 55) {
    return {
      label: "Sociedad Confiable",
      badgeClass: "border-navy-100 bg-navy-50 text-navy-800",
    };
  }
  if (pct >= 35) {
    return {
      label: "Química Irregular",
      badgeClass: "border-leather-500/40 bg-leather-50 text-leather-700",
    };
  }
  return {
    label: "Mejor de Rivales",
    badgeClass: "border-crimson-600/30 bg-crimson-50 text-crimson-700",
  };
}

export interface StatsInteractiveViewProps {
  initialTab: StatsTab;
  seasons: Season[];
  selectedSeasonId: string;
  selectedModality: MatchModality | "ALL";
  selectedMatchType: StatsCompetitionFilter;
  includeLowSample: boolean;
  activePlayers: StatsActivePlayerOption[];
  lab: StatsLabSummary;
  profile: StatsProfileSummary;
  viewerPlayerId: string | null;
}

export function StatsInteractiveView({
  initialTab,
  seasons,
  selectedSeasonId,
  selectedModality,
  selectedMatchType,
  includeLowSample,
  activePlayers,
  lab,
  profile,
  viewerPlayerId,
}: StatsInteractiveViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<StatsTab>(initialTab);
  const [showEffectiveness310, setShowEffectiveness310] = useState(false);
  const [openMetrics, setOpenMetrics] = useState<Record<string, boolean>>({});
  const [labComboId, setLabComboId] = useState("");
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const labTabRef = useRef<HTMLButtonElement | null>(null);
  const playerTabRef = useRef<HTMLButtonElement | null>(null);

  const selectedPlayers = useMemo(
    () => activePlayers.filter((p) => lab.selectedPlayerIds.includes(p.id)),
    [activePlayers, lab.selectedPlayerIds]
  );

  const toggleMetricFormula = (key: MetricKey) => {
    setOpenMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navigateWithParams = (next: {
    tab?: StatsTab;
    seasonId?: string;
    modality?: MatchModality | "ALL";
    matchType?: StatsCompetitionFilter;
    includeLowSample?: boolean;
    labIds?: string[];
    playerId?: string;
  }) => {
    const resolvedTab = next.tab ?? tab;
    const resolvedSeasonId = next.seasonId ?? selectedSeasonId;
    const resolvedModality = next.modality ?? selectedModality;
    const resolvedMatchType = next.matchType ?? selectedMatchType;
    const resolvedIncludeLowSample = next.includeLowSample ?? includeLowSample;
    const resolvedLabIds = next.labIds ?? lab.selectedPlayerIds;
    const resolvedPlayerId = next.playerId ?? profile.selectedPlayerId;

    const params = new URLSearchParams();
    if (resolvedTab !== "lab") {
      params.set("tab", resolvedTab);
    }
    if (resolvedSeasonId !== "ALL") {
      const seasonObj = seasons.find((s) => s.id === resolvedSeasonId);
      if (seasonObj) {
        params.set("season", String(seasonObj.year));
      }
    }
    if (resolvedModality !== "ALL") {
      params.set("modality", resolvedModality);
    }
    if (resolvedMatchType !== "ALL") {
      params.set("type", resolvedMatchType);
    }
    if (resolvedIncludeLowSample) {
      params.set("all", "1");
    }
    if (next.labIds !== undefined) {
      params.set(
        "lab",
        resolvedLabIds.length > 0 ? resolvedLabIds.join(",") : "none"
      );
    } else if (lab.selectedPlayerIds.length === 0) {
      params.set("lab", "none");
    } else {
      params.set("lab", lab.selectedPlayerIds.join(","));
    }

    if (resolvedPlayerId) {
      params.set("player", resolvedPlayerId);
    }

    const qs = params.toString();
    const target = qs ? `/stats?${qs}` : "/stats";
    startTransition(() => {
      router.replace(target, { scroll: false });
    });
  };

  const toggleLabPlayer = (id: string) => {
    const nextIds = lab.selectedPlayerIds.includes(id)
      ? lab.selectedPlayerIds.filter((x) => x !== id)
      : [...lab.selectedPlayerIds, id];
    navigateWithParams({ labIds: nextIds });
  };

  const labChartData = useMemo(() => {
    if (!lab.subgroup) return [];
    const items = [
      {
        name: "Química",
        value: Number(lab.subgroup.chemistryPct.toFixed(1)),
        fill: "var(--theme-chart-positive)",
      },
      {
        name: "Wilson CT%",
        value: Number(lab.subgroup.wilsonCtPct.toFixed(1)),
        fill: "var(--theme-chart-secondary)",
      },
    ];
    if (showEffectiveness310) {
      items.push({
        name: "Efect. 3/1/0",
        value: Number(lab.subgroup.effectiveness310Pct.toFixed(1)),
        fill: "var(--theme-chart-tertiary)",
      });
    }
    return items;
  }, [lab.subgroup, showEffectiveness310]);

  const teammatesChartData = useMemo(
    () =>
      profile.bestTeammates.map(({ displayName, stats }) => ({
        name: displayName,
        wilson: Number(stats.wilsonCtPct.toFixed(1)),
        quimica: Number(stats.chemistryPct.toFixed(1)),
        pj: stats.matchesTogether,
      })),
    [profile.bestTeammates]
  );

  const rivalsChartData = useMemo(
    () =>
      profile.topRivals.map(({ displayName, stats }) => ({
        name: displayName,
        balance: stats.h2hBalance,
        record: `${stats.winsA}G-${stats.drawsAgainst}E-${stats.winsB}P`,
      })),
    [profile.topRivals]
  );

  const profileRow = profile.row;

  const selectTab = (nextTab: StatsTab, focusButton = false) => {
    setTab(nextTab);
    navigateWithParams({ tab: nextTab });
    if (focusButton) {
      if (nextTab === "lab") {
        labTabRef.current?.focus();
      } else {
        playerTabRef.current?.focus();
      }
    }
  };

  const handleTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      selectTab(tab === "lab" ? "player" : "lab", true);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectTab("lab", true);
    } else if (e.key === "End") {
      e.preventDefault();
      selectTab("player", true);
    }
  };

  const labVerdict = lab.subgroup
    ? getChemistryVerdict(lab.subgroup.chemistryPct, lab.subgroup.matchesPlayed)
    : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display flex items-center gap-2 text-3xl font-extrabold tracking-wide text-ink">
            <BarChart3 className="h-6 w-6 text-pitch-700" />
            Estadísticas y lab grupal
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Química (%), Consistencia Wilson (z = 1.28) e Historial mano a mano
            {isPending ? " · Calculando..." : ""}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Modo de estadísticas"
          onKeyDown={handleTabKeyDown}
          className="inline-flex rounded-md border border-rule bg-surface p-0.5"
        >
          <button
            ref={labTabRef}
            id="stats-tab-lab"
            type="button"
            role="tab"
            aria-selected={tab === "lab"}
            aria-controls="stats-panel-lab"
            tabIndex={tab === "lab" ? 0 : -1}
            onClick={() => selectTab("lab")}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-sm px-3.5 text-sm font-semibold transition-colors",
              tab === "lab"
                ? "bg-pitch-800 text-white"
                : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
            )}
          >
            <FlaskConical className="h-4 w-4" />
            Lab Grupal
          </button>
          <button
            ref={playerTabRef}
            id="stats-tab-player"
            type="button"
            role="tab"
            aria-selected={tab === "player"}
            aria-controls="stats-panel-player"
            tabIndex={tab === "player" ? 0 : -1}
            onClick={() => selectTab("player")}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-sm px-3.5 text-sm font-semibold transition-colors",
              tab === "player"
                ? "bg-pitch-800 text-white"
                : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
            )}
          >
            <User className="h-4 w-4" />
            Stats por jugador
          </button>
        </div>
      </header>

      {/* Shared Filters */}
      <section
        aria-label="Filtros de estadísticas"
        className="flex flex-col gap-3 rounded-lg border border-rule bg-surface p-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      >
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          <span className="mr-1 shrink-0 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Temporada
          </span>
          <button
            type="button"
            aria-pressed={selectedSeasonId === "ALL"}
            onClick={() => navigateWithParams({ seasonId: "ALL" })}
            className={cn(
              "min-h-10 shrink-0 rounded-md border px-3 text-sm font-semibold transition-colors",
              selectedSeasonId === "ALL"
                ? "border-leather-600 bg-leather-600 text-white"
                : "border-rule bg-paper text-ink-muted hover:text-ink"
            )}
          >
            Histórico
          </button>
          {seasons.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={selectedSeasonId === s.id}
              onClick={() => navigateWithParams({ seasonId: s.id })}
              className={cn(
                "font-display min-h-10 shrink-0 rounded-md border px-3 text-base font-bold transition-colors",
                selectedSeasonId === s.id
                  ? "border-leather-600 bg-leather-600 text-white"
                  : "border-rule bg-paper text-ink-muted hover:text-ink"
              )}
            >
              {s.year}
            </button>
          ))}
        </div>

        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          <span className="mr-1 shrink-0 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Modalidad
          </span>
          {(["ALL", "F5", "F6", "F7"] as const).map((mod) => (
            <button
              key={mod}
              type="button"
              aria-pressed={selectedModality === mod}
              onClick={() => navigateWithParams({ modality: mod })}
              className={cn(
                "min-h-10 shrink-0 rounded-md border px-3 text-sm font-semibold transition-colors",
                selectedModality === mod
                  ? "border-pitch-800 bg-pitch-800 text-white"
                  : "border-rule bg-paper text-ink-muted hover:text-ink"
              )}
            >
              {mod === "ALL" ? "Todas" : mod}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Torneo:
          </span>
          {(
            [
              { id: "ALL", label: "Todos", activeClass: "border-pitch-800 bg-pitch-800 text-white" },
              { id: "league", label: "Liga", activeClass: "border-comp-league bg-comp-league text-white" },
              { id: "cup", label: "Copa", activeClass: "border-comp-cup bg-comp-cup text-white" },
              { id: "lolonmebol", label: "LOLONMEBOL", activeClass: "border-comp-lolonmebol bg-comp-lolonmebol text-white" },
            ] as const
          ).map(({ id, label, activeClass }) => (
            <button
              key={id}
              type="button"
              aria-pressed={selectedMatchType === id}
              onClick={() => navigateWithParams({ matchType: id })}
              className={cn(
                "min-h-10 shrink-0 rounded-md border px-3 text-sm font-semibold transition-colors",
                selectedMatchType === id
                  ? activeClass
                  : "border-rule bg-paper text-ink-muted hover:text-ink"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="inline-flex min-h-10 w-fit cursor-pointer items-center gap-2.5 rounded-md border border-rule bg-paper px-3 text-sm font-medium text-ink transition-colors hover:border-rule-strong">
          <input
            type="checkbox"
            checked={showEffectiveness310}
            onChange={(e) => setShowEffectiveness310(e.target.checked)}
            className="h-4 w-4 rounded-sm accent-pitch-800"
          />
          Efectividad (Liga / Copa)
        </label>
      </section>

      {tab === "lab" ? (
        <div
          id="stats-panel-lab"
          role="tabpanel"
          aria-labelledby="stats-tab-lab"
          className={cn("space-y-4 transition-opacity", isPending && "opacity-70")}
        >
          <section className="rounded-lg border border-rule bg-surface p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display flex items-center gap-2 text-lg font-bold tracking-wide text-ink">
                  <Users className="h-4 w-4 text-pitch-700" />
                  Elegí 2 o más jugadores ({lab.selectedPlayerIds.length}{" "}
                  seleccionados)
                </h2>
                <p className="text-xs text-ink-muted">
                  Buscá con el selector o expandí el padrón para sumar o quitar
                  jugadores del Lab.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-full sm:w-72">
                  <PlayerCombobox
                    options={activePlayers}
                    value={labComboId}
                    onChange={(id) => {
                      setLabComboId(id);
                      toggleLabPlayer(id);
                    }}
                    placeholder="Buscar jugador para sumar/quitar..."
                    searchPlaceholder="Buscar jugador..."
                  />
                </div>
                {lab.selectedPlayerIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setLabComboId("");
                      navigateWithParams({ labIds: [] });
                    }}
                    className="min-h-10 rounded-md border border-crimson-600/30 bg-crimson-50 px-3 text-xs font-bold text-crimson-700 transition-colors hover:bg-crimson-100"
                  >
                    Limpiar ({lab.selectedPlayerIds.length})
                  </button>
                )}
              </div>
            </div>

            {/* Mobile: compact selected chips + on-demand full list toggle */}
            {!showAllPlayers && selectedPlayers.length > 0 && (
              <div className="mb-2.5 flex flex-wrap gap-1.5 md:hidden">
                {selectedPlayers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleLabPlayer(p.id)}
                    aria-label={`Quitar a ${p.displayName}`}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-pitch-800 bg-pitch-800 px-3 text-sm font-semibold text-white transition-colors hover:bg-pitch-900"
                  >
                    <span>{p.displayName}</span>
                    <X className="h-3.5 w-3.5 opacity-80" />
                  </button>
                ))}
              </div>
            )}

            <div className="mb-2.5 md:hidden">
              <button
                type="button"
                aria-expanded={showAllPlayers}
                onClick={() => setShowAllPlayers((prev) => !prev)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-rule bg-paper px-3 text-xs font-semibold text-pitch-800 transition-colors hover:border-pitch-700"
              >
                {showAllPlayers ? (
                  <>
                    Ocultar lista de jugadores
                    <ChevronUp className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    Ver todos los jugadores ({activePlayers.length})
                    <ChevronDown className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>

            <div
              className={cn(
                "flex-wrap gap-1.5",
                showAllPlayers ? "flex" : "hidden md:flex"
              )}
            >
              {activePlayers.map((p) => {
                const selected = lab.selectedPlayerIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleLabPlayer(p.id)}
                    className={cn(
                      "min-h-10 rounded-md border px-3 text-sm font-semibold transition-colors",
                      selected
                        ? "border-pitch-800 bg-pitch-800 text-white"
                        : "border-rule bg-paper text-ink hover:border-pitch-700"
                    )}
                  >
                    {p.displayName}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 border-t border-rule pt-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink-muted">
                  {includeLowSample
                    ? "Padrón completo (incluye parejas y jugadores con < 3 PJ)"
                    : "Padrón activo con umbral mínimo de 3 PJ"}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-rule bg-paper px-2.5 text-xs font-semibold text-ink transition-colors hover:border-rule-strong">
                    <input
                      type="checkbox"
                      checked={includeLowSample}
                      onChange={(e) =>
                        navigateWithParams({
                          includeLowSample: e.target.checked,
                        })
                      }
                      className="h-3.5 w-3.5 rounded-sm accent-pitch-800"
                    />
                    Incluir &lt; 3 PJ
                  </label>
                  <MetricFormulaButton
                    metricKey="minThreshold"
                    openMetrics={openMetrics}
                    onToggle={toggleMetricFormula}
                  />
                </div>
              </div>
              <MetricFormulaPanel
                metricKey="minThreshold"
                openMetrics={openMetrics}
              />
            </div>
          </section>

          {lab.selectedPlayerIds.length < 2 ? (
            <div className="rounded-lg border border-dashed border-rule-strong bg-surface p-8 text-center text-sm text-ink-muted">
              Seleccioná al menos 2 jugadores para calcular Química, Consistencia
              Wilson e Historial mano a mano.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {lab.subgroup && (
                <section className="flex flex-col justify-between rounded-lg border border-rule bg-surface p-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2">
                      <h3 className="font-display text-lg font-bold tracking-wide text-pitch-800">
                        Jugando juntos · {lab.selectedPlayerNames.join(" + ")}
                      </h3>
                      {labVerdict && (
                        <span
                          className={cn(
                            "rounded-sm border px-2 py-0.5 text-[11px] font-bold",
                            labVerdict.badgeClass
                          )}
                        >
                          {labVerdict.label}
                        </span>
                      )}
                    </div>

                    <dl className="mt-3 grid grid-cols-3 divide-x divide-rule rounded-md bg-paper">
                      <div className="px-2.5 py-2.5 text-center sm:px-3">
                        <dt className="text-xs font-semibold text-ink-muted">
                          Química
                        </dt>
                        <dd className="font-display mt-0.5 text-2xl font-extrabold text-pitch-800 tabular-nums">
                          {lab.subgroup.chemistryPct.toFixed(1)}%
                        </dd>
                      </div>
                      <div className="px-2.5 py-2.5 text-center sm:px-3">
                        <dt className="text-xs font-semibold text-ink-muted">
                          Wilson CT%
                        </dt>
                        <dd className="font-display mt-0.5 text-2xl font-extrabold text-leather-700 tabular-nums">
                          {lab.subgroup.wilsonCtPct.toFixed(1)}%
                        </dd>
                      </div>
                      <div className="px-2.5 py-2.5 text-center sm:px-3">
                        <dt className="text-xs font-semibold text-ink-muted">
                          PJ ({lab.subgroup.wins}-{lab.subgroup.draws}-
                          {lab.subgroup.losses})
                        </dt>
                        <dd className="font-display mt-0.5 text-2xl font-extrabold text-ink tabular-nums">
                          {lab.subgroup.matchesPlayed}
                        </dd>
                      </div>
                    </dl>

                    {lab.subgroup.matchesPlayed > 0 && (
                      <LabSubgroupChart data={labChartData} />
                    )}

                    <div className="mt-4 border-t border-rule pt-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <MetricFormulaButton
                          metricKey="chemistry"
                          openMetrics={openMetrics}
                          onToggle={toggleMetricFormula}
                          label="Química"
                        />
                        <MetricFormulaButton
                          metricKey="wilson"
                          openMetrics={openMetrics}
                          onToggle={toggleMetricFormula}
                          label="Wilson CT%"
                        />
                        <MetricFormulaButton
                          metricKey="effectiveness310"
                          openMetrics={openMetrics}
                          onToggle={toggleMetricFormula}
                          label={`Efectividad (${lab.subgroup.effectiveness310Pct.toFixed(1)}%)`}
                        />
                      </div>
                      <MetricFormulaPanel
                        metricKey="chemistry"
                        openMetrics={openMetrics}
                      />
                      <MetricFormulaPanel
                        metricKey="wilson"
                        openMetrics={openMetrics}
                      />
                      <MetricFormulaPanel
                        metricKey="effectiveness310"
                        openMetrics={openMetrics}
                      />
                    </div>
                  </div>

                  {showEffectiveness310 && (
                    <p className="mt-3 border-t border-rule pt-2.5 text-xs text-ink-muted">
                      Efectividad (Liga 3/1/0 · Copa 4/2/0) en gráfico:{" "}
                      <strong className="text-ink">
                        {lab.subgroup.effectiveness310Pct.toFixed(1)}%
                      </strong>
                    </p>
                  )}
                </section>
              )}

              {lab.pairwise && (
                <section className="flex flex-col justify-between rounded-lg border border-rule bg-surface p-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2">
                      <h3 className="font-display flex items-center gap-2 text-lg font-bold tracking-wide text-ink">
                        <Swords className="h-4 w-4 text-crimson-600" />
                        Historial mano a mano (rivales)
                      </h3>
                      <MetricFormulaButton
                        metricKey="h2h"
                        openMetrics={openMetrics}
                        onToggle={toggleMetricFormula}
                      />
                    </div>

                    <MetricFormulaPanel
                      metricKey="h2h"
                      openMetrics={openMetrics}
                    />

                    <div className="pitch-chalk-surface mt-4 flex items-center justify-between rounded-md border border-pitch-900 px-4 py-4 text-paper sm:px-5">
                      <div className="min-w-0 flex-1 text-center">
                        <span className="block truncate text-xs font-semibold text-pitch-100">
                          {lab.pairwise.playerAName}
                        </span>
                        <span className="font-display mt-1 block text-4xl font-extrabold text-gold-400 tabular-nums">
                          {lab.pairwise.stats.winsA}
                        </span>
                      </div>

                      <div className="px-2.5 text-center sm:px-3">
                        <span className="block text-xs font-semibold text-pitch-200">
                          Empates: {lab.pairwise.stats.drawsAgainst}
                        </span>
                        <span className="font-display mt-1 inline-block rounded-sm bg-pitch-900/80 px-2.5 py-0.5 text-sm font-bold text-white tabular-nums">
                          Dif:{" "}
                          {lab.pairwise.stats.h2hBalance > 0
                            ? `+${lab.pairwise.stats.h2hBalance}`
                            : lab.pairwise.stats.h2hBalance}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 text-center">
                        <span className="block truncate text-xs font-semibold text-pitch-100">
                          {lab.pairwise.playerBName}
                        </span>
                        <span className="font-display mt-1 block text-4xl font-extrabold text-gold-400 tabular-nums">
                          {lab.pairwise.stats.winsB}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-center text-xs text-ink-muted">
                    {lab.pairwise.stats.matchesAgainst} partidos enfrentados en
                    equipos rivales
                  </p>
                </section>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          id="stats-panel-player"
          role="tabpanel"
          aria-labelledby="stats-tab-player"
          className={cn("space-y-4 transition-opacity", isPending && "opacity-70")}
        >
          <section className="rounded-lg border border-rule bg-surface p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <PlayerCombobox
                label="Explorar ficha estadística de jugador"
                options={activePlayers}
                value={profile.selectedPlayerId}
                onChange={(id) => navigateWithParams({ playerId: id })}
                placeholder="Elegir jugador del padrón..."
                searchPlaceholder="Buscar jugador por nombre..."
                className="sm:max-w-md"
              />

              {viewerPlayerId &&
                activePlayers.some((p) => p.id === viewerPlayerId) &&
                profile.selectedPlayerId !== viewerPlayerId && (
                  <button
                    type="button"
                    onClick={() =>
                      navigateWithParams({ playerId: viewerPlayerId })
                    }
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-pitch-800 bg-pitch-50 px-3.5 text-xs font-bold text-pitch-800 transition-colors hover:bg-pitch-100"
                  >
                    <User className="h-3.5 w-3.5" />
                    Ver mis stats
                  </button>
                )}
            </div>

            {profileRow && (
              <div className="mt-4 space-y-3">
                <div className="pitch-chalk-surface flex flex-wrap items-center justify-between gap-3 rounded-md border border-pitch-900 px-4 py-3.5 text-paper">
                  <div>
                    <h2 className="font-display flex items-center gap-2 text-2xl font-extrabold tracking-wide text-white">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-gold-500 text-sm font-extrabold text-ink">
                        #{profileRow.position}
                      </span>
                      {profileRow.displayName}
                      {profileRow.stars > 0 && (
                        <span className="inline-flex gap-0.5">
                          {Array.from({ length: profileRow.stars }).map(
                            (_, i) => (
                              <Star
                                key={i}
                                className="h-4 w-4 fill-gold-400 text-gold-400"
                              />
                            )
                          )}
                        </span>
                      )}
                    </h2>
                    <p className="mt-0.5 text-xs text-pitch-100">
                      {profileRow.pg}G · {profileRow.pe}E · {profileRow.pp}P (
                      {profileRow.pj} PJ en tabla)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-display block text-3xl font-extrabold text-gold-400">
                      {profileRow.points}
                    </span>
                    <span className="text-xs font-semibold text-pitch-100">
                      Puntos
                    </span>
                  </div>
                </div>

                <dl className="grid grid-cols-2 divide-x divide-y divide-rule rounded-md bg-paper sm:grid-cols-4 sm:divide-y-0">
                  <div className="px-3 py-3 text-center">
                    <dt className="text-xs font-semibold text-ink-muted">PG%</dt>
                    <dd className="font-display mt-0.5 text-2xl font-extrabold text-ink tabular-nums">
                      {profileRow.winRate.toFixed(0)}%
                    </dd>
                  </div>
                  <div className="px-3 py-3 text-center">
                    <dt className="text-xs font-semibold text-ink-muted">
                      MVPs
                    </dt>
                    <dd className="font-display mt-0.5 text-2xl font-extrabold text-leather-700 tabular-nums">
                      {profileRow.mvps}
                    </dd>
                  </div>
                  <div className="px-3 py-3 text-center">
                    <dt className="text-xs font-semibold text-ink-muted">
                      G/A ({profileRow.goalContributions})
                    </dt>
                    <dd className="font-display mt-0.5 text-2xl font-extrabold text-ink tabular-nums">
                      {profileRow.goals}G / {profileRow.assists}A
                    </dd>
                  </div>
                  <div className="px-3 py-3 text-center">
                    <dt className="text-xs font-semibold text-ink-muted">
                      Calif. Prom
                    </dt>
                    <dd className="font-display mt-0.5 text-2xl font-extrabold text-pitch-800 tabular-nums">
                      {profileRow.avgRating !== null
                        ? profileRow.avgRating.toFixed(2)
                        : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="border-t border-rule pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <MetricFormulaButton
                      metricKey="pgPct"
                      openMetrics={openMetrics}
                      onToggle={toggleMetricFormula}
                      label="PG%"
                    />
                    <MetricFormulaButton
                      metricKey="avgRating"
                      openMetrics={openMetrics}
                      onToggle={toggleMetricFormula}
                      label="Calif. Prom"
                    />
                    <MetricFormulaButton
                      metricKey="minThreshold"
                      openMetrics={openMetrics}
                      onToggle={toggleMetricFormula}
                      label="Umbral 3 PJ"
                    />
                  </div>
                  <MetricFormulaPanel
                    metricKey="pgPct"
                    openMetrics={openMetrics}
                  />
                  <MetricFormulaPanel
                    metricKey="avgRating"
                    openMetrics={openMetrics}
                  />
                  <MetricFormulaPanel
                    metricKey="minThreshold"
                    openMetrics={openMetrics}
                  />
                </div>
              </div>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-rule bg-surface p-4">
              <div className="mb-3 border-b border-rule pb-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold tracking-wide text-pitch-800">
                    Mejores socios (Wilson CT%)
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <MetricFormulaButton
                      metricKey="wilson"
                      openMetrics={openMetrics}
                      onToggle={toggleMetricFormula}
                      label="Wilson"
                    />
                    <MetricFormulaButton
                      metricKey="chemistry"
                      openMetrics={openMetrics}
                      onToggle={toggleMetricFormula}
                      label="Química"
                    />
                  </div>
                </div>
                <MetricFormulaPanel
                  metricKey="wilson"
                  openMetrics={openMetrics}
                />
                <MetricFormulaPanel
                  metricKey="chemistry"
                  openMetrics={openMetrics}
                />
              </div>
              {teammatesChartData.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">
                  Se necesitan al menos 3 partidos juntos con este filtro para
                  calcular socios.
                </p>
              ) : (
                <>
                  <TeammatesChart data={teammatesChartData} />
                  <ul className="mt-2 divide-y divide-rule text-xs">
                    {profile.bestTeammates.map(
                      ({ playerId, displayName, stats }) => {
                        const verdict = getChemistryVerdict(
                          stats.chemistryPct,
                          stats.matchesTogether
                        );
                        return (
                          <li
                            key={playerId}
                            className="flex flex-wrap items-center justify-between gap-2 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-ink">
                                {displayName}{" "}
                                <span className="font-normal text-ink-muted">
                                  ({stats.matchesTogether} PJ)
                                </span>
                              </span>
                              {verdict && (
                                <span
                                  className={cn(
                                    "rounded-sm border px-1.5 py-0.5 text-[10px] font-bold",
                                    verdict.badgeClass
                                  )}
                                >
                                  {verdict.label}
                                </span>
                              )}
                            </div>
                            <span className="font-display text-sm font-bold text-pitch-800 tabular-nums">
                              CT {stats.wilsonCtPct.toFixed(1)}% · Q{" "}
                              {stats.chemistryPct.toFixed(0)}%
                            </span>
                          </li>
                        );
                      }
                    )}
                  </ul>
                </>
              )}
            </section>

            <section className="rounded-lg border border-rule bg-surface p-4">
              <div className="mb-3 border-b border-rule pb-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold tracking-wide text-ink">
                    Historial vs rivales (V − D)
                  </h3>
                  <MetricFormulaButton
                    metricKey="h2h"
                    openMetrics={openMetrics}
                    onToggle={toggleMetricFormula}
                  />
                </div>
                <MetricFormulaPanel
                  metricKey="h2h"
                  openMetrics={openMetrics}
                />
              </div>
              {rivalsChartData.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">
                  Se necesitan al menos 3 enfrentamientos como rivales con este
                  filtro.
                </p>
              ) : (
                <>
                  <RivalsChart data={rivalsChartData} />
                  <ul className="mt-2 divide-y divide-rule text-xs">
                    {profile.topRivals.map(
                      ({ playerId, displayName, stats }) => (
                        <li
                          key={playerId}
                          className="flex items-center justify-between py-2"
                        >
                          <span className="font-semibold text-ink">
                            vs {displayName}{" "}
                            <span className="font-normal text-ink-muted">
                              ({stats.winsA}G-{stats.drawsAgainst}E-
                              {stats.winsB}P)
                            </span>
                          </span>
                          <span
                            className={cn(
                              "font-display rounded-sm px-2 py-0.5 text-sm font-bold",
                              stats.h2hBalance > 0
                                ? "bg-pitch-50 text-pitch-800"
                                : stats.h2hBalance < 0
                                  ? "bg-crimson-50 text-crimson-700"
                                  : "bg-surface-subtle text-ink-muted"
                            )}
                          >
                            {stats.h2hBalance > 0
                              ? `+${stats.h2hBalance}`
                              : stats.h2hBalance}
                          </span>
                        </li>
                      )
                    )}
                  </ul>
                </>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
