import "server-only";

import { parseClientMessage, type Snapshot } from "@/shared/protocol";
import { apply, freshState, step, toSnapshot } from "@/server/sim/rules";
import type { RunState } from "@/server/sim/state";
import type { RunStore } from "@/server/store/memory";

const HELLO_WAIT_MS = 5_000;
const FRAME_LIMIT = 1024;

export type SessionNotice =
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "close"; code: number };

export function createSession(input: { store: RunStore; openedAt: number }) {
  let state: RunState | null = null;
  let closed: number | null = null;

  function close(code: number): SessionNotice[] {
    if (closed !== null) return [];
    closed = code;
    return [{ type: "close", code }];
  }

  return {
    async receive(raw: string, now: number): Promise<SessionNotice[]> {
      if (closed !== null) return [];
      if (Buffer.byteLength(raw) > FRAME_LIMIT) return [];
      if (!state) {
        if (now >= input.openedAt + HELLO_WAIT_MS) return close(4002);
        const message = parseClientMessage(raw);
        if (!message || message.type !== "hello") return [];
        const activated = await input.store.activate({
          runId: message.runId,
          token: message.token,
          now,
        });
        if (activated !== "ok") return close(4001);
        state = freshState(message.runId, now);
        return [{ type: "snapshot", snapshot: toSnapshot(state) }];
      }
      const message = parseClientMessage(raw);
      if (!message || message.type === "hello") return [];
      apply(state, message, now);
      return [];
    },

    tick(now: number): SessionNotice[] {
      if (closed !== null) return [];
      if (!state) {
        if (now >= input.openedAt + HELLO_WAIT_MS) return close(4002);
        return [];
      }
      return [{ type: "snapshot", snapshot: step(state, now) }];
    },

    async disconnect(now: number): Promise<void> {
      if (!state) return;
      const current = state;
      state = null;
      await input.store.finish({
        runId: current.runId,
        simMs: current.simMs,
        kills: current.player.kills,
        level: current.player.level,
        reason: "disconnect",
        now,
      });
    },
  };
}
