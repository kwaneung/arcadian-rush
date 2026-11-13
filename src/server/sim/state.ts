import "server-only";

export type UpgradeId =
  | "might"
  | "haste"
  | "stride"
  | "vigor"
  | "magnet"
  | "volley";

export type Ranks = Record<UpgradeId, number>;

export type Phase = "playing" | "choosing" | "paused" | "ended";

export type RunState = {
  runId: string;
  phase: Phase;
  random: () => number;
  activatedAt: number;
  simMs: number;
  nextEntityId: number;
  nextSpawnSimMs: number;
  lastShotSimMs: number;
  player: {
    x: number;
    y: number;
    hp: number;
    level: number;
    xp: number;
    facingX: number;
    facingY: number;
    kills: number;
    intentX: number;
    intentY: number;
    ranks: Ranks;
  };
  moveAcceptedAt: number[];
  pauseAcceptedAt: number[];
};

const EMPTY_RANKS: Ranks = {
  might: 0,
  haste: 0,
  stride: 0,
  vigor: 0,
  magnet: 0,
  volley: 0,
};

export function createRunState(input: {
  runId: string;
  activatedAt: number;
  random?: () => number;
}): RunState {
  return {
    runId: input.runId,
    phase: "playing",
    random: input.random ?? (() => 0),
    activatedAt: input.activatedAt,
    simMs: 0,
    nextEntityId: 1,
    nextSpawnSimMs: 1000,
    lastShotSimMs: 0,
    player: {
      x: 0,
      y: 0,
      hp: 100,
      level: 1,
      xp: 0,
      facingX: 1,
      facingY: 0,
      kills: 0,
      intentX: 0,
      intentY: 0,
      ranks: { ...EMPTY_RANKS },
    },
    moveAcceptedAt: [],
    pauseAcceptedAt: [],
  };
}
