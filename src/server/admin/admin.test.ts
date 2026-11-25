import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import type { ViewerSession } from "@/server/auth";
import { loadAdminViewModel } from "@/server/queries/admin";
import {
  SeedPublicTournamentRepository,
  type PublicTournamentRepository,
} from "@/server/repositories";
import {
  performAwardPlayerTitle,
  performCreateAnnouncement,
  performCreateCalendarEvent,
  performCreateMatch,
  performCreatePlayer,
  performCreateSeason,
  performDeleteAnnouncement,
  performDeleteCalendarEvent,
  performDeleteMatch,
  performRegenerateCupBracket,
  performUpdateCupTie,
  performUpdateMatch,
  performUpdatePlayerRole,
  type AdminDbClient,
  type DbErrorLike,
  type DbQueryBuilder,
  type DbQueryResult,
} from "./mutations-core";

const GUEST_SESSION: ViewerSession = {
  role: "guest",
  userId: null,
  playerId: null,
  playerUuid: null,
  displayName: null,
  email: null,
};

const PLAYER_SESSION: ViewerSession = {
  role: "player",
  userId: "user-player-1",
  playerId: "b-aguzzi",
  playerUuid: "11111111-1111-4111-8111-111111111111",
  displayName: "B. Aguzzi",
  email: "player@example.com",
};

const OPERATOR_SESSION: ViewerSession = {
  role: "authorized",
  userId: "user-op-1",
  playerId: "pipo",
  playerUuid: "22222222-2222-4222-8222-222222222222",
  displayName: "Pipo",
  email: "op@example.com",
};

const ADMIN_SESSION: ViewerSession = {
  role: "admin",
  userId: "user-admin-1",
  playerId: "luca",
  playerUuid: "33333333-3333-4333-8333-333333333333",
  displayName: "Luca",
  email: "admin@example.com",
};

interface FakeOp {
  table: string;
  op: "select" | "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  filters: Array<{ kind: string; col: string; val: unknown }>;
  columns?: string;
}

interface FakeDbOptions {
  tables?: Record<string, Array<Record<string, unknown>>>;
  failOn?: Partial<
    Record<string, { op: FakeOp["op"]; error: DbErrorLike; once?: boolean }>
  >;
}

function createFakeDb(options: FakeDbOptions = {}) {
  const store: Record<string, Array<Record<string, unknown>>> = {
    seasons: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        year: 2026,
        name: "Temporada 2026",
        status: "active",
      },
    ],
    players: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        slug: "b-aguzzi",
        display_name: "B. Aguzzi",
        role: "player",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        slug: "pipo",
        display_name: "Pipo",
        role: "authorized",
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        slug: "luca",
        display_name: "Luca",
        role: "admin",
      },
    ],
    matches: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        slug: "match-2026-1-2026-03-01",
        season_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        match_number: 1,
        match_date: "2026-03-01",
        match_type: "league",
        modality: "F5",
        team_a_score: 5,
        team_b_score: 4,
        result_outcome: "A",
        counts_for_league: true,
        counts_for_stats: true,
        notes: "Inicial",
      },
    ],
    match_players: [
      {
        match_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        player_id: "11111111-1111-4111-8111-111111111111",
        team: "A",
        is_cup_captain: false,
        goals: 2,
        assists: 0,
        admin_rating: 8,
        is_mvp: true,
      },
      {
        match_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        player_id: "22222222-2222-4222-8222-222222222222",
        team: "B",
        is_cup_captain: false,
        goals: 1,
        assists: 1,
        admin_rating: 7,
        is_mvp: false,
      },
    ],
    announcements: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        external_key: "ann-1",
        title: "Aviso 1",
        body: "Contenido",
        is_pinned: true,
      },
    ],
    calendar_events: [
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        external_key: "ev-1",
        season_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        title: "Fecha 1",
        event_date: "2026-03-01",
        event_type: "league",
      },
    ],
    player_titles: [],
    cup_editions: [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        season_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Copa LOLONMEBOL 2026",
        cutoff_snapshot_json: [],
      },
    ],
    cup_ties: [
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        cup_edition_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        round: "quarterfinal",
        slot_order: 1,
        player_a_id: "11111111-1111-4111-8111-111111111111",
        player_b_id: "22222222-2222-4222-8222-222222222222",
        seed_a: 1,
        seed_b: 8,
        override_score_a: null,
        override_score_b: null,
        winner_player_id: null,
        notes: null,
      },
    ],
    fund_months: [],
    ...(options.tables ?? {}),
  };

  const ops: FakeOp[] = [];
  const consumedFails = new Set<string>();
  let idSeq = 1;

  function matchesFilters(
    row: Record<string, unknown>,
    filters: FakeOp["filters"]
  ): boolean {
    return filters.every((f) => {
      if (f.kind === "eq") return row[f.col] === f.val;
      if (f.kind === "neq") return row[f.col] !== f.val;
      if (f.kind === "in")
        return Array.isArray(f.val) && f.val.includes(row[f.col]);
      return true;
    });
  }

  const db: AdminDbClient = {
    from(table: string): DbQueryBuilder {
      const state: FakeOp = { table, op: "select", filters: [] };

      const execute = async (
        mode: "many" | "single" | "maybeSingle"
      ): Promise<DbQueryResult> => {
        ops.push({ ...state, filters: [...state.filters] });

        const failRule = options.failOn?.[table];
        const failKey = `${table}:${state.op}`;
        if (
          failRule &&
          failRule.op === state.op &&
          !(failRule.once && consumedFails.has(failKey))
        ) {
          if (failRule.once) consumedFails.add(failKey);
          return { data: null, error: failRule.error };
        }

        const rows = store[table] ?? (store[table] = []);

        if (state.op === "select") {
          const matched = rows.filter((r) => matchesFilters(r, state.filters));
          if (mode === "single") {
            return matched[0]
              ? { data: matched[0], error: null }
              : { data: null, error: { message: "Not found" } };
          }
          if (mode === "maybeSingle") {
            return { data: matched[0] ?? null, error: null };
          }
          return { data: matched, error: null };
        }

        if (state.op === "insert") {
          const items = Array.isArray(state.payload)
            ? state.payload
            : [state.payload as Record<string, unknown>];
          const inserted = items.map((item) => {
            const row = {
              id:
                (item.id as string | undefined) ??
                `99999999-9999-4999-8999-${String(idSeq++).padStart(12, "0")}`,
              ...item,
            };
            rows.push(row);
            return row;
          });
          if (mode === "single" || mode === "maybeSingle") {
            return { data: inserted[0] ?? null, error: null };
          }
          return { data: inserted, error: null };
        }

        if (state.op === "upsert") {
          const items = Array.isArray(state.payload)
            ? state.payload
            : [state.payload as Record<string, unknown>];
          for (const item of items) {
            const existingIdx = rows.findIndex(
              (r) =>
                r.match_id === item.match_id && r.player_id === item.player_id
            );
            if (existingIdx >= 0) {
              rows[existingIdx] = { ...rows[existingIdx], ...item };
            } else {
              rows.push({ ...item });
            }
          }
          return { data: items, error: null };
        }

        if (state.op === "update") {
          const patch = state.payload as Record<string, unknown>;
          for (let i = 0; i < rows.length; i++) {
            if (matchesFilters(rows[i], state.filters)) {
              rows[i] = { ...rows[i], ...patch };
            }
          }
          return { data: null, error: null };
        }

        if (state.op === "delete") {
          store[table] = rows.filter((r) => !matchesFilters(r, state.filters));
          return { data: null, error: null };
        }

        return { data: null, error: null };
      };

      const builder: DbQueryBuilder = {
        select(columns?: string) {
          state.columns = columns;
          return builder;
        },
        insert(values) {
          state.op = "insert";
          state.payload = values;
          return builder;
        },
        update(values) {
          state.op = "update";
          state.payload = values;
          return builder;
        },
        upsert(values) {
          state.op = "upsert";
          state.payload = values;
          return builder;
        },
        delete() {
          state.op = "delete";
          return builder;
        },
        eq(col, val) {
          state.filters.push({ kind: "eq", col, val });
          return builder;
        },
        neq(col, val) {
          state.filters.push({ kind: "neq", col, val });
          return builder;
        },
        in(col, val) {
          state.filters.push({ kind: "in", col, val });
          return builder;
        },
        maybeSingle() {
          return execute("maybeSingle");
        },
        single() {
          return execute("single");
        },
        then(onfulfilled, onrejected) {
          return execute("many").then(onfulfilled, onrejected);
        },
      };

      return builder;
    },
  };

  return { db, store, ops };
}

describe("WU-6 Admin Server Actions — Role Guards", () => {
  const validMatchPayload = {
    seasonId: "season-2026",
    matchType: "league" as const,
    modality: "F5" as const,
    matchDate: "2026-04-10",
    matchNumber: 12,
    teamAScore: 7,
    teamBScore: 5,
    countsForLeague: true,
    roster: [
      { playerId: "b-aguzzi", team: "A" as const, isMvp: true },
      { playerId: "pipo", team: "B" as const },
    ],
  };

  it("blocks guest (UNAUTHENTICATED) and player (FORBIDDEN) across all mutations", async () => {
    const { db } = createFakeDb();
    const repo = new SeedPublicTournamentRepository();

    for (const [session, expectedCode] of [
      [GUEST_SESSION, "UNAUTHENTICATED"],
      [PLAYER_SESSION, "FORBIDDEN"],
    ] as const) {
      const results = await Promise.all([
        performCreateMatch(db, session, validMatchPayload),
        performUpdateMatch(db, session, {
          ...validMatchPayload,
          matchId: "match-2026-1-2026-03-01",
        }),
        performDeleteMatch(db, session, { matchId: "match-2026-1-2026-03-01" }),
        performCreateAnnouncement(db, session, {
          title: "T",
          body: "B",
          isPinned: false,
        }),
        performDeleteAnnouncement(db, session, { announcementId: "ann-1" }),
        performCreateCalendarEvent(db, session, {
          seasonId: "season-2026",
          title: "Ev",
          eventDate: "2026-04-10",
          eventType: "league",
        }),
        performDeleteCalendarEvent(db, session, { eventId: "ev-1" }),
        performCreatePlayer(db, session, {
          displayName: "Pedro",
          role: "player",
        }),
        performUpdatePlayerRole(db, session, {
          playerId: "b-aguzzi",
          role: "authorized",
        }),
        performAwardPlayerTitle(db, session, {
          playerId: "b-aguzzi",
          seasonId: "season-2026",
          titleType: "league",
        }),
        performCreateSeason(db, session, { year: 2027, defaultFee: 3000 }),
        performRegenerateCupBracket(db, session, repo, {
          seasonId: "season-2026",
          previousFinalists: ["b-aguzzi", "pipo"],
        }),
        performUpdateCupTie(db, session, {
          tieId: "cup-2026-qf-1",
          patch: { overrideScoreA: 5 },
        }),
      ]);

      for (const res of results) {
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.code).toBe(expectedCode);
      }
    }
  });

  it("allows authorized operators on matches/announcements/calendar but rejects admin-only mutations", async () => {
    const { db } = createFakeDb();
    const repo = new SeedPublicTournamentRepository();

    const okCreateMatch = await performCreateMatch(
      db,
      OPERATOR_SESSION,
      validMatchPayload
    );
    expect(okCreateMatch.ok).toBe(true);

    const okAnn = await performCreateAnnouncement(db, OPERATOR_SESSION, {
      title: "Aviso Op",
      body: "Cuerpo",
      isPinned: true,
    });
    expect(okAnn.ok).toBe(true);

    const okEv = await performCreateCalendarEvent(db, OPERATOR_SESSION, {
      seasonId: "season-2026",
      title: "Fecha Op",
      eventDate: "2026-04-15",
      eventType: "league",
    });
    expect(okEv.ok).toBe(true);

    const forbiddenResults = await Promise.all([
      performUpdateMatch(db, OPERATOR_SESSION, {
        ...validMatchPayload,
        matchId: "match-2026-1-2026-03-01",
      }),
      performCreatePlayer(db, OPERATOR_SESSION, {
        displayName: "Nuevo",
        role: "player",
      }),
      performUpdatePlayerRole(db, OPERATOR_SESSION, {
        playerId: "b-aguzzi",
        role: "admin",
      }),
      performAwardPlayerTitle(db, OPERATOR_SESSION, {
        playerId: "b-aguzzi",
        seasonId: "season-2026",
        titleType: "cup",
      }),
      performCreateSeason(db, OPERATOR_SESSION, { year: 2027, defaultFee: 3000 }),
      performRegenerateCupBracket(db, OPERATOR_SESSION, repo, {
        seasonId: "season-2026",
        previousFinalists: ["b-aguzzi", "pipo"],
      }),
      performUpdateCupTie(db, OPERATOR_SESSION, {
        tieId: "cup-2026-qf-1",
        patch: { notes: "Override" },
      }),
    ]);

    for (const res of forbiddenResults) {
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe("FORBIDDEN");
    }
  });
});

describe("WU-6 Admin Server Actions — Persistence, Validation & Rollback", () => {
  it("rolls back newly inserted match if match_players insert fails", async () => {
    const { db, store } = createFakeDb({
      failOn: {
        match_players: {
          op: "insert",
          error: { message: "constraint violation" },
        },
      },
    });
    const initialCount = store.matches.length;

    const res = await performCreateMatch(db, ADMIN_SESSION, {
      seasonId: "season-2026",
      matchType: "league",
      modality: "F5",
      matchDate: "2026-05-01",
      matchNumber: 20,
      teamAScore: 4,
      teamBScore: 3,
      countsForLeague: true,
      roster: [
        { playerId: "b-aguzzi", team: "A" },
        { playerId: "pipo", team: "B" },
      ],
    });

    expect(res.ok).toBe(false);
    expect(store.matches.length).toBe(initialCount);
  });

  it("updates match metadata and syncs roster (upserting new & deleting removed players)", async () => {
    const { db, store } = createFakeDb();

    const res = await performUpdateMatch(db, ADMIN_SESSION, {
      matchId: "match-2026-1-2026-03-01",
      seasonId: "season-2026",
      matchType: "cup",
      modality: "F6",
      matchDate: "2026-03-02",
      matchNumber: 2,
      teamAScore: 6,
      teamBScore: 6,
      countsForLeague: false,
      countsForStats: true,
      notes: "Editado",
      roster: [
        {
          playerId: "b-aguzzi",
          team: "A",
          goals: 3,
          assists: 1,
          adminRating: 9,
          isMvp: true,
        },
        {
          playerId: "luca",
          team: "B",
          goals: 2,
          assists: 0,
          adminRating: 8,
          isMvp: false,
        },
      ],
    });

    expect(res.ok).toBe(true);
    const updatedMatch = store.matches.find(
      (m) => m.slug === "match-2026-1-2026-03-01"
    );
    expect(updatedMatch?.match_type).toBe("cup");
    expect(updatedMatch?.result_outcome).toBe("draw");
    expect(updatedMatch?.notes).toBe("Editado");

    const rosterPlayerIds = store.match_players
      .filter((mp) => mp.match_id === updatedMatch?.id)
      .map((mp) => mp.player_id);
    expect(rosterPlayerIds).toContain("11111111-1111-4111-8111-111111111111");
    expect(rosterPlayerIds).toContain("33333333-3333-4333-8333-333333333333");
    expect(rosterPlayerIds).not.toContain("22222222-2222-4222-8222-222222222222");
  });

  it("prevents admin self-demotion in updatePlayerRole", async () => {
    const { db } = createFakeDb();
    const res = await performUpdatePlayerRole(db, ADMIN_SESSION, {
      playerId: "luca",
      role: "player",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("VALIDATION");
  });

  it("creates season with cup_edition and 12 fund_months, and rolls back on fund_months failure", async () => {
    const { db, store } = createFakeDb();
    const okRes = await performCreateSeason(db, ADMIN_SESSION, {
      year: 2027,
      defaultFee: 4500,
      cupCutoffDate: "2027-07-01",
    });

    expect(okRes.ok).toBe(true);
    expect(store.seasons.some((s) => s.year === 2027 && s.status === "active")).toBe(true);
    expect(store.seasons.some((s) => s.year === 2026 && s.status === "finished")).toBe(true);
    expect(store.cup_editions.some((c) => c.name === "Copa LOLONMEBOL 2027")).toBe(true);
    expect(store.fund_months.length).toBe(12);

    const dupRes = await performCreateSeason(db, ADMIN_SESSION, {
      year: 2027,
      defaultFee: 4500,
    });
    expect(dupRes.ok).toBe(false);
    if (!dupRes.ok) expect(dupRes.code).toBe("CONFLICT");

    const { db: failingDb, store: failingStore } = createFakeDb({
      failOn: {
        fund_months: { op: "insert", error: { message: "fund write failed" } },
      },
    });
    const failRes = await performCreateSeason(failingDb, ADMIN_SESSION, {
      year: 2028,
      defaultFee: 5000,
    });
    expect(failRes.ok).toBe(false);
    expect(failingStore.seasons.some((s) => s.year === 2028)).toBe(false);
  });

  it("updates cup tie by domain ID (cup-2026-qf-1) and resolves player slugs to UUIDs", async () => {
    const { db, store } = createFakeDb();
    const res = await performUpdateCupTie(db, ADMIN_SESSION, {
      tieId: "cup-2026-qf-1",
      patch: {
        playerBId: "luca",
        overrideScoreA: 10,
        overrideScoreB: 8,
        winnerPlayerId: "b-aguzzi",
        notes: "Reemplazo por lesión",
      },
    });

    expect(res.ok).toBe(true);
    expect(store.cup_ties[0].player_b_id).toBe(
      "33333333-3333-4333-8333-333333333333"
    );
    expect(store.cup_ties[0].override_score_a).toBe(10);
    expect(store.cup_ties[0].winner_player_id).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("Probe B1-a: performUpdateMatch removes newly added phantom players on delete failure rollback", async () => {
    const { db, store } = createFakeDb({
      failOn: {
        match_players: {
          op: "delete",
          error: { message: "transient delete error" },
          once: true,
        },
      },
    });

    const res = await performUpdateMatch(db, ADMIN_SESSION, {
      matchId: "match-2026-1-2026-03-01",
      seasonId: "season-2026",
      matchType: "cup",
      modality: "F6",
      matchDate: "2026-03-02",
      matchNumber: 2,
      teamAScore: 9,
      teamBScore: 1,
      countsForLeague: false,
      countsForStats: true,
      notes: "Should rollback",
      roster: [
        { playerId: "b-aguzzi", team: "A" },
        { playerId: "luca", team: "B" }, // added P3 while removing pipo (P2)
      ],
    });

    expect(res.ok).toBe(false);
    const match = store.matches.find(
      (m) => m.slug === "match-2026-1-2026-03-01"
    );
    expect(match?.notes).toBe("Inicial");
    const rosterIds = store.match_players
      .filter((mp) => mp.match_id === match?.id)
      .map((mp) => mp.player_id)
      .sort();
    expect(rosterIds).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  it("Probe B1-b: performUpdateMatch aborts with zero writes when prevRoster snapshot read fails", async () => {
    const { db, ops } = createFakeDb({
      failOn: {
        match_players: {
          op: "select",
          error: { message: "snapshot read error" },
        },
      },
    });

    const res = await performUpdateMatch(db, ADMIN_SESSION, {
      matchId: "match-2026-1-2026-03-01",
      seasonId: "season-2026",
      matchType: "league",
      modality: "F5",
      matchDate: "2026-03-01",
      matchNumber: 1,
      teamAScore: 5,
      teamBScore: 4,
      countsForLeague: true,
      roster: [
        { playerId: "b-aguzzi", team: "A" },
        { playerId: "luca", team: "B" },
      ],
    });

    expect(res.ok).toBe(false);
    const writes = ops.filter(
      (o) =>
        (o.table === "matches" || o.table === "match_players") &&
        o.op !== "select"
    );
    expect(writes).toHaveLength(0);
  });

  it("Probe B2-a: performRegenerateCupBracket aborts with zero writes if cup_ties snapshot select fails", async () => {
    const { db, ops, store } = createFakeDb({
      failOn: {
        cup_ties: {
          op: "select",
          error: { message: "cup_ties read failed" },
        },
      },
    });
    const repo = new SeedPublicTournamentRepository();
    const initialTies = [...store.cup_ties];

    const res = await performRegenerateCupBracket(db, ADMIN_SESSION, repo, {
      seasonId: "season-2026",
      previousFinalists: ["b-aguzzi", "pipo"],
    });

    expect(res.ok).toBe(false);
    expect(store.cup_ties).toEqual(initialTies);
    const cupWrites = ops.filter(
      (o) =>
        (o.table === "cup_ties" || o.table === "cup_editions") &&
        o.op !== "select"
    );
    expect(cupWrites).toHaveLength(0);
  });

  it("Probe B2-b: performRegenerateCupBracket preserves cutoff_snapshot_json and restores cup_ties when insert fails", async () => {
    const { db, store } = createFakeDb({
      failOn: {
        cup_ties: {
          op: "insert",
          error: { message: "cup_ties insert failed" },
          once: true,
        },
      },
    });
    store.cup_editions[0].cutoff_snapshot_json = ["existing-seed-1"];
    const repo = new SeedPublicTournamentRepository();

    const res = await performRegenerateCupBracket(db, ADMIN_SESSION, repo, {
      seasonId: "season-2026",
      previousFinalists: ["b-aguzzi", "pipo"],
    });

    expect(res.ok).toBe(false);
    expect(store.cup_editions[0].cutoff_snapshot_json).toEqual([
      "existing-seed-1",
    ]);
    expect(store.cup_ties).toHaveLength(1);
    expect(store.cup_ties[0].round).toBe("quarterfinal");
  });
});

describe("WU-6 SSR Admin Guard & Architectural Contracts", () => {
  it("loadAdminViewModel blocks guest and player without calling repository", async () => {
    const getPublicDataset = vi.fn();
    const repo = { getPublicDataset } as unknown as PublicTournamentRepository;

    const guestVm = await loadAdminViewModel(GUEST_SESSION, repo);
    expect(guestVm.status).toBe("unauthorized");

    const playerVm = await loadAdminViewModel(PLAYER_SESSION, repo);
    expect(playerVm.status).toBe("unauthorized");
    expect(getPublicDataset).not.toHaveBeenCalled();

    const realRepo = new SeedPublicTournamentRepository();
    const opVm = await loadAdminViewModel(OPERATOR_SESSION, realRepo);
    expect(opVm.status).toBe("authorized");
    if (opVm.status === "authorized") {
      expect(opVm.session.role).toBe("authorized");
      expect(opVm.data.seasons.length).toBeGreaterThan(0);
    }
  });

  it("enforces RSC /admin page, modular tabs without useTournament, and server-only boundaries", () => {
    const root = process.cwd();
    const adminPageSrc = readFileSync(
      path.join(root, "src/app/admin/page.tsx"),
      "utf8"
    );
    expect(adminPageSrc).not.toMatch(/["']use client["']/);
    expect(adminPageSrc).not.toContain("useTournament");
    expect(adminPageSrc).toContain("getAdminViewModel");

    for (const relPath of [
      "src/components/admin/AdminWorkspaceShell.tsx",
      "src/components/admin/AdminMatchesTab.tsx",
      "src/components/admin/AdminAnnouncementsTab.tsx",
      "src/components/admin/AdminPlayersTab.tsx",
      "src/components/admin/AdminCupTab.tsx",
    ]) {
      const src = readFileSync(path.join(root, relPath), "utf8");
      expect(src).not.toContain("useTournament");
    }

    for (const relPath of [
      "src/server/admin/mutations-core.ts",
      "src/server/queries/admin.ts",
    ]) {
      const src = readFileSync(path.join(root, relPath), "utf8");
      expect(src).toMatch(/^import ["']server-only["'];/);
    }

    const adminCoreSrc = readFileSync(
      path.join(root, "src/server/admin/mutations-core.ts"),
      "utf8"
    );
    expect(adminCoreSrc).not.toMatch(/\.select\([^)]*email/);
  });
});
