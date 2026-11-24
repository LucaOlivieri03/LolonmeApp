import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  FundMonth,
  FundPayment,
  FundTransaction,
} from "@/lib/types/domain";
import { requireAdmin, type AdminSession } from "@/server/auth";
import { mapDatabaseRowsToDataset } from "@/server/db/mappers";
import type {
  DbFundMonthRow,
  DbFundPaymentRow,
  DbFundTransactionRow,
  DbPlayerRow,
  DbSeasonRow,
} from "@/server/db/types";
import type { AdminFundRepository } from "./ports";
import { toAdminFundData } from "./projections";
import { PUBLIC_PLAYER_COLUMNS } from "./supabase-public-repository";
import type { AdminFundData } from "./types";

const PAGE_SIZE = 1000;

async function fetchAllAdminRows<T>(
  client: SupabaseClient,
  table: string,
  columns: string
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Supabase query failed on "${table}": ${error.message}`);
    }

    const batch = (data ?? []) as unknown as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  return rows;
}

export interface SupabaseAdminFundRepositoryOptions {
  client?: SupabaseClient;
  authorizeAdmin?: () => Promise<AdminSession>;
}

/**
 * Admin-only Pozo repository backed by session-scoped Supabase SSR client.
 * Defense-in-depth: validates `requireAdmin()` in app code AND relies on PostgreSQL RLS `public.is_admin()`.
 */
export class SupabaseAdminFundRepository implements AdminFundRepository {
  private readonly injectedClient?: SupabaseClient;
  private readonly authorizeAdmin: () => Promise<AdminSession>;

  constructor(options?: SupabaseAdminFundRepositoryOptions) {
    this.injectedClient = options?.client;
    this.authorizeAdmin = options?.authorizeAdmin ?? (() => requireAdmin());
  }

  private async getAuthorizedClient(): Promise<SupabaseClient> {
    await this.authorizeAdmin();
    if (this.injectedClient) {
      return this.injectedClient;
    }
    const client = await createSupabaseServerClient();
    if (!client) {
      throw new Error(
        "Supabase SSR client is unavailable because Supabase environment variables are not configured."
      );
    }
    return client as unknown as SupabaseClient;
  }

  async getFundData(seasonId?: string): Promise<AdminFundData> {
    const client = await this.getAuthorizedClient();

    const [seasons, players, fund_months, fund_payments, fund_transactions] =
      await Promise.all([
        fetchAllAdminRows<DbSeasonRow>(
          client,
          "seasons",
          "id, year, name, status, cup_cutoff_date"
        ),
        fetchAllAdminRows<DbPlayerRow>(
          client,
          "players",
          PUBLIC_PLAYER_COLUMNS
        ),
        fetchAllAdminRows<DbFundMonthRow>(
          client,
          "fund_months",
          "id, season_id, month_number, month_label, fee_amount"
        ),
        fetchAllAdminRows<DbFundPaymentRow>(
          client,
          "fund_payments",
          "id, fund_month_id, player_id, paid, paid_at"
        ),
        fetchAllAdminRows<DbFundTransactionRow>(
          client,
          "fund_transactions",
          "id, external_key, season_id, tx_type, amount, description, tx_date"
        ),
      ]);

    const dataset = mapDatabaseRowsToDataset({
      seasons,
      players,
      fund_months,
      fund_payments,
      fund_transactions,
    });

    return toAdminFundData(dataset, seasonId);
  }

  async getFundMonths(seasonId?: string): Promise<FundMonth[]> {
    const data = await this.getFundData(seasonId);
    return data.fundMonths;
  }

  async getFundPayments(seasonId?: string): Promise<FundPayment[]> {
    const data = await this.getFundData(seasonId);
    return data.fundPayments;
  }

  async getFundTransactions(seasonId?: string): Promise<FundTransaction[]> {
    const data = await this.getFundData(seasonId);
    return data.fundTransactions;
  }
}
