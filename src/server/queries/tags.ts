import "server-only";

export const CACHE_TAGS = {
  seasons: "seasons",
  players: "players",
  matches: "matches",
  cup: "cup",
  calendar: "calendar",
  announcements: "announcements",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
