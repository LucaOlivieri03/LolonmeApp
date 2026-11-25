import fs from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { TournamentDataset } from "@/lib/types/domain";
import {
  AuthError,
  GUEST_SESSION,
  requireAdmin,
  type AdminSession,
} from "@/server/auth";
import { mapDatasetToDatabaseRows } from "@/server/db";
import {
  PUBLIC_PLAYER_COLUMNS,
  SeedAdminFundRepository,
  SeedPublicTournamentRepository,
  SupabaseAdminFundRepository,
  SupabaseTournamentRepository,
} from "./index";

function createFixtureDataset(): TournamentDataset {
  return {
    seasons: [
      {
        id: "season-2026",
        year: 2026,
        name: "Temporada 2026",
        status: "active",
        cupCutoffDate: "2026-07-15",
      },
    ],
    players: [
      {
        id: "luca",
        userId: "secret-auth-uuid-1",
        email: "luca@private.test",
        displayName: "Luca",
        nickname: "El Presi",
        role: "admin",
        isActive: true,
      },
      {
        id: "enzo",
        userId: "secret-auth-uuid-2",
        email: "enzo@private.test",
        displayName: "Enzo",
        role: "player",
        isActive: true,
      },
    ],
    aliases: [{ id: "alias-1", playerId: "luca", rawName: "Luquita" }],
    titles: [
      {
        id: "title-2026-league-luca",
        playerId: "luca",
        seasonId: "season-2026",
        titleType: "league",
        awardedAt: "2026-12-20",
      },
    ],
    matches: [
      {
        id: "m-2026-01",
        seasonId: "season-2026",
        matchNumber: 1,
        matchDate: "2026-03-10",
        matchType: "league",
        modality: "F5",
        teamAScore: 5,
        teamBScore: 3,
        countsForLeague: true,
        countsForStats: true,
        votingStatus: "closed",
        players: [
          {
            id: "m-2026-01-luca",
            matchId: "m-2026-01",
            playerId: "luca",
            team: "A",
            isCupCaptain: false,
            goals: 2,
            assists: 1,
            adminRating: 8.5,
            isMvp: true,
          },
          {
            id: "m-2026-01-enzo",
            matchId: "m-2026-01",
            playerId: "enzo",
            team: "B",
            isCupCaptain: false,
            goals: 1,
            assists: 0,
            adminRating: 7,
            isMvp: false,
          },
        ],
      },
    ],
    calendarEvents: [
      {
        id: "cal-1",
        seasonId: "season-2026",
        title: "Fecha 1",
        eventDate: "2026-03-10",
        eventType: "league",
        matchId: "m-2026-01",
      },
    ],
    announcements: [
      {
        id: "ann-1",
        title: "Arranca la 2026",
        body: "Nos vemos el martes.",
        isPinned: true,
        createdBy: "luca",
        createdAt: "2026-03-01T12:00:00Z",
      },
    ],
    cupEditions: [
      {
        id: "cup-2026",
        seasonId: "season-2026",
        name: "Copa 2026",
        cutoffSnapshotPlayerIds: ["luca", "enzo"],
      },
    ],
    cupTies: [
      {
        id: "cup-2026-final-1",
        cupEditionId: "cup-2026",
        round: "final",
        slotOrder: 1,
        playerAId: "luca",
        playerBId: "enzo",
        seedA: 1,
        seedB: 2,
        leg1MatchId: "m-2026-01",
        leg2MatchId: null,
        overrideScoreA: null,
        overrideScoreB: null,
        winnerPlayerId: "luca",
      },
    ],
    fundMonths: [
      {
        id: "fm-2026-3",
        seasonId: "season-2026",
        monthNumber: 3,
        monthLabel: "Marzo",
        feeAmount: 5000,
      },
    ],
    fundPayments: [
      {
        id: "fp-fm-2026-3-luca",
        fundMonthId: "fm-2026-3",
        playerId: "luca",
        paid: true,
        paidAt: "2026-03-05T10:00:00Z",
      },
    ],
    fundTransactions: [
      {
        id: "ftx-1",
        seasonId: "season-2026",
        txType: "expense",
        amount: 2500,
        description: "Pelota nueva",
        txDate: "2026-03-08",
      },
    ],
  };
}

function createMockSupabaseFromRows(
  rowsByTable: Record<string, unknown[]>,
  options?: { errorTable?: string }
) {
  const queries: Array<{ table: string; columns: string }> = [];

  const client = {
    from: vi.fn((table: string) => ({
      select: vi.fn((columns: string) => {
        queries.push({ table, columns });
        return {
          order: vi.fn(() => ({
            range: vi.fn(async (from: number, to: number) => {
              if (options?.errorTable === table) {
                return {
                  data: null,
                  error: { message: `permission denied for table ${table}` },
                };
              }
              const list = rowsByTable[table] ?? [];
              return {
                data: list.slice(from, to + 1),
                error: null,
              };
            }),
          })),
        };
      }),
    })),
  };

  return { client: client as unknown as SupabaseClient, queries };
}

const ADMIN_SESSION: AdminSession = {
  role: "admin",
  userId: "auth-admin",
  playerId: "luca",
  playerUuid: "uuid-luca",
  displayName: "Luca",
  email: "luca@private.test",
};

describe("PublicTournamentRepository privacy & segregation contract", () => {
  it("SeedPublicTournamentRepository strips email, userId, and all fund_* entities", async () => {
    const repo = new SeedPublicTournamentRepository(createFixtureDataset());
    const data = await repo.getPublicDataset();

    expect("fundMonths" in data).toBe(false);
    expect("fundPayments" in data).toBe(false);
    expect("fundTransactions" in data).toBe(false);

    expect(data.players).toHaveLength(2);
    for (const player of data.players) {
      expect("email" in player).toBe(false);
      expect("userId" in player).toBe(false);
    }

    const singlePlayer = await repo.getPlayerById("luca");
    expect(singlePlayer).not.toBeNull();
    expect("email" in singlePlayer!).toBe(false);
    expect("userId" in singlePlayer!).toBe(false);

    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("luca@private.test");
    expect(serialized).not.toContain("secret-auth-uuid");
    expect(serialized).not.toContain("Pelota nueva");
  });

  it("SupabaseTournamentRepository never queries fund_* tables or players.email/user_id", async () => {
    const dbRows = mapDatasetToDatabaseRows(createFixtureDataset());
    const { client, queries } = createMockSupabaseFromRows(
      dbRows as unknown as Record<string, unknown[]>
    );

    const repo = new SupabaseTournamentRepository(client);
    const data = await repo.getPublicDataset();

    const queriedTables = queries.map((q) => q.table);
    expect(queriedTables).not.toContain("fund_months");
    expect(queriedTables).not.toContain("fund_payments");
    expect(queriedTables).not.toContain("fund_transactions");

    const playerQuery = queries.find((q) => q.table === "players");
    expect(playerQuery).toBeDefined();
    expect(playerQuery!.columns).toBe(PUBLIC_PLAYER_COLUMNS);
    expect(playerQuery!.columns).not.toMatch(/\bemail\b/i);
    expect(playerQuery!.columns).not.toMatch(/\buser_id\b/i);
    expect(playerQuery!.columns).not.toContain("*");

    expect("fundMonths" in data).toBe(false);
    expect("fundPayments" in data).toBe(false);
    expect("fundTransactions" in data).toBe(false);
    expect(data.players.every((p) => !("email" in p) && !("userId" in p))).toBe(
      true
    );
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0].players).toHaveLength(2);
  });

  it("SupabaseTournamentRepository paginates cleanly past 1000 rows without truncation", async () => {
    const dbRows = mapDatasetToDatabaseRows(createFixtureDataset());
    const matchId = dbRows.matches[0].id;
    const playerId = dbRows.players[0].id;
    const manyMatchPlayers = Array.from({ length: 1050 }, (_, index) => ({
      id: `00000000-0000-5000-8000-${String(index + 1).padStart(12, "0")}`,
      match_id: matchId,
      player_id: playerId,
      team: "A" as const,
      is_cup_captain: false,
      goals: 0,
      assists: 0,
      admin_rating: null,
      is_mvp: false,
    }));

    const { client } = createMockSupabaseFromRows({
      ...(dbRows as unknown as Record<string, unknown[]>),
      match_players: manyMatchPlayers,
    });

    const repo = new SupabaseTournamentRepository(client);
    const matches = await repo.getMatches("season-2026");
    expect(matches).toHaveLength(1);
    expect(matches[0].players).toHaveLength(1050);
  });

  it("SupabaseTournamentRepository throws a descriptive error on database failure", async () => {
    const dbRows = mapDatasetToDatabaseRows(createFixtureDataset());
    const { client } = createMockSupabaseFromRows(
      dbRows as unknown as Record<string, unknown[]>,
      { errorTable: "matches" }
    );

    const repo = new SupabaseTournamentRepository(client);
    await expect(repo.getMatches()).rejects.toThrow(
      /Supabase query failed on "matches"/
    );
  });
});

describe("AdminFundRepository authorization boundary", () => {
  it("blocks non-admin callers on SeedAdminFundRepository and allows admin", async () => {
    const deniedRepo = new SeedAdminFundRepository({
      dataset: createFixtureDataset(),
      authorizeAdmin: () => requireAdmin(GUEST_SESSION),
    });

    await expect(deniedRepo.getFundData()).rejects.toThrow(AuthError);

    const allowedRepo = new SeedAdminFundRepository({
      dataset: createFixtureDataset(),
      authorizeAdmin: async () => ADMIN_SESSION,
    });

    const fund = await allowedRepo.getFundData("season-2026");
    expect(fund.fundMonths).toHaveLength(1);
    expect(fund.fundPayments).toHaveLength(1);
    expect(fund.fundTransactions).toHaveLength(1);
  });

  it("blocks non-admin callers on SupabaseAdminFundRepository before querying Supabase", async () => {
    const dbRows = mapDatasetToDatabaseRows(createFixtureDataset());
    const { client, queries } = createMockSupabaseFromRows(
      dbRows as unknown as Record<string, unknown[]>
    );

    const deniedRepo = new SupabaseAdminFundRepository({
      client,
      authorizeAdmin: () =>
        requireAdmin({
          role: "authorized",
          userId: "auth-op",
          playerId: "toto",
          playerUuid: "uuid-toto",
          displayName: "Toto",
          email: "toto@test.com",
        }),
    });

    await expect(deniedRepo.getFundData()).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
    expect(queries).toHaveLength(0);

    const allowedRepo = new SupabaseAdminFundRepository({
      client,
      authorizeAdmin: async () => ADMIN_SESSION,
    });

    const fund = await allowedRepo.getFundData("season-2026");
    expect(fund.fundMonths).toHaveLength(1);
    expect(fund.fundPayments).toHaveLength(1);
    expect(fund.fundTransactions).toHaveLength(1);
  });
});

describe("server-only architectural guard across src/server/**", () => {
  it('ensures every non-test TypeScript module under src/server/ imports "server-only"', () => {
    const serverDir = path.resolve(process.cwd(), "src/server");
    const nonTestFiles: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (
          entry.isFile() &&
          entry.name.endsWith(".ts") &&
          !entry.name.endsWith(".test.ts")
        ) {
          nonTestFiles.push(fullPath);
        }
      }
    }

    walk(serverDir);
    expect(nonTestFiles.length).toBeGreaterThan(0);

    for (const file of nonTestFiles) {
      const relPath = path
        .relative(process.cwd(), file)
        .split(path.sep)
        .join("/");
      const content = fs.readFileSync(file, "utf8");
      const firstLine = content.split(/\r?\n/)[0]?.trim();
      const expectedFirstLine = relPath.startsWith("src/server/actions/")
        ? '"use server";'
        : 'import "server-only";';
      expect(
        firstLine,
        `${relPath} must start with ${expectedFirstLine}`
      ).toBe(expectedFirstLine);
    }
  });
});
