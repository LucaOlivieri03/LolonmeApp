import type {
  CalendarEventType,
  MatchModality,
  MatchType,
  PlayerRole,
  TitleType,
} from "@/lib/types/domain";

export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNCONFIGURED"
  | "INTERNAL";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; code: ActionErrorCode };

export interface MatchRosterEntryInput {
  playerId: string;
  team: "A" | "B";
  isCupCaptain?: boolean;
  goals?: number;
  assists?: number;
  adminRating?: number | null;
  isMvp?: boolean;
}

export interface CreateMatchInput {
  seasonId: string;
  matchType: MatchType;
  modality: MatchModality;
  matchDate: string;
  matchNumber: number | null;
  teamAScore: number | null;
  teamBScore: number | null;
  resultOutcome?: "A" | "B" | "draw" | null;
  countsForLeague: boolean;
  countsForStats?: boolean;
  notes?: string | null;
  roster: MatchRosterEntryInput[];
}

export interface UpdateMatchInput extends CreateMatchInput {
  matchId: string;
}

export interface DeleteMatchInput {
  matchId: string;
}

export interface OpenMatchVotingInput {
  matchId: string;
}

export interface CloseMatchVotingInput {
  matchId: string;
  applyVotedMvp?: boolean;
  overrideMvpPlayerIds?: string[];
}

export interface MatchVoteEntryInput {
  targetPlayerId: string;
  rating: number;
  votedMvp: boolean;
}

export interface SubmitMatchVotesInput {
  matchId: string;
  entries: MatchVoteEntryInput[];
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  isPinned: boolean;
}

export interface DeleteAnnouncementInput {
  announcementId: string;
}

export interface CreateCalendarEventInput {
  seasonId: string;
  title: string;
  description?: string | null;
  matchId?: string | null;
  eventDate: string;
  eventType: CalendarEventType;
}

export interface DeleteCalendarEventInput {
  eventId: string;
}

export interface CreatePlayerInput {
  displayName: string;
  email?: string | null;
  role: Exclude<PlayerRole, "guest">;
}

export interface UpdatePlayerRoleInput {
  playerId: string;
  role: Exclude<PlayerRole, "guest">;
}

export interface RequestPlayerLinkInput {
  playerId: string;
}

export interface ApprovePlayerLinkRequestInput {
  requestId: string;
}

export interface RejectPlayerLinkRequestInput {
  requestId: string;
  reviewNote?: string | null;
}

export interface UpdatePlayerEmailInput {
  playerId: string;
  email: string | null;
}

export interface AwardPlayerTitleInput {
  playerId: string;
  seasonId: string;
  titleType: TitleType;
}

export interface CreateSeasonInput {
  year: number;
  defaultFee: number;
  cupCutoffDate?: string | null;
}

export interface RegenerateCupBracketInput {
  seasonId: string;
  previousFinalists: [string, string];
}

export interface UpdateCupTieInput {
  tieId: string;
  patch: {
    playerAId?: string | null;
    playerBId?: string | null;
    overrideScoreA?: number | null;
    overrideScoreB?: number | null;
    winnerPlayerId?: string | null;
    notes?: string | null;
  };
}

export interface EnrollPlayerInFundInput {
  seasonId: string;
  playerId: string;
}

export interface CreatePlayerAndEnrollInFundInput {
  seasonId: string;
  displayName: string;
}

export interface ToggleFundPaymentInput {
  fundMonthId: string;
  playerId: string;
  paid?: boolean;
}

export interface UpdateFundMonthFeeInput {
  fundMonthId: string;
  feeAmount: number;
}

export interface CreateFundTransactionInput {
  seasonId: string;
  txType: "expense" | "yield";
  amount: number;
  description: string;
  txDate: string;
}

export interface ExcelMatchDiffSummaryDto {
  externalSourceKey: string;
  matchDate: string;
  matchNumber: number | null;
  changes: string[];
}

export interface ExcelImportPreviewDto {
  newPlayersCount: number;
  newMatchesCount: number;
  updatedMatchesCount: number;
  unchangedMatchesCount: number;
  updatedMatches: ExcelMatchDiffSummaryDto[];
}

export interface ExcelImportApplySummaryDto {
  newPlayersCount: number;
  newMatchesCount: number;
  updatedMatchesCount: number;
  unchangedMatchesCount: number;
}
