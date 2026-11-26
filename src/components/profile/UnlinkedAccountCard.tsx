"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  LogOut,
  Send,
  UserPlus,
} from "lucide-react";
import { PlayerCombobox } from "@/components/tournament/PlayerCombobox";
import type {
  AvailableUnlinkedPlayer,
  PlayerLinkRequestSummary,
} from "@/lib/types/view-models";
import { requestPlayerLinkAction, signOutAction } from "@/server/actions/auth";
import { cn, formatDateEs } from "@/lib/utils";

export interface UnlinkedAccountCardProps {
  email: string | null;
  pendingRequest: PlayerLinkRequestSummary | null;
  availablePlayers: AvailableUnlinkedPlayer[];
}

export function UnlinkedAccountCard({
  email,
  pendingRequest,
  availablePlayers,
}: UnlinkedAccountCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedPlayerId, setSelectedPlayerId] = useState(
    availablePlayers[0]?.id ?? ""
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const comboboxOptions = useMemo(
    () =>
      availablePlayers.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        ...(p.nickname ? { subtitle: p.nickname } : {}),
      })),
    [availablePlayers]
  );

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await requestPlayerLinkAction({ playerId: selectedPlayerId });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({
        type: "success",
        text:
          res.message ??
          "Solicitud registrada. Esperando aprobación del administrador.",
      });
      router.refresh();
    });
  };

  const formattedCreatedDate = pendingRequest?.createdAt
    ? formatDateEs(pendingRequest.createdAt.slice(0, 10))
    : null;

  return (
    <section className="mx-auto max-w-xl rounded-lg border border-leather-600/40 bg-surface p-6 sm:p-8">
      {pendingRequest ? (
        <div>
          <div className="text-center">
            <Clock className="mx-auto h-10 w-10 text-leather-600" />
            <h2 className="font-display mt-3 text-2xl font-extrabold tracking-wide text-ink">
              Esperando aprobación del administrador
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">
              Recibimos tu solicitud para asociar{" "}
              {email ? <strong className="text-ink">{email}</strong> : "tu cuenta"}{" "}
              con la ficha oficial de{" "}
              <strong className="text-pitch-800">
                {pendingRequest.requestedPlayerName}
              </strong>
              .
            </p>
          </div>

          <dl className="mt-5 grid gap-2 rounded-md bg-paper p-3.5 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-bold uppercase tracking-wider text-ink-muted">
                Jugador solicitado
              </dt>
              <dd className="mt-0.5 text-sm font-bold text-ink">
                {pendingRequest.requestedPlayerName}
              </dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-wider text-ink-muted">
                Fecha de solicitud
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink">
                {formattedCreatedDate ?? "Reciente"}
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-center text-xs leading-relaxed text-ink-muted">
            Apenas un Administrador la apruebe desde el panel oficial, tus
            estadísticas, estrellas y permisos se habilitarán automáticamente al
            recargar esta pantalla.
          </p>
        </div>
      ) : (
        <div>
          <div className="text-center">
            <UserPlus className="mx-auto h-10 w-10 text-pitch-700" />
            <h2 className="font-display mt-3 text-2xl font-extrabold tracking-wide text-ink">
              Elegí tu ficha en el padrón LOLONMEBOL
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">
              Iniciaste sesión
              {email ? (
                <>
                  {" "}
                  con <strong className="text-ink">{email}</strong>
                </>
              ) : null}
              . Buscate en el padrón oficial para pedirle al Administrador que
              vincule tu cuenta.
            </p>
          </div>

          {feedback && (
            <div
              role={feedback.type === "error" ? "alert" : "status"}
              className={cn(
                "mt-4 flex items-start gap-2 rounded-md p-3 text-xs font-medium",
                feedback.type === "error"
                  ? "bg-crimson-50 text-crimson-700"
                  : "bg-pitch-50 text-pitch-900"
              )}
            >
              {feedback.type === "error" ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pitch-700" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {comboboxOptions.length === 0 ? (
            <p className="mt-5 rounded-md bg-paper p-4 text-center text-xs leading-relaxed text-ink-muted">
              No quedan fichas libres disponibles para auto-solicitud en este
              momento. Consultá con un Administrador del torneo para revisar tu
              padrón.
            </p>
          ) : (
            <form onSubmit={handleSubmitRequest} className="mt-5 space-y-3">
              <PlayerCombobox
                label="Tu nombre en el padrón"
                options={comboboxOptions}
                value={selectedPlayerId}
                onChange={setSelectedPlayerId}
                placeholder="Seleccioná quién sos..."
                searchPlaceholder="Buscar por nombre o apodo..."
                emptyMessage="No se encontraron jugadores libres con ese nombre"
              />

              <button
                type="submit"
                disabled={isPending || !selectedPlayerId}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-pitch-800 px-4 text-sm font-bold text-white transition-colors hover:bg-pitch-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {isPending
                  ? "Enviando solicitud..."
                  : "Enviar solicitud de vinculación"}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-rule pt-4">
        <Link
          href="/stats?tab=player"
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-rule bg-paper px-4 text-xs font-semibold text-ink transition-colors hover:border-pitch-700"
        >
          <BarChart3 className="h-4 w-4 text-pitch-700" />
          Explorar Stats por Jugador
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-rule bg-paper px-4 text-xs font-bold text-ink transition-colors hover:border-pitch-700"
          >
            <LogOut className="h-4 w-4 text-ink-muted" />
            Usar otra cuenta
          </button>
        </form>
      </div>
    </section>
  );
}
