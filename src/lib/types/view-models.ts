import type {
  PairwiseStats,
  StandingsRow,
  SubgroupStats,
} from "@/lib/engine";
import type {
  CalendarEventType,
  CupRound,
  MatchModality,
  MatchType,
  PlayerRole,
  PlayerTitle,
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

export interface MatchLedgerPlayerItem {
  id: string;
  playerId: string;
  displayName: string;
  team: "A" | "B";
  goals: number;
  assists: number;
  isMvp: boolean;
  isCupCaptain: boolean;
  adminRating: number | null;
}

export interface MatchLedgerItem {
  id: string;
  seasonId: string;
  matchDate: string;
  matchType: MatchType;
  modality: MatchModality;
  matchNumber: number | null;
  teamAScore: number | null;
  teamBScore: number | null;
  resultOutcome: "A" | "B" | "draw" | null;
  notes?: string | null;
  mvpNames: string[];
  teamA: MatchLedgerPlayerItem[];
  teamB: MatchLedgerPlayerItem[];
}

export interface MatchPlayerOption {
  id: string;
  displayName: string;
}

export interface StatsActivePlayerOption {
  id: string;
  displayName: string;
  position: number;
  points: number;
  pj: number;
  stars: number;
}

export interface StatsPairingItem {
  playerId: string;
  displayName: string;
  stats: PairwiseStats;
}

export interface StatsLabPairwiseItem {
  playerAName: string;
  playerBName: string;
  stats: PairwiseStats;
}

export interface StatsProfileSummary {
  selectedPlayerId: string;
  row: StandingsRow | null;
  bestTeammates: StatsPairingItem[];
  topRivals: StatsPairingItem[];
}

export interface StatsLabSummary {
  selectedPlayerIds: string[];
  selectedPlayerNames: string[];
  subgroup: SubgroupStats | null;
  pairwise: StatsLabPairwiseItem | null;
}

export interface AuthFormActionState {
  status: "idle" | "otp_sent" | "error";
  email?: string;
  message?: string;
  sentAt?: number;
}

export interface ProfileRecentMatchItem {
  id: string;
  matchNumber: number | null;
  matchDate: string;
  notes?: string | null;
  team: "A" | "B";
  isMvp: boolean;
  goals: number;
  assists: number;
  adminRating: number | null;
  teamAScore: number | null;
  teamBScore: number | null;
  resultOutcome: "A" | "B" | "draw" | null;
}

export interface AvailableUnlinkedPlayer {
  id: string;
  displayName: string;
  nickname?: string;
}

export interface PlayerLinkRequestSummary {
  id: string;
  requestedPlayerId: string;
  requestedPlayerName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewNote?: string | null;
}

export type ProfileViewModel =
  | {
      status: "guest";
      isAuthConfigured: boolean;
    }
  | {
      status: "unlinked";
      email: string | null;
      pendingRequest: PlayerLinkRequestSummary | null;
      availablePlayers: AvailableUnlinkedPlayer[];
    }
  | {
      status: "linked";
      player: {
        id: string;
        displayName: string;
        nickname?: string | null;
        role: Exclude<PlayerRole, "guest">;
        email: string | null;
      };
      activeSeasonName: string;
      annualRow: StandingsRow | null;
      historicalRow: StandingsRow | null;
      titles: PlayerTitle[];
      recentMatches: ProfileRecentMatchItem[];
    };
