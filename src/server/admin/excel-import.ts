import "server-only";
import { applyImportDiff, computeImportDiff } from "@/lib/excel/diff";
import type {
  ActionResult,
  ExcelImportApplySummaryDto,
  ExcelImportPreviewDto,
} from "@/lib/types/admin-actions";
import type { TournamentDataset } from "@/lib/types/domain";
import { assertAdmin, isAuthError, type ViewerSession } from "@/server/auth";
import {
  syncDatasetToSupabase,
  type SeedTableClient,
} from "@/server/db/seed-sync";
import type {
  AdminFundData,
  PublicTournamentData,
} from "@/server/repositories";

const MAX_PREVIEW_UPDATED_MATCHES = 12;

function authErrorToActionResult(err: unknown): ActionResult<never> {
  if (isAuthError(err)) {
    return { ok: false, code: err.code, error: err.message };
  }
  return {
    ok: false,
    code: "INTERNAL",
    error: err instanceof Error ? err.message : "Error inesperado en el servidor.",
  };
}

/**
 * Reconstructs a full server-side `TournamentDataset` from segregated public + admin fund projections.
 */
export function composeFullDataset(
  publicData: PublicTournamentData,
  fundData: AdminFundData
): TournamentDataset {
  return {
    seasons: publicData.seasons,
    players: publicData.players,
    aliases: publicData.aliases,
    titles: publicData.titles,
    matches: publicData.matches,
    calendarEvents: publicData.calendarEvents,
    announcements: publicData.announcements,
    cupEditions: publicData.cupEditions,
    cupTies: publicData.cupTies,
    fundMonths: fundData.fundMonths,
    fundPayments: fundData.fundPayments,
    fundTransactions: fundData.fundTransactions,
  };
}

/**
 * Computes a lightweight server-side Dry-Run diff preview (`ExcelImportPreviewDto`)
 * without mutating the database or exposing private fields.
 */
export function previewExcelImportFromDataset(
  session: ViewerSession,
  existingDataset: TournamentDataset,
  incomingDataset: TournamentDataset
): ActionResult<ExcelImportPreviewDto> {
  try {
    assertAdmin(session);
  } catch (err) {
    return authErrorToActionResult(err);
  }

  const diff = computeImportDiff(existingDataset, incomingDataset);

  return {
    ok: true,
    data: {
      newPlayersCount: diff.newPlayers.length,
      newMatchesCount: diff.newMatches.length,
      updatedMatchesCount: diff.updatedMatches.length,
      unchangedMatchesCount: diff.unchangedMatchesCount,
      updatedMatches: diff.updatedMatches
        .slice(0, MAX_PREVIEW_UPDATED_MATCHES)
        .map((u) => ({
          externalSourceKey: u.externalSourceKey,
          matchDate: u.matchDate,
          matchNumber: u.matchNumber,
          changes: u.changes,
        })),
    },
  };
}

/**
 * Merges an incoming Excel `TournamentDataset` with the current database state
 * and synchronizes all tables idempotently into PostgreSQL.
 */
export async function applyExcelImportFromDataset(
  session: ViewerSession,
  existingDataset: TournamentDataset,
  incomingDataset: TournamentDataset,
  client: SeedTableClient | null,
  options: { overwriteExisting: boolean }
): Promise<ActionResult<ExcelImportApplySummaryDto>> {
  try {
    assertAdmin(session);
  } catch (err) {
    return authErrorToActionResult(err);
  }

  if (!client) {
    return {
      ok: false,
      code: "UNCONFIGURED",
      error: "Supabase no está configurado en el servidor.",
    };
  }

  try {
    const diff = computeImportDiff(existingDataset, incomingDataset);
    const merged = applyImportDiff(existingDataset, incomingDataset, {
      overwriteExisting: options.overwriteExisting,
    });

    const updatedMatchKeysOrSlugs = new Set<string>();
    if (options.overwriteExisting) {
      for (const u of diff.updatedMatches) {
        updatedMatchKeysOrSlugs.add(u.externalSourceKey);
        updatedMatchKeysOrSlugs.add(u.incomingMatch.id);
      }
    }

    const incomingSeasonIds = new Set(incomingDataset.seasons.map((s) => s.id));

    await syncDatasetToSupabase(
      client,
      merged,
      options.overwriteExisting
        ? {
            pruneReplacedChildren: {
              updatedMatchKeysOrSlugs,
              replacedCupSeasonIds: incomingSeasonIds,
              replacedFundTxSeasonIds: incomingSeasonIds,
            },
          }
        : undefined
    );

    const appliedUpdates = options.overwriteExisting
      ? diff.updatedMatches.length
      : 0;

    return {
      ok: true,
      message: `Importación aplicada en PostgreSQL: ${diff.newMatches.length} partidos nuevos, ${appliedUpdates} actualizados, ${diff.newPlayers.length} jugadores nuevos.`,
      data: {
        newPlayersCount: diff.newPlayers.length,
        newMatchesCount: diff.newMatches.length,
        updatedMatchesCount: appliedUpdates,
        unchangedMatchesCount: diff.unchangedMatchesCount,
      },
    };
  } catch (err) {
    return {
      ok: false,
      code: "INTERNAL",
      error:
        err instanceof Error
          ? err.message
          : "No se pudo sincronizar la importación con PostgreSQL.",
    };
  }
}
