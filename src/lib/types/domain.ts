export type PlayerRole = "admin" | "authorized" | "player" | "guest";
export type TitleType = "league" | "cup" | "lolonmebol";
export type SeasonStatus = "active" | "finished";
export type CalendarEventType =
  | "league"
  | "cup"
  | "lolonmebol"
  | "special_f11"
  | "rest"
  | "postponed";
export type MatchType =
  | "league"
  | "cup"
  | "lolonmebol"
  | "special_f11"
  | "league_tiebreaker";
export type MatchModality = "F5" | "F6" | "F7" | "F11";
export type VotingStatus = "open" | "closed";
export type CupRound =
  | "preliminary"
  | "quarterfinal"
  | "semifinal"
  | "final"
  | "lolonmebol";
export type FundTxType = "expense" | "yield";

export interface Player {
  id: string;
  userId?: string | null;
  email?: string | null;
  displayName: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  role: Exclude<PlayerRole, "guest">;
  favoriteClubId?: number | null;
  politicalOrientation?: string | null;
  isActive: boolean;
}

export interface PlayerAlias {
  id: string;
  playerId: string;
  rawName: string;
}

export interface PlayerTitle {
  id: string;
  playerId: string;
  seasonId: string;
  titleType: TitleType;
  awardedAt: string;
}

export interface Season {
  id: string;
  year: number;
  name: string;
  status: SeasonStatus;
  cupCutoffDate?: string | null;
}

export interface MatchPlayer {
  id: string;
  matchId: string;
  playerId: string;
  team: "A" | "B";
  isCupCaptain: boolean;
  goals: number;
  assists: number;
  adminRating: number | null;
  isMvp: boolean;
  pitchX?: number | null;
  pitchY?: number | null;
}

export interface MatchVote {
  id: string;
  matchId: string;
  voterPlayerId: string;
  targetPlayerId: string;
  rating: number;
  votedMvp: boolean;
  createdAt?: string;
}

export interface Match {
  id: string;
  seasonId: string;
  matchNumber: number | null;
  matchDate: string;
  matchType: MatchType;
  modality: MatchModality;
  teamAScore: number | null;
  teamBScore: number | null;
  /** Used when historical matches (e.g. 2025) record winner/draw without exact goals */
  resultOutcome?: "A" | "B" | "draw" | null;
  countsForLeague: boolean;
  countsForStats: boolean;
  votingStatus: VotingStatus;
  externalSourceKey?: string | null;
  notes?: string | null;
  players: MatchPlayer[];
}

export interface CalendarEvent {
  id: string;
  seasonId: string;
  title: string;
  description?: string | null;
  eventDate: string;
  eventType: CalendarEventType;
  matchId?: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdBy?: string | null;
  createdAt: string;
}

export interface CupEdition {
  id: string;
  seasonId: string;
  name: string;
  cutoffSnapshotPlayerIds: string[];
}

export interface CupTie {
  id: string;
  cupEditionId: string;
  round: CupRound;
  slotOrder: number;
  playerAId: string | null;
  playerBId: string | null;
  seedA: number | null;
  seedB: number | null;
  leg1MatchId: string | null;
  leg2MatchId: string | null;
  overrideScoreA: number | null;
  overrideScoreB: number | null;
  winnerPlayerId: string | null;
  notes?: string | null;
}

export interface FundMonth {
  id: string;
  seasonId: string;
  monthNumber: number;
  monthLabel: string;
  feeAmount: number;
}

export interface FundPayment {
  id: string;
  fundMonthId: string;
  playerId: string;
  paid: boolean;
  paidAt?: string | null;
}

export interface FundTransaction {
  id: string;
  seasonId: string;
  txType: FundTxType;
  amount: number;
  description: string;
  txDate: string;
}

export interface TournamentDataset {
  seasons: Season[];
  players: Player[];
  aliases: PlayerAlias[];
  titles: PlayerTitle[];
  matches: Match[];
  calendarEvents: CalendarEvent[];
  announcements: Announcement[];
  cupEditions: CupEdition[];
  cupTies: CupTie[];
  fundMonths: FundMonth[];
  fundPayments: FundPayment[];
  fundTransactions: FundTransaction[];
}
