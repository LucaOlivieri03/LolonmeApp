import type {
  FundMonth,
  FundPayment,
  FundTransaction,
  Season,
} from "@/lib/types/domain";

export const SPANISH_MONTH_LABELS: Array<{ monthNumber: number; monthLabel: string }> = [
  { monthNumber: 1, monthLabel: "Enero" },
  { monthNumber: 2, monthLabel: "Febrero" },
  { monthNumber: 3, monthLabel: "Marzo" },
  { monthNumber: 4, monthLabel: "Abril" },
  { monthNumber: 5, monthLabel: "Mayo" },
  { monthNumber: 6, monthLabel: "Junio" },
  { monthNumber: 7, monthLabel: "Julio" },
  { monthNumber: 8, monthLabel: "Agosto" },
  { monthNumber: 9, monthLabel: "Septiembre" },
  { monthNumber: 10, monthLabel: "Octubre" },
  { monthNumber: 11, monthLabel: "Noviembre" },
  { monthNumber: 12, monthLabel: "Diciembre" },
];

export function resolveDefaultSeasonId(
  seasons: Season[],
  currentId?: string
): string {
  if (seasons.length === 0) return "";
  if (currentId && seasons.some((s) => s.id === currentId)) {
    return currentId;
  }
  const sorted = [...seasons].sort((a, b) => b.year - a.year);
  const active = sorted.find((s) => s.status === "active");
  return (active ?? sorted[0])?.id ?? "";
}

export function enrollPlayerInSeasonFund(
  fundMonths: FundMonth[],
  fundPayments: FundPayment[],
  seasonId: string,
  playerId: string
): FundPayment[] {
  const seasonMonths = fundMonths.filter((m) => m.seasonId === seasonId);
  const existingKeys = new Set(
    fundPayments.map((p) => `${p.fundMonthId}|${p.playerId}`)
  );
  const additions: FundPayment[] = [];
  for (const m of seasonMonths) {
    const key = `${m.id}|${playerId}`;
    if (!existingKeys.has(key)) {
      additions.push({
        id: `fp-${m.id}-${playerId}`,
        fundMonthId: m.id,
        playerId,
        paid: false,
      });
    }
  }
  return additions.length > 0 ? [...fundPayments, ...additions] : fundPayments;
}

export interface FundMonthBreakdown {
  month: FundMonth;
  paidCount: number;
  collectedAmount: number;
}

export interface FundSummary {
  totalCollected: number;
  totalExpenses: number;
  totalYields: number;
  balance: number;
  byMonth: FundMonthBreakdown[];
}

export function computeFundSummary(
  months: FundMonth[],
  payments: FundPayment[],
  transactions: FundTransaction[]
): FundSummary {
  const byMonth: FundMonthBreakdown[] = months.map((month) => {
    const paidCount = payments.filter(
      (p) => p.fundMonthId === month.id && p.paid
    ).length;
    return {
      month,
      paidCount,
      collectedAmount: paidCount * month.feeAmount,
    };
  });

  const totalCollected = byMonth.reduce((sum, m) => sum + m.collectedAmount, 0);
  const totalExpenses = transactions
    .filter((t) => t.txType === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalYields = transactions
    .filter((t) => t.txType === "yield")
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    totalCollected,
    totalExpenses,
    totalYields,
    balance: totalCollected - totalExpenses + totalYields,
    byMonth,
  };
}
