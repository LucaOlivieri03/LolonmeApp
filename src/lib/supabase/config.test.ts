import { afterEach, describe, expect, it } from "vitest";
import {
  getSupabaseEnv,
  isLocalSeedOverrideEnabled,
  isSupabaseConfigured,
} from "./config";

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  LOLONME_LOCAL_SEED: process.env.LOLONME_LOCAL_SEED,
  NEXT_PUBLIC_LOCAL_SEED: process.env.NEXT_PUBLIC_LOCAL_SEED,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      (process.env as Record<string, string>)[key] = value;
    }
  }
}

describe("supabase config local seed override", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("returns configured env when URL and anon key are set and no local seed flag is active", () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    delete process.env.LOLONME_LOCAL_SEED;
    delete process.env.NEXT_PUBLIC_LOCAL_SEED;

    expect(isLocalSeedOverrideEnabled()).toBe(false);
    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabaseEnv()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("disables Supabase when LOLONME_LOCAL_SEED is enabled in non-production", () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.LOLONME_LOCAL_SEED = "1";

    expect(isLocalSeedOverrideEnabled()).toBe(true);
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseEnv()).toBeNull();
  });

  it("disables Supabase when NEXT_PUBLIC_LOCAL_SEED is enabled in non-production", () => {
    (process.env as Record<string, string>).NODE_ENV = "test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    delete process.env.LOLONME_LOCAL_SEED;
    process.env.NEXT_PUBLIC_LOCAL_SEED = "true";

    expect(isLocalSeedOverrideEnabled()).toBe(true);
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseEnv()).toBeNull();
  });

  it("ignores local seed override in production", () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.LOLONME_LOCAL_SEED = "1";
    process.env.NEXT_PUBLIC_LOCAL_SEED = "true";

    expect(isLocalSeedOverrideEnabled()).toBe(false);
    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabaseEnv()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
  });
});
