"use client";

import { useMemo, useState } from "react";
import { Check, PlusCircle, Wallet } from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import { computeFundSummary } from "@/lib/engine";
import type { FundTxType } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

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

  // Players that appear in this season's fund payments (or top active players)
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

  const formatARS = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-pitch-700" />
          <div>
            <h2 className="text-sm font-black text-navy-900">
              Pozo y Premios (Exclusivo Admin)
            </h2>
            <p className="text-[11px] text-slate-500">
              Cuota configurable por mes · Saldo automático
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {sortedSeasons.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeasonId(s.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-bold",
                seasonId === s.id
                  ? "border-navy-800 bg-navy-800 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              )}
            >
              {s.year}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-pitch-700/15 bg-white p-3">
          <span className="text-[10px] font-bold uppercase text-slate-400">
            Cuotas Recaudadas
          </span>
          <p className="mt-1 text-base font-black text-pitch-800">
            {formatARS(summary.totalCollected)}
          </p>
        </div>
        <div className="rounded-xl border border-pitch-700/15 bg-white p-3">
          <span className="text-[10px] font-bold uppercase text-slate-400">
            Rendimientos
          </span>
          <p className="mt-1 text-base font-black text-navy-700">
            +{formatARS(summary.totalYields)}
          </p>
        </div>
        <div className="rounded-xl border border-pitch-700/15 bg-white p-3">
          <span className="text-[10px] font-bold uppercase text-slate-400">
            Gastos / Premios
          </span>
          <p className="mt-1 text-base font-black text-crimson-600">
            -{formatARS(summary.totalExpenses)}
          </p>
        </div>
        <div className="rounded-xl bg-navy-900 p-3 text-white">
          <span className="text-[10px] font-bold uppercase text-gold-400">
            Saldo Total
          </span>
          <p className="mt-1 text-base font-black">
            {formatARS(summary.balance)}
          </p>
        </div>
      </div>

      {/* Monthly Fees & Payment Matrix */}
      <div className="overflow-x-auto rounded-2xl border border-pitch-700/15 bg-white shadow-xs">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-pitch-50 text-left text-[11px] font-bold text-navy-900">
              <th className="py-2.5 pl-3 pr-2">Mes</th>
              <th className="py-2.5 px-2">Cuota ($)</th>
              {pozoPlayers.map((p) => (
                <th key={p.id} className="py-2.5 px-1.5 text-center">
                  {p.displayName.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {months.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="py-2 pl-3 pr-2 font-bold text-navy-900">
                  {m.monthLabel}
                </td>
                <td className="py-2 px-2">
                  <input
                    type="number"
                    value={m.feeAmount}
                    onChange={(e) =>
                      updateFundMonthFee(m.id, Number(e.target.value) || 0)
                    }
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs font-bold text-navy-900"
                  />
                </td>
                {pozoPlayers.map((p) => {
                  const isPaid = paidMap.get(`${m.id}|${p.id}`) ?? false;
                  return (
                    <td key={p.id} className="py-2 px-1 text-center">
                      <button
                        type="button"
                        onClick={() => toggleFundPayment(m.id, p.id)}
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors",
                          isPaid
                            ? "border-pitch-700 bg-pitch-700 text-white"
                            : "border-slate-200 bg-white text-slate-300 hover:border-pitch-500"
                        )}
                        title={`${p.displayName} - ${m.monthLabel}: ${isPaid ? "Pagó" : "Pendiente"}`}
                      >
                        <Check className="h-3.5 w-3.5" />
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
        className="rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs"
      >
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-navy-800">
          <PlusCircle className="h-4 w-4 text-pitch-700" />
          Registrar Gasto, Premio o Rendimiento
        </h3>
        <div className="grid gap-2.5 sm:grid-cols-4">
          <select
            value={txType}
            onChange={(e) => setTxType(e.target.value as FundTxType)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-navy-900"
          >
            <option value="expense">Gasto / Premio (-)</option>
            <option value="yield">Rendimiento (+)</option>
          </select>
          <input
            type="number"
            placeholder="Monto ($)"
            value={txAmount}
            onChange={(e) => setTxAmount(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            required
          />
          <input
            type="text"
            placeholder="Descripción (ej. Trofeo Liga 26)"
            value={txDesc}
            onChange={(e) => setTxDesc(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs sm:col-span-2"
            required
          />
        </div>
        <button
          type="submit"
          className="mt-3 rounded-xl bg-pitch-700 px-4 py-2 text-xs font-bold text-white hover:bg-pitch-800"
        >
          Agregar Movimiento
        </button>

        {transactions.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 pt-2 text-xs">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <span className="font-bold text-navy-900">
                    {tx.description}
                  </span>
                  <span className="ml-2 text-[11px] text-slate-400">
                    {tx.txDate}
                  </span>
                </div>
                <span
                  className={cn(
                    "font-mono font-bold",
                    tx.txType === "yield"
                      ? "text-pitch-700"
                      : "text-crimson-600"
                  )}
                >
                  {tx.txType === "yield" ? "+" : "-"}
                  {formatARS(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </form>
    </div>
  );
}
