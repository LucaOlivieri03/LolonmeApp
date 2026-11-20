"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import seedData from "@/lib/data/seed-data.json";
import {
  SPANISH_MONTH_LABELS,
  computeStandings,
  enrollPlayerInSeasonFund,
  generateCupBracket,
  replaceMatchInDataset,
} from "@/lib/engine";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Announcement,
  CalendarEvent,
  CupEdition,
  CupTie,
  FundMonth,
  FundTransaction,
  Match,
  Player,
  PlayerRole,
  Season,
  TitleType,
  TournamentDataset,
} from "@/lib/types/domain";

const STORAGE_KEY = "lolonmeapp_dataset_v1";
const ROLE_STORAGE_KEY = "lolonmeapp_role_v1";
const LOGGED_PLAYER_STORAGE_KEY = "lolonmeapp_logged_player_v1";

interface TournamentContextValue {
  dataset: TournamentDataset;
  role: PlayerRole;
  loggedPlayerId: string | null;
  isLocalMode: boolean;
  setRole: (role: PlayerRole) => void;
  setLoggedPlayerId: (playerId: string | null) => void;
  resetToSeed: () => void;
  applyDataset: (next: TournamentDataset) => void;
  addMatch: (match: Match) => void;
  updateMatch: (match: Match) => void;
  deleteMatch: (matchId: string) => void;
  addAnnouncement: (ann: Omit<Announcement, "id" | "createdAt">) => void;
  deleteAnnouncement: (id: string) => void;
  addCalendarEvent: (ev: Omit<CalendarEvent, "id">) => void;
  deleteCalendarEvent: (id: string) => void;
  updateCupTie: (tieId: string, patch: Partial<CupTie>) => void;
  regenerateCupBracket: (seasonId: string, finalistIds: string[]) => void;
  addPlayer: (input: { displayName: string; email?: string; role: Exclude<PlayerRole, "guest"> }) => string;
  updatePlayerRole: (playerId: string, role: Exclude<PlayerRole, "guest">) => void;
  addPlayerTitle: (playerId: string, seasonId: string, titleType: TitleType) => void;
  addSeason: (input: { year: number; defaultFee?: number; cupCutoffDate?: string }) => string;
  addPlayerToPozo: (seasonId: string, playerId: string) => void;
  toggleFundPayment: (fundMonthId: string, playerId: string) => void;
  updateFundMonthFee: (fundMonthId: string, feeAmount: number) => void;
  addFundTransaction: (tx: Omit<FundTransaction, "id">) => void;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

const INITIAL_DATASET = seedData as unknown as TournamentDataset;

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const isLocalMode = !isSupabaseConfigured();
  const [dataset, setDataset] = useState<TournamentDataset>(INITIAL_DATASET);
  const [role, setRoleState] = useState<PlayerRole>(isLocalMode ? "admin" : "guest");
  const [loggedPlayerId, setLoggedPlayerIdState] = useState<string | null>(
    isLocalMode ? "b-aguzzi" : null
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as TournamentDataset;
        if (parsed && Array.isArray(parsed.matches) && Array.isArray(parsed.players)) {
          setDataset(parsed);
        }
      }
      if (isLocalMode) {
        const savedRole = localStorage.getItem(ROLE_STORAGE_KEY) as PlayerRole | null;
        if (savedRole && ["admin", "authorized", "player", "guest"].includes(savedRole)) {
          setRoleState(savedRole);
          if (savedRole === "guest") {
            setLoggedPlayerIdState(null);
          }
        }
        const savedPlayerId = localStorage.getItem(LOGGED_PLAYER_STORAGE_KEY);
        if (savedPlayerId) {
          setLoggedPlayerIdState(savedPlayerId === "NONE" ? null : savedPlayerId);
        }
      }
    } catch {
      // Ignore storage read errors
    } finally {
      setHydrated(true);
    }

    if (!isLocalMode) {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        supabase.auth.getUser().then(async ({ data }) => {
          if (!data.user) {
            setRoleState("guest");
            setLoggedPlayerIdState(null);
            return;
          }
          const { data: player } = await supabase
            .from("players")
            .select("id, role")
            .eq("user_id", data.user.id)
            .single();
          if (player?.id) {
            setLoggedPlayerIdState(player.id as string);
          }
          if (player?.role && ["admin", "authorized", "player"].includes(player.role)) {
            setRoleState(player.role as PlayerRole);
          } else {
            setRoleState("player");
          }
        });
      }
    }
  }, [isLocalMode]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
    } catch {
      // Ignore quota errors
    }
  }, [dataset, hydrated]);

  const setRole = (nextRole: PlayerRole) => {
    // Role simulation is strictly disabled when Supabase Auth is configured
    if (!isLocalMode) return;
    setRoleState(nextRole);
    if (nextRole === "guest") {
      setLoggedPlayerIdState(null);
    } else if (!loggedPlayerId) {
      setLoggedPlayerIdState(dataset.players[0]?.id ?? "b-aguzzi");
    }
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, nextRole);
    } catch {
      // Ignore storage errors
    }
  };

  const setLoggedPlayerId = (nextPlayerId: string | null) => {
    if (!isLocalMode) return;
    setLoggedPlayerIdState(nextPlayerId);
    try {
      localStorage.setItem(LOGGED_PLAYER_STORAGE_KEY, nextPlayerId ?? "NONE");
    } catch {
      // Ignore storage errors
    }
  };

  const resetToSeed = () => {
    setDataset(INITIAL_DATASET);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const applyDataset = (next: TournamentDataset) => {
    setDataset(next);
  };

  const addMatch = (match: Match) => {
    setDataset((prev) => ({
      ...prev,
      matches: [match, ...prev.matches].sort((a, b) =>
        b.matchDate.localeCompare(a.matchDate)
      ),
    }));
  };

  const updateMatch = (match: Match) => {
    setDataset((prev) => ({
      ...prev,
      matches: replaceMatchInDataset(prev.matches, match),
    }));
  };

  const deleteMatch = (matchId: string) => {
    setDataset((prev) => ({
      ...prev,
      matches: prev.matches.filter((m) => m.id !== matchId),
    }));
  };

  const addAnnouncement = (ann: Omit<Announcement, "id" | "createdAt">) => {
    const created: Announcement = {
      ...ann,
      id: `ann-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setDataset((prev) => ({
      ...prev,
      announcements: [created, ...prev.announcements],
    }));
  };

  const deleteAnnouncement = (id: string) => {
    setDataset((prev) => ({
      ...prev,
      announcements: prev.announcements.filter((a) => a.id !== id),
    }));
  };

  const addCalendarEvent = (ev: Omit<CalendarEvent, "id">) => {
    const created: CalendarEvent = {
      ...ev,
      id: `cal-${Date.now()}`,
    };
    setDataset((prev) => ({
      ...prev,
      calendarEvents: [created, ...prev.calendarEvents].sort((a, b) =>
        b.eventDate.localeCompare(a.eventDate)
      ),
    }));
  };

  const deleteCalendarEvent = (id: string) => {
    setDataset((prev) => ({
      ...prev,
      calendarEvents: prev.calendarEvents.filter((e) => e.id !== id),
    }));
  };

  const updateCupTie = (tieId: string, patch: Partial<CupTie>) => {
    setDataset((prev) => ({
      ...prev,
      cupTies: prev.cupTies.map((t) =>
        t.id === tieId ? { ...t, ...patch } : t
      ),
    }));
  };

  const regenerateCupBracket = (seasonId: string, finalistIds: string[]) => {
    setDataset((prev) => {
      const edition = prev.cupEditions.find((e) => e.seasonId === seasonId);
      if (!edition) return prev;
      const standings = computeStandings({
        players: prev.players,
        matches: prev.matches,
        titles: prev.titles,
        seasonId,
      });
      const cutoffIds = standings.rows.map((r) => r.playerId);
      const nextTies = generateCupBracket({
        editionId: edition.id,
        standingsPlayerIds: cutoffIds,
        previousLolonmebolFinalistIds: finalistIds,
      });
      return {
        ...prev,
        cupEditions: prev.cupEditions.map((e) =>
          e.id === edition.id
            ? { ...e, cutoffSnapshotPlayerIds: cutoffIds }
            : e
        ),
        cupTies: [
          ...prev.cupTies.filter((t) => t.cupEditionId !== edition.id),
          ...nextTies,
        ],
      };
    });
  };

  const addPlayer = (input: {
    displayName: string;
    email?: string;
    role: Exclude<PlayerRole, "guest">;
  }): string => {
    const slug = input.displayName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const playerId = slug || `player-${Date.now()}`;
    const created: Player = {
      id: playerId,
      displayName: input.displayName.trim(),
      email: input.email?.trim() || null,
      role: input.role,
      isActive: true,
    };
    setDataset((prev) => {
      if (prev.players.some((p) => p.id === playerId)) return prev;
      return {
        ...prev,
        players: [...prev.players, created].sort((a, b) =>
          a.displayName.localeCompare(b.displayName, "es")
        ),
      };
    });
    return playerId;
  };

  const updatePlayerRole = (
    playerId: string,
    nextRole: Exclude<PlayerRole, "guest">
  ) => {
    setDataset((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === playerId ? { ...p, role: nextRole } : p
      ),
    }));
  };

  const addPlayerTitle = (
    playerId: string,
    seasonId: string,
    titleType: TitleType
  ) => {
    setDataset((prev) => ({
      ...prev,
      titles: [
        ...prev.titles,
        {
          id: `title-${Date.now()}`,
          playerId,
          seasonId,
          titleType,
          awardedAt: new Date().toISOString().slice(0, 10),
        },
      ],
    }));
  };

  const addSeason = (input: {
    year: number;
    defaultFee?: number;
    cupCutoffDate?: string;
  }): string => {
    const year = Math.round(input.year);
    const seasonId = `season-${year}`;
    const fee =
      typeof input.defaultFee === "number" && Number.isFinite(input.defaultFee)
        ? Math.max(0, input.defaultFee)
        : 3000;
    const cutoff = input.cupCutoffDate?.trim() || `${year}-07-01`;

    setDataset((prev) => {
      if (prev.seasons.some((s) => s.id === seasonId || s.year === year)) {
        return prev;
      }

      const maxExistingYear = prev.seasons.reduce(
        (max, s) => Math.max(max, s.year),
        0
      );
      const isNewest = year >= maxExistingYear;

      const updatedSeasons: Season[] = prev.seasons.map((s) =>
        isNewest && s.status === "active" ? { ...s, status: "finished" } : s
      );

      const newSeason: Season = {
        id: seasonId,
        year,
        name: `Temporada ${year}`,
        status: isNewest ? "active" : "finished",
        cupCutoffDate: cutoff,
      };

      const newCupEdition: CupEdition = {
        id: `cup-${year}`,
        seasonId,
        name: `Copa LOLONMEBOL ${year}`,
        cutoffSnapshotPlayerIds: [],
      };

      const newFundMonths: FundMonth[] = SPANISH_MONTH_LABELS.map(
        ({ monthNumber, monthLabel }) => ({
          id: `fm-${year}-${monthNumber}`,
          seasonId,
          monthNumber,
          monthLabel,
          feeAmount: fee,
        })
      );

      return {
        ...prev,
        seasons: [...updatedSeasons, newSeason].sort((a, b) => a.year - b.year),
        cupEditions: [...prev.cupEditions, newCupEdition],
        fundMonths: [...prev.fundMonths, ...newFundMonths],
      };
    });

    return seasonId;
  };

  const addPlayerToPozo = (seasonId: string, playerId: string) => {
    if (!seasonId || !playerId) return;
    setDataset((prev) => {
      const season = prev.seasons.find((s) => s.id === seasonId);
      let fundMonths = prev.fundMonths;
      if (season && !fundMonths.some((m) => m.seasonId === seasonId)) {
        const createdMonths: FundMonth[] = SPANISH_MONTH_LABELS.map(
          ({ monthNumber, monthLabel }) => ({
            id: `fm-${season.year}-${monthNumber}`,
            seasonId,
            monthNumber,
            monthLabel,
            feeAmount: 3000,
          })
        );
        fundMonths = [...fundMonths, ...createdMonths];
      }
      const nextPayments = enrollPlayerInSeasonFund(
        fundMonths,
        prev.fundPayments,
        seasonId,
        playerId
      );
      return {
        ...prev,
        fundMonths,
        fundPayments: nextPayments,
      };
    });
  };

  const toggleFundPayment = (fundMonthId: string, playerId: string) => {
    setDataset((prev) => {
      const existing = prev.fundPayments.find(
        (p) => p.fundMonthId === fundMonthId && p.playerId === playerId
      );
      if (existing) {
        return {
          ...prev,
          fundPayments: prev.fundPayments.map((p) =>
            p.id === existing.id
              ? {
                  ...p,
                  paid: !p.paid,
                  paidAt: !p.paid ? new Date().toISOString() : null,
                }
              : p
          ),
        };
      }
      return {
        ...prev,
        fundPayments: [
          ...prev.fundPayments,
          {
            id: `fp-${fundMonthId}-${playerId}`,
            fundMonthId,
            playerId,
            paid: true,
            paidAt: new Date().toISOString(),
          },
        ],
      };
    });
  };

  const updateFundMonthFee = (fundMonthId: string, feeAmount: number) => {
    setDataset((prev) => ({
      ...prev,
      fundMonths: prev.fundMonths.map((m) =>
        m.id === fundMonthId ? { ...m, feeAmount: Math.max(0, feeAmount) } : m
      ),
    }));
  };

  const addFundTransaction = (tx: Omit<FundTransaction, "id">) => {
    setDataset((prev) => ({
      ...prev,
      fundTransactions: [
        { ...tx, id: `ftx-${Date.now()}` },
        ...prev.fundTransactions,
      ],
    }));
  };

  return (
    <TournamentContext.Provider
      value={{
        dataset,
        role,
        loggedPlayerId,
        isLocalMode,
        setRole,
        setLoggedPlayerId,
        resetToSeed,
        applyDataset,
        addMatch,
        updateMatch,
        deleteMatch,
        addAnnouncement,
        deleteAnnouncement,
        addCalendarEvent,
        deleteCalendarEvent,
        updateCupTie,
        regenerateCupBracket,
        addPlayer,
        updatePlayerRole,
        addPlayerTitle,
        addSeason,
        addPlayerToPozo,
        toggleFundPayment,
        updateFundMonthFee,
        addFundTransaction,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const ctx = useContext(TournamentContext);
  if (!ctx) {
    throw new Error("useTournament must be used within TournamentProvider");
  }
  return ctx;
}
