"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewerSession } from "@/server/auth";
import { CACHE_TAGS } from "@/server/queries/tags";
import {
  performCreateAnnouncement,
  performCreateCalendarEvent,
  performDeleteAnnouncement,
  performDeleteCalendarEvent,
  type AdminDbClient,
} from "@/server/admin/mutations-core";
import type {
  ActionResult,
  CreateAnnouncementInput,
  CreateCalendarEventInput,
  DeleteAnnouncementInput,
  DeleteCalendarEventInput,
} from "@/lib/types/admin-actions";

export async function createAnnouncementAction(
  input: CreateAnnouncementInput
): Promise<ActionResult<{ id: string }>> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performCreateAnnouncement(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateTag(CACHE_TAGS.announcements);
    revalidatePath("/admin");
  }
  return result;
}

export async function deleteAnnouncementAction(
  input: DeleteAnnouncementInput
): Promise<ActionResult> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performDeleteAnnouncement(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateTag(CACHE_TAGS.announcements);
    revalidatePath("/admin");
  }
  return result;
}

export async function createCalendarEventAction(
  input: CreateCalendarEventInput
): Promise<ActionResult<{ id: string }>> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performCreateCalendarEvent(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateTag(CACHE_TAGS.calendar);
    revalidatePath("/admin");
  }
  return result;
}

export async function deleteCalendarEventAction(
  input: DeleteCalendarEventInput
): Promise<ActionResult> {
  const [session, client] = await Promise.all([
    getViewerSession(),
    createSupabaseServerClient(),
  ]);
  const result = await performDeleteCalendarEvent(
    client as unknown as AdminDbClient | null,
    session,
    input
  );
  if (result.ok) {
    revalidateTag(CACHE_TAGS.calendar);
    revalidatePath("/admin");
  }
  return result;
}
