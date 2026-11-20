"use client";

import { useMemo, useState } from "react";
import { Check, PlusCircle, Search, UserPlus, Wallet } from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import { computeFundSummary, resolveDefaultSeasonId } from "@/lib/engine";
import type { FundTxType } from "@/lib/types/domain";
import { cn, formatArs, formatDateEs } from "@/lib/utils";

export function AdminPozoTab() {
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

  const [playerQuery, setPlayerQuery] = useState("");
  const [enrollPlayerId, setEnrollPlayerId] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");

  const [txType, setTxType] = useState<FundTxType>("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txDesc, setTxDesc] = useState("");

  if (role !== "admin") {
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

  const filteredPozoPlayers = useMemo(() => {
    const q = playerQuery.trim().toLowerCase();
    if (!q) return pozoPlayers;
    return pozoPlayers.filter((p) =>
      p.displayName.toLowerCase().includes(q)
    );
  }, [pozoPlayers, playerQuery]);

  const unEnrolledPlayers = useMemo(() => {
    const enrolledIds = new Set(pozoPlayers.map((p) => p.id));
    return dataset.players.filter((p) => !enrolledIds.has(p.id));
  }, [dataset.players, pozoPlayers]);

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

  const handleEnrollExisting = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = enrollPlayerId || unEnrolledPlayers[0]?.id;
    if (!targetId) return;
    addPlayerToPozo(seasonId, targetId);
    setEnrollPlayerId("");
  };

  const handleCreateAndEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    const createdId = addPlayer({
      displayName: newPlayerName.trim(),
      role: "player",
    });
    addPlayerToPozo(seasonId, createdId);
    setNewPlayerName("");
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
              onClick={() => setSeasonId(s.id)}
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

      {/* Filter by person & Enroll player into Pozo */}
      <div className="grid gap-3 rounded-lg border border-rule bg-surface p-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <label
            htmlFor="pozo-person-filter"
            className="block text-xs font-bold uppercase tracking-wider text-ink-muted"
          >
            Filtrar por persona ({filteredPozoPlayers.length}/{pozoPlayers.length})
          </label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              id="pozo-person-filter"
              type="search"
              value={playerQuery}
              onChange={(e) => setPlayerQuery(e.target.value)}
              placeholder="Buscar jugador en el Pozo..."
              className="min-h-10 w-full rounded-md border border-rule bg-paper pr-3 pl-9 text-base text-ink placeholder:text-ink-muted sm:text-sm"
            />
          </div>
        </div>

        <form
          onSubmit={handleEnrollExisting}
          className="flex flex-col justify-end gap-2 sm:flex-row sm:items-end lg:col-span-4"
        >
          <div className="flex-1">
            <label
              htmlFor="pozo-enroll-select"
              className="block text-xs font-bold uppercase tracking-wider text-ink-muted"
            >
              Incorporar jugador del padrón
            </label>
            <select
              id="pozo-enroll-select"
              value={enrollPlayerId || unEnrolledPlayers[0]?.id || ""}
              onChange={(e) => setEnrollPlayerId(e.target.value)}
              disabled={unEnrolledPlayers.length === 0}
              className="mt-1 min-h-10 w-full rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink disabled:opacity-50 sm:text-sm"
            >
              {unEnrolledPlayers.length === 0 ? (
                <option value="">Todos los jugadores están en el Pozo</option>
              ) : (
                unEnrolledPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))
              )}
            </select>
          </div>
          <button
            type="submit"
            disabled={unEnrolledPlayers.length === 0}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md bg-pitch-800 px-3.5 text-xs font-bold text-white transition-colors hover:bg-pitch-900 disabled:opacity-40"
          >
            <UserPlus className="h-4 w-4" />
            Sumar al Pozo
          </button>
        </form>

        <form
          onSubmit={handleCreateAndEnroll}
          className="flex flex-col justify-end gap-2 sm:flex-row sm:items-end lg:col-span-4"
        >
          <div className="flex-1">
            <label
              htmlFor="pozo-create-player"
              className="block text-xs font-bold uppercase tracking-wider text-ink-muted"
            >
              Crear nuevo y sumar al Pozo
            </label>
            <input
              id="pozo-create-player"
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Nombre (ej. T. Allende)"
              className="mt-1 min-h-10 w-full rounded-md border border-rule bg-paper px-3 text-base text-ink placeholder:text-ink-muted sm:text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!newPlayerName.trim()}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-pitch-800 bg-surface px-3.5 text-xs font-bold text-pitch-800 transition-colors hover:bg-pitch-50 disabled:opacity-40"
          >
            <PlusCircle className="h-4 w-4" />
            Crear y Sumar
          </button>
        </form>
      </div>

      {/* Focused Player Payment/Debt Summary when filtering */}
      {playerQuery.trim() && filteredPozoPlayers.length > 0 && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPozoPlayers.map((p) => {
            const st = playerDebtSummary.get(p.id);
            if (!st) return null;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border border-rule bg-surface px-3.5 py-2.5 text-xs"
              >
                <div>
                  <p className="text-sm font-bold text-ink">{p.displayName}</p>
                  <p className="text-ink-muted">
                    {st.paidMonths} pagado{st.paidMonths === 1 ? "" : "s"} ·{" "}
                    {st.pendingMonths} pendiente{st.pendingMonths === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-display block text-sm font-bold text-pitch-800">
                    Pagó: {formatArs(st.paidAmount)}
                  </span>
                  <span
                    className={cn(
                      "font-display block text-sm font-bold",
                      st.debtAmount > 0 ? "text-crimson-600" : "text-ink-muted"
                    )}
                  >
                    Deuda: {formatArs(st.debtAmount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Monthly Fees & Payment Matrix with sticky month column */}
      <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule bg-surface-subtle text-left text-xs font-bold uppercase tracking-wider text-ink-muted">
              <th className="sticky left-0 z-20 border-r border-rule/80 bg-surface-subtle py-3 pl-3.5 pr-3">
                Mes
              </th>
              <th className="py-3 px-2.5">Cuota ($)</th>
              {filteredPozoPlayers.map((p) => {
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
                {filteredPozoPlayers.map((p) => {
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
