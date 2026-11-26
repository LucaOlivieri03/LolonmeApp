import { describe, expect, it } from "vitest";
import {
  clampTokenPosition,
  computeInitialFormation,
  PITCH_BOUNDS,
} from "./tactical-board";

describe("tactical-board formation & clamping", () => {
  it("clamps Team A strictly to the top half of the pitch", () => {
    const crossedMidfield = clampTokenPosition("A", 50, 80);
    expect(crossedMidfield.y).toBe(PITCH_BOUNDS.teamA.maxY);

    const outOfBoundsLeft = clampTokenPosition("A", -10, 2);
    expect(outOfBoundsLeft).toEqual({
      x: PITCH_BOUNDS.minX,
      y: PITCH_BOUNDS.teamA.minY,
    });
  });

  it("clamps Team B strictly to the bottom half of the pitch", () => {
    const crossedMidfield = clampTokenPosition("B", 50, 15);
    expect(crossedMidfield.y).toBe(PITCH_BOUNDS.teamB.minY);

    const outOfBoundsRight = clampTokenPosition("B", 110, 105);
    expect(outOfBoundsRight).toEqual({
      x: PITCH_BOUNDS.maxX,
      y: PITCH_BOUNDS.teamB.maxY,
    });
  });

  it("places every player of a 7v7 match inside their own half", () => {
    const teamA = Array.from({ length: 7 }, (_, i) => ({ id: `a-${i}` }));
    const teamB = Array.from({ length: 7 }, (_, i) => ({ id: `b-${i}` }));
    const positions = computeInitialFormation(teamA, teamB);

    for (const p of teamA) {
      const pos = positions[p.id];
      expect(pos).toBeDefined();
      expect(pos.y).toBeGreaterThanOrEqual(PITCH_BOUNDS.teamA.minY);
      expect(pos.y).toBeLessThanOrEqual(PITCH_BOUNDS.teamA.maxY);
    }

    for (const p of teamB) {
      const pos = positions[p.id];
      expect(pos).toBeDefined();
      expect(pos.y).toBeGreaterThanOrEqual(PITCH_BOUNDS.teamB.minY);
      expect(pos.y).toBeLessThanOrEqual(PITCH_BOUNDS.teamB.maxY);
    }
  });

  it("uses saved official pitchX/pitchY coordinates when present (clamped to half)", () => {
    const positions = computeInitialFormation(
      [{ id: "a-1", pitchX: 30, pitchY: 22 }],
      [{ id: "b-1", pitchX: 70, pitchY: 80 }]
    );
    expect(positions["a-1"]).toEqual({ x: 30, y: 22 });
    expect(positions["b-1"]).toEqual({ x: 70, y: 80 });
  });
});
