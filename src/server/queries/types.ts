import "server-only";
import type { StandingsResult } from "@/lib/engine";
import type { Announcement, CalendarEvent, Season } from "@/lib/types/domain";
import type {
  CalendarEventItem,
  CalendarLinkedMatchSummary,
  CalendarMonthGroup,
  ResolvedCupTie,
} from "@/lib/types/view-models";

export type {
  CalendarEventItem,
  CalendarLinkedMatchSummary,
  CalendarMonthGroup,
  ResolvedCupTie,
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
