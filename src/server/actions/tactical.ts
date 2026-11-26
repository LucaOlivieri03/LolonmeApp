"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewerSession } from "@/server/auth";
import { CACHE_TAGS } from "@/server/queries/tags";
import type { AdminDbClient } from "@/server/admin/mutations-core";
import { performSaveTacticalPositions } from "@/server/admin/tactical-core";
import type {
  ActionResult,
  SaveTacticalPositionsInput,
} from "@/lib/types/admin-actions";

export async function saveTacticalPositionsAction(
  input: SaveTacticalPositionsInput
): Promise<ActionResult<{ updatedCount: number }>> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);

  const result = await performSaveTacticalPositions(
    client as unknown as AdminDbClient | null,
    session,
    input
  );

  if (result.ok) {
    revalidateTag(CACHE_TAGS.matches);
    revalidatePath("/partidos");
  }

  return result;
}
