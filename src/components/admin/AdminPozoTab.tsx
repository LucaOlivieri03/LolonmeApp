"use client";

import { useMemo, useState } from "react";
import { Check, PlusCircle, Wallet } from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import { computeFundSummary } from "@/lib/engine";
import type { FundTxType } from "@/lib/types/domain";
import { cn, formatArs, formatDateEs } from "@/lib/utils";

export function AdminPozoTab() {
  const {
    dataset,
    toggleFundPayment,
    updateFundMonthFee,
    addFundTransaction,
  } = useTournament();

  const sortedSeasons = useMemo(
    () => [...dataset.seasons].sort((a, b) => b.year - a.year),
    [dataset.seasons]
  );
  const [seasonId, setSeasonId] = useState(sortedSeasons[0]?.id ?? "season-2026");

  const [txType, setTxType] = useState<FundTxType>("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txDesc, setTxDesc] = useState("");

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

      {/* Monthly Fees & Payment Matrix with sticky month column */}
      <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule bg-surface-subtle text-left text-xs font-bold uppercase tracking-wider text-ink-muted">
              <th className="sticky left-0 z-20 border-r border-rule/80 bg-surface-subtle py-3 pl-3.5 pr-3">
                Mes
              </th>
              <th className="py-3 px-2.5">Cuota ($)</th>
              {pozoPlayers.map((p) => (
                <th key={p.id} className="py-3 px-1.5 text-center">
                  {p.displayName.split(" ")[0]}
                </th>
              ))}
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
                {pozoPlayers.map((p) => {
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
