"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewerSession } from "@/server/auth";
import { CACHE_TAGS } from "@/server/queries/tags";
import {
  performAwardPlayerTitle,
  performCreatePlayer,
  performCreateSeason,
  performUpdatePlayerRole,
  type AdminDbClient,
} from "@/server/admin/mutations-core";
import type {
  ActionResult,
  AwardPlayerTitleInput,
  CreatePlayerInput,
  CreateSeasonInput,
  UpdatePlayerRoleInput,
} from "@/lib/types/admin-actions";

export async function createPlayerAction(
  input: CreatePlayerInput
): Promise<ActionResult<{ id: string }>> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performCreatePlayer(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateTag(CACHE_TAGS.players);
    revalidatePath("/admin");
  }
  return result;
}

export async function updatePlayerRoleAction(
  input: UpdatePlayerRoleInput
): Promise<ActionResult> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performUpdatePlayerRole(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateTag(CACHE_TAGS.players);
    revalidatePath("/admin");
  }
  return result;
}

export async function awardPlayerTitleAction(
  input: AwardPlayerTitleInput
): Promise<ActionResult> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performAwardPlayerTitle(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateTag(CACHE_TAGS.players);
    revalidateTag(CACHE_TAGS.seasons);
    revalidatePath("/admin");
  }
  return result;
}

export async function createSeasonAction(
  input: CreateSeasonInput
): Promise<ActionResult<{ id: string; year: number }>> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performCreateSeason(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateTag(CACHE_TAGS.seasons);
    revalidateTag(CACHE_TAGS.cup);
    revalidateTag(CACHE_TAGS.calendar);
    revalidatePath("/admin");
  }
  return result;
}
