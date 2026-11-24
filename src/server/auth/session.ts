import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlayerRole } from "@/lib/types/domain";
import type { DbPlayerRole } from "@/server/db/types";

export type ViewerRole = PlayerRole;

export interface ViewerSession {
  role: ViewerRole;
  userId: string | null;
  playerId: string | null;
  playerUuid: string | null;
  displayName: string | null;
  email: string | null;
}

export interface AuthenticatedPlayerSession extends ViewerSession {
  role: Exclude<ViewerRole, "guest">;
  userId: string;
  playerId: string;
  playerUuid: string;
}

export interface OperatorSession extends AuthenticatedPlayerSession {
  role: "admin" | "authorized";
}

export interface AdminSession extends AuthenticatedPlayerSession {
  role: "admin";
}

export const GUEST_SESSION: Readonly<ViewerSession> = Object.freeze({
  role: "guest",
  userId: null,
  playerId: null,
  playerUuid: null,
  displayName: null,
  email: null,
});

interface LinkedPlayerLookupRow {
  id: string;
  slug: string;
  display_name: string;
  role: DbPlayerRole;
  is_active: boolean;
}

export interface AuthSessionClient {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: { message: string } | null;
    }>;
  };
  from: (table: "players") => {
    select: (columns: string) => {
      eq: (column: "user_id", value: string) => {
        maybeSingle: () => Promise<{
          data: LinkedPlayerLookupRow | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

/**
 * Resolves the current viewer session from an SSR Supabase client.
 * Never queries `players.email` (revoked by PostgreSQL RLS); reads email only from Auth.
 */
export async function resolveViewerSession(
  client: AuthSessionClient | null
): Promise<ViewerSession> {
  if (!client) {
    return { ...GUEST_SESSION };
  }

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return { ...GUEST_SESSION };
  }

  const { data: player, error: playerError } = await client
    .from("players")
    .select("id, slug, display_name, role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (playerError || !player || !player.is_active) {
    return {
      role: "guest",
      userId: user.id,
      playerId: null,
      playerUuid: null,
      displayName: null,
      email: user.email ?? null,
    };
  }

  return {
    role: player.role,
    userId: user.id,
    playerId: player.slug || player.id,
    playerUuid: player.id,
    displayName: player.display_name,
    email: user.email ?? null,
  };
}

/**
 * Reads the current viewer's SSR session and linked player role from Supabase.
 */
export async function getViewerSession(): Promise<ViewerSession> {
  const client = await createSupabaseServerClient();
  return resolveViewerSession(client as unknown as AuthSessionClient | null);
}
