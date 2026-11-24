import "server-only";
import type {
  Announcement,
  CalendarEvent,
  CupEdition,
  CupTie,
  FundMonth,
  FundPayment,
  FundTransaction,
  Match,
  Player,
  PlayerAlias,
  PlayerTitle,
  Season,
} from "@/lib/types/domain";

/**
 * Public-safe player projection: explicitly excludes private account identifiers
 * (`email` and `userId`) so they can never leak into public SSR props or client bundles.
 */
export type PublicPlayer = Omit<Player, "email" | "userId">;

export interface PublicCupData {
  editions: CupEdition[];
  ties: CupTie[];
}

/**
 * Public-safe tournament projection: contains all competition, schedule, cup,
 * and announcement entities, and structurally omits all Pozo (`fund_*`) data.
 */
export interface PublicTournamentData {
  seasons: Season[];
  players: PublicPlayer[];
  aliases: PlayerAlias[];
  titles: PlayerTitle[];
  matches: Match[];
  calendarEvents: CalendarEvent[];
  announcements: Announcement[];
  cupEditions: CupEdition[];
  cupTies: CupTie[];
}

/**
 * Admin-exclusive financial projection for the Pozo (fund months, payments, transactions).
 */
export interface AdminFundData {
  fundMonths: FundMonth[];
  fundPayments: FundPayment[];
  fundTransactions: FundTransaction[];
}
