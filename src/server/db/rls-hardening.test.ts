import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  "supabase/migrations/0005_security_rls_hardening.sql"
);

function readMigrationSql(): string {
  expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  return fs.readFileSync(MIGRATION_PATH, "utf8");
}

function extractFunctionBody(sql: string, functionName: string): string {
  const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION\\s+${escaped}\\s*\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`,
    "i"
  );
  const match = sql.match(pattern);
  expect(match, `Expected function ${functionName} to be defined`).not.toBeNull();
  return match![0];
}

function extractPolicyStatement(sql: string, policyName: string): string {
  const escaped = policyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `DROP POLICY IF EXISTS\\s+"?${escaped}"?\\s+ON\\s+[\\w.]+;\\s*CREATE POLICY\\s+"?${escaped}"?[\\s\\S]*?;`,
    "i"
  );
  const match = sql.match(pattern);
  expect(match, `Expected idempotent policy ${policyName} to be defined`).not.toBeNull();
  return match![0];
}

describe("0005_security_rls_hardening.sql migration invariants", () => {
  it("uses idempotent DDL statements throughout the migration", () => {
    const sql = readMigrationSql();

    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION/i);
    expect(sql).toMatch(/DROP POLICY IF EXISTS/i);
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS/i);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS/i);
    expect(sql).toMatch(/DO \$\$[\s\S]*?IF NOT EXISTS[\s\S]*?END \$\$;/i);
  });

  it("1. excludes deactivated users (is_active = true) in current_player_role() and current_player_id()", () => {
    const sql = readMigrationSql();

    const roleFn = extractFunctionBody(sql, "public.current_player_role");
    expect(roleFn).toMatch(/\bSTABLE\b/i);
    expect(roleFn).toMatch(/\bSECURITY DEFINER\b/i);
    expect(roleFn).toMatch(/SET search_path = public/i);
    expect(roleFn).toMatch(/WHERE\s+user_id\s*=\s*auth\.uid\(\)\s+AND\s+is_active\s*=\s*true\s+LIMIT\s+1/i);

    const idFn = extractFunctionBody(sql, "public.current_player_id");
    expect(idFn).toMatch(/\bSTABLE\b/i);
    expect(idFn).toMatch(/\bSECURITY DEFINER\b/i);
    expect(idFn).toMatch(/SET search_path = public/i);
    expect(idFn).toMatch(/WHERE\s+user_id\s*=\s*auth\.uid\(\)\s+AND\s+is_active\s*=\s*true\s+LIMIT\s+1/i);
  });

  it("2. binds player_link_requests INSERT email to the authenticated JWT email claim", () => {
    const sql = readMigrationSql();
    const policy = extractPolicyStatement(sql, "users_insert_own_pending_link_request");

    expect(policy).toMatch(/ON public\.player_link_requests/i);
    expect(policy).toMatch(/FOR INSERT/i);
    expect(policy).toMatch(/TO authenticated/i);
    expect(policy).toMatch(/lower\(btrim\(email\)\)\s*=\s*lower\(COALESCE\(auth\.jwt\(\)\s*->>\s*'email',\s*''\)\)/i);
    expect(policy).toMatch(/auth\.uid\(\)\s*=\s*user_id/i);
    expect(policy).toMatch(/status\s*=\s*'pending'/i);
    expect(policy).toMatch(/reviewed_by\s+IS\s+NULL/i);
    expect(policy).toMatch(/reviewed_at\s+IS\s+NULL/i);
    expect(policy).toMatch(/p\.role\s*<>\s*'admin'/i);
  });

  it("3. enforces voting integrity on public.match_votes (no self-vote, single MVP per voter, target on roster)", () => {
    const sql = readMigrationSql();

    // Idempotent CHECK constraint preventing self-votes
    expect(sql).toMatch(
      /conname\s*=\s*'match_votes_no_self_vote'[\s\S]*?ADD CONSTRAINT match_votes_no_self_vote[\s\S]*?CHECK\s*\(voter_player_id\s*<>\s*target_player_id\)/i
    );

    // Partial unique index enforcing at most one MVP vote per voter per match
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_match_votes_one_mvp_per_voter\s+ON public\.match_votes\s*\(match_id,\s*voter_player_id\)\s+WHERE voted_mvp = true/i
    );

    // INSERT and UPDATE policies require open match, voter participation, non-self-vote, and target participation
    const insertPolicy = extractPolicyStatement(sql, "write_match_votes_participants");
    expect(insertPolicy).toMatch(/FOR INSERT WITH CHECK/i);
    expect(insertPolicy).toMatch(/voter_player_id\s*<>\s*target_player_id/i);
    expect(insertPolicy).toMatch(/m\.voting_status\s*=\s*'open'/i);
    expect(insertPolicy).toMatch(/mp\.player_id\s*=\s*public\.current_player_id\(\)/i);
    expect(insertPolicy).toMatch(
      /FROM public\.match_players mp_target[\s\S]*?mp_target\.match_id\s*=\s*match_votes\.match_id\s+AND\s+mp_target\.player_id\s*=\s*match_votes\.target_player_id/i
    );

    const updatePolicy = extractPolicyStatement(sql, "update_match_votes_participants");
    expect(updatePolicy).toMatch(/FOR UPDATE USING/i);
    expect(updatePolicy).toMatch(/WITH CHECK/i);
    expect(updatePolicy).toMatch(/voter_player_id\s*<>\s*target_player_id/i);
    expect(updatePolicy).toMatch(/m\.voting_status\s*=\s*'open'/i);
    expect(updatePolicy).toMatch(
      /FROM public\.match_players mp_target[\s\S]*?mp_target\.match_id\s*=\s*match_votes\.match_id\s+AND\s+mp_target\.player_id\s*=\s*match_votes\.target_player_id/i
    );
  });

  it("4. restricts non-admin operator UPDATEs on matches and match_players via BEFORE UPDATE triggers", () => {
    const sql = readMigrationSql();

    // Matches trigger guard
    const matchGuard = extractFunctionBody(sql, "public.guard_operator_match_update");
    expect(matchGuard).toMatch(/auth\.uid\(\)\s+IS\s+NOT\s+NULL\s+AND\s+NOT\s+public\.is_admin\(\)/i);
    for (const protectedColumn of [
      "id",
      "season_id",
      "match_number",
      "match_date",
      "match_type",
      "modality",
      "team_a_score",
      "team_b_score",
      "result_outcome",
      "counts_for_league",
      "counts_for_stats",
      "external_source_key",
      "slug",
      "notes",
      "created_at",
    ]) {
      expect(matchGuard).toMatch(
        new RegExp(`NEW\\.${protectedColumn}\\s+IS\\s+DISTINCT\\s+FROM\\s+OLD\\.${protectedColumn}`, "i")
      );
    }
    // Voting lifecycle columns must remain editable by authorized operators
    for (const allowedColumn of ["voting_status", "voting_closed_at", "voting_closed_by"]) {
      expect(matchGuard).not.toMatch(
        new RegExp(`NEW\\.${allowedColumn}\\s+IS\\s+DISTINCT\\s+FROM\\s+OLD\\.${allowedColumn}`, "i")
      );
    }
    expect(sql).toMatch(
      /CREATE TRIGGER trg_guard_operator_match_update\s+BEFORE UPDATE ON public\.matches\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.guard_operator_match_update\(\)/i
    );

    // Match players trigger guard (cooperates with 0004 pitch_x/pitch_y captain guard)
    const matchPlayerGuard = extractFunctionBody(sql, "public.guard_operator_match_player_update");
    expect(matchPlayerGuard).toMatch(/auth\.uid\(\)\s+IS\s+NOT\s+NULL\s+AND\s+NOT\s+public\.is_admin\(\)/i);
    for (const protectedColumn of [
      "id",
      "match_id",
      "player_id",
      "team",
      "is_cup_captain",
      "goals",
      "assists",
      "admin_rating",
    ]) {
      expect(matchPlayerGuard).toMatch(
        new RegExp(`NEW\\.${protectedColumn}\\s+IS\\s+DISTINCT\\s+FROM\\s+OLD\\.${protectedColumn}`, "i")
      );
    }
    // is_mvp and tactical pitch coordinates remain editable by authorized operators
    for (const allowedColumn of ["is_mvp", "pitch_x", "pitch_y"]) {
      expect(matchPlayerGuard).not.toMatch(
        new RegExp(`NEW\\.${allowedColumn}\\s+IS\\s+DISTINCT\\s+FROM\\s+OLD\\.${allowedColumn}`, "i")
      );
    }
    expect(sql).toMatch(
      /CREATE TRIGGER trg_guard_operator_match_player_update\s+BEFORE UPDATE ON public\.match_players\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.guard_operator_match_player_update\(\)/i
    );
  });

  it("5. revokes table-level SELECT on players with explicit column grants, hardens guard_player_self_update(), and guards blog_topics.is_pinned", () => {
    const sql = readMigrationSql();

    // Table-level revoke + explicit column grants for anon (excludes user_id and email)
    expect(sql).toMatch(/REVOKE SELECT ON public\.players FROM anon;/i);
    const anonGrant = sql.match(/GRANT SELECT\s*\(([\s\S]*?)\)\s*ON public\.players TO anon;/i);
    expect(anonGrant, "Expected explicit column GRANT SELECT to anon").not.toBeNull();
    const anonCols = anonGrant![1].split(",").map((c) => c.trim().toLowerCase());
    expect(anonCols).not.toContain("user_id");
    expect(anonCols).not.toContain("email");
    expect(anonCols).toEqual(
      expect.arrayContaining([
        "id",
        "slug",
        "display_name",
        "nickname",
        "avatar_url",
        "role",
        "favorite_club_id",
        "political_orientation",
        "is_active",
        "created_at",
      ])
    );

    // Table-level revoke + explicit column grants for authenticated (excludes email, keeps user_id)
    expect(sql).toMatch(/REVOKE SELECT ON public\.players FROM authenticated;/i);
    const authGrant = sql.match(/GRANT SELECT\s*\(([\s\S]*?)\)\s*ON public\.players TO authenticated;/i);
    expect(authGrant, "Expected explicit column GRANT SELECT to authenticated").not.toBeNull();
    const authCols = authGrant![1].split(",").map((c) => c.trim().toLowerCase());
    expect(authCols).not.toContain("email");
    expect(authCols).toContain("user_id");
    expect(authCols).toEqual(
      expect.arrayContaining([
        "id",
        "user_id",
        "slug",
        "display_name",
        "nickname",
        "avatar_url",
        "role",
        "favorite_club_id",
        "political_orientation",
        "is_active",
        "created_at",
      ])
    );

    const playerGuard = extractFunctionBody(sql, "public.guard_player_self_update");
    expect(playerGuard).toMatch(/auth\.uid\(\)\s+IS\s+NOT\s+NULL\s+AND\s+NOT\s+public\.is_admin\(\)/i);
    for (const protectedColumn of [
      "id",
      "created_at",
      "role",
      "email",
      "user_id",
      "is_active",
      "slug",
      "display_name",
    ]) {
      expect(playerGuard).toMatch(
        new RegExp(`NEW\\.${protectedColumn}\\s+IS\\s+DISTINCT\\s+FROM\\s+OLD\\.${protectedColumn}`, "i")
      );
    }

    const blogPinGuard = extractFunctionBody(sql, "public.guard_blog_topic_pin");
    expect(blogPinGuard).toMatch(/auth\.uid\(\)\s+IS\s+NOT\s+NULL\s+AND\s+NOT\s+public\.is_admin\(\)/i);
    expect(blogPinGuard).toMatch(/TG_OP\s*=\s*'INSERT'\s+AND\s+NEW\.is_pinned\s*=\s*true/i);
    expect(blogPinGuard).toMatch(/TG_OP\s*=\s*'UPDATE'\s+AND\s+NEW\.is_pinned\s+IS\s+DISTINCT\s+FROM\s+OLD\.is_pinned/i);
    expect(sql).toMatch(
      /CREATE TRIGGER trg_guard_blog_topic_pin\s+BEFORE INSERT OR UPDATE ON public\.blog_topics\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.guard_blog_topic_pin\(\)/i
    );
  });
});
