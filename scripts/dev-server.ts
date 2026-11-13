import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parse } from "node:url";

import next from "next";
import { WebSocketServer } from "ws";

import { attachRunSocket } from "../src/server/attach";

const hostname = "127.0.0.1";
const port = 3000;

async function main(): Promise<void> {
  const app = next({ dev: true, hostname, port });
  await app.prepare();
  const handle = app.getRequestHandler();
  const sockets = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  const server = createServer((request, response) => {
    void serve(request, response);
  });

  server.prependListener("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname !== "/api/runs/socket") return;
    const originalEnd = socket.end.bind(socket);
    socket.end = (() => socket) as typeof socket.end;
    sockets.handleUpgrade(request, socket, head, (ws) => {
      attachRunSocket(ws);
      process.nextTick(() => {
        socket.end = originalEnd;
      });
    });
  });

  async function serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname === "/api/runs/socket") {
      response.writeHead(426).end();
      return;
    }
    const parsed = parse(request.url ?? "", true);
    await handle(request, response, parsed);
  }

  server.requestTimeout = 0;
  server.headersTimeout = 0;
  server.timeout = 0;
  server.listen(port, hostname, () => {
    console.log(`http://${hostname}:${port}`);
  });
}

void main();
