import "server-only";
import type { Player, TournamentDataset } from "@/lib/types/domain";
import type {
  AdminFundData,
  PublicPlayer,
  PublicTournamentData,
} from "./types";

/**
 * Explicitly constructs a public-safe player object containing only allowed fields.
 * Never copies `email`, `userId`, or arbitrary extra properties.
 */
export function toPublicPlayer(player: Player): PublicPlayer {
  const projected: PublicPlayer = {
    id: player.id,
    displayName: player.displayName,
    role: player.role,
    isActive: player.isActive,
  };

  if (player.nickname !== undefined && player.nickname !== null) {
    projected.nickname = player.nickname;
  }
  if (player.avatarUrl !== undefined && player.avatarUrl !== null) {
    projected.avatarUrl = player.avatarUrl;
  }
  if (player.favoriteClubId !== undefined && player.favoriteClubId !== null) {
    projected.favoriteClubId = player.favoriteClubId;
  }
  if (
    player.politicalOrientation !== undefined &&
    player.politicalOrientation !== null
  ) {
    projected.politicalOrientation = player.politicalOrientation;
  }

  return projected;
}

/**
 * Strips all private/financial collections (`fundMonths`, `fundPayments`, `fundTransactions`)
 * and projects players through `toPublicPlayer`.
 */
export function toPublicTournamentData(
  dataset: TournamentDataset
): PublicTournamentData {
  return {
    seasons: dataset.seasons,
    players: dataset.players.map(toPublicPlayer),
    aliases: dataset.aliases,
    titles: dataset.titles,
    matches: dataset.matches,
    calendarEvents: dataset.calendarEvents,
    announcements: dataset.announcements,
    cupEditions: dataset.cupEditions,
    cupTies: dataset.cupTies,
  };
}

/**
 * Extracts admin-only Pozo data, optionally scoped to a single domain `seasonId` (e.g. `season-2026`).
 */
export function toAdminFundData(
  dataset: Pick<
    TournamentDataset,
    "fundMonths" | "fundPayments" | "fundTransactions"
  >,
  seasonId?: string
): AdminFundData {
  if (!seasonId) {
    return {
      fundMonths: dataset.fundMonths,
      fundPayments: dataset.fundPayments,
      fundTransactions: dataset.fundTransactions,
    };
  }

  const fundMonths = dataset.fundMonths.filter(
    (month) => month.seasonId === seasonId
  );
  const allowedMonthIds = new Set(fundMonths.map((month) => month.id));
  const fundPayments = dataset.fundPayments.filter((payment) =>
    allowedMonthIds.has(payment.fundMonthId)
  );
  const fundTransactions = dataset.fundTransactions.filter(
    (tx) => tx.seasonId === seasonId
  );

  return {
    fundMonths,
    fundPayments,
    fundTransactions,
  };
}
