"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewerSession } from "@/server/auth";
import { CACHE_TAGS } from "@/server/queries/tags";
import {
  performCreateMatch,
  performDeleteMatch,
  performUpdateMatch,
  type AdminDbClient,
} from "@/server/admin/mutations-core";
import type {
  ActionResult,
  CreateMatchInput,
  DeleteMatchInput,
  UpdateMatchInput,
} from "@/lib/types/admin-actions";

function revalidateMatchViews(): void {
  revalidateTag(CACHE_TAGS.matches);
  revalidateTag(CACHE_TAGS.seasons);
  revalidateTag(CACHE_TAGS.calendar);
  revalidateTag(CACHE_TAGS.cup);
  revalidatePath("/admin");
}

export async function createMatchAction(
  input: CreateMatchInput
): Promise<ActionResult<{ id: string }>> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performCreateMatch(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateMatchViews();
  }
  return result;
}

export async function updateMatchAction(
  input: UpdateMatchInput
): Promise<ActionResult<{ id: string }>> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performUpdateMatch(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateMatchViews();
  }
  return result;
}

export async function deleteMatchAction(
  input: DeleteMatchInput
): Promise<ActionResult> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performDeleteMatch(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateMatchViews();
  }
  return result;
}
