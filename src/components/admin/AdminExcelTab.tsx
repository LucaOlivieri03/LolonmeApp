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

export function AdminExcelTab() {
  const { dataset, applyDataset, resetToSeed } = useTournament();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<TournamentDataset | null>(null);
  const [diff, setDiff] = useState<ImportDiffPreview | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

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
      <div className="rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-pitch-700" />
            <div>
              <h2 className="text-sm font-black text-navy-900">
                Importador Constante de Excel (LOLONMEBOL.xlsx)
              </h2>
              <p className="text-[11px] text-slate-500">
                Paso 1: Subí el archivo → Paso 2: Revisá el Dry-Run Diff → Paso 3: Confirmá cambios.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              resetToSeed();
              setDoneMessage("Datos restaurados al snapshot inicial de LOLONMEBOL.xlsx.");
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar Seed Local
          </button>
        </div>

        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-pitch-700/30 bg-pitch-50/50 p-6 text-center transition-colors hover:bg-pitch-50">
          <Upload className="h-7 w-7 text-pitch-700" />
          <span className="mt-2 text-xs font-bold text-navy-900">
            {loading
              ? "Analizando hojas de Excel en el servidor..."
              : "Seleccioná LOLONMEBOL.xlsx para vista previa (Dry-Run)"}
          </span>
          <span className="mt-0.5 text-[11px] text-slate-500">
            Normaliza automáticamente estrellas (⭐), alias y fechas
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
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-crimson-600">
            {error}
          </p>
        )}

        {doneMessage && (
          <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-pitch-50 px-3 py-2 text-xs font-bold text-pitch-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {doneMessage}
          </p>
        )}
      </div>

      {diff && (
        <div className="space-y-3 rounded-2xl border border-navy-800/20 bg-white p-4 shadow-xs">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-navy-800">
            Vista Previa (Dry-Run / Diff)
          </h3>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-pitch-50 p-3 text-center">
              <span className="block text-xl font-black text-pitch-800">
                {diff.newMatches.length}
              </span>
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Partidos Nuevos
              </span>
            </div>
            <div className="rounded-xl bg-gold-100/70 p-3 text-center">
              <span className="block text-xl font-black text-gold-700">
                {diff.updatedMatches.length}
              </span>
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Con Cambios
              </span>
            </div>
            <div className="rounded-xl bg-navy-50 p-3 text-center">
              <span className="block text-xl font-black text-navy-800">
                {diff.newPlayers.length}
              </span>
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Jugadores Nuevos
              </span>
            </div>
            <div className="rounded-xl bg-slate-100 p-3 text-center">
              <span className="block text-xl font-black text-slate-600">
                {diff.unchangedMatchesCount}
              </span>
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Sin Cambios
              </span>
            </div>
          </div>

          {diff.updatedMatches.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-gold-500/30 bg-gold-100/30 p-3 text-xs">
              <p className="font-bold text-navy-900">Partidos con diferencias:</p>
              <ul className="space-y-1 text-slate-700">
                {diff.updatedMatches.slice(0, 8).map((u) => (
                  <li key={u.externalSourceKey}>
                    <strong>{u.externalSourceKey}</strong> ({u.matchDate}):{" "}
                    {u.changes.join(" · ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-navy-900">
            <input
              type="checkbox"
              checked={overwriteExisting}
              onChange={(e) => setOverwriteExisting(e.target.checked)}
              className="h-4 w-4 accent-pitch-700"
            />
            Sobrescribir partidos existentes con diferencias (si se desmarca, solo se agregan los nuevos)
          </label>

          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-xl bg-pitch-700 px-4 py-2 text-xs font-bold text-white hover:bg-pitch-800"
          >
            Confirmar Importación
          </button>
        </div>
      )}
    </div>
  );
}
