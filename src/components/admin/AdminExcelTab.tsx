"use client";

import { useState } from "react";
import { CheckCircle2, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import {
  applyImportDiff,
  computeImportDiff,
  type ImportDiffPreview,
} from "@/lib/excel/diff";
import type { TournamentDataset } from "@/lib/types/domain";
import { formatDateEs } from "@/lib/utils";

export function AdminExcelTab() {
  const { dataset, applyDataset, resetToSeed } = useTournament();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<TournamentDataset | null>(null);
  const [diff, setDiff] = useState<ImportDiffPreview | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setDoneMessage(null);
    setIncoming(null);
    setDiff(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import-excel", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al analizar el Excel");
      }
      const parsed = data.dataset as TournamentDataset;
      setIncoming(parsed);
      setDiff(computeImportDiff(dataset, parsed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!incoming) return;
    const merged = applyImportDiff(dataset, incoming, { overwriteExisting });
    applyDataset(merged);
    setDoneMessage(
      `Importación aplicada: ${diff?.newMatches.length ?? 0} partidos nuevos, ${overwriteExisting ? diff?.updatedMatches.length ?? 0 : 0} actualizados, ${diff?.newPlayers.length ?? 0} jugadores nuevos.`
    );
    setIncoming(null);
    setDiff(null);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-rule bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-pitch-700" />
            <div>
              <h2 className="font-display text-xl font-bold tracking-wide text-ink">
                Importador Constante de Excel (LOLONMEBOL.xlsx)
              </h2>
              <p className="text-xs text-ink-muted">
                Subí el archivo → Revisá el Dry-Run Diff → Confirmá cambios sin perder historial.
              </p>
            </div>
          </div>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-rule bg-paper px-3 text-xs font-semibold text-ink-muted transition-colors hover:border-crimson-600/40 hover:text-crimson-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar Seed Local
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  resetToSeed();
                  setConfirmReset(false);
                  setDoneMessage(
                    "Datos restaurados al snapshot inicial de LOLONMEBOL.xlsx."
                  );
                }}
                className="min-h-10 rounded-md bg-crimson-600 px-3 text-xs font-bold text-white hover:bg-crimson-700"
              >
                Confirmar restauración
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-10 rounded-md border border-rule bg-paper px-3 text-xs font-semibold text-ink-muted"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-pitch-700/35 bg-pitch-50/40 p-7 text-center transition-colors hover:border-pitch-700 hover:bg-pitch-50/70">
          <Upload className="h-7 w-7 text-pitch-700" />
          <span className="mt-2 text-sm font-bold text-ink">
            {loading
              ? "Analizando hojas de Excel en el servidor..."
              : "Seleccioná LOLONMEBOL.xlsx para vista previa (Dry-Run)"}
          </span>
          <span className="mt-1 text-xs text-ink-muted">
            Normaliza automáticamente estrellas, alias y fechas
          </span>
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            disabled={loading}
            className="hidden"
          />
        </label>

        {error && (
          <p className="mt-3 rounded-md border border-crimson-600/30 bg-crimson-50 px-3.5 py-2.5 text-sm font-semibold text-crimson-700">
            {error}
          </p>
        )}

        {doneMessage && (
          <p className="mt-3 flex items-center gap-2 rounded-md border border-pitch-200 bg-pitch-50 px-3.5 py-2.5 text-sm font-semibold text-pitch-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {doneMessage}
          </p>
        )}
      </section>

      {diff && (
        <section className="space-y-4 rounded-lg border border-pitch-700/35 bg-surface p-4">
          <h3 className="font-display text-lg font-bold tracking-wide text-ink">
            Vista Previa (Dry-Run / Diff)
          </h3>

          <dl className="grid grid-cols-2 divide-x divide-y divide-rule overflow-hidden rounded-md border border-rule bg-paper sm:grid-cols-4 sm:divide-y-0">
            <div className="px-3 py-3 text-center">
              <dt className="text-xs font-semibold text-ink-muted">Partidos Nuevos</dt>
              <dd className="font-display mt-0.5 text-2xl font-extrabold text-pitch-800">
                {diff.newMatches.length}
              </dd>
            </div>
            <div className="px-3 py-3 text-center">
              <dt className="text-xs font-semibold text-ink-muted">Con Cambios</dt>
              <dd className="font-display mt-0.5 text-2xl font-extrabold text-leather-700">
                {diff.updatedMatches.length}
              </dd>
            </div>
            <div className="px-3 py-3 text-center">
              <dt className="text-xs font-semibold text-ink-muted">Jugadores Nuevos</dt>
              <dd className="font-display mt-0.5 text-2xl font-extrabold text-navy-700">
                {diff.newPlayers.length}
              </dd>
            </div>
            <div className="px-3 py-3 text-center">
              <dt className="text-xs font-semibold text-ink-muted">Sin Cambios</dt>
              <dd className="font-display mt-0.5 text-2xl font-extrabold text-ink-muted">
                {diff.unchangedMatchesCount}
              </dd>
            </div>
          </dl>

          {diff.updatedMatches.length > 0 && (
            <div className="space-y-1.5 rounded-md border border-gold-500/40 bg-gold-50 p-3.5 text-xs">
              <p className="font-bold text-ink">Partidos con diferencias:</p>
              <ul className="space-y-1 text-ink-muted">
                {diff.updatedMatches.slice(0, 8).map((u) => (
                  <li key={u.externalSourceKey}>
                    <strong className="text-ink">{u.externalSourceKey}</strong> (
                    {formatDateEs(u.matchDate)}): {u.changes.join(" · ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={overwriteExisting}
              onChange={(e) => setOverwriteExisting(e.target.checked)}
              className="h-4 w-4 accent-pitch-800"
            />
            Sobrescribir partidos existentes con diferencias (si se desmarca, solo se agregan los nuevos)
          </label>

          <button
            type="button"
            onClick={handleConfirm}
            className="min-h-11 rounded-md bg-pitch-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-pitch-900"
          >
            Confirmar Importación
          </button>
        </section>
      )}
    </div>
  );
}
