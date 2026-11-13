import { describe, expect, it } from "vitest";

import { combineIntent, keyboardVector } from "@/client/intent";

describe("keyboard intent", () => {
  it("cancels opposite keys and clamps the combined vector", () => {
    expect(keyboardVector(new Set(["KeyA", "ArrowLeft"]))).toEqual({ x: -1, y: 0 });
    expect(keyboardVector(new Set(["KeyA", "KeyD", "ArrowLeft"]))).toEqual({ x: 0, y: 0 });
    expect(keyboardVector(new Set(["KeyW", "KeyS"]))).toEqual({ x: 0, y: 0 });
    const diagonal = combineIntent(keyboardVector(new Set(["KeyD", "KeyS"])), { x: 0, y: 0 });
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
  });
});
