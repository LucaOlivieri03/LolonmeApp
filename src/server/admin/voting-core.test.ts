import { describe, expect, it, vi } from "vitest";
import type { ViewerSession } from "@/server/auth";
import type { AdminDbClient, DbQueryBuilder } from "./mutations-core";
import {
  performCloseMatchVoting,
  performOpenMatchVoting,
  performSubmitMatchVotes,
} from "./voting-core";

const MATCH_UUID = "11111111-1111-4111-8111-111111111111";
const PLAYER_1_UUID = "22222222-2222-4222-8222-222222222221";
const PLAYER_2_UUID = "22222222-2222-4222-8222-222222222222";

const guestSession: ViewerSession = {
  userId: null,
  email: null,
  playerId: null,
  playerUuid: null,
  displayName: null,
  role: "guest",
};

const playerSession: ViewerSession = {
  userId: "auth-1",
  email: "luca@test.com",
  playerId: "luca",
  playerUuid: PLAYER_1_UUID,
  displayName: "Luca",
  role: "player",
};

const adminSession: ViewerSession = {
  userId: "auth-admin",
  email: "admin@test.com",
  playerId: "admin",
  playerUuid: PLAYER_1_UUID,
  displayName: "Admin",
  role: "admin",
};

function createMockClient(handlers: {
  matchRow?: { id: string; voting_status: "open" | "closed" } | null;
  roster?: Array<{ player_id: string }>;
  players?: Array<{ id: string; slug: string }>;
  votes?: Array<{ target_player_id: string; voted_mvp: boolean }>;
  onUpsert?: (rows: unknown) => void;
  onUpdate?: (table: string, payload: unknown) => void;
}): AdminDbClient {
  return {
    from(table: string) {
      let currentAction: "select" | "update" | "upsert" = "select";
      let updatePayload: unknown = null;

      const builder: DbQueryBuilder = {
        select() {
          currentAction = "select";
          return builder;
        },
        insert() {
          return builder;
        },
        update(values) {
          currentAction = "update";
          updatePayload = values;
          handlers.onUpdate?.(table, values);
          return builder;
        },
        upsert(values) {
          currentAction = "upsert";
          handlers.onUpsert?.(values);
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
            return Promise.resolve({
              data: handlers.matchRow ?? null,
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(onfulfilled, onrejected) {
          let data: unknown = null;
          if (currentAction === "select") {
            if (table === "match_players") data = handlers.roster ?? [];
            if (table === "players") data = handlers.players ?? [];
            if (table === "match_votes") data = handlers.votes ?? [];
          } else if (currentAction === "update") {
            data = updatePayload;
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

describe("voting-core server mutations", () => {
  it("blocks non-operators from opening or closing voting", async () => {
    const client = createMockClient({
      matchRow: { id: MATCH_UUID, voting_status: "closed" },
    });

    const openRes = await performOpenMatchVoting(client, playerSession, {
      matchId: MATCH_UUID,
    });
    expect(openRes.ok).toBe(false);
    if (!openRes.ok) expect(openRes.code).toBe("FORBIDDEN");

    const closeRes = await performCloseMatchVoting(client, guestSession, {
      matchId: MATCH_UUID,
    });
    expect(closeRes.ok).toBe(false);
    if (!closeRes.ok) expect(closeRes.code).toBe("UNAUTHENTICATED");
  });

  it("allows admin to open voting and close voting while applying top MVP", async () => {
    const updates: Array<{ table: string; payload: unknown }> = [];
    const client = createMockClient({
      matchRow: { id: MATCH_UUID, voting_status: "open" },
      votes: [
        { target_player_id: PLAYER_2_UUID, voted_mvp: true },
        { target_player_id: PLAYER_2_UUID, voted_mvp: true },
      ],
      onUpdate: (table, payload) => updates.push({ table, payload }),
    });

    const openRes = await performOpenMatchVoting(client, adminSession, {
      matchId: MATCH_UUID,
    });
    expect(openRes.ok).toBe(true);

    const closeRes = await performCloseMatchVoting(client, adminSession, {
      matchId: MATCH_UUID,
    });
    expect(closeRes.ok).toBe(true);
    if (closeRes.ok) {
      expect(closeRes.data?.winningMvpPlayerUuids).toEqual([PLAYER_2_UUID]);
    }
    expect(
      updates.some(
        (u) =>
          u.table === "match_players" &&
          (u.payload as { is_mvp?: boolean }).is_mvp === true
      )
    ).toBe(true);
  });

  it("blocks voting when match voting is closed", async () => {
    const client = createMockClient({
      matchRow: { id: MATCH_UUID, voting_status: "closed" },
    });

    const res = await performSubmitMatchVotes(client, playerSession, {
      matchId: MATCH_UUID,
      entries: [{ targetPlayerId: "nico", rating: 8, votedMvp: true }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("CONFLICT");
  });

  it("accepts valid participant ballot using domain slugs, clears prior MVP flag, and upserts UUIDs", async () => {
    const upsertSpy = vi.fn();
    const updates: Array<{ table: string; payload: unknown }> = [];
    const client = createMockClient({
      matchRow: { id: MATCH_UUID, voting_status: "open" },
      roster: [{ player_id: PLAYER_1_UUID }, { player_id: PLAYER_2_UUID }],
      players: [
        { id: PLAYER_1_UUID, slug: "luca" },
        { id: PLAYER_2_UUID, slug: "nico" },
      ],
      onUpdate: (table, payload) => updates.push({ table, payload }),
      onUpsert: upsertSpy,
    });

    const res = await performSubmitMatchVotes(client, playerSession, {
      matchId: MATCH_UUID,
      entries: [{ targetPlayerId: "nico", rating: 9, votedMvp: true }],
    });

    expect(res.ok).toBe(true);
    expect(updates).toContainEqual({
      table: "match_votes",
      payload: { voted_mvp: false },
    });
    expect(upsertSpy).toHaveBeenCalledWith([
      {
        match_id: MATCH_UUID,
        voter_player_id: PLAYER_1_UUID,
        target_player_id: PLAYER_2_UUID,
        rating: 9,
        voted_mvp: true,
      },
    ]);
  });
});
