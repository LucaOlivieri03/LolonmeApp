import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AdminFundRepository, PublicTournamentRepository } from "./ports";
import {
  SeedAdminFundRepository,
  SeedPublicTournamentRepository,
} from "./seed-repository";
import { SupabaseAdminFundRepository } from "./supabase-admin-fund-repository";
import { SupabaseTournamentRepository } from "./supabase-public-repository";

export * from "./types";
export * from "./ports";
export * from "./projections";
export * from "./supabase-public-repository";
export * from "./supabase-admin-fund-repository";
export * from "./seed-repository";

/**
 * Returns the active public tournament repository:
 * Supabase PostgreSQL when configured, or deterministic server-side seed fallback for CI/tests.
 */
export function getPublicTournamentRepository(): PublicTournamentRepository {
  if (isSupabaseConfigured()) {
    return new SupabaseTournamentRepository();
  }
  return new SeedPublicTournamentRepository();
}

/**
 * Returns the active admin-only Pozo repository:
 * Session-scoped Supabase SSR client when configured, or guarded server-side seed fallback.
 */
export function getAdminFundRepository(): AdminFundRepository {
  if (isSupabaseConfigured()) {
    return new SupabaseAdminFundRepository();
  }
  return new SeedAdminFundRepository();
}
