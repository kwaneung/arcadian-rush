import { describe, expect, it } from "vitest";

import { createMemoryStore } from "@/server/store/memory";

describe("memory store", () => {
  it("rejects a second activate and an expired token", async () => {
    const store = createMemoryStore();
    const issued = await store.issue({ now: 0, ipHash: "hash" });
    if (!issued.ok) throw new Error("expected issue");
    expect(await store.activate({ runId: issued.runId, token: issued.token, now: 30_000 })).toBe("ok");
    expect(await store.activate({ runId: issued.runId, token: issued.token, now: 30_000 })).toBe("reject");

    const expired = await store.issue({ now: 0, ipHash: "other" });
    if (!expired.ok) throw new Error("expected issue");
    expect(await store.activate({ runId: expired.runId, token: expired.token, now: 30_001 })).toBe("reject");
  });

  it("rate limits five issues inside the open window and ignores the boundary", async () => {
    const store = createMemoryStore();
    const now = 60_000;
    const boundary = await store.issue({ now: 0, ipHash: "hash" });
    expect(boundary.ok).toBe(true);
    for (let count = 0; count < 5; count += 1) {
      const issued = await store.issue({ now, ipHash: "hash" });
      expect(issued.ok).toBe(true);
    }
    expect(await store.issue({ now, ipHash: "hash" })).toEqual({ ok: false, error: "rate" });
    expect(await store.board({ limit: 20 })).toEqual([]);
  });

  it("returns unrecorded and then missing after finish", async () => {
    const store = createMemoryStore();
    const issued = await store.issue({ now: 0, ipHash: "hash" });
    if (!issued.ok) throw new Error("expected issue");
    await store.activate({ runId: issued.runId, token: issued.token, now: 0 });
    expect(
      await store.finish({
        runId: issued.runId,
        simMs: 0,
        kills: 0,
        level: 1,
        reason: "disconnect",
        now: 1,
      }),
    ).toBe("unrecorded");
    expect(
      await store.finish({
        runId: issued.runId,
        simMs: 0,
        kills: 0,
        level: 1,
        reason: "disconnect",
        now: 2,
      }),
    ).toBe("unrecorded");
    expect(await store.read(issued.runId)).toEqual({ status: "missing" });
  });
});
