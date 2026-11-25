import { describe, expect, it, vi } from "vitest";
import {
  AuthError,
  GUEST_SESSION,
  isAuthError,
  performRequestEmailOtp,
  performSignInWithPassword,
  performVerifyEmailOtp,
  requireAdmin,
  requireAuthenticatedPlayer,
  requireOperator,
  resolveAuthCallback,
  resolveSafeAppOrigin,
  resolveViewerSession,
  sanitizeRedirectPath,
  type AuthSessionClient,
  type CallbackAuthClient,
  type ServerAuthActionsClient,
  type ViewerSession,
} from "./index";

function createMockAuthClient(options: {
  user?: { id: string; email?: string | null } | null;
  authError?: { message: string } | null;
  playerRow?: {
    id: string;
    slug: string;
    display_name: string;
    role: "admin" | "authorized" | "player";
    is_active: boolean;
  } | null;
  playerError?: { message: string } | null;
}) {
  const selectSpy = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: options.playerRow ?? null,
        error: options.playerError ?? null,
      }),
    }),
  });

  const client: AuthSessionClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user ?? null },
        error: options.authError ?? null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: selectSpy,
    }),
  };

  return { client, selectSpy };
}

async function expectAuthError(
  promise: Promise<unknown>,
  expectedStatus: 401 | 403,
  expectedCode: "UNAUTHENTICATED" | "FORBIDDEN"
) {
  try {
    await promise;
    throw new Error("Expected AuthError to be thrown, but promise resolved.");
  } catch (err) {
    expect(isAuthError(err)).toBe(true);
    const authErr = err as AuthError;
    expect(authErr.status).toBe(expectedStatus);
    expect(authErr.code).toBe(expectedCode);
  }
}

describe("resolveViewerSession", () => {
  it("returns guest session when Supabase client is null or unauthenticated", async () => {
    expect(await resolveViewerSession(null)).toEqual(GUEST_SESSION);

    const { client } = createMockAuthClient({ user: null });
    expect(await resolveViewerSession(client)).toEqual(GUEST_SESSION);
  });

  it("returns guest role with userId when auth user is unlinked or inactive", async () => {
    const unlinked = createMockAuthClient({
      user: { id: "user-1", email: "unlinked@example.com" },
      playerRow: null,
    });
    expect(await resolveViewerSession(unlinked.client)).toEqual({
      role: "guest",
      userId: "user-1",
      playerId: null,
      playerUuid: null,
      displayName: null,
      email: "unlinked@example.com",
    });

    const inactive = createMockAuthClient({
      user: { id: "user-2", email: "inactive@example.com" },
      playerRow: {
        id: "uuid-2",
        slug: "inactive-player",
        display_name: "Inactive",
        role: "admin",
        is_active: false,
      },
    });
    expect(await resolveViewerSession(inactive.client)).toEqual({
      role: "guest",
      userId: "user-2",
      playerId: null,
      playerUuid: null,
      displayName: null,
      email: "inactive@example.com",
    });
  });

  it("resolves active linked player role without selecting players.email", async () => {
    const { client, selectSpy } = createMockAuthClient({
      user: { id: "user-admin", email: "admin@lolonmebol.test" },
      playerRow: {
        id: "uuid-admin",
        slug: "luca-olivieri",
        display_name: "Luca Olivieri",
        role: "admin",
        is_active: true,
      },
    });

    const session = await resolveViewerSession(client);
    expect(session).toEqual({
      role: "admin",
      userId: "user-admin",
      playerId: "luca-olivieri",
      playerUuid: "uuid-admin",
      displayName: "Luca Olivieri",
      email: "admin@lolonmebol.test",
    });

    expect(selectSpy).toHaveBeenCalledTimes(1);
    const selectedColumns = String(selectSpy.mock.calls[0]?.[0] ?? "");
    expect(selectedColumns).not.toMatch(/\bemail\b/i);
    expect(selectedColumns).not.toContain("*");
  });
});

describe("SSR role guards (401 / 403)", () => {
  const guestSession: ViewerSession = { ...GUEST_SESSION };

  const unlinkedUserSession: ViewerSession = {
    role: "guest",
    userId: "auth-unlinked",
    playerId: null,
    playerUuid: null,
    displayName: null,
    email: "unlinked@test.com",
  };

  const playerSession: ViewerSession = {
    role: "player",
    userId: "auth-player",
    playerId: "enzo",
    playerUuid: "uuid-enzo",
    displayName: "Enzo",
    email: "enzo@test.com",
  };

  const authorizedSession: ViewerSession = {
    role: "authorized",
    userId: "auth-op",
    playerId: "toto",
    playerUuid: "uuid-toto",
    displayName: "Toto",
    email: "toto@test.com",
  };

  const adminSession: ViewerSession = {
    role: "admin",
    userId: "auth-admin",
    playerId: "luca",
    playerUuid: "uuid-luca",
    displayName: "Luca",
    email: "luca@test.com",
  };

  it("returns 401 UNAUTHENTICATED for guests on all guards", async () => {
    await expectAuthError(
      requireAuthenticatedPlayer(guestSession),
      401,
      "UNAUTHENTICATED"
    );
    await expectAuthError(
      requireOperator(guestSession),
      401,
      "UNAUTHENTICATED"
    );
    await expectAuthError(requireAdmin(guestSession), 401, "UNAUTHENTICATED");
  });

  it("returns 403 FORBIDDEN for authenticated but unlinked users on all guards", async () => {
    await expectAuthError(
      requireAuthenticatedPlayer(unlinkedUserSession),
      403,
      "FORBIDDEN"
    );
    await expectAuthError(
      requireOperator(unlinkedUserSession),
      403,
      "FORBIDDEN"
    );
    await expectAuthError(requireAdmin(unlinkedUserSession), 403, "FORBIDDEN");
  });

  it("enforces role hierarchy for player, authorized, and admin", async () => {
    await expect(requireAuthenticatedPlayer(playerSession)).resolves.toMatchObject(
      { role: "player", playerId: "enzo" }
    );
    await expectAuthError(requireOperator(playerSession), 403, "FORBIDDEN");
    await expectAuthError(requireAdmin(playerSession), 403, "FORBIDDEN");

    await expect(
      requireAuthenticatedPlayer(authorizedSession)
    ).resolves.toMatchObject({ role: "authorized", playerId: "toto" });
    await expect(requireOperator(authorizedSession)).resolves.toMatchObject({
      role: "authorized",
      playerId: "toto",
    });
    await expectAuthError(requireAdmin(authorizedSession), 403, "FORBIDDEN");

    await expect(requireAuthenticatedPlayer(adminSession)).resolves.toMatchObject(
      { role: "admin", playerId: "luca" }
    );
    await expect(requireOperator(adminSession)).resolves.toMatchObject({
      role: "admin",
      playerId: "luca",
    });
    await expect(requireAdmin(adminSession)).resolves.toMatchObject({
      role: "admin",
      playerId: "luca",
    });
  });
});

describe("Redirect sanitization & auth callback / actions security", () => {
  it("sanitizeRedirectPath blocks external URLs, protocol-relative URLs, backslash tricks, and control chars", () => {
    expect(sanitizeRedirectPath("/perfil")).toBe("/perfil");
    expect(sanitizeRedirectPath("/admin?tab=matches")).toBe(
      "/admin?tab=matches"
    );
    expect(sanitizeRedirectPath(undefined)).toBe("/perfil");
    expect(sanitizeRedirectPath("")).toBe("/perfil");
    expect(sanitizeRedirectPath("https://evil.example/phish")).toBe("/perfil");
    expect(sanitizeRedirectPath("//evil.example/phish")).toBe("/perfil");
    expect(sanitizeRedirectPath("/\\evil.example/phish")).toBe("/perfil");
    expect(sanitizeRedirectPath("/perfil\nSet-Cookie: bad=1")).toBe("/perfil");
  });

  it("resolveSafeAppOrigin prefers explicit env over headers and rejects malformed hosts", () => {
    expect(
      resolveSafeAppOrigin({
        siteUrlEnv: "https://lolonmebol.app/some/path",
        hostHeader: "evil.example",
      })
    ).toBe("https://lolonmebol.app");

    expect(
      resolveSafeAppOrigin({
        siteUrlEnv: "",
        vercelUrlEnv: "lolonme-preview.vercel.app",
      })
    ).toBe("https://lolonme-preview.vercel.app");

    expect(
      resolveSafeAppOrigin({
        siteUrlEnv: "",
        vercelUrlEnv: "",
        hostHeader: "localhost:3000",
      })
    ).toBe("http://localhost:3000");

    expect(
      resolveSafeAppOrigin({
        siteUrlEnv: "",
        vercelUrlEnv: "",
        hostHeader: "evil.example/path?bad=1",
      })
    ).toBe("http://localhost:3000");
  });

  it("resolveAuthCallback exchanges PKCE code or verifies token_hash and neutralizes open-redirects", async () => {
    const exchangeSpy = vi.fn().mockResolvedValue({ error: null });
    const verifySpy = vi.fn().mockResolvedValue({ error: null });
    const mockClient: CallbackAuthClient = {
      auth: {
        exchangeCodeForSession: exchangeSpy,
        verifyOtp: verifySpy,
      },
    };

    const okCode = await resolveAuthCallback(
      "https://lolonmebol.app/auth/callback?code=pkce-123&next=//evil.example",
      mockClient
    );
    expect(okCode).toEqual({
      ok: true,
      redirectTo: "https://lolonmebol.app/perfil",
    });
    expect(exchangeSpy).toHaveBeenCalledWith("pkce-123");

    const okTokenHash = await resolveAuthCallback(
      "https://lolonmebol.app/auth/callback?token_hash=th-456&type=magiclink&next=/stats",
      mockClient
    );
    expect(okTokenHash).toEqual({
      ok: true,
      redirectTo: "https://lolonmebol.app/stats",
    });
    expect(verifySpy).toHaveBeenCalledWith({
      token_hash: "th-456",
      type: "magiclink",
    });

    const missing = await resolveAuthCallback(
      "https://lolonmebol.app/auth/callback",
      mockClient
    );
    expect(missing).toEqual({
      ok: false,
      redirectTo: "https://lolonmebol.app/perfil?authError=missing_code",
    });
  });

  it("performRequestEmailOtp, performVerifyEmailOtp, and performSignInWithPassword validate inputs", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const actionsClient: ServerAuthActionsClient = {
      auth: { signInWithOtp, verifyOtp, signInWithPassword, signOut },
    };

    expect(
      await performRequestEmailOtp(actionsClient, "not-an-email", "http://localhost:3000")
    ).toMatchObject({ status: "error" });

    const sent = await performRequestEmailOtp(
      actionsClient,
      "  Jugador@Lolonmebol.Test ",
      "https://lolonmebol.app"
    );
    expect(sent).toMatchObject({
      status: "otp_sent",
      email: "jugador@lolonmebol.test",
    });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "jugador@lolonmebol.test",
      options: {
        shouldCreateUser: true,
        emailRedirectTo: "https://lolonmebol.app/auth/callback?next=/perfil",
      },
    });

    expect(
      await performVerifyEmailOtp(actionsClient, "jugador@lolonmebol.test", "12ab")
    ).toMatchObject({ ok: false });

    expect(
      await performVerifyEmailOtp(actionsClient, "jugador@lolonmebol.test", "123456")
    ).toEqual({ ok: true });

    expect(
      await performSignInWithPassword(actionsClient, "jugador@lolonmebol.test", "secret123")
    ).toEqual({ ok: true });
  });
});
