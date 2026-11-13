import "server-only";

import { Buffer } from "node:buffer";
import type { RawData, WebSocket } from "ws";

import { createSession, type SessionNotice } from "@/server/session";
import { getRunStore } from "@/server/store/global";

export function attachRunSocket(ws: WebSocket, openedAt = Date.now()): void {
  const session = createSession({ store: getRunStore(), openedAt });
  let pending: string | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  function flush(): void {
    if (pending === null || ws.bufferedAmount > 0) return;
    const latest = pending;
    pending = null;
    if (ws.readyState === ws.OPEN) ws.send(latest);
  }

  function deliver(notice: SessionNotice): void {
    if (notice.type === "snapshot") {
      pending = JSON.stringify(notice.snapshot);
      flush();
      return;
    }
    if (timer) clearInterval(timer);
    ws.close(notice.code);
  }

  timer = setInterval(() => {
    for (const notice of session.tick(Date.now())) deliver(notice);
    flush();
  }, 50);

  ws.on("message", (data: RawData, isBinary: boolean) => {
    const raw = textFrame(data, isBinary);
    if (raw === null) return;
    void session.receive(raw, Date.now()).then((notices) => {
      for (const notice of notices) deliver(notice);
    });
  });

  ws.on("close", () => {
    if (timer) clearInterval(timer);
    void session.disconnect(Date.now());
  });
}

function textFrame(data: RawData, isBinary: boolean): string | null {
  if (isBinary) return null;
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return null;
}
