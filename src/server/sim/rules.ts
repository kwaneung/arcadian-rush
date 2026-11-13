import "server-only";

import { clampIntent, type ClientMessage, type Snapshot } from "@/shared/protocol";
import { createRunState, type RunState } from "@/server/sim/state";

export const PLAYER_RADIUS = 14;
export const WORLD_HALF = 800;
export const BASE_SPEED = 140;
export const TICK_MS = 50;
const MOVE_WINDOW_MS = 1000;
const MOVE_LIMIT = 20;

export function moveSpeed(strideRank: number): number {
  return Math.min(280, BASE_SPEED * 1.12 ** strideRank);
}

export function xpToNext(level: number): number {
  return 5 + (level - 1) * 3;
}

export function toSnapshot(state: RunState): Snapshot {
  return {
    type: "snapshot",
    runId: state.runId,
    phase: state.phase,
    simMs: state.simMs,
    player: {
      x: state.player.x,
      y: state.player.y,
      radius: PLAYER_RADIUS,
      hp: state.player.hp,
      maxHp: 100,
      level: state.player.level,
      xp: state.player.xp,
      xpToNext: xpToNext(state.player.level),
      facingX: state.player.facingX,
      facingY: state.player.facingY,
      kills: state.player.kills,
    },
    entities: [],
    offer: null,
    result: null,
  };
}

export function apply(state: RunState, message: ClientMessage, now: number): void {
  if (state.phase === "ended") return;
  switch (message.type) {
    case "move":
      applyMove(state, message.x, message.y, now);
      return;
    case "hello":
    case "pause":
    case "resume":
    case "choose":
      return;
    default: {
      const unreachable: never = message;
      return unreachable;
    }
  }
}

export function step(state: RunState, now: number): Snapshot {
  void now;
  if (state.phase !== "ended") {
    state.simMs += TICK_MS;
    movePlayer(state);
  }
  return toSnapshot(state);
}

export function freshState(runId: string, activatedAt: number): RunState {
  return createRunState({ runId, activatedAt });
}

function applyMove(state: RunState, x: number, y: number, now: number): void {
  const intent = clampIntent(x, y);
  if (!intent) return;
  const recent = state.moveAcceptedAt.filter((acceptedAt) => acceptedAt > now - MOVE_WINDOW_MS);
  state.moveAcceptedAt = recent;
  if (recent.length >= MOVE_LIMIT) return;
  state.player.intentX = intent.x;
  state.player.intentY = intent.y;
  state.moveAcceptedAt.push(now);
}

function movePlayer(state: RunState): void {
  const intentX = state.player.intentX;
  const intentY = state.player.intentY;
  const length = Math.hypot(intentX, intentY);
  if (length > 0) {
    const distance = moveSpeed(state.player.ranks.stride) * (TICK_MS / 1000);
    const unitX = intentX / length;
    const unitY = intentY / length;
    state.player.x += unitX * distance;
    state.player.y += unitY * distance;
    state.player.facingX = unitX;
    state.player.facingY = unitY;
  }
  const limit = WORLD_HALF - PLAYER_RADIUS;
  state.player.x = Math.min(limit, Math.max(-limit, state.player.x));
  state.player.y = Math.min(limit, Math.max(-limit, state.player.y));
}
