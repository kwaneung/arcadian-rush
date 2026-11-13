import "server-only";

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export type EndReason = "death" | "time_limit" | "disconnect";

export type RunStore = {
  issue(input: {
    now: number;
    ipHash: string;
  }): Promise<
    | { ok: true; runId: string; token: string; expiresAt: number }
    | { ok: false; error: "rate" | "unavailable" }
  >;
  activate(input: {
    runId: string;
    token: string;
    now: number;
  }): Promise<"ok" | "reject">;
  finish(input: {
    runId: string;
    simMs: number;
    kills: number;
    level: number;
    reason: EndReason;
    now: number;
  }): Promise<"recorded" | "unrecorded">;
  read(runId: string): Promise<
    | { status: "issued" | "active" }
    | { status: "missing" }
  >;
  board(input: { limit: number }): Promise<never[]>;
};

type Row = {
  tokenHash: string;
  issueIpHash: string;
  status: "issued" | "active" | "ended";
  issuedAt: number;
  expiresAt: number;
};

const TOKEN_TTL_MS = 30_000;
const ISSUE_WINDOW_MS = 60_000;
const ISSUE_LIMIT = 5;

export function createMemoryStore(): RunStore {
  const rows = new Map<string, Row>();

  return {
    async issue({ now, ipHash }) {
      const recent = [...rows.values()].filter(
        (row) => row.issueIpHash === ipHash && row.issuedAt > now - ISSUE_WINDOW_MS,
      );
      if (recent.length >= ISSUE_LIMIT) return { ok: false, error: "rate" };
      const runId = randomUUID();
      const token = randomBytes(32).toString("base64url");
      rows.set(runId, {
        tokenHash: sha256(token),
        issueIpHash: ipHash,
        status: "issued",
        issuedAt: now,
        expiresAt: now + TOKEN_TTL_MS,
      });
      return { ok: true, runId, token, expiresAt: now + TOKEN_TTL_MS };
    },

    async activate({ runId, token, now }) {
      const row = rows.get(runId);
      if (!row || row.status !== "issued" || now > row.expiresAt) return "reject";
      if (!sameHash(sha256(token), row.tokenHash)) return "reject";
      row.status = "active";
      return "ok";
    },

    async finish({ runId }) {
      const row = rows.get(runId);
      if (!row || row.status !== "active") return "unrecorded";
      row.status = "ended";
      return "unrecorded";
    },

    async read(runId) {
      const row = rows.get(runId);
      if (!row || row.status === "ended") return { status: "missing" };
      return { status: row.status };
    },

    async board() {
      return [];
    },
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sameHash(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
