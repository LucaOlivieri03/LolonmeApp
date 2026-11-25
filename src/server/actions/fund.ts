"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  CreateFundTransactionInput,
  CreatePlayerAndEnrollInFundInput,
  EnrollPlayerInFundInput,
  ToggleFundPaymentInput,
  UpdateFundMonthFeeInput,
} from "@/lib/types/admin-actions";
import {
  performCreateFundTransaction,
  performCreatePlayerAndEnrollInFund,
  performEnrollPlayerInFund,
  performToggleFundPayment,
  performUpdateFundMonthFee,
  type AdminDbClient,
} from "@/server/admin/mutations-core";
import { getViewerSession } from "@/server/auth";
import { CACHE_TAGS } from "@/server/queries/tags";

export async function enrollPlayerInFundAction(
  input: EnrollPlayerInFundInput
): Promise<ActionResult<{ initializedMonths: number }>> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performEnrollPlayerInFund(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidatePath("/admin");
  }
  return result;
}

export async function createPlayerAndEnrollInFundAction(
  input: CreatePlayerAndEnrollInFundInput
): Promise<ActionResult<{ id: string }>> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performCreatePlayerAndEnrollInFund(
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

export async function toggleFundPaymentAction(
  input: ToggleFundPaymentInput
): Promise<ActionResult<{ paid: boolean }>> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performToggleFundPayment(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidatePath("/admin");
  }
  return result;
}

export async function updateFundMonthFeeAction(
  input: UpdateFundMonthFeeInput
): Promise<ActionResult> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performUpdateFundMonthFee(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidatePath("/admin");
  }
  return result;
}

export async function createFundTransactionAction(
  input: CreateFundTransactionInput
): Promise<ActionResult> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performCreateFundTransaction(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidatePath("/admin");
  }
  return result;
}
