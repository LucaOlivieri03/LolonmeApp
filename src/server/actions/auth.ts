"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  performRequestEmailOtp,
  performSignInWithGoogle,
  performSignInWithPassword,
  performVerifyEmailOtp,
  resolveSafeAppOrigin,
  type AuthActionState,
  type ServerAuthActionsClient,
} from "@/server/auth";

export async function signInWithGoogleAction(): Promise<void> {
  const client = await createSupabaseServerClient();
  const reqHeaders = await headers();
  const origin = resolveSafeAppOrigin({
    hostHeader: reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host"),
    protoHeader: reqHeaders.get("x-forwarded-proto"),
  });

  const result = await performSignInWithGoogle(
    client as unknown as ServerAuthActionsClient | null,
    origin
  );

  if (!result.ok) {
    redirect(`/perfil?authError=${encodeURIComponent(result.errorCode)}`);
  }

  redirect(result.url);
}

export async function requestEmailOtpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const client = await createSupabaseServerClient();
  const reqHeaders = await headers();
  const origin = resolveSafeAppOrigin({
    hostHeader: reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host"),
    protoHeader: reqHeaders.get("x-forwarded-proto"),
  });

  return performRequestEmailOtp(
    client as unknown as ServerAuthActionsClient | null,
    formData.get("email"),
    origin
  );
}

export async function verifyEmailOtpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const client = await createSupabaseServerClient();
  const result = await performVerifyEmailOtp(
    client as unknown as ServerAuthActionsClient | null,
    formData.get("email"),
    formData.get("token")
  );

  if (!result.ok) {
    return result.state;
  }

  revalidatePath("/", "layout");
  redirect("/perfil");
}

export async function signInWithPasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const client = await createSupabaseServerClient();
  const result = await performSignInWithPassword(
    client as unknown as ServerAuthActionsClient | null,
    formData.get("email"),
    formData.get("password")
  );

  if (!result.ok) {
    return result.state;
  }

  revalidatePath("/", "layout");
  redirect("/perfil");
}

export async function signOutAction(): Promise<void> {
  const client = await createSupabaseServerClient();
  if (client) {
    await client.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/perfil");
}
