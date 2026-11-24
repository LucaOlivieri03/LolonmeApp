import "server-only";
import fs from "fs";
import path from "path";
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
  TournamentDataset,
} from "@/lib/types/domain";
import { requireAdmin, type AdminSession } from "@/server/auth";
import type { AdminFundRepository, PublicTournamentRepository } from "./ports";
import {
  toAdminFundData,
  toPublicPlayer,
  toPublicTournamentData,
} from "./projections";
import type {
  AdminFundData,
  PublicCupData,
  PublicPlayer,
  PublicTournamentData,
} from "./types";

let cachedSeedDataset: TournamentDataset | null = null;

function loadSeedDatasetFromDisk(): TournamentDataset {
  if (cachedSeedDataset) {
    return cachedSeedDataset;
  }
  const seedPath = path.resolve(process.cwd(), "src/lib/data/seed-data.json");
  const raw = fs.readFileSync(seedPath, "utf8");
  cachedSeedDataset = JSON.parse(raw) as TournamentDataset;
  return cachedSeedDataset;
}

/**
 * Deterministic server-side fallback repository for tests and CI without Supabase credentials.
 * Enforces the exact same public projection boundary (no `email`, no `userId`, no `fund_*`).
 */
export class SeedPublicTournamentRepository
  implements PublicTournamentRepository
{
  private readonly datasetProvider: () => TournamentDataset;

  constructor(dataset?: TournamentDataset) {
    this.datasetProvider = dataset ? () => dataset : loadSeedDatasetFromDisk;
  }

  async getPublicDataset(): Promise<PublicTournamentData> {
    return toPublicTournamentData(this.datasetProvider());
  }

  async getSeasons(): Promise<Season[]> {
    return [...this.datasetProvider().seasons];
  }

  async getPlayers(): Promise<PublicPlayer[]> {
    return this.datasetProvider().players.map(toPublicPlayer);
  }

  async getPlayerById(playerId: string): Promise<PublicPlayer | null> {
    const player = this.datasetProvider().players.find(
      (item) => item.id === playerId
    );
    return player ? toPublicPlayer(player) : null;
  }

  async getAliases(): Promise<PlayerAlias[]> {
    return [...this.datasetProvider().aliases];
  }

  async getTitles(seasonId?: string): Promise<PlayerTitle[]> {
    const titles = this.datasetProvider().titles;
    return seasonId
      ? titles.filter((title) => title.seasonId === seasonId)
      : [...titles];
  }

  async getMatches(seasonId?: string): Promise<Match[]> {
    const matches = this.datasetProvider().matches;
    return seasonId
      ? matches.filter((match) => match.seasonId === seasonId)
      : [...matches];
  }

  async getMatchById(matchId: string): Promise<Match | null> {
    return (
      this.datasetProvider().matches.find((match) => match.id === matchId) ??
      null
    );
  }

  async getCalendarEvents(seasonId?: string): Promise<CalendarEvent[]> {
    const events = this.datasetProvider().calendarEvents;
    return seasonId
      ? events.filter((event) => event.seasonId === seasonId)
      : [...events];
  }

  async getAnnouncements(): Promise<Announcement[]> {
    return [...this.datasetProvider().announcements];
  }

  async getCupData(seasonId?: string): Promise<PublicCupData> {
    const dataset = this.datasetProvider();
    if (!seasonId) {
      return {
        editions: [...dataset.cupEditions],
        ties: [...dataset.cupTies],
      };
    }
    const editions = dataset.cupEditions.filter(
      (edition) => edition.seasonId === seasonId
    );
    const editionIds = new Set(editions.map((edition) => edition.id));
    const ties = dataset.cupTies.filter((tie) =>
      editionIds.has(tie.cupEditionId)
    );
    return { editions, ties };
  }
}

export interface SeedAdminFundRepositoryOptions {
  dataset?: TournamentDataset;
  authorizeAdmin?: () => Promise<AdminSession>;
}

/**
 * Deterministic server-side fallback for admin-only Pozo reads in tests/CI.
 * Still enforces admin authorization via `requireAdmin()` (or injected guard).
 */
export class SeedAdminFundRepository implements AdminFundRepository {
  private readonly datasetProvider: () => TournamentDataset;
  private readonly authorizeAdmin: () => Promise<AdminSession>;

  constructor(options?: SeedAdminFundRepositoryOptions) {
    this.datasetProvider = options?.dataset
      ? () => options.dataset!
      : loadSeedDatasetFromDisk;
    this.authorizeAdmin = options?.authorizeAdmin ?? (() => requireAdmin());
  }

  async getFundData(seasonId?: string): Promise<AdminFundData> {
    await this.authorizeAdmin();
    return toAdminFundData(this.datasetProvider(), seasonId);
  }

  async getFundMonths(seasonId?: string): Promise<FundMonth[]> {
    const data = await this.getFundData(seasonId);
    return data.fundMonths;
  }

  async getFundPayments(seasonId?: string): Promise<FundPayment[]> {
    const data = await this.getFundData(seasonId);
    return data.fundPayments;
  }

  async getFundTransactions(seasonId?: string): Promise<FundTransaction[]> {
    const data = await this.getFundData(seasonId);
    return data.fundTransactions;
  }
}
