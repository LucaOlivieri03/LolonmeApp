import "server-only";
import type { StandingsResult } from "@/lib/engine";
import type {
  Announcement,
  CalendarEvent,
  MatchModality,
  MatchType,
  Season,
} from "@/lib/types/domain";
import type {
  CalendarEventItem,
  CalendarLinkedMatchSummary,
  CalendarMonthGroup,
  MatchLedgerItem,
  MatchLedgerPlayerItem,
  MatchPlayerOption,
  ResolvedCupTie,
  StatsActivePlayerOption,
  StatsLabPairwiseItem,
  StatsLabSummary,
  StatsPairingItem,
  StatsProfileSummary,
} from "@/lib/types/view-models";

export type {
  CalendarEventItem,
  CalendarLinkedMatchSummary,
  CalendarMonthGroup,
  MatchLedgerItem,
  MatchLedgerPlayerItem,
  MatchPlayerOption,
  ResolvedCupTie,
  StatsActivePlayerOption,
  StatsLabPairwiseItem,
  StatsLabSummary,
  StatsPairingItem,
  StatsProfileSummary,
};

/**
 * Minimal pre-computed Home page view model.
 * Contains only pre-calculated standings rows, resolved cup ties, and announcements.
 */
export interface HomeViewModel {
  seasons: Season[];
  activeSeason: Season | null;
  annualStandings: StandingsResult;
  historicalStandings: StandingsResult;
  cupEditionName: string;
  cupTies: ResolvedCupTie[];
  seasonMatchesCount: number;
  announcements: Announcement[];
  latestEvent: CalendarEvent | null;
}

export interface CalendarViewModel {
  seasons: Season[];
  selectedSeasonId: string;
  events: CalendarEventItem[];
  groupedByMonth: CalendarMonthGroup[];
  initialMonth: string;
}

export interface MatchesQueryFilters {
  seasonFilter?: number | "all";
  matchType?: MatchType | "ALL";
  dateFilter?: string;
  matchNumberQuery?: string;
  playerId?: string;
}

export interface MatchesViewModel {
  seasons: Season[];
  selectedSeasonId: string;
  selectedType: MatchType | "ALL";
  dateFilter: string;
  matchNumberQuery: string;
  playerFilterId: string;
  availableMatchNumbers: number[];
  playerOptions: MatchPlayerOption[];
  matches: MatchLedgerItem[];
}

export interface StatsQueryFilters {
  seasonFilter?: number | "all";
  modality?: MatchModality | "ALL";
  /**
   * `undefined` selects default top 2 active players.
   * An empty array `[]` represents an explicit user clear.
   */
  labPlayerIds?: string[];
  playerId?: string;
}

export interface StatsViewModel {
  seasons: Season[];
  selectedSeasonId: string;
  selectedModality: MatchModality | "ALL";
  activePlayers: StatsActivePlayerOption[];
  lab: StatsLabSummary;
  profile: StatsProfileSummary;
}
