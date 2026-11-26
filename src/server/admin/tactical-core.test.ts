import { describe, expect, it } from "vitest";
import type { ViewerSession } from "@/server/auth";
import type { AdminDbClient, DbQueryBuilder } from "./mutations-core";
import { performSaveTacticalPositions } from "./tactical-core";
import { PITCH_BOUNDS } from "@/lib/matches/tactical-board";

const MATCH_UUID = "11111111-1111-4111-8111-111111111111";
const CAPTAIN_A_UUID = "22222222-2222-4222-8222-222222222221";
const PLAYER_A_UUID = "22222222-2222-4222-8222-222222222222";
const PLAYER_B_UUID = "22222222-2222-4222-8222-222222222223";

const captainASession: ViewerSession = {
  userId: "auth-cap-a",
  email: "cap@test.com",
  playerId: "cap-a",
  playerUuid: CAPTAIN_A_UUID,
  displayName: "Cap A",
  role: "player",
};

const regularPlayerSession: ViewerSession = {
  userId: "auth-p-a",
  email: "pa@test.com",
  playerId: "player-a",
  playerUuid: PLAYER_A_UUID,
  displayName: "Player A",
  role: "player",
};

const adminSession: ViewerSession = {
  userId: "auth-admin",
  email: "admin@test.com",
  playerId: "admin",
  playerUuid: PLAYER_A_UUID,
  displayName: "Admin",
  role: "admin",
};

const ROSTER = [
  { id: "mp-1", player_id: CAPTAIN_A_UUID, team: "A" as const, is_cup_captain: true },
  { id: "mp-2", player_id: PLAYER_A_UUID, team: "A" as const, is_cup_captain: false },
  { id: "mp-3", player_id: PLAYER_B_UUID, team: "B" as const, is_cup_captain: false },
];

const PLAYERS = [
  { id: CAPTAIN_A_UUID, slug: "cap-a" },
  { id: PLAYER_A_UUID, slug: "player-a" },
  { id: PLAYER_B_UUID, slug: "player-b" },
];

function createMockClient(
  updates: Array<{ table: string; payload: unknown }>
): AdminDbClient {
  return {
    from(table: string) {
      let action: "select" | "update" = "select";
      const builder: DbQueryBuilder = {
        select() {
          action = "select";
          return builder;
        },
        insert() {
          return builder;
        },
        update(values) {
          action = "update";
          updates.push({ table, payload: values });
          return builder;
        },
        upsert() {
          return builder;
        },
        delete() {
          return builder;
        },
        eq() {
          return builder;
        },
        neq() {
          return builder;
        },
        in() {
          return builder;
        },
        single() {
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle() {
          if (table === "matches") {
            return Promise.resolve({ data: { id: MATCH_UUID }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(onfulfilled, onrejected) {
          let data: unknown = null;
          if (action === "select") {
            if (table === "match_players") data = ROSTER;
            if (table === "players") data = PLAYERS;
          }
          return Promise.resolve({ data, error: null }).then(
            onfulfilled,
            onrejected
          );
        },
      };
      return builder;
    },
  };
}

describe("tactical-core position persistence", () => {
  it("forbids regular non-captain players from persisting official positions", async () => {
    const updates: Array<{ table: string; payload: unknown }> = [];
    const res = await performSaveTacticalPositions(
      createMockClient(updates),
      regularPlayerSession,
      {
        matchId: MATCH_UUID,
        positions: [{ playerId: "player-a", x: 50, y: 30 }],
      }
    );

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("FORBIDDEN");
    expect(updates).toHaveLength(0);
  });

  it("allows a Team A captain to save Team A positions (clamped to top half) but forbids Team B", async () => {
    const updates: Array<{ table: string; payload: unknown }> = [];
    const okRes = await performSaveTacticalPositions(
      createMockClient(updates),
      captainASession,
      {
        matchId: MATCH_UUID,
        positions: [{ playerId: "player-a", x: 50, y: 90 }], // attempts to cross midfield
      }
    );

    expect(okRes.ok).toBe(true);
    expect(updates).toEqual([
      {
        table: "match_players",
        payload: { pitch_x: 50, pitch_y: PITCH_BOUNDS.teamA.maxY },
      },
    ]);

    const forbiddenRes = await performSaveTacticalPositions(
      createMockClient([]),
      captainASession,
      {
        matchId: MATCH_UUID,
        positions: [{ playerId: "player-b", x: 50, y: 75 }],
      }
    );
    expect(forbiddenRes.ok).toBe(false);
    if (!forbiddenRes.ok) expect(forbiddenRes.code).toBe("FORBIDDEN");
  });

  it("allows admin to save both Team A and Team B positions", async () => {
    const updates: Array<{ table: string; payload: unknown }> = [];
    const res = await performSaveTacticalPositions(
      createMockClient(updates),
      adminSession,
      {
        matchId: MATCH_UUID,
        positions: [
          { playerId: "player-a", x: 35, y: 25 },
          { playerId: "player-b", x: 65, y: 75 },
        ],
      }
    );

    expect(res.ok).toBe(true);
    expect(updates).toHaveLength(2);
  });
});
