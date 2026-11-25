import "server-only";
import type { PlayerRole } from "@/lib/types/domain";
import { getViewerSession, type ViewerSession } from "@/server/auth";
import {
  getAdminFundRepository,
  getPublicTournamentRepository,
  type AdminFundData,
  type AdminFundRepository,
  type PublicTournamentData,
  type PublicTournamentRepository,
} from "@/server/repositories";

export interface AdminSessionSummary {
  role: "admin" | "authorized";
  playerId: string | null;
  displayName: string | null;
}

export type AdminViewModel =
  | {
      status: "unauthorized";
      isAuthenticated: boolean;
      role: PlayerRole;
    }
  | {
      status: "authorized";
      session: AdminSessionSummary;
      data: PublicTournamentData;
      fund: AdminFundData | null;
    };

/**
 * Pure loader for `/admin` SSR guard and data hydration.
 * - Never loads or serializes tournament data when the viewer is not an operator.
 * - Loads sensitive Pozo (`fund_*`) data ONLY when `session.role === "admin"`.
 */
export async function loadAdminViewModel(
  session: ViewerSession,
  repo: PublicTournamentRepository,
  fundRepo?: AdminFundRepository
): Promise<AdminViewModel> {
  if (session.role !== "admin" && session.role !== "authorized") {
    return {
      status: "unauthorized",
      isAuthenticated: Boolean(session.userId),
      role: session.role,
    };
  }

  if (session.role === "admin") {
    const activeFundRepo = fundRepo ?? getAdminFundRepository();
    const [data, fund] = await Promise.all([
      repo.getPublicDataset(),
      activeFundRepo.getFundData(),
    ]);

    return {
      status: "authorized",
      session: {
        role: session.role,
        playerId: session.playerId,
        displayName: session.displayName,
      },
      data,
      fund,
    };
  }

  const data = await repo.getPublicDataset();

  return {
    status: "authorized",
    session: {
      role: session.role,
      playerId: session.playerId,
      displayName: session.displayName,
    },
    data,
    fund: null,
  };
}

/**
 * Server-only SSR entrypoint for `/admin`.
 * Always reads fresh data (no unstable_cache) so admin mutations reflect immediately.
 */
export async function getAdminViewModel(): Promise<AdminViewModel> {
  const session = await getViewerSession();
  const repo = getPublicTournamentRepository();
  return loadAdminViewModel(session, repo);
}
