import { describe, expect, it } from "vitest";
import {
  formatMatchScoreBadge,
  shouldShowGoalsAssists,
} from "./display";

describe("formatMatchScoreBadge (#34)", () => {
  it("omits 'Ganó Eq. A' for 2025 matches without numeric scores", () => {
    expect(
      formatMatchScoreBadge({
        matchDate: "2025-12-16",
        teamAScore: null,
        teamBScore: null,
        resultOutcome: "A",
      })
    ).toBeNull();
  });

  it("keeps 'Empate' for 2025 draws without numeric scores", () => {
    expect(
      formatMatchScoreBadge({
        matchDate: "2025-07-02",
        teamAScore: null,
        teamBScore: null,
        resultOutcome: "draw",
      })
    ).toBe("Empate");
  });

  it("shows exact numeric score for 2026 matches", () => {
    expect(
      formatMatchScoreBadge({
        matchDate: "2026-02-04",
        teamAScore: 12,
        teamBScore: 7,
        resultOutcome: "A",
      })
    ).toBe("12 – 7");
  });
});

describe("shouldShowGoalsAssists (#34)", () => {
  it("shows 0G / 0A in 2026 regular matches", () => {
    expect(
      shouldShowGoalsAssists({
        matchDate: "2026-03-11",
        matchType: "league",
        goals: 0,
        assists: 0,
      })
    ).toBe(true);
  });

  it("hides 0G / 0A in 2025 matches", () => {
    expect(
      shouldShowGoalsAssists({
        matchDate: "2025-12-16",
        matchType: "league",
        goals: 0,
        assists: 0,
      })
    ).toBe(false);
  });

  it("shows positive goals or assists in any season", () => {
    expect(
      shouldShowGoalsAssists({
        matchDate: "2025-12-16",
        matchType: "league",
        goals: 2,
        assists: 0,
      })
    ).toBe(true);
  });
});
