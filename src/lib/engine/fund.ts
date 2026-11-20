import type {
  FundMonth,
  FundPayment,
  FundTransaction,
} from "@/lib/types/domain";

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
