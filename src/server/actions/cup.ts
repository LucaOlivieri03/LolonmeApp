"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewerSession } from "@/server/auth";
import { CACHE_TAGS } from "@/server/queries/tags";
import { getPublicTournamentRepository } from "@/server/repositories";
import {
  performRegenerateCupBracket,
  performUpdateCupTie,
  type AdminDbClient,
} from "@/server/admin/mutations-core";
import type {
  ActionResult,
  RegenerateCupBracketInput,
  UpdateCupTieInput,
} from "@/lib/types/admin-actions";

export async function regenerateCupBracketAction(
  input: RegenerateCupBracketInput
): Promise<ActionResult> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const repo = getPublicTournamentRepository();
  const result = await performRegenerateCupBracket(
    client as unknown as AdminDbClient | null,
    session,
    repo,
    input
  );
  if (result.ok) {
    revalidateTag(CACHE_TAGS.cup);
    revalidatePath("/admin");
  }
  return result;
}

export async function updateCupTieAction(
  input: UpdateCupTieInput
): Promise<ActionResult> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performUpdateCupTie(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateTag(CACHE_TAGS.cup);
    revalidatePath("/admin");
  }
  return result;
}
