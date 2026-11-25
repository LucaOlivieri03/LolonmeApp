"use client";

import { useMemo, useState } from "react";
import { Check, PlusCircle, UserPlus, Wallet, X } from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import { PlayerCombobox } from "@/components/tournament/PlayerCombobox";
import { computeFundSummary, resolveDefaultSeasonId } from "@/lib/engine";
import type { FundTxType } from "@/lib/types/domain";
import { cn, formatArs, formatDateEs } from "@/lib/utils";

export function AdminPozoTab({
  allowAdminOverride = false,
}: {
  allowAdminOverride?: boolean;
} = {}) {
  const {
    dataset,
    role,
    addPlayer,
    addPlayerToPozo,
    toggleFundPayment,
    updateFundMonthFee,
    addFundTransaction,
  } = useTournament();

  const sortedSeasons = useMemo(
    () => [...dataset.seasons].sort((a, b) => b.year - a.year),
    [dataset.seasons]
  );
  const [selectedSeasonId, setSeasonId] = useState(() =>
    resolveDefaultSeasonId(dataset.seasons)
  );
  const seasonId = resolveDefaultSeasonId(sortedSeasons, selectedSeasonId);

  const [focusedPlayerId, setFocusedPlayerId] = useState<string>("ALL");
  const [enrollPlayerId, setEnrollPlayerId] = useState<string>("");
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [enrollNotice, setEnrollNotice] = useState<string | null>(null);

  const [txType, setTxType] = useState<FundTxType>("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txDesc, setTxDesc] = useState("");

  if (!allowAdminOverride && role !== "admin") {
    return null;
  }

  const months = useMemo(
    () =>
      dataset.fundMonths
        .filter((m) => m.seasonId === seasonId)
        .sort((a, b) => a.monthNumber - b.monthNumber),
    [dataset.fundMonths, seasonId]
  );

  const monthIds = useMemo(() => new Set(months.map((m) => m.id)), [months]);
  const payments = useMemo(
    () => dataset.fundPayments.filter((p) => monthIds.has(p.fundMonthId)),
    [dataset.fundPayments, monthIds]
  );

  const transactions = useMemo(
    () => dataset.fundTransactions.filter((t) => t.seasonId === seasonId),
    [dataset.fundTransactions, seasonId]
  );

  const summary = useMemo(
    () => computeFundSummary(months, payments, transactions),
    [months, payments, transactions]
  );

  const pozoPlayers = useMemo(() => {
    const ids = new Set(payments.map((p) => p.playerId));
    return dataset.players
      .filter((p) => ids.has(p.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
  }, [dataset.players, payments]);

  const paidMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const p of payments) {
      m.set(`${p.fundMonthId}|${p.playerId}`, p.paid);
    }
    return m;
  }, [payments]);

  const playerDebtSummary = useMemo(() => {
    const map = new Map<
      string,
      { paidMonths: number; pendingMonths: number; paidAmount: number; debtAmount: number }
    >();
    for (const p of pozoPlayers) {
      let paidMonths = 0;
      let pendingMonths = 0;
      let paidAmount = 0;
      let debtAmount = 0;
      for (const m of months) {
        const isPaid = paidMap.get(`${m.id}|${p.id}`) ?? false;
        if (isPaid) {
          paidMonths++;
          paidAmount += m.feeAmount;
        } else {
          pendingMonths++;
          debtAmount += m.feeAmount;
        }
      }
      map.set(p.id, { paidMonths, pendingMonths, paidAmount, debtAmount });
    }
    return map;
  }, [pozoPlayers, months, paidMap]);

  const safeFocusedPlayerId =
    focusedPlayerId === "ALL" || pozoPlayers.some((p) => p.id === focusedPlayerId)
      ? focusedPlayerId
      : "ALL";

  const visiblePozoPlayers = useMemo(() => {
    if (safeFocusedPlayerId === "ALL") return pozoPlayers;
    return pozoPlayers.filter((p) => p.id === safeFocusedPlayerId);
  }, [pozoPlayers, safeFocusedPlayerId]);

  const unEnrolledPlayers = useMemo(() => {
    const enrolledIds = new Set(pozoPlayers.map((p) => p.id));
    return dataset.players.filter((p) => !enrolledIds.has(p.id));
  }, [dataset.players, pozoPlayers]);

  const selectedEnrollId =
    enrollPlayerId && unEnrolledPlayers.some((p) => p.id === enrollPlayerId)
      ? enrollPlayerId
      : (unEnrolledPlayers[0]?.id ?? "");

  const filterComboboxOptions = useMemo(
    () => [
      {
        id: "ALL",
        displayName: `Todos los jugadores del Pozo (${pozoPlayers.length})`,
        subtitle: "Matriz completa",
      },
      ...pozoPlayers.map((p) => {
        const st = playerDebtSummary.get(p.id);
        return {
          id: p.id,
          displayName: p.displayName,
          subtitle: st
            ? `${st.paidMonths}/${months.length} al día${st.debtAmount > 0 ? ` · Debe ${formatArs(st.debtAmount)}` : ""}`
            : undefined,
        };
      }),
    ],
    [pozoPlayers, playerDebtSummary, months.length]
  );

  const enrollComboboxOptions = useMemo(
    () =>
      unEnrolledPlayers.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        subtitle: "En padrón",
      })),
    [unEnrolledPlayers]
  );

  const handleEnrollExisting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollId) return;
    const player = dataset.players.find((p) => p.id === selectedEnrollId);
    addPlayerToPozo(seasonId, selectedEnrollId);
    setEnrollPlayerId("");
    setEnrollNotice(
      `${player?.displayName ?? "Jugador"} incorporado al Pozo con sus ${months.length || 12} meses inicializados.`
    );
  };

  const handleCreateAndEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;
    const createdId = addPlayer({
      displayName: trimmed,
      role: "player",
    });
    addPlayerToPozo(seasonId, createdId);
    setNewPlayerName("");
    setShowCreateNew(false);
    setFocusedPlayerId(createdId);
    setEnrollNotice(
      `Jugador "${trimmed}" creado en el padrón e incorporado al Pozo.`
    );
  };

  const handleAddTx = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(txAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !txDesc.trim()) return;
    addFundTransaction({
      seasonId,
      txType,
      amount,
      description: txDesc.trim(),
      txDate: new Date().toISOString().slice(0, 10),
    });
    setTxAmount("");
    setTxDesc("");
  };

  const focusedPlayer =
    safeFocusedPlayerId !== "ALL"
      ? pozoPlayers.find((p) => p.id === safeFocusedPlayerId) ?? null
      : null;
  const focusedDebt = focusedPlayer
    ? playerDebtSummary.get(focusedPlayer.id) ?? null
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-pitch-700" />
          <div>
            <h2 className="font-display text-xl font-bold tracking-wide text-ink">
              Pozo y Premios (Exclusivo Admin)
            </h2>
            <p className="text-xs text-ink-muted">
              Cuota configurable por mes · Saldo automático en ARS
            </p>
          </div>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Temporada del Pozo">
          {sortedSeasons.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSeasonId(s.id);
                setFocusedPlayerId("ALL");
                setEnrollNotice(null);
              }}
              className={cn(
                "font-display min-h-10 rounded-md border px-3.5 text-base font-bold transition-colors",
                seasonId === s.id
                  ? "border-leather-600 bg-leather-600 text-white"
                  : "border-rule bg-surface text-ink-muted hover:text-ink"
              )}
            >
              {s.year}
            </button>
          ))}
        </div>
      </div>

      {/* Unified Financial Ledger Strip */}
      <dl className="grid grid-cols-2 divide-x divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-surface sm:grid-cols-4 sm:divide-y-0">
        <div className="px-4 py-3">
          <dt className="text-xs font-semibold text-ink-muted">Cuotas Recaudadas</dt>
          <dd className="font-display mt-0.5 text-2xl font-extrabold text-pitch-800">
            {formatArs(summary.totalCollected)}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs font-semibold text-ink-muted">Rendimientos</dt>
          <dd className="font-display mt-0.5 text-2xl font-extrabold text-navy-700">
            +{formatArs(summary.totalYields)}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs font-semibold text-ink-muted">Gastos / Premios</dt>
          <dd className="font-display mt-0.5 text-2xl font-extrabold text-crimson-600">
            -{formatArs(summary.totalExpenses)}
          </dd>
        </div>
        <div className="bg-pitch-800 px-4 py-3 text-paper">
          <dt className="text-xs font-semibold text-gold-400">Saldo Total</dt>
          <dd className="font-display mt-0.5 text-2xl font-extrabold text-white">
            {formatArs(summary.balance)}
          </dd>
        </div>
      </dl>

      {/* Federation Control Bar: Filter by Person (PlayerCombobox) & Enroll Player (PlayerCombobox) */}
      <section className="rounded-lg border border-rule bg-surface">
        <div className="grid divide-y divide-rule md:grid-cols-2 md:divide-x md:divide-y-0">
          {/* Left Column: Person Filter using shared PlayerCombobox */}
          <div className="p-4">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <PlayerCombobox
                  label={`Filtrar matriz por persona (${visiblePozoPlayers.length}/${pozoPlayers.length})`}
                  options={filterComboboxOptions}
                  value={safeFocusedPlayerId}
                  onChange={setFocusedPlayerId}
                  placeholder="Todos los jugadores del Pozo..."
                  searchPlaceholder="Buscar jugador en el Pozo..."
                />
              </div>
              {safeFocusedPlayerId !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setFocusedPlayerId("ALL")}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-rule bg-paper px-3 text-xs font-bold text-ink-muted transition-colors hover:border-pitch-700 hover:text-ink"
                  title="Ver todos los jugadores"
                >
                  <X className="h-3.5 w-3.5" />
                  Todos
                </button>
              )}
            </div>

            {focusedPlayer && focusedDebt && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-rule bg-paper px-3.5 py-2.5 text-xs">
                <div>
                  <span className="font-bold text-ink">
                    {focusedPlayer.displayName}
                  </span>
                  <span className="ml-2 text-ink-muted">
                    {focusedDebt.paidMonths} pagado
                    {focusedDebt.paidMonths === 1 ? "" : "s"} ·{" "}
                    {focusedDebt.pendingMonths} pendiente
                    {focusedDebt.pendingMonths === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-sm font-bold text-pitch-800">
                    Pagó: {formatArs(focusedDebt.paidAmount)}
                  </span>
                  <span
                    className={cn(
                      "font-display text-sm font-bold",
                      focusedDebt.debtAmount > 0
                        ? "text-crimson-600"
                        : "text-ink-muted"
                    )}
                  >
                    Deuda: {formatArs(focusedDebt.debtAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Enroll Existing Player (PlayerCombobox) or Create New */}
          <div className="p-4">
            {!showCreateNew ? (
              <form onSubmit={handleEnrollExisting} className="space-y-2.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <PlayerCombobox
                      label={`Incorporar jugador del padrón al Pozo (${unEnrolledPlayers.length} disponibles)`}
                      options={enrollComboboxOptions}
                      value={selectedEnrollId}
                      onChange={setEnrollPlayerId}
                      placeholder={
                        unEnrolledPlayers.length === 0
                          ? "Todos los jugadores están en el Pozo"
                          : "Elegir jugador del padrón..."
                      }
                      searchPlaceholder="Buscar jugador del padrón..."
                      emptyMessage="No quedan jugadores sin incorporar"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!selectedEnrollId}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-pitch-800 px-4 text-xs font-bold text-white transition-colors hover:bg-pitch-900 disabled:opacity-40"
                  >
                    <UserPlus className="h-4 w-4" />
                    Sumar al Pozo
                  </button>
                </div>

                <div className="flex items-center justify-between pt-0.5 text-xs">
                  <span className="text-ink-muted">
                    ¿No está cargado en el padrón general?
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCreateNew(true)}
                    className="inline-flex items-center gap-1 font-bold text-pitch-800 hover:underline"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Crear nuevo jugador y sumar
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateAndEnroll} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="pozo-create-player"
                    className="block text-xs font-bold uppercase tracking-wider text-ink-muted"
                  >
                    Alta de Nuevo Jugador directo al Pozo
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateNew(false);
                      setNewPlayerName("");
                    }}
                    className="text-xs font-semibold text-ink-muted hover:text-ink"
                  >
                    Volver al padrón
                  </button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="pozo-create-player"
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="Nombre visible (ej. T. Allende)"
                    className="min-h-11 flex-1 rounded-md border border-rule bg-paper px-3 text-base text-ink placeholder:text-ink-muted sm:text-sm"
                    required
                  />
                  <button
                    type="submit"
                    disabled={!newPlayerName.trim()}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-pitch-800 px-4 text-xs font-bold text-white transition-colors hover:bg-pitch-900 disabled:opacity-40"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Crear y Sumar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {enrollNotice && (
          <div className="flex items-center justify-between border-t border-rule bg-pitch-50 px-4 py-2 text-xs font-semibold text-pitch-800">
            <span>{enrollNotice}</span>
            <button
              type="button"
              onClick={() => setEnrollNotice(null)}
              aria-label="Cerrar aviso"
              className="rounded p-0.5 text-pitch-700 hover:bg-pitch-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* Monthly Fees & Payment Matrix with sticky month column */}
      <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule bg-surface-subtle text-left text-xs font-bold uppercase tracking-wider text-ink-muted">
              <th className="sticky left-0 z-20 border-r border-rule/80 bg-surface-subtle py-3 pl-3.5 pr-3">
                Mes
              </th>
              <th className="py-3 px-2.5">Cuota ($)</th>
              {visiblePozoPlayers.map((p) => {
                const st = playerDebtSummary.get(p.id);
                return (
                  <th
                    key={p.id}
                    className="py-3 px-2 text-center whitespace-nowrap"
                    title={p.displayName}
                  >
                    <span className="block text-ink">{p.displayName}</span>
                    {st && (
                      <span
                        className={cn(
                          "mt-0.5 block text-[10px] font-semibold normal-case",
                          st.pendingMonths > 0 ? "text-crimson-600" : "text-pitch-700"
                        )}
                      >
                        {st.paidMonths}/{months.length}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {months.map((m) => (
              <tr key={m.id} className="bg-surface hover:bg-pitch-50/40">
                <td className="sticky left-0 z-10 border-r border-rule/80 bg-surface py-2.5 pl-3.5 pr-3 font-semibold text-ink whitespace-nowrap">
                  {m.monthLabel}
                </td>
                <td className="py-2 px-2.5">
                  <input
                    type="number"
                    aria-label={`Cuota ${m.monthLabel}`}
                    value={m.feeAmount}
                    onChange={(e) =>
                      updateFundMonthFee(m.id, Number(e.target.value) || 0)
                    }
                    className="font-display min-h-10 w-24 rounded-md border border-rule bg-paper px-2.5 text-base font-bold text-ink"
                  />
                </td>
                {visiblePozoPlayers.map((p) => {
                  const isPaid = paidMap.get(`${m.id}|${p.id}`) ?? false;
                  return (
                    <td key={p.id} className="py-1.5 px-1 text-center">
                      <button
                        type="button"
                        aria-pressed={isPaid}
                        aria-label={`${p.displayName} - ${m.monthLabel}: ${isPaid ? "Pagó" : "Pendiente"}`}
                        onClick={() => toggleFundPayment(m.id, p.id)}
                        className={cn(
                          "inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors",
                          isPaid
                            ? "border-pitch-800 bg-pitch-800 text-white"
                            : "border-rule bg-paper text-rule-strong hover:border-pitch-700 hover:text-pitch-700"
                        )}
                        title={`${p.displayName} - ${m.monthLabel}: ${isPaid ? "Pagó" : "Pendiente"}`}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Expense / Yield */}
      <form
        onSubmit={handleAddTx}
        className="rounded-lg border border-rule bg-surface p-4"
      >
        <h3 className="font-display mb-3 flex items-center gap-2 text-lg font-bold tracking-wide text-ink">
          <PlusCircle className="h-4 w-4 text-pitch-700" />
          Registrar Gasto, Premio o Rendimiento
        </h3>
        <div className="grid gap-2.5 sm:grid-cols-4">
          <select
            value={txType}
            onChange={(e) => setTxType(e.target.value as FundTxType)}
            className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
          >
            <option value="expense">Gasto / Premio (-)</option>
            <option value="yield">Rendimiento (+)</option>
          </select>
          <input
            type="number"
            placeholder="Monto ($)"
            value={txAmount}
            onChange={(e) => setTxAmount(e.target.value)}
            className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
            required
          />
          <input
            type="text"
            placeholder="Descripción (ej. Trofeo Liga 26)"
            value={txDesc}
            onChange={(e) => setTxDesc(e.target.value)}
            className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base text-ink sm:col-span-2 sm:text-sm"
            required
          />
        </div>
        <button
          type="submit"
          className="mt-3 min-h-11 rounded-md bg-pitch-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-900"
        >
          Agregar Movimiento
        </button>

        {transactions.length > 0 && (
          <ul className="mt-4 divide-y divide-rule border-t border-rule pt-2 text-sm">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-ink">{tx.description}</span>
                  <span className="ml-2 text-xs text-ink-muted">
                    {formatDateEs(tx.txDate)}
                  </span>
                </div>
                <span
                  className={cn(
                    "font-display shrink-0 text-base font-bold",
                    tx.txType === "yield"
                      ? "text-pitch-700"
                      : "text-crimson-600"
                  )}
                >
                  {tx.txType === "yield" ? "+" : "-"}
                  {formatArs(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </form>
    </div>
  );
}
