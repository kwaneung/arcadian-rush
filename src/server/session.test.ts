import { describe, expect, it } from "vitest";

import { createSession } from "@/server/session";
import { createMemoryStore } from "@/server/store/memory";

describe("session", () => {
  it("closes 4002 when hello does not arrive within 5000ms", async () => {
    const store = createMemoryStore();
    const openedAt = 10_000;
    const session = createSession({ store, openedAt });
    expect(await session.receive(JSON.stringify({ type: "move", x: 1, y: 0 }), openedAt + 100)).toEqual([]);
    expect(session.tick(openedAt + 5_000)).toEqual([{ type: "close", code: 4002 }]);
  });

  it("closes 4001 for a rejected hello and sends no snapshot", async () => {
    const store = createMemoryStore();
    const session = createSession({ store, openedAt: 0 });
    const notices = await session.receive(
      JSON.stringify({
        type: "hello",
        runId: "00000000-0000-4000-8000-000000000099",
        token: "missing",
      }),
      0,
    );
    expect(notices).toEqual([{ type: "close", code: 4001 }]);
  });

  it("starts at the origin and does not restore a disconnected token", async () => {
    const store = createMemoryStore();
    const issued = await store.issue({ now: 0, ipHash: "hash" });
    if (!issued.ok) throw new Error("expected issue");
    const session = createSession({ store, openedAt: 0 });
    const notices = await session.receive(
      JSON.stringify({ type: "hello", runId: issued.runId, token: issued.token }),
      0,
    );
    expect(notices[0]).toMatchObject({
      type: "snapshot",
      snapshot: { player: { x: 0, y: 0, hp: 100 } },
    });
    await session.disconnect(50);
    const again = createSession({ store, openedAt: 100 });
    expect(
      await again.receive(
        JSON.stringify({ type: "hello", runId: issued.runId, token: issued.token }),
        100,
      ),
    ).toEqual([{ type: "close", code: 4001 }]);
  });
});
