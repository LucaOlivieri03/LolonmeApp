"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import seedData from "@/lib/data/seed-data.json";
import { computeStandings, generateCupBracket } from "@/lib/engine";
import type {
  Announcement,
  CalendarEvent,
  CupTie,
  FundTransaction,
  Match,
  Player,
  PlayerRole,
  TitleType,
  TournamentDataset,
} from "@/lib/types/domain";

const STORAGE_KEY = "lolonmeapp_dataset_v1";
const ROLE_STORAGE_KEY = "lolonmeapp_role_v1";

interface TournamentContextValue {
  dataset: TournamentDataset;
  role: PlayerRole;
  setRole: (role: PlayerRole) => void;
  resetToSeed: () => void;
  applyDataset: (next: TournamentDataset) => void;
  addMatch: (match: Match) => void;
  deleteMatch: (matchId: string) => void;
  addAnnouncement: (ann: Omit<Announcement, "id" | "createdAt">) => void;
  deleteAnnouncement: (id: string) => void;
  addCalendarEvent: (ev: Omit<CalendarEvent, "id">) => void;
  deleteCalendarEvent: (id: string) => void;
  updateCupTie: (tieId: string, patch: Partial<CupTie>) => void;
  regenerateCupBracket: (seasonId: string, finalistIds: string[]) => void;
  addPlayer: (input: { displayName: string; email?: string; role: Exclude<PlayerRole, "guest"> }) => void;
  updatePlayerRole: (playerId: string, role: Exclude<PlayerRole, "guest">) => void;
  addPlayerTitle: (playerId: string, seasonId: string, titleType: TitleType) => void;
  toggleFundPayment: (fundMonthId: string, playerId: string) => void;
  updateFundMonthFee: (fundMonthId: string, feeAmount: number) => void;
  addFundTransaction: (tx: Omit<FundTransaction, "id">) => void;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

const INITIAL_DATASET = seedData as unknown as TournamentDataset;

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const [dataset, setDataset] = useState<TournamentDataset>(INITIAL_DATASET);
  const [role, setRoleState] = useState<PlayerRole>("admin");
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
      const savedRole = localStorage.getItem(ROLE_STORAGE_KEY) as PlayerRole | null;
      if (savedRole && ["admin", "authorized", "player", "guest"].includes(savedRole)) {
        setRoleState(savedRole);
      }
    } catch {
      // Ignore storage read errors
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
    } catch {
      // Ignore quota errors
    }
  }, [dataset, hydrated]);

  const setRole = (nextRole: PlayerRole) => {
    setRoleState(nextRole);
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, nextRole);
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
  }) => {
    const slug = input.displayName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const created: Player = {
      id: slug || `player-${Date.now()}`,
      displayName: input.displayName.trim(),
      email: input.email?.trim() || null,
      role: input.role,
      isActive: true,
    };
    setDataset((prev) => ({
      ...prev,
      players: [...prev.players, created].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "es")
      ),
    }));
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
        setRole,
        resetToSeed,
        applyDataset,
        addMatch,
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
