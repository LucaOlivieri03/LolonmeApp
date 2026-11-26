import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import {
  AuthError,
  GUEST_SESSION,
  isAuthError,
  loadUnlinkedProfileState,
  performRequestEmailOtp,
  performRequestPlayerLink,
  performSignInWithGoogle,
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

  it("resolveSafeAppOrigin blocks untrusted Host headers, matches Vercel PKCE aliases, and never produces invalid URLs", async () => {
    expect(
      resolveSafeAppOrigin({
        siteUrlEnv: "https://lolonmebol.app/some/path",
        hostHeader: "evil.example",
      })
    ).toBe("https://lolonmebol.app");

    // Probe 1a & 1b: untrusted external Host and localhost-prefixed spoofed domain fall back safely
    expect(
      resolveSafeAppOrigin({
        siteUrlEnv: "",
        vercelProdUrlEnv: "",
        vercelBranchUrlEnv: "",
        vercelUrlEnv: "",
        hostHeader: "evil.example",
      })
    ).toBe("http://localhost:3000");

    expect(
      resolveSafeAppOrigin({
        siteUrlEnv: "",
        vercelProdUrlEnv: "",
        vercelBranchUrlEnv: "",
        vercelUrlEnv: "",
        hostHeader: "localhost.evil.example",
      })
    ).toBe("http://localhost:3000");

    // Probe 1c: Vercel production alias matches incoming Host ahead of immutable deployment hash (PKCE cookie match)
    expect(
      resolveSafeAppOrigin({
        siteUrlEnv: "",
        vercelProdUrlEnv: "lolonmeapp.vercel.app",
        vercelBranchUrlEnv: "lolonmeapp-git-main.vercel.app",
        vercelUrlEnv: "lolonmeapp-9x8y7z.vercel.app",
        hostHeader: "lolonmeapp.vercel.app",
      })
    ).toBe("https://lolonmeapp.vercel.app");

    expect(
      resolveSafeAppOrigin({
        siteUrlEnv: "",
        vercelProdUrlEnv: "lolonmeapp.vercel.app",
        vercelBranchUrlEnv: "lolonmeapp-git-feat.vercel.app",
        vercelUrlEnv: "lolonmeapp-9x8y7z.vercel.app",
        hostHeader: "lolonmeapp-git-feat.vercel.app",
      })
    ).toBe("https://lolonmeapp-git-feat.vercel.app");

    // Exact loopback allowed for local dev on custom valid port
    expect(
      resolveSafeAppOrigin({
        siteUrlEnv: "",
        vercelProdUrlEnv: "",
        vercelBranchUrlEnv: "",
        vercelUrlEnv: "",
        hostHeader: "localhost:3001",
      })
    ).toBe("http://localhost:3001");

    // Probe 1d & 1e: invalid port (>65535) and non-HTTP scheme (`javascript:`) never crash performRequestEmailOtp
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    const mockActionsClient: ServerAuthActionsClient = {
      auth: {
        signInWithOtp,
        verifyOtp: vi.fn().mockResolvedValue({ error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    };

    const badPortOrigin = resolveSafeAppOrigin({
      siteUrlEnv: "",
      vercelProdUrlEnv: "",
      vercelBranchUrlEnv: "",
      vercelUrlEnv: "",
      hostHeader: "localhost:99999",
    });
    expect(badPortOrigin).toBe("http://localhost:3000");
    await expect(
      performRequestEmailOtp(
        mockActionsClient,
        "jugador@lolonmebol.test",
        badPortOrigin
      )
    ).resolves.toMatchObject({ status: "otp_sent" });

    const jsSchemeOrigin = resolveSafeAppOrigin({
      siteUrlEnv: "javascript:alert(1)",
      vercelProdUrlEnv: "",
      vercelBranchUrlEnv: "",
      vercelUrlEnv: "",
    });
    expect(jsSchemeOrigin).toBe("http://localhost:3000");
    const firstSent = await performRequestEmailOtp(
      mockActionsClient,
      "typo@lolonmebol.test",
      "javascript:alert(1)"
    );
    const secondSent = await performRequestEmailOtp(
      mockActionsClient,
      "real@lolonmebol.test",
      "https://lolonmeapp.vercel.app"
    );
    expect(Number.isSafeInteger(firstSent.sentAt)).toBe(true);
    expect(Number.isSafeInteger(secondSent.sentAt)).toBe(true);
    expect(secondSent.sentAt).not.toBe(firstSent.sentAt);
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

  it("performSignInWithGoogle initiates Google OAuth with safe /auth/callback?next=/perfil redirect and rejects unsafe or missing URLs", async () => {
    expect(await performSignInWithGoogle(null, "https://lolonmebol.app")).toMatchObject({
      ok: false,
      errorCode: "not_configured",
    });

    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth?state=pkce" },
      error: null,
    });
    const oauthClient: ServerAuthActionsClient = {
      auth: {
        signInWithOtp: vi.fn(),
        verifyOtp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        signInWithOAuth,
      },
    };

    const okResult = await performSignInWithGoogle(
      oauthClient,
      "https://lolonmebol.app"
    );
    expect(okResult).toEqual({
      ok: true,
      url: "https://accounts.google.com/o/oauth2/v2/auth?state=pkce",
    });
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://lolonmebol.app/auth/callback?next=/perfil",
      },
    });

    // Malicious callbackOrigin falls back to http://localhost:3000
    await performSignInWithGoogle(oauthClient, "javascript:alert(1)");
    expect(signInWithOAuth).toHaveBeenLastCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback?next=/perfil",
      },
    });

    // Rejects non-HTTP(S) provider URLs
    signInWithOAuth.mockResolvedValueOnce({
      data: { url: "javascript:evil()" },
      error: null,
    });
    expect(
      await performSignInWithGoogle(oauthClient, "https://lolonmebol.app")
    ).toMatchObject({
      ok: false,
      errorCode: "provider_error",
    });

    // Surfaces provider errors cleanly
    signInWithOAuth.mockResolvedValueOnce({
      data: { url: null },
      error: { message: "OAuth disabled" },
    });
    expect(
      await performSignInWithGoogle(oauthClient, "https://lolonmebol.app")
    ).toMatchObject({
      ok: false,
      errorCode: "provider_error",
    });

    // LoginCard highlights "Continuar con Google" as primary CTA wired to signInWithGoogleAction
    const loginCardSrc = readFileSync(
      path.join(process.cwd(), "src/components/profile/LoginCard.tsx"),
      "utf8"
    );
    expect(loginCardSrc).toContain("signInWithGoogleAction");
    expect(loginCardSrc).toContain("Continuar con Google");
  });

  it("loadUnlinkedProfileState & performRequestPlayerLink enforce unlinked-only access, exclude admins/linked/inactive players, and block duplicate pending requests", async () => {
    const playersTable = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        slug: "free-player",
        display_name: "Jugador Libre",
        nickname: "Libre",
        role: "player" as const,
        is_active: true,
        user_id: null as string | null,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        slug: "free-authorized",
        display_name: "Autorizado Libre",
        nickname: null,
        role: "authorized" as const,
        is_active: true,
        user_id: null as string | null,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        slug: "admin-boss",
        display_name: "Admin Presidente",
        nickname: null,
        role: "admin" as const,
        is_active: true,
        user_id: null as string | null,
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        slug: "already-linked",
        display_name: "Ya Vinculado",
        nickname: null,
        role: "player" as const,
        is_active: true,
        user_id: "existing-auth-uid",
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        slug: "inactive-player",
        display_name: "Inactivo",
        nickname: null,
        role: "player" as const,
        is_active: false,
        user_id: null as string | null,
      },
    ];
    const requestsTable: Array<{
      id: string;
      user_id: string;
      email: string;
      requested_player_id: string;
      status: "pending" | "approved" | "rejected";
      created_at: string;
      review_note: string | null;
    }> = [];

    const mockDb = {
      players: playersTable,
      requests: requestsTable,
    };

    const dbAdapter = {
      async listCandidatePlayers() {
        return mockDb.players;
      },
      async findPendingRequestByUserId(userId: string) {
        return (
          mockDb.requests.find(
            (r) => r.user_id === userId && r.status === "pending"
          ) ?? null
        );
      },
      async findPlayerByUserId(userId: string) {
        return mockDb.players.find((p) => p.user_id === userId) ?? null;
      },
      async findPlayerByIdentifier(identifier: string) {
        return (
          mockDb.players.find(
            (p) => p.slug === identifier || p.id === identifier
          ) ?? null
        );
      },
      async insertPendingRequest(row: {
        user_id: string;
        email: string;
        requested_player_id: string;
      }) {
        if (
          mockDb.requests.some(
            (r) => r.user_id === row.user_id && r.status === "pending"
          )
        ) {
          return {
            data: null,
            error: { code: "23505", message: "duplicate pending request" },
          };
        }
        const created = {
          id: `req-${mockDb.requests.length + 1}`,
          ...row,
          status: "pending" as const,
          created_at: "2026-11-25T22:00:00Z",
          review_note: null,
        };
        mockDb.requests.push(created);
        return { data: created, error: null };
      },
    };

    // 1. loadUnlinkedProfileState exposes ONLY active, unlinked, non-admin players without email or userId
    const initialState = await loadUnlinkedProfileState(dbAdapter, "user-new-1");
    expect(initialState).toEqual({
      pendingRequest: null,
      availablePlayers: [
        { id: "free-authorized", displayName: "Autorizado Libre" },
        { id: "free-player", displayName: "Jugador Libre", nickname: "Libre" },
      ],
    });
    expect(JSON.stringify(initialState)).not.toContain("admin-boss");
    expect(JSON.stringify(initialState)).not.toContain("already-linked");
    expect(JSON.stringify(initialState)).not.toContain("existing-auth-uid");

    // 2. Guest (unauthenticated) rejected with UNAUTHENTICATED
    expect(
      await performRequestPlayerLink(dbAdapter, GUEST_SESSION, {
        playerId: "free-player",
      })
    ).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });

    // 3. Already-linked session rejected with CONFLICT
    const linkedSession: ViewerSession = {
      role: "player",
      userId: "existing-auth-uid",
      playerId: "already-linked",
      playerUuid: "44444444-4444-4444-8444-444444444444",
      displayName: "Ya Vinculado",
      email: "linked@lolonmebol.test",
    };
    expect(
      await performRequestPlayerLink(dbAdapter, linkedSession, {
        playerId: "free-player",
      })
    ).toMatchObject({ ok: false, code: "CONFLICT" });

    const unlinkedSession: ViewerSession = {
      role: "guest",
      userId: "user-new-1",
      playerId: null,
      playerUuid: null,
      displayName: null,
      email: "  NuevoJugador@Gmail.com ",
    };

    // 4. Rejects admin, already-linked, and inactive target players
    expect(
      await performRequestPlayerLink(dbAdapter, unlinkedSession, {
        playerId: "admin-boss",
      })
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });

    expect(
      await performRequestPlayerLink(dbAdapter, unlinkedSession, {
        playerId: "already-linked",
      })
    ).toMatchObject({ ok: false, code: "CONFLICT" });

    expect(
      await performRequestPlayerLink(dbAdapter, unlinkedSession, {
        playerId: "inactive-player",
      })
    ).toMatchObject({ ok: false, code: "VALIDATION" });

    // 5. Valid unlinked player request succeeds with normalized lowercase email
    const createdRes = await performRequestPlayerLink(
      dbAdapter,
      unlinkedSession,
      { playerId: "free-player" }
    );
    expect(createdRes).toMatchObject({
      ok: true,
      data: { requestId: "req-1" },
    });
    expect(requestsTable[0]).toMatchObject({
      user_id: "user-new-1",
      email: "nuevojugador@gmail.com",
      requested_player_id: "11111111-1111-4111-8111-111111111111",
      status: "pending",
    });

    // 6. Second request while first is pending fails with CONFLICT
    expect(
      await performRequestPlayerLink(dbAdapter, unlinkedSession, {
        playerId: "free-authorized",
      })
    ).toMatchObject({ ok: false, code: "CONFLICT" });

    // 7. Reloading state returns pendingRequest with resolved player name
    const reloadedState = await loadUnlinkedProfileState(
      dbAdapter,
      "user-new-1"
    );
    expect(reloadedState.pendingRequest).toEqual({
      id: "req-1",
      requestedPlayerId: "free-player",
      requestedPlayerName: "Jugador Libre",
      status: "pending",
      createdAt: "2026-11-25T22:00:00Z",
      reviewNote: null,
    });
  });
});
