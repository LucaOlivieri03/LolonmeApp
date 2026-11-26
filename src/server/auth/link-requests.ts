import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActionResult,
  RequestPlayerLinkInput,
} from "@/lib/types/admin-actions";
import type { PlayerRole } from "@/lib/types/domain";
import type {
  AvailableUnlinkedPlayer,
  PlayerLinkRequestSummary,
} from "@/lib/types/view-models";
import { normalizeEmailInput } from "./actions-core";
import type { ViewerSession } from "./session";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CandidatePlayerRow {
  id: string;
  slug: string;
  display_name: string;
  nickname: string | null;
  role: Exclude<PlayerRole, "guest">;
  is_active: boolean;
  user_id: string | null;
}

export interface PendingLinkRequestRow {
  id: string;
  user_id: string;
  email: string;
  requested_player_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  review_note: string | null;
}

export interface LinkRequestDbAdapter {
  listCandidatePlayers(): Promise<CandidatePlayerRow[]>;
  findPendingRequestByUserId(userId: string): Promise<PendingLinkRequestRow | null>;
  findPlayerByUserId(userId: string): Promise<CandidatePlayerRow | null>;
  findPlayerByIdentifier(identifier: string): Promise<CandidatePlayerRow | null>;
  insertPendingRequest(row: {
    user_id: string;
    email: string;
    requested_player_id: string;
  }): Promise<{
    data: PendingLinkRequestRow | null;
    error: { message: string; code?: string } | null;
  }>;
}

const SAFE_PLAYER_CANDIDATE_COLUMNS =
  "id, slug, display_name, nickname, role, is_active, user_id";

export function createSupabaseLinkRequestAdapter(
  client: SupabaseClient | null
): LinkRequestDbAdapter | null {
  if (!client) return null;

  return {
    async listCandidatePlayers() {
      const { data, error } = await client
        .from("players")
        .select(SAFE_PLAYER_CANDIDATE_COLUMNS)
        .eq("is_active", true)
        .is("user_id", null)
        .neq("role", "admin")
        .order("display_name", { ascending: true });

      if (error || !data) return [];
      return data as CandidatePlayerRow[];
    },

    async findPendingRequestByUserId(userId: string) {
      const { data, error } = await client
        .from("player_link_requests")
        .select(
          "id, user_id, email, requested_player_id, status, created_at, review_note"
        )
        .eq("user_id", userId)
        .eq("status", "pending")
        .maybeSingle();

      if (error || !data) return null;
      return data as PendingLinkRequestRow;
    },

    async findPlayerByUserId(userId: string) {
      const { data, error } = await client
        .from("players")
        .select(SAFE_PLAYER_CANDIDATE_COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();

      if (error || !data) return null;
      return data as CandidatePlayerRow;
    },

    async findPlayerByIdentifier(identifier: string) {
      const trimmed = identifier.trim();
      if (!trimmed) return null;

      const bySlug = await client
        .from("players")
        .select(SAFE_PLAYER_CANDIDATE_COLUMNS)
        .eq("slug", trimmed)
        .maybeSingle();

      if (!bySlug.error && bySlug.data) {
        return bySlug.data as CandidatePlayerRow;
      }

      if (UUID_REGEX.test(trimmed)) {
        const byId = await client
          .from("players")
          .select(SAFE_PLAYER_CANDIDATE_COLUMNS)
          .eq("id", trimmed)
          .maybeSingle();

        if (!byId.error && byId.data) {
          return byId.data as CandidatePlayerRow;
        }
      }

      return null;
    },

    async insertPendingRequest(row) {
      const { data, error } = await client
        .from("player_link_requests")
        .insert({
          user_id: row.user_id,
          email: row.email,
          requested_player_id: row.requested_player_id,
          status: "pending",
        })
        .select(
          "id, user_id, email, requested_player_id, status, created_at, review_note"
        )
        .single();

      return {
        data: (data as PendingLinkRequestRow | null) ?? null,
        error: error
          ? {
              message: error.message,
              ...(error.code ? { code: error.code } : {}),
            }
          : null,
      };
    },
  };
}

export interface UnlinkedProfileState {
  pendingRequest: PlayerLinkRequestSummary | null;
  availablePlayers: AvailableUnlinkedPlayer[];
}

export async function loadUnlinkedProfileState(
  adapter: LinkRequestDbAdapter | null,
  userId: string
): Promise<UnlinkedProfileState> {
  if (!adapter || !userId) {
    return {
      pendingRequest: null,
      availablePlayers: [],
    };
  }

  const [candidates, pendingRow] = await Promise.all([
    adapter.listCandidatePlayers(),
    adapter.findPendingRequestByUserId(userId),
  ]);

  const availablePlayers: AvailableUnlinkedPlayer[] = candidates
    .filter(
      (p) =>
        p.is_active === true &&
        (p.user_id === null || p.user_id === undefined) &&
        p.role !== "admin"
    )
    .sort((a, b) => a.display_name.localeCompare(b.display_name, "es"))
    .map((p) => ({
      id: p.slug || p.id,
      displayName: p.display_name,
      ...(p.nickname ? { nickname: p.nickname } : {}),
    }));

  if (!pendingRow) {
    return {
      pendingRequest: null,
      availablePlayers,
    };
  }

  const matchedCandidate = candidates.find(
    (p) => p.id === pendingRow.requested_player_id
  );
  const resolvedTarget =
    matchedCandidate ??
    (await adapter.findPlayerByIdentifier(pendingRow.requested_player_id));

  const pendingRequest: PlayerLinkRequestSummary = {
    id: pendingRow.id,
    requestedPlayerId:
      resolvedTarget?.slug || resolvedTarget?.id || pendingRow.requested_player_id,
    requestedPlayerName: resolvedTarget?.display_name ?? "Jugador del padrón",
    status: pendingRow.status,
    createdAt: pendingRow.created_at,
    reviewNote: pendingRow.review_note ?? null,
  };

  return {
    pendingRequest,
    availablePlayers,
  };
}

export async function performRequestPlayerLink(
  adapter: LinkRequestDbAdapter | null,
  session: ViewerSession,
  input: RequestPlayerLinkInput
): Promise<ActionResult<{ requestId: string }>> {
  if (!session.userId) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      error: "Debés iniciar sesión para solicitar la vinculación de tu cuenta.",
    };
  }

  if (session.playerId !== null || session.role !== "guest") {
    return {
      ok: false,
      code: "CONFLICT",
      error: "Tu cuenta ya se encuentra vinculada a un jugador del padrón.",
    };
  }

  if (!adapter) {
    return {
      ok: false,
      code: "UNCONFIGURED",
      error: "Supabase Auth no está configurado en este entorno.",
    };
  }

  const targetIdentifier = input.playerId?.trim() ?? "";
  if (!targetIdentifier) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Seleccioná tu nombre del padrón para enviar la solicitud.",
    };
  }

  const email = normalizeEmailInput(session.email);
  if (!email) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Tu cuenta no dispone de un correo electrónico válido.",
    };
  }

  const [existingLinkedPlayer, existingPending, targetPlayer] =
    await Promise.all([
      adapter.findPlayerByUserId(session.userId),
      adapter.findPendingRequestByUserId(session.userId),
      adapter.findPlayerByIdentifier(targetIdentifier),
    ]);

  if (existingLinkedPlayer) {
    return {
      ok: false,
      code: "CONFLICT",
      error: "Tu cuenta ya se encuentra vinculada a un jugador del padrón.",
    };
  }

  if (existingPending) {
    return {
      ok: false,
      code: "CONFLICT",
      error:
        "Ya tenés una solicitud de vinculación pendiente de aprobación por el administrador.",
    };
  }

  if (!targetPlayer) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "Jugador no encontrado en el padrón.",
    };
  }

  if (!targetPlayer.is_active) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Ese jugador no se encuentra activo en el padrón.",
    };
  }

  if (targetPlayer.role === "admin") {
    return {
      ok: false,
      code: "FORBIDDEN",
      error:
        "Las fichas de administrador no admiten solicitudes de auto-vinculación.",
    };
  }

  if (targetPlayer.user_id !== null && targetPlayer.user_id !== undefined) {
    return {
      ok: false,
      code: "CONFLICT",
      error: "Ese jugador ya tiene otra cuenta vinculada.",
    };
  }

  const { data, error } = await adapter.insertPendingRequest({
    user_id: session.userId,
    email,
    requested_player_id: targetPlayer.id,
  });

  if (error || !data) {
    if (error?.code === "23505") {
      return {
        ok: false,
        code: "CONFLICT",
        error:
          "Ya tenés una solicitud de vinculación pendiente de aprobación por el administrador.",
      };
    }
    return {
      ok: false,
      code: "INTERNAL",
      error: "No se pudo registrar la solicitud de vinculación.",
    };
  }

  return {
    ok: true,
    message: `Solicitud enviada para vincularte como ${targetPlayer.display_name}.`,
    data: { requestId: data.id },
  };
}
