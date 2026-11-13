import { upgradeWebSocket } from "@vercel/functions";

import { attachRunSocket } from "@/server/attach";

export const runtime = "nodejs";
export const maxDuration = 300;

export function GET(): Promise<Response> {
  return upgradeWebSocket((ws) => {
    attachRunSocket(ws);
  });
}
