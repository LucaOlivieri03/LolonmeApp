import "server-only";
import type {
  CalendarEventType,
  CupRound,
  FundTxType,
  MatchModality,
  MatchType,
  PlayerRole,
  SeasonStatus,
  TitleType,
  VotingStatus,
} from "@/lib/types/domain";

export type DbPlayerRole = Exclude<PlayerRole, "guest">;
export type DbResultOutcome = "A" | "B" | "draw";
export type DbNumeric = number | string;

export interface DbSeasonRow {
  id: string;
  year: number;
  name: string;
  status: SeasonStatus;
  cup_cutoff_date: string | null;
}

export interface DbPlayerRow {
  id: string;
  slug: string;
  user_id?: string | null;
  email?: string | null;
  display_name: string;
  nickname?: string | null;
  avatar_url?: string | null;
  role: DbPlayerRole;
  favorite_club_id?: number | null;
  political_orientation?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface DbPlayerAliasRow {
  id: string;
  player_id: string;
  raw_name: string;
}

export interface DbPlayerTitleRow {
  id: string;
  player_id: string;
  season_id: string;
  title_type: TitleType;
  awarded_at: string;
}

export interface DbMatchRow {
  id: string;
  slug?: string | null;
  season_id: string;
  match_number: number | null;
  match_date: string;
  match_type: MatchType;
  modality: MatchModality;
  team_a_score: number | null;
  team_b_score: number | null;
  result_outcome: DbResultOutcome | null;
  counts_for_league: boolean;
  counts_for_stats: boolean;
  voting_status: VotingStatus;
  voting_closed_at?: string | null;
  voting_closed_by?: string | null;
  external_source_key: string | null;
  notes: string | null;
  created_at?: string;
}

export interface DbMatchPlayerRow {
  id: string;
  match_id: string;
  player_id: string;
  team: "A" | "B";
  is_cup_captain: boolean;
  goals: number;
  assists: number;
  admin_rating: DbNumeric | null;
  is_mvp: boolean;
}

export interface DbCalendarEventRow {
  id: string;
  external_key?: string | null;
  season_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: CalendarEventType;
  match_id: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface DbAnnouncementRow {
  id: string;
  external_key?: string | null;
  title: string;
  body: string;
  is_pinned: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface DbCupEditionRow {
  id: string;
  season_id: string;
  name: string;
  cutoff_snapshot_json: string[];
  created_at?: string;
}

export interface DbCupTieRow {
  id: string;
  cup_edition_id: string;
  round: CupRound;
  slot_order: number;
  player_a_id: string | null;
  player_b_id: string | null;
  seed_a: number | null;
  seed_b: number | null;
  leg1_match_id: string | null;
  leg2_match_id: string | null;
  override_score_a: number | null;
  override_score_b: number | null;
  winner_player_id: string | null;
  notes: string | null;
}

export interface DbFundMonthRow {
  id: string;
  season_id: string;
  month_number: number;
  month_label: string;
  fee_amount: DbNumeric;
}

export interface DbFundPaymentRow {
  id: string;
  fund_month_id: string;
  player_id: string;
  paid: boolean;
  paid_at: string | null;
}

export interface DbFundTransactionRow {
  id: string;
  external_key?: string | null;
  season_id: string;
  tx_type: FundTxType;
  amount: DbNumeric;
  description: string;
  tx_date: string;
}

export interface DatabaseDatasetRows {
  seasons: DbSeasonRow[];
  players: DbPlayerRow[];
  player_aliases: DbPlayerAliasRow[];
  player_titles: DbPlayerTitleRow[];
  matches: DbMatchRow[];
  match_players: DbMatchPlayerRow[];
  calendar_events: DbCalendarEventRow[];
  announcements: DbAnnouncementRow[];
  cup_editions: DbCupEditionRow[];
  cup_ties: DbCupTieRow[];
  fund_months: DbFundMonthRow[];
  fund_payments: DbFundPaymentRow[];
  fund_transactions: DbFundTransactionRow[];
}
