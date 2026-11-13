import "server-only";

import { createHash } from "node:crypto";

import type { RunStore } from "@/server/store/memory";

export function hashClientAddress(header: string | null): string {
  const raw = header?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(raw).digest("hex");
}

export async function issueRun(
  store: RunStore,
  now: number,
  forwardedFor: string | null,
): Promise<Response> {
  const issued = await store.issue({
    now,
    ipHash: hashClientAddress(forwardedFor),
  });
  if (!issued.ok) {
    const status = issued.error === "rate" ? 429 : 503;
    return Response.json({ error: issued.error }, { status });
  }
  return Response.json(
    {
      runId: issued.runId,
      token: issued.token,
      expiresAt: new Date(issued.expiresAt).toISOString(),
    },
    { status: 201 },
  );
}
