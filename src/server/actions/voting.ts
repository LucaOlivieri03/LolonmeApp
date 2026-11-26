"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewerSession } from "@/server/auth";
import { CACHE_TAGS } from "@/server/queries/tags";
import type { AdminDbClient } from "@/server/admin/mutations-core";
import {
  performCloseMatchVoting,
  performOpenMatchVoting,
  performSubmitMatchVotes,
} from "@/server/admin/voting-core";
import type {
  ActionResult,
  CloseMatchVotingInput,
  OpenMatchVotingInput,
  SubmitMatchVotesInput,
} from "@/lib/types/admin-actions";

function revalidateVotingViews(): void {
  revalidateTag(CACHE_TAGS.matches);
  revalidatePath("/partidos");
  revalidatePath("/admin");
  revalidatePath("/stats");
  revalidatePath("/");
}

export async function openMatchVotingAction(
  input: OpenMatchVotingInput
): Promise<ActionResult<{ matchId: string; votingStatus: "open" }>> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performOpenMatchVoting(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateVotingViews();
  }
  return result;
}

export async function closeMatchVotingAction(
  input: CloseMatchVotingInput
): Promise<
  ActionResult<{
    matchId: string;
    votingStatus: "closed";
    winningMvpPlayerUuids: string[];
  }>
> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performCloseMatchVoting(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateVotingViews();
  }
  return result;
}

export async function submitMatchVotesAction(
  input: SubmitMatchVotesInput
): Promise<ActionResult<{ savedCount: number }>> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performSubmitMatchVotes(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateVotingViews();
  }
  return result;
}
