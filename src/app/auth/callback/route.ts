import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/config";
import {
  resolveAuthCallback,
  type CallbackAuthClient,
} from "@/server/auth/callback";
import { resolveSafeAppOrigin } from "@/server/auth/redirect";

export async function GET(request: NextRequest) {
  const env = getSupabaseEnv();
  const pendingCookies: Array<{
    name: string;
    value: string;
    options?: CookieOptions;
  }> = [];

  const supabase = env
    ? createServerClient(env.url, env.anonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(
            cookiesToSet: Array<{
              name: string;
              value: string;
              options?: CookieOptions;
            }>
          ) {
            pendingCookies.push(...cookiesToSet);
          },
        },
      })
    : null;

  const safeOrigin = resolveSafeAppOrigin({
    hostHeader:
      request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    protoHeader: request.headers.get("x-forwarded-proto"),
  });

  const { redirectTo } = await resolveAuthCallback(
    request.url,
    supabase as unknown as CallbackAuthClient | null,
    safeOrigin
  );

  const response = NextResponse.redirect(redirectTo);
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}
