import { describe, expect, it } from "vitest";

import { parseClientMessage } from "@/shared/protocol";
import { apply, freshState, step } from "@/server/sim/rules";

const RUN_ID = "00000000-0000-4000-8000-000000000001";

describe("movement", () => {
  it("keeps the previous intent when the move is not finite", () => {
    const state = freshState(RUN_ID, 0);
    apply(state, { type: "move", x: 1, y: 0 }, 0);
    apply(state, { type: "move", x: Number.NaN, y: 0 }, 1);
    expect(state.player.intentX).toBeCloseTo(1);
    expect(state.player.intentY).toBe(0);
  });

  it("moves one tick at the rank 0 speed", () => {
    const state = freshState(RUN_ID, 0);
    apply(state, { type: "move", x: 3, y: 4 }, 0);
    step(state, 50);
    expect(Math.hypot(state.player.x, state.player.y)).toBeCloseTo(140 * 0.05);
    expect(state.player.hp).toBe(100);
  });

  it("ignores a health field on move", () => {
    const state = freshState(RUN_ID, 0);
    const parsed = parseClientMessage(JSON.stringify({ type: "move", x: 1, y: 0, hp: 9999 }));
    expect(parsed).toEqual({ type: "move", x: 1, y: 0 });
    apply(state, parsed!, 0);
    step(state, 50);
    expect(state.player.hp).toBe(100);
  });

  it("ignores the 21st move inside one second", () => {
    const state = freshState(RUN_ID, 0);
    for (let count = 0; count < 20; count += 1) {
      apply(state, { type: "move", x: 1, y: 0 }, 5_000);
    }
    apply(state, { type: "move", x: 0, y: 1 }, 5_000);
    expect(state.player.intentX).toBeCloseTo(1);
    expect(state.player.intentY).toBe(0);
  });

  it("does not change state for pause, resume, or choose", () => {
    const state = freshState(RUN_ID, 0);
    apply(state, { type: "pause" }, 0);
    apply(state, { type: "resume" }, 0);
    apply(state, { type: "choose", index: 0 }, 0);
    expect(state.phase).toBe("playing");
    expect(state.player.x).toBe(0);
  });
});
