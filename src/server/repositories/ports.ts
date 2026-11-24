import "server-only";
import type {
  Announcement,
  CalendarEvent,
  FundMonth,
  FundPayment,
  FundTransaction,
  Match,
  PlayerAlias,
  PlayerTitle,
  Season,
} from "@/lib/types/domain";
import type {
  AdminFundData,
  PublicCupData,
  PublicPlayer,
  PublicTournamentData,
} from "./types";

/**
 * Segregated read port for public tournament data.
 * By contract, never exposes `players.email`, `players.userId`, or any `fund_*` entity.
 */
export interface PublicTournamentRepository {
  getPublicDataset(): Promise<PublicTournamentData>;
  getSeasons(): Promise<Season[]>;
  getPlayers(): Promise<PublicPlayer[]>;
  getPlayerById(playerId: string): Promise<PublicPlayer | null>;
  getAliases(): Promise<PlayerAlias[]>;
  getTitles(seasonId?: string): Promise<PlayerTitle[]>;
  getMatches(seasonId?: string): Promise<Match[]>;
  getMatchById(matchId: string): Promise<Match | null>;
  getCalendarEvents(seasonId?: string): Promise<CalendarEvent[]>;
  getAnnouncements(): Promise<Announcement[]>;
  getCupData(seasonId?: string): Promise<PublicCupData>;
}

/**
 * Segregated read port for sensitive Pozo (fund) entities.
 * Implementations MUST enforce admin authorization before returning data.
 */
export interface AdminFundRepository {
  getFundData(seasonId?: string): Promise<AdminFundData>;
  getFundMonths(seasonId?: string): Promise<FundMonth[]>;
  getFundPayments(seasonId?: string): Promise<FundPayment[]>;
  getFundTransactions(seasonId?: string): Promise<FundTransaction[]>;
}
