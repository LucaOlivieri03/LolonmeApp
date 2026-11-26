import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlayerRole } from "@/lib/types/domain";
import type {
  AdminPendingLinkRequestItem,
  AdminPlayerAuthLinkInfo,
  AdminPlayerLinkStatus,
} from "@/lib/types/view-models";
import { getViewerSession, type ViewerSession } from "@/server/auth";
import {
  getAdminFundRepository,
  getPublicTournamentRepository,
  type AdminFundData,
  type AdminFundRepository,
  type PublicTournamentData,
  type PublicTournamentRepository,
} from "@/server/repositories";

export type {
  AdminPendingLinkRequestItem,
  AdminPlayerAuthLinkInfo,
  AdminPlayerLinkStatus,
};

export interface AdminSessionSummary {
  role: "admin" | "authorized";
  playerId: string | null;
  displayName: string | null;
}

export interface AdminAuthLinksData {
  pendingLinkRequests: AdminPendingLinkRequestItem[];
  playerAuthLinks: Record<string, AdminPlayerAuthLinkInfo>;
}

export interface AdminAuthLinksLoader {
  loadAuthLinksData(
    players: PublicTournamentData["players"]
  ): Promise<AdminAuthLinksData>;
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
      pendingLinkRequests: AdminPendingLinkRequestItem[] | null;
      playerAuthLinks: Record<string, AdminPlayerAuthLinkInfo> | null;
    };

interface RpcAuthLinkRow {
  player_id: string;
  player_slug: string;
  email: string | null;
  is_linked: boolean;
}

interface DbPendingLinkRequestRow {
  id: string;
  email: string;
  requested_player_id: string;
  created_at: string;
}

function buildDefaultPlayerAuthLinks(
  players: PublicTournamentData["players"]
): Record<string, AdminPlayerAuthLinkInfo> {
  const map: Record<string, AdminPlayerAuthLinkInfo> = {};
  for (const player of players) {
    map[player.id] = {
      playerId: player.id,
      email: null,
      isLinked: false,
      status: "unlinked",
    };
  }
  return map;
}

export function createSupabaseAdminAuthLinksLoader(
  client: SupabaseClient | null
): AdminAuthLinksLoader {
  return {
    async loadAuthLinksData(players) {
      const playerAuthLinks = buildDefaultPlayerAuthLinks(players);
      if (!client) {
        return {
          pendingLinkRequests: [],
          playerAuthLinks,
        };
      }

      const [rpcRes, pendingRes] = await Promise.all([
        client.rpc("admin_list_player_auth_links"),
        client
          .from("player_link_requests")
          .select("id, email, requested_player_id, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
      ]);

      const uuidToPlayer = new Map<
        string,
        { slug: string; displayName: string }
      >();
      const nameBySlug = new Map(
        players.map((p) => [p.id, p.displayName] as const)
      );

      if (!rpcRes.error && Array.isArray(rpcRes.data)) {
        for (const row of rpcRes.data as RpcAuthLinkRow[]) {
          const slug = row.player_slug || row.player_id;
          const cleanEmail = row.email?.trim().toLowerCase() || null;
          const isLinked = Boolean(row.is_linked);
          const status: AdminPlayerLinkStatus = isLinked
            ? "linked"
            : cleanEmail
              ? "preloaded"
              : "unlinked";

          playerAuthLinks[slug] = {
            playerId: slug,
            email: cleanEmail,
            isLinked,
            status,
          };

          uuidToPlayer.set(row.player_id, {
            slug,
            displayName: nameBySlug.get(slug) ?? slug,
          });
        }
      }

      const pendingLinkRequests: AdminPendingLinkRequestItem[] = [];
      if (!pendingRes.error && Array.isArray(pendingRes.data)) {
        for (const req of pendingRes.data as DbPendingLinkRequestRow[]) {
          const resolved = uuidToPlayer.get(req.requested_player_id);
          pendingLinkRequests.push({
            id: req.id,
            email: req.email,
            requestedPlayerId: resolved?.slug ?? req.requested_player_id,
            requestedPlayerName:
              resolved?.displayName ?? "Jugador del padrón",
            createdAt: req.created_at,
          });
        }
      }

      return {
        pendingLinkRequests,
        playerAuthLinks,
      };
    },
  };
}

/**
 * Pure loader for `/admin` SSR guard and data hydration.
 * - Never loads or serializes tournament data when the viewer is not an operator.
 * - Loads sensitive Pozo (`fund_*`), `pendingLinkRequests`, and `playerAuthLinks`
 *   ONLY when `session.role === "admin"`.
 */
export async function loadAdminViewModel(
  session: ViewerSession,
  repo: PublicTournamentRepository,
  fundRepo?: AdminFundRepository,
  authLinksLoader?: AdminAuthLinksLoader
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

    const authLinks = authLinksLoader
      ? await authLinksLoader.loadAuthLinksData(data.players)
      : {
          pendingLinkRequests: [],
          playerAuthLinks: buildDefaultPlayerAuthLinks(data.players),
        };

    return {
      status: "authorized",
      session: {
        role: session.role,
        playerId: session.playerId,
        displayName: session.displayName,
      },
      data,
      fund,
      pendingLinkRequests: authLinks.pendingLinkRequests,
      playerAuthLinks: authLinks.playerAuthLinks,
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
    pendingLinkRequests: null,
    playerAuthLinks: null,
  };
}

/**
 * Server-only SSR entrypoint for `/admin`.
 * Always reads fresh data (no unstable_cache) so admin mutations reflect immediately.
 */
export async function getAdminViewModel(): Promise<AdminViewModel> {
  const session = await getViewerSession();
  const repo = getPublicTournamentRepository();

  if (session.role === "admin") {
    const client = await createSupabaseServerClient();
    return loadAdminViewModel(
      session,
      repo,
      undefined,
      createSupabaseAdminAuthLinksLoader(client)
    );
  }

  return loadAdminViewModel(session, repo);
}
