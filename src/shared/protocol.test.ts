import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { clampIntent, parseClientMessage } from "@/shared/protocol";

describe("parseClientMessage", () => {
  it("drops fields outside the schema", () => {
    expect(parseClientMessage(JSON.stringify({ type: "move", x: 1, y: 0, hp: 9999 }))).toEqual({
      type: "move",
      x: 1,
      y: 0,
    });
  });

  it("returns null for a non-finite move", () => {
    expect(parseClientMessage(JSON.stringify({ type: "move", x: null, y: 0 }))).toBeNull();
    expect(clampIntent(Number.NaN, 0)).toBeNull();
  });

  it("clamps (3, 4) onto the unit circle", () => {
    const intent = clampIntent(3, 4);
    expect(intent).not.toBeNull();
    expect(Math.hypot(intent!.x, intent!.y)).toBeCloseTo(1);
  });

  it("rejects a fractional choose index", () => {
    expect(parseClientMessage(JSON.stringify({ type: "choose", index: 1.5 }))).toBeNull();
  });
});

describe("protocol source", () => {
  it("does not contain combat constants", () => {
    const source = readFileSync(path.resolve("src/shared/protocol.ts"), "utf8");
    expect(source).not.toMatch(/(^|[^0-9])10([^0-9]|$)/);
    expect(source).not.toMatch(/(^|[^0-9])30([^0-9]|$)/);
    expect(source).not.toMatch(/(^|[^0-9])800([^0-9]|$)/);
  });
});
