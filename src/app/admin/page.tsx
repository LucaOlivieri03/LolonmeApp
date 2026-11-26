import Link from "next/link";
import { Lock, Shield } from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import type { PlayerRole } from "@/lib/types/domain";
import { getAdminViewModel } from "@/server/queries/admin";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<PlayerRole, string> = {
  admin: "Admin · Presidente",
  authorized: "Jugador Autorizado",
  player: "Jugador",
  guest: "Invitado — sin cuenta",
};

export default async function AdminPage() {
  const vm = await getAdminViewModel();

  if (vm.status === "unauthorized") {
    return (
      <div className="space-y-5">
        <header className="pitch-chalk-surface rounded-lg border border-pitch-900 p-4 text-paper">
          <div className="flex items-start gap-2.5">
            <Shield className="mt-0.5 h-6 w-6 shrink-0 text-gold-400" />
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-wide text-white sm:text-3xl">
                Panel de Administración
              </h1>
              <p className="text-xs text-pitch-100">
                Acceso protegido por sesión oficial · Rol actual:{" "}
                {ROLE_LABELS[vm.role]}
              </p>
            </div>
          </div>
        </header>

        <div className="rounded-lg border border-crimson-600/35 bg-surface p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-crimson-600" />
          <h2 className="font-display mt-2 text-xl font-bold tracking-wide text-ink">
            Acceso Restringido · {ROLE_LABELS[vm.role]}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Solo los usuarios con rol <strong className="text-ink">Admin</strong>{" "}
            o <strong className="text-ink">Jugador Autorizado</strong> pueden
            operar el panel de administración.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {!vm.isAuthenticated ? (
              <Link
                href="/perfil"
                className="inline-flex min-h-10 items-center rounded-md bg-pitch-800 px-4 text-xs font-bold text-white transition-colors hover:bg-pitch-900"
              >
                Iniciar Sesión en Perfil
              </Link>
            ) : null}
            <Link
              href="/"
              className="inline-flex min-h-10 items-center rounded-md border border-rule bg-paper px-4 text-xs font-bold text-ink transition-colors hover:border-rule-strong"
            >
              Volver al Inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminWorkspaceShell
      session={vm.session}
      data={{
        seasons: vm.data.seasons,
        players: vm.data.players,
        matches: vm.data.matches,
        announcements: vm.data.announcements,
        calendarEvents: vm.data.calendarEvents,
        cupEditions: vm.data.cupEditions,
        cupTies: vm.data.cupTies,
      }}
      fund={vm.fund}
      pendingLinkRequests={vm.pendingLinkRequests}
      playerAuthLinks={vm.playerAuthLinks}
    />
  );
}
