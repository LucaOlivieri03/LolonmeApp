import "server-only";
import { AuthError } from "./errors";
import {
  getViewerSession,
  type AdminSession,
  type AuthenticatedPlayerSession,
  type OperatorSession,
  type ViewerSession,
} from "./session";

export function assertAuthenticatedPlayer(
  session: ViewerSession
): AuthenticatedPlayerSession {
  if (!session.userId) {
    throw new AuthError(401, "UNAUTHENTICATED", "Authentication required.");
  }
  if (!session.playerId || !session.playerUuid || session.role === "guest") {
    throw new AuthError(
      403,
      "FORBIDDEN",
      "An active linked player profile is required."
    );
  }
  return {
    ...session,
    role: session.role,
    userId: session.userId,
    playerId: session.playerId,
    playerUuid: session.playerUuid,
  };
}

export function assertOperator(session: ViewerSession): OperatorSession {
  const playerSession = assertAuthenticatedPlayer(session);
  if (playerSession.role !== "admin" && playerSession.role !== "authorized") {
    throw new AuthError(
      403,
      "FORBIDDEN",
      "Operator or admin privileges are required."
    );
  }
  return {
    ...playerSession,
    role: playerSession.role,
  };
}

export function assertAdmin(session: ViewerSession): AdminSession {
  const playerSession = assertAuthenticatedPlayer(session);
  if (playerSession.role !== "admin") {
    throw new AuthError(403, "FORBIDDEN", "Admin privileges are required.");
  }
  return {
    ...playerSession,
    role: "admin",
  };
}

export async function requireAuthenticatedPlayer(
  session?: ViewerSession
): Promise<AuthenticatedPlayerSession> {
  const resolved = session ?? (await getViewerSession());
  return assertAuthenticatedPlayer(resolved);
}

export async function requireOperator(
  session?: ViewerSession
): Promise<OperatorSession> {
  const resolved = session ?? (await getViewerSession());
  return assertOperator(resolved);
}

export async function requireAdmin(
  session?: ViewerSession
): Promise<AdminSession> {
  const resolved = session ?? (await getViewerSession());
  return assertAdmin(resolved);
}
