"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import type { ExcelImportPreviewDto } from "@/lib/types/admin-actions";
import { formatDateEs } from "@/lib/utils";

export function AdminExcelTab() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ExcelImportPreviewDto | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setLoading(true);
    setError(null);
    setDoneMessage(null);
    setPreview(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "preview");

      const res = await fetch("/api/import-excel", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al analizar el Excel");
      }
      setPreview(data.preview as ExcelImportPreviewDto);
    } catch (err) {
      setSelectedFile(null);
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleConfirm = async () => {
    if (!selectedFile || !preview) return;

    setApplying(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("mode", "apply");
      formData.append("overwriteExisting", String(overwriteExisting));

      const res = await fetch("/api/import-excel", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || "No se pudo aplicar la importación en PostgreSQL"
        );
      }

      setDoneMessage(
        data.message ??
          `Importación aplicada: ${preview.newMatchesCount} partidos nuevos, ${overwriteExisting ? preview.updatedMatchesCount : 0} actualizados, ${preview.newPlayersCount} jugadores nuevos.`
      );
      setPreview(null);
      setSelectedFile(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-rule bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-pitch-700" />
            <div>
              <h2 className="font-display text-xl font-bold tracking-wide text-ink">
                Importador Oficial de Excel (LOLONMEBOL.xlsx)
              </h2>
              <p className="text-xs text-ink-muted">
                Subí el archivo → Revisá el Dry-Run contra PostgreSQL → Confirmá
                sincronización sin perder historial ni roles.
              </p>
            </div>
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-pitch-700/35 bg-pitch-50/40 p-7 text-center transition-colors hover:border-pitch-700 hover:bg-pitch-50/70 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-leather-600">
          <Upload className="h-7 w-7 text-pitch-700" />
          <span className="mt-2 text-sm font-bold text-ink">
            {loading
              ? "Analizando hojas de Excel contra la base de datos..."
              : "Seleccioná LOLONMEBOL.xlsx para vista previa (Dry-Run)"}
          </span>
          <span className="mt-1 text-xs text-ink-muted">
            Normaliza automáticamente estrellas, alias, fechas y Pozo en el
            servidor
          </span>
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            disabled={loading || applying}
            className="sr-only"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-md border border-crimson-600/30 bg-crimson-50 px-3.5 py-2.5 text-sm font-semibold text-crimson-700"
          >
            {error}
          </p>
        )}

        {doneMessage && (
          <p
            role="status"
            className="mt-3 flex items-center gap-2 rounded-md border border-pitch-200 bg-pitch-50 px-3.5 py-2.5 text-sm font-semibold text-pitch-800"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {doneMessage}
          </p>
        )}
      </section>

      {preview && (
        <section className="space-y-4 rounded-lg border border-pitch-700/35 bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold tracking-wide text-ink">
              Vista Previa en Servidor (Dry-Run / Diff)
            </h3>
            {selectedFile && (
              <span className="text-xs font-semibold text-ink-muted">
                Archivo: {selectedFile.name}
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 divide-x divide-y divide-rule overflow-hidden rounded-md border border-rule bg-paper sm:grid-cols-4 sm:divide-y-0">
            <div className="px-3 py-3 text-center">
              <dt className="text-xs font-semibold text-ink-muted">
                Partidos Nuevos
              </dt>
              <dd className="font-display mt-0.5 text-2xl font-extrabold text-pitch-800">
                {preview.newMatchesCount}
              </dd>
            </div>
            <div className="px-3 py-3 text-center">
              <dt className="text-xs font-semibold text-ink-muted">
                Con Cambios
              </dt>
              <dd className="font-display mt-0.5 text-2xl font-extrabold text-leather-700">
                {preview.updatedMatchesCount}
              </dd>
            </div>
            <div className="px-3 py-3 text-center">
              <dt className="text-xs font-semibold text-ink-muted">
                Jugadores Nuevos
              </dt>
              <dd className="font-display mt-0.5 text-2xl font-extrabold text-navy-700">
                {preview.newPlayersCount}
              </dd>
            </div>
            <div className="px-3 py-3 text-center">
              <dt className="text-xs font-semibold text-ink-muted">
                Sin Cambios
              </dt>
              <dd className="font-display mt-0.5 text-2xl font-extrabold text-ink-muted">
                {preview.unchangedMatchesCount}
              </dd>
            </div>
          </dl>

          {preview.updatedMatches.length > 0 && (
            <div className="space-y-1.5 rounded-md border border-gold-500/40 bg-gold-50 p-3.5 text-xs">
              <p className="font-bold text-ink">Partidos con diferencias:</p>
              <ul className="space-y-1 text-ink-muted">
                {preview.updatedMatches.map((u) => (
                  <li key={u.externalSourceKey}>
                    <strong className="text-ink">{u.externalSourceKey}</strong>{" "}
                    ({formatDateEs(u.matchDate)}): {u.changes.join(" · ")}
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
              disabled={applying}
              className="h-4 w-4 accent-pitch-800"
            />
            Sobrescribir partidos existentes con diferencias (si se desmarca,
            solo se agregan los nuevos)
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={applying}
              className="min-h-11 rounded-md bg-pitch-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-pitch-900 disabled:opacity-45"
            >
              {applying
                ? "Sincronizando en PostgreSQL..."
                : "Confirmar Importación"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setSelectedFile(null);
              }}
              disabled={applying}
              className="min-h-11 rounded-md border border-rule bg-paper px-4 text-sm font-semibold text-ink-muted hover:text-ink disabled:opacity-45"
            >
              Cancelar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
