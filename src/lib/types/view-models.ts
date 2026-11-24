import type {
  CalendarEventType,
  CupRound,
  MatchModality,
} from "./domain";

/**
 * Pre-resolved Cup tie DTO computed on the server.
 * Eliminates the need to send raw `matches` or `players` arrays to the client bracket.
 */
export interface ResolvedCupTie {
  id: string;
  round: CupRound;
  slotOrder: number;
  playerAName: string;
  playerBName: string;
  seedA: number | null;
  seedB: number | null;
  scoreA: number | null;
  scoreB: number | null;
  hasScores: boolean;
  isAWin: boolean;
  isBWin: boolean;
  notes?: string | null;
}

export interface CalendarLinkedMatchSummary {
  modality: MatchModality;
  matchNumber: number | null;
  teamAScore: number | null;
  teamBScore: number | null;
}

export interface CalendarEventItem {
  id: string;
  seasonId: string;
  title: string;
  description?: string | null;
  eventDate: string;
  eventType: CalendarEventType;
  matchId?: string | null;
  linkedMatch: CalendarLinkedMatchSummary | null;
}

export interface CalendarMonthGroup {
  monthKey: string;
  events: CalendarEventItem[];
}
