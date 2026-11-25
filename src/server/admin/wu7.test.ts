import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import type { TournamentDataset } from "@/lib/types/domain";
import {
  GUEST_SESSION,
  type AdminSession,
  type AuthenticatedPlayerSession,
  type OperatorSession,
} from "@/server/auth";
import {
  syncDatasetToSupabase,
  type SeedTableClient,
} from "@/server/db/seed-sync";
import { loadAdminViewModel } from "@/server/queries/admin";
import {
  SeedAdminFundRepository,
  SeedPublicTournamentRepository,
  type AdminFundRepository,
  type PublicTournamentRepository,
} from "@/server/repositories";
import {
  performCreateFundTransaction,
  performCreatePlayerAndEnrollInFund,
  performEnrollPlayerInFund,
  performToggleFundPayment,
  performUpdateFundMonthFee,
  type AdminDbClient,
  type DbErrorLike,
  type DbQueryBuilder,
  type DbQueryResult,
} from "@/server/admin/mutations-core";
import {
  applyExcelImportFromDataset,
  previewExcelImportFromDataset,
} from "@/server/admin/excel-import";

const ADMIN_SESSION: AdminSession = {
  role: "admin",
  userId: "00000000-0000-4000-8000-000000000001",
  playerId: "luca",
  playerUuid: "11111111-1111-4111-8111-111111111111",
  displayName: "Luca",
  email: "luca@lolonme.test",
};

const OPERATOR_SESSION: OperatorSession = {
  role: "authorized",
  userId: "00000000-0000-4000-8000-000000000002",
  playerId: "pipo",
  playerUuid: "22222222-2222-4222-8222-222222222222",
  displayName: "Pipo",
  email: "pipo@lolonme.test",
};

const PLAYER_SESSION: AuthenticatedPlayerSession = {
  role: "player",
  userId: "00000000-0000-4000-8000-000000000003",
  playerId: "b-aguzzi",
  playerUuid: "33333333-3333-4333-8333-333333333333",
  displayName: "B. Aguzzi",
  email: "bauti@lolonme.test",
};

type Row = Record<string, unknown>;
type TableName =
  | "seasons"
  | "players"
  | "fund_months"
  | "fund_payments"
  | "fund_transactions";

interface FailDirective {
  op: "select" | "insert" | "update" | "upsert" | "delete";
  error: DbErrorLike;
  once?: boolean;
}

function createFakeFundDb(options?: {
  failOn?: Partial<Record<TableName, FailDirective>>;
}) {
  let seq = 200;
  const nextUuid = () =>
    `99999999-9999-4999-8999-${String(++seq).padStart(12, "0")}`;

  const store: Record<string, Row[]> = {
    seasons: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa2026",
        year: 2026,
        name: "Temporada 2026",
        status: "active",
        cup_cutoff_date: "2026-08-01",
      },
    ],
    players: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        slug: "luca",
        display_name: "Luca",
        role: "admin",
        is_active: true,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        slug: "b-aguzzi",
        display_name: "B. Aguzzi",
        role: "player",
        is_active: true,
      },
    ],
    fund_months: [
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffff0001",
        season_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa2026",
        month_number: 1,
        month_label: "Enero",
        fee_amount: 3000,
      },
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffff0002",
        season_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa2026",
        month_number: 2,
        month_label: "Febrero",
        fee_amount: 3000,
      },
    ],
    fund_payments: [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeee0001",
        fund_month_id: "ffffffff-ffff-4fff-8fff-ffffffff0001",
        player_id: "11111111-1111-4111-8111-111111111111",
        paid: true,
        paid_at: "2026-01-10T10:00:00.000Z",
      },
    ],
    fund_transactions: [],
  };

  const failMap = { ...(options?.failOn ?? {}) };

  const db: AdminDbClient = {
    from(table: string): DbQueryBuilder {
      let op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
      let payload: Row | Row[] | null = null;
      let conflictKey: string | undefined;
      let returnColumns = false;
      let selectedCols = "";
      const filters: Array<(row: Row) => boolean> = [];

      const execute = async (): Promise<DbQueryResult> => {
        if (table === "players" && /\bemail\b/.test(selectedCols)) {
          return {
            data: null,
            error: {
              code: "42501",
              message: "permission denied for column email of table players",
            },
          };
        }

        const directive = failMap[table as TableName];
        if (directive && directive.op === op) {
          if (directive.once) {
            delete failMap[table as TableName];
          }
          return { data: null, error: directive.error };
        }

        const tableRows = store[table] ?? (store[table] = []);
        const matches = (row: Row) => filters.every((fn) => fn(row));

        if (op === "select") {
          return {
            data: tableRows.filter(matches).map((r) => ({ ...r })),
            error: null,
          };
        }

        if (op === "insert") {
          const items = Array.isArray(payload) ? payload : [payload!];
          const inserted = items.map((item) => {
            const row: Row = {
              id: (item.id as string | undefined) ?? nextUuid(),
              ...item,
            };
            tableRows.push(row);
            return { ...row };
          });
          return {
            data: returnColumns ? inserted : null,
            error: null,
          };
        }

        if (op === "upsert") {
          const items = Array.isArray(payload) ? payload : [payload!];
          const cols = (conflictKey ?? "id").split(",").map((c) => c.trim());
          const upserted = items.map((item) => {
            const idx = tableRows.findIndex((existing) =>
              cols.every((col) => existing[col] === item[col])
            );
            if (idx >= 0) {
              tableRows[idx] = { ...tableRows[idx], ...item };
              return { ...tableRows[idx] };
            }
            const row: Row = {
              id: (item.id as string | undefined) ?? nextUuid(),
              ...item,
            };
            tableRows.push(row);
            return { ...row };
          });
          return { data: returnColumns ? upserted : null, error: null };
        }

        if (op === "update") {
          const updated: Row[] = [];
          for (let i = 0; i < tableRows.length; i++) {
            if (matches(tableRows[i])) {
              tableRows[i] = { ...tableRows[i], ...(payload as Row) };
              updated.push({ ...tableRows[i] });
            }
          }
          return { data: returnColumns ? updated : null, error: null };
        }

        const kept: Row[] = [];
        for (const r of tableRows) {
          if (!matches(r)) kept.push(r);
        }
        store[table] = kept;
        return { data: null, error: null };
      };

      const builder: DbQueryBuilder = {
        select(cols = "*") {
          selectedCols = cols;
          if (op !== "select") {
            returnColumns = true;
          }
          return builder;
        },
        insert(values) {
          op = "insert";
          payload = values;
          return builder;
        },
        update(values) {
          op = "update";
          payload = values;
          return builder;
        },
        upsert(values, opts) {
          op = "upsert";
          payload = values;
          conflictKey = opts?.onConflict;
          return builder;
        },
        delete() {
          op = "delete";
          return builder;
        },
        eq(column, value) {
          filters.push((row) => row[column] === value);
          return builder;
        },
        neq(column, value) {
          filters.push((row) => row[column] !== value);
          return builder;
        },
        in(column, values) {
          const set = new Set(values);
          filters.push((row) => set.has(row[column]));
          return builder;
        },
        async maybeSingle() {
          const res = await execute();
          if (res.error) return res;
          const arr = (res.data as Row[] | null) ?? [];
          return { data: arr[0] ?? null, error: null };
        },
        async single() {
          const res = await execute();
          if (res.error) return res;
          const arr = (res.data as Row[] | null) ?? [];
          if (arr.length === 0) {
            return { data: null, error: { message: "Row not found" } };
          }
          return { data: arr[0], error: null };
        },
        then(onfulfilled, onrejected) {
          return execute().then(onfulfilled, onrejected);
        },
      };

      return builder;
    },
  };

  return { db, store };
}

function createFixtureExcelDataset(variant: "base" | "updated"): TournamentDataset {
  const isUpdated = variant === "updated";
  return {
    seasons: [
      {
        id: "season-2026",
        year: 2026,
        name: "Temporada 2026",
        status: "active",
        cupCutoffDate: "2026-08-01",
      },
    ],
    players: [
      {
        id: "luca",
        displayName: "Luca",
        role: isUpdated ? "player" : "admin",
        email: isUpdated ? undefined : "luca@secret.test",
        userId: isUpdated ? undefined : "auth-uuid-luca",
        isActive: true,
      },
      {
        id: "pipo",
        displayName: "Pipo",
        role: isUpdated ? "player" : "authorized",
        isActive: true,
      },
      {
        id: "enzo",
        displayName: "Enzo",
        role: "player",
        isActive: true,
      },
      ...(isUpdated
        ? [
            {
              id: "t-allende",
              displayName: "T. Allende",
              role: "player" as const,
              isActive: true,
            },
          ]
        : []),
    ],
    aliases: [{ id: "alias-1", playerId: "luca", rawName: "Luquita" }],
    titles: [],
    matches: [
      {
        id: "m-2026-01",
        seasonId: "season-2026",
        matchNumber: 1,
        matchDate: "2026-03-10",
        matchType: "league",
        modality: "F5",
        teamAScore: isUpdated ? 6 : 5,
        teamBScore: 3,
        countsForLeague: true,
        countsForStats: true,
        votingStatus: "closed",
        externalSourceKey: "2026-F1",
        players: [
          {
            id: "m-2026-01-luca",
            matchId: "m-2026-01",
            playerId: "luca",
            team: "A",
            isCupCaptain: false,
            goals: 2,
            assists: 1,
            adminRating: 8,
            isMvp: true,
          },
          ...(isUpdated
            ? [
                {
                  id: "m-2026-01-t-allende",
                  matchId: "m-2026-01",
                  playerId: "t-allende",
                  team: "B" as const,
                  isCupCaptain: false,
                  goals: 1,
                  assists: 0,
                  adminRating: 7,
                  isMvp: false,
                },
              ]
            : [
                {
                  id: "m-2026-01-enzo",
                  matchId: "m-2026-01",
                  playerId: "enzo",
                  team: "B" as const,
                  isCupCaptain: false,
                  goals: 1,
                  assists: 0,
                  adminRating: 7,
                  isMvp: false,
                },
              ]),
        ],
      },
      ...(isUpdated
        ? [
            {
              id: "m-2026-02",
              seasonId: "season-2026",
              matchNumber: 2,
              matchDate: "2026-03-17",
              matchType: "league" as const,
              modality: "F5" as const,
              teamAScore: 4,
              teamBScore: 4,
              countsForLeague: true,
              countsForStats: true,
              votingStatus: "closed" as const,
              externalSourceKey: "2026-F2",
              players: [
                {
                  id: "m-2026-02-luca",
                  matchId: "m-2026-02",
                  playerId: "luca",
                  team: "A" as const,
                  isCupCaptain: false,
                  goals: 2,
                  assists: 0,
                  adminRating: 7.5,
                  isMvp: false,
                },
                {
                  id: "m-2026-02-pipo",
                  matchId: "m-2026-02",
                  playerId: "pipo",
                  team: "B" as const,
                  isCupCaptain: false,
                  goals: 2,
                  assists: 0,
                  adminRating: 8,
                  isMvp: true,
                },
              ],
            },
          ]
        : []),
    ],
    calendarEvents: [],
    announcements: [],
    cupEditions: [
      {
        id: "cup-2026",
        seasonId: "season-2026",
        name: "Copa 2026",
        cutoffSnapshotPlayerIds: ["luca", "pipo"],
      },
    ],
    cupTies: isUpdated
      ? [
          {
            id: "cup-2026-final-1",
            cupEditionId: "cup-2026",
            round: "final",
            slotOrder: 1,
            playerAId: "luca",
            playerBId: "pipo",
            seedA: 1,
            seedB: 2,
            leg1MatchId: null,
            leg2MatchId: null,
            overrideScoreA: null,
            overrideScoreB: null,
            winnerPlayerId: null,
          },
        ]
      : [
          {
            id: "cup-2026-prelim-1",
            cupEditionId: "cup-2026",
            round: "preliminary",
            slotOrder: 1,
            playerAId: "pipo",
            playerBId: "enzo",
            seedA: 8,
            seedB: 9,
            leg1MatchId: null,
            leg2MatchId: null,
            overrideScoreA: null,
            overrideScoreB: null,
            winnerPlayerId: null,
          },
          {
            id: "cup-2026-final-1",
            cupEditionId: "cup-2026",
            round: "final",
            slotOrder: 1,
            playerAId: "luca",
            playerBId: "pipo",
            seedA: 1,
            seedB: 2,
            leg1MatchId: null,
            leg2MatchId: null,
            overrideScoreA: null,
            overrideScoreB: null,
            winnerPlayerId: null,
          },
        ],
    fundMonths: [
      {
        id: "fm-2026-1",
        seasonId: "season-2026",
        monthNumber: 1,
        monthLabel: "Enero",
        feeAmount: 3000,
      },
    ],
    fundPayments: [
      {
        id: "fp-fm-2026-1-luca",
        fundMonthId: "fm-2026-1",
        playerId: "luca",
        paid: true,
        paidAt: "2026-01-05T10:00:00Z",
      },
    ],
    fundTransactions: isUpdated
      ? [
          {
            id: "ftx-2026-expense-1",
            seasonId: "season-2026",
            txType: "expense",
            amount: 12000,
            description: "Trofeo actualizado",
            txDate: "2026-03-01",
          },
        ]
      : [
          {
            id: "ftx-2026-expense-1",
            seasonId: "season-2026",
            txType: "expense",
            amount: 10000,
            description: "Trofeo inicial",
            txDate: "2026-03-01",
          },
          {
            id: "ftx-2026-expense-2",
            seasonId: "season-2026",
            txType: "expense",
            amount: 4000,
            description: "Gasto eliminado en Excel",
            txDate: "2026-03-02",
          },
          {
            id: "manual-ftx-2026-abc12345",
            seasonId: "season-2026",
            txType: "yield",
            amount: 1500,
            description: "Rendimiento manual en Admin",
            txDate: "2026-03-05",
          },
        ],
  };
}

function createInMemorySyncClient() {
  const tables: Record<string, Row[]> = {};
  const selectedColumnsLog: Array<{ table: string; columns: string }> = [];

  const client: SeedTableClient = {
    async selectAll(table, columns) {
      selectedColumnsLog.push({ table, columns });
      if (table === "players" && /\bemail\b/.test(columns)) {
        throw new Error("permission denied for column email of table players");
      }
      return (tables[table] ?? []).map((r) => ({ ...r }));
    },
    async upsertRows(table, rows, onConflict) {
      const list = tables[table] ?? (tables[table] = []);
      const cols = onConflict.split(",").map((c) => c.trim());
      for (const row of rows) {
        const idx = list.findIndex((existing) =>
          cols.every((col) => existing[col] === row[col])
        );
        if (idx >= 0) {
          // Simulate PostgreSQL ON CONFLICT DO UPDATE touching only supplied keys
          list[idx] = { ...list[idx], ...row };
        } else {
          list.push({ ...row });
        }
      }
    },
    async deleteByIds(table, ids) {
      if (ids.length === 0) return;
      const drop = new Set(ids);
      tables[table] = (tables[table] ?? []).filter(
        (r) => !drop.has(String(r.id))
      );
    },
  };

  return { client, tables, selectedColumnsLog };
}

describe("WU-7 Pozo SSR Segregation & Admin-Only Mutations", () => {
  it("hydrates fund data ONLY for admin and keeps fund=null with zero fund queries for authorized operators", async () => {
    const publicRepo = new SeedPublicTournamentRepository();
    const getFundDataSpy = vi.fn(async () => ({
      fundMonths: [],
      fundPayments: [],
      fundTransactions: [],
    }));
    const mockFundRepo = {
      getFundData: getFundDataSpy,
    } as unknown as AdminFundRepository;

    const opVm = await loadAdminViewModel(
      OPERATOR_SESSION,
      publicRepo,
      mockFundRepo
    );
    expect(opVm.status).toBe("authorized");
    if (opVm.status === "authorized") {
      expect(opVm.fund).toBeNull();
    }
    expect(getFundDataSpy).not.toHaveBeenCalled();

    const realFundRepo = new SeedAdminFundRepository({
      authorizeAdmin: async () => ADMIN_SESSION,
    });
    const adminVm = await loadAdminViewModel(
      ADMIN_SESSION,
      publicRepo,
      realFundRepo
    );
    expect(adminVm.status).toBe("authorized");
    if (adminVm.status === "authorized") {
      expect(adminVm.fund).not.toBeNull();
      expect(adminVm.fund!.fundMonths.length).toBeGreaterThan(0);
    }
  });

  it("blocks guest, player, and authorized operators across all 5 Pozo mutations", async () => {
    const { db } = createFakeFundDb();

    for (const session of [GUEST_SESSION, PLAYER_SESSION, OPERATOR_SESSION]) {
      const expectedCode =
        session.role === "guest" ? "UNAUTHENTICATED" : "FORBIDDEN";

      const r1 = await performEnrollPlayerInFund(db, session, {
        seasonId: "season-2026",
        playerId: "b-aguzzi",
      });
      expect(r1).toMatchObject({ ok: false, code: expectedCode });

      const r2 = await performCreatePlayerAndEnrollInFund(db, session, {
        seasonId: "season-2026",
        displayName: "Nuevo",
      });
      expect(r2).toMatchObject({ ok: false, code: expectedCode });

      const r3 = await performToggleFundPayment(db, session, {
        fundMonthId: "fm-2026-1",
        playerId: "luca",
      });
      expect(r3).toMatchObject({ ok: false, code: expectedCode });

      const r4 = await performUpdateFundMonthFee(db, session, {
        fundMonthId: "fm-2026-1",
        feeAmount: 5000,
      });
      expect(r4).toMatchObject({ ok: false, code: expectedCode });

      const r5 = await performCreateFundTransaction(db, session, {
        seasonId: "season-2026",
        txType: "expense",
        amount: 2000,
        description: "Pelota",
        txDate: "2026-03-10",
      });
      expect(r5).toMatchObject({ ok: false, code: expectedCode });
    }
  });

  it("enrolls players initializing 12 months without overwriting already-paid months, toggles payments, updates fees, and records manual transactions", async () => {
    const { db, store } = createFakeFundDb();

    // Enroll Luca (already paid Enero; missing months 2..12 should be initialized as paid=false)
    const enrollRes = await performEnrollPlayerInFund(db, ADMIN_SESSION, {
      seasonId: "season-2026",
      playerId: "luca",
    });
    expect(enrollRes.ok).toBe(true);
    expect(store.fund_months).toHaveLength(12);

    const lucaPayments = store.fund_payments.filter(
      (p) => p.player_id === ADMIN_SESSION.playerUuid
    );
    expect(lucaPayments).toHaveLength(12);
    const janPayment = lucaPayments.find(
      (p) => p.fund_month_id === "ffffffff-ffff-4fff-8fff-ffffffff0001"
    );
    expect(janPayment?.paid).toBe(true); // Preserved!

    // Toggle Febrero for Luca (false -> true -> false)
    const toggleOn = await performToggleFundPayment(db, ADMIN_SESSION, {
      fundMonthId: "fm-2026-2",
      playerId: "luca",
    });
    expect(toggleOn).toMatchObject({ ok: true, data: { paid: true } });

    const toggleOff = await performToggleFundPayment(db, ADMIN_SESSION, {
      fundMonthId: "fm-2026-2",
      playerId: "luca",
    });
    expect(toggleOff).toMatchObject({ ok: true, data: { paid: false } });

    // Update monthly fee and validate negative rejection
    const badFee = await performUpdateFundMonthFee(db, ADMIN_SESSION, {
      fundMonthId: "fm-2026-2",
      feeAmount: -100,
    });
    expect(badFee).toMatchObject({ ok: false, code: "VALIDATION" });

    const okFee = await performUpdateFundMonthFee(db, ADMIN_SESSION, {
      fundMonthId: "fm-2026-2",
      feeAmount: 4500,
    });
    expect(okFee.ok).toBe(true);
    expect(
      store.fund_months.find((m) => m.month_number === 2)?.fee_amount
    ).toBe(4500);

    // Add manual yield transaction (external_key must not start with ftx-)
    const txRes = await performCreateFundTransaction(db, ADMIN_SESSION, {
      seasonId: "season-2026",
      txType: "yield",
      amount: 3200,
      description: "Intereses billetera",
      txDate: "2026-04-01",
    });
    expect(txRes.ok).toBe(true);
    expect(store.fund_transactions).toHaveLength(1);
    expect(String(store.fund_transactions[0].external_key)).toMatch(
      /^manual-ftx-/
    );
  });

  it("rolls back newly created player if Pozo payment initialization fails in performCreatePlayerAndEnrollInFund", async () => {
    const { db, store } = createFakeFundDb({
      failOn: {
        fund_payments: {
          op: "insert",
          error: { message: "fund_payments write failure" },
          once: true,
        },
      },
    });
    const playersBefore = store.players.length;

    const res = await performCreatePlayerAndEnrollInFund(db, ADMIN_SESSION, {
      seasonId: "season-2026",
      displayName: "T. Allende",
    });

    expect(res.ok).toBe(false);
    expect(store.players).toHaveLength(playersBefore);
    expect(store.players.some((p) => p.slug === "t-allende")).toBe(false);
  });
});

describe("WU-7 DB-Backed Excel Importer & Stale Child Pruning", () => {
  it("enforces admin role on preview and apply, never selects players.email, preserves roles/emails, and prunes stale children on overwrite", async () => {
    const baseDataset = createFixtureExcelDataset("base");
    const updatedDataset = createFixtureExcelDataset("updated");

    // Unauthorized preview & apply must fail closed
    const deniedPreview = previewExcelImportFromDataset(
      OPERATOR_SESSION,
      baseDataset,
      updatedDataset
    );
    expect(deniedPreview).toMatchObject({ ok: false, code: "FORBIDDEN" });

    const { client, tables, selectedColumnsLog } = createInMemorySyncClient();

    // Seed initial DB state (including private email & user_id on Luca)
    await syncDatasetToSupabase(client, baseDataset);
    expect(tables.players.find((p) => p.slug === "luca")?.email).toBe(
      "luca@secret.test"
    );

    // Clear log to verify authenticated admin sync never selects email
    selectedColumnsLog.length = 0;

    // Preview as Admin
    const previewRes = previewExcelImportFromDataset(
      ADMIN_SESSION,
      baseDataset,
      updatedDataset
    );
    expect(previewRes.ok).toBe(true);
    if (previewRes.ok && previewRes.data) {
      expect(previewRes.data.newPlayersCount).toBe(1);
      expect(previewRes.data.newMatchesCount).toBe(1);
      expect(previewRes.data.updatedMatchesCount).toBe(1);
      expect(previewRes.data.unchangedMatchesCount).toBe(0);
    }

    // Apply with overwriteExisting = true
    const applyRes = await applyExcelImportFromDataset(
      ADMIN_SESSION,
      baseDataset,
      updatedDataset,
      client,
      { overwriteExisting: true }
    );
    expect(applyRes.ok).toBe(true);

    // 1. Never selected email column on players
    for (const q of selectedColumnsLog) {
      if (q.table === "players") {
        expect(q.columns).not.toMatch(/\bemail\b/);
      }
    }

    // 2. Preserved admin/authorized roles AND private email/user_id in DB!
    const lucaRow = tables.players.find((p) => p.slug === "luca");
    const pipoRow = tables.players.find((p) => p.slug === "pipo");
    expect(lucaRow?.role).toBe("admin");
    expect(lucaRow?.email).toBe("luca@secret.test");
    expect(lucaRow?.user_id).toBe("auth-uuid-luca");
    expect(pipoRow?.role).toBe("authorized");

    // 3. Updated match 2026-F1 pruned removed player Enzo and has exact 2 players (Luca + T. Allende)
    const m1 = tables.matches.find((m) => m.external_source_key === "2026-F1");
    expect(m1?.team_a_score).toBe(6);
    const m1Players = tables.match_players.filter((mp) => mp.match_id === m1?.id);
    expect(m1Players).toHaveLength(2);
    const enzoRow = tables.players.find((p) => p.slug === "enzo");
    expect(m1Players.some((mp) => mp.player_id === enzoRow?.id)).toBe(false);

    // 4. Pruned obsolete cup_ties (preliminary removed) and obsolete Excel ftx-2 while keeping manual-ftx!
    expect(tables.cup_ties).toHaveLength(1);
    expect(tables.cup_ties[0].round).toBe("final");

    const txKeys = tables.fund_transactions.map((t) => t.external_key);
    expect(txKeys).toContain("ftx-2026-expense-1");
    expect(txKeys).not.toContain("ftx-2026-expense-2");
    expect(txKeys).toContain("manual-ftx-2026-abc12345");
  });
});

describe("WU-7 Complete Removal of TournamentProvider, localStorage & Client seed-data", () => {
  it("confirms TournamentProvider.tsx is deleted and zero client/app files reference useTournament, localStorage, or seed-data.json", () => {
    const root = process.cwd();
    const providerPath = path.join(
      root,
      "src/components/providers/TournamentProvider.tsx"
    );
    expect(existsSync(providerPath)).toBe(false);

    const srcRoot = path.join(root, "src");
    const sourceFiles: string[] = [];

    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (
          entry.isFile() &&
          /\.(ts|tsx)$/.test(entry.name) &&
          !/\.test\.(ts|tsx)$/.test(entry.name)
        ) {
          sourceFiles.push(full);
        }
      }
    }

    walk(srcRoot);
    expect(sourceFiles.length).toBeGreaterThan(20);

    for (const file of sourceFiles) {
      const rel = path.relative(root, file).split(path.sep).join("/");
      const content = readFileSync(file, "utf8");

      expect(
        content,
        `${rel} must not reference TournamentProvider`
      ).not.toContain("TournamentProvider");
      expect(content, `${rel} must not reference useTournament`).not.toContain(
        "useTournament"
      );
      expect(content, `${rel} must not use localStorage`).not.toContain(
        "localStorage"
      );

      if (!rel.startsWith("src/server/")) {
        expect(
          content,
          `${rel} outside src/server/ must not import seed-data.json`
        ).not.toContain("seed-data.json");
      }
    }
  });
});
