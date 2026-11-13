export type ClientMessage =
  | { type: "hello"; runId: string; token: string }
  | { type: "move"; x: number; y: number }
  | { type: "choose"; index: number }
  | { type: "pause" }
  | { type: "resume" };

export type Snapshot = {
  type: "snapshot";
  runId: string;
  phase: "playing" | "choosing" | "paused" | "ended";
  simMs: number;
  player: {
    x: number;
    y: number;
    radius: number;
    hp: number;
    maxHp: number;
    level: number;
    xp: number;
    xpToNext: number;
    facingX: number;
    facingY: number;
    kills: number;
  };
  entities: Array<{
    id: number;
    kind: "enemy" | "projectile" | "gem";
    subtype: string;
    x: number;
    y: number;
    radius: number;
    hpFraction?: number;
  }>;
  offer: null | Array<{
    index: number;
    id: string;
    title: string;
    detail: string;
  }>;
  result: null | {
    simMs: number;
    kills: number;
    level: number;
    reason: "death" | "time_limit" | "disconnect";
    recorded: boolean;
  };
};

const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_LIMIT = 200;

export function clampIntent(
  x: number,
  y: number,
): { x: number; y: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const clampedX = Math.min(1, Math.max(-1, x));
  const clampedY = Math.min(1, Math.max(-1, y));
  const length = Math.hypot(clampedX, clampedY);
  if (length > 1) {
    return { x: clampedX / length, y: clampedY / length };
  }
  return { x: clampedX, y: clampedY };
}

export function parseClientMessage(raw: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  switch (record.type) {
    case "hello":
      return parseHello(record);
    case "move":
      return parseMove(record);
    case "choose":
      return parseChoose(record);
    case "pause":
      return { type: "pause" };
    case "resume":
      return { type: "resume" };
    default:
      return null;
  }
}

function parseHello(record: Record<string, unknown>): ClientMessage | null {
  if (typeof record.runId !== "string" || !RUN_ID.test(record.runId)) return null;
  if (typeof record.token !== "string") return null;
  if (record.token.length < 1 || record.token.length > TOKEN_LIMIT) return null;
  return { type: "hello", runId: record.runId, token: record.token };
}

function parseMove(record: Record<string, unknown>): ClientMessage | null {
  if (typeof record.x !== "number" || typeof record.y !== "number") return null;
  if (!Number.isFinite(record.x) || !Number.isFinite(record.y)) return null;
  return { type: "move", x: record.x, y: record.y };
}

function parseChoose(record: Record<string, unknown>): ClientMessage | null {
  if (typeof record.index !== "number" || !Number.isInteger(record.index)) return null;
  if (record.index < 0) return null;
  return { type: "choose", index: record.index };
}

export function parseSnapshot(raw: string): Snapshot | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type !== "snapshot") return null;
  if (typeof record.runId !== "string" || !RUN_ID.test(record.runId)) return null;
  if (!isPhase(record.phase) || typeof record.simMs !== "number") return null;
  if (!isPlayer(record.player)) return null;
  return {
    type: "snapshot",
    runId: record.runId,
    phase: record.phase,
    simMs: record.simMs,
    player: record.player,
    entities: [],
    offer: null,
    result: null,
  };
}

function isPhase(value: unknown): value is Snapshot["phase"] {
  return (
    value === "playing" ||
    value === "choosing" ||
    value === "paused" ||
    value === "ended"
  );
}

function isPlayer(value: unknown): value is Snapshot["player"] {
  if (!value || typeof value !== "object") return false;
  const player = value as Record<string, unknown>;
  return (
    typeof player.x === "number" &&
    typeof player.y === "number" &&
    typeof player.radius === "number" &&
    typeof player.hp === "number" &&
    typeof player.maxHp === "number" &&
    typeof player.level === "number" &&
    typeof player.xp === "number" &&
    typeof player.xpToNext === "number" &&
    typeof player.facingX === "number" &&
    typeof player.facingY === "number" &&
    typeof player.kills === "number"
  );
}
