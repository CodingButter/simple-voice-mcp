/**
 * HTTP Server with WebSocket support
 * Serves the React UI and handles WebSocket connections for audio streaming
 */

import { serve, type ServerWebSocket } from "bun";
import index from "../index.html";
import { WebSocketManager } from "./websocket.js";
import { pushClientInput } from "../mcp/tools.js";

export function startHTTPServer(wsManager: WebSocketManager) {
  const port = parseInt(process.env.MCP_HTTP_PORT || "3000");

  const server = serve({
    port,
    routes: {
      // Serve React app
      "/*": index,

      // WebSocket endpoint
      "/ws": {
        async GET(req) {
          // TODO: Extract clientId from query params
          const url = new URL(req.url);
          const clientId = url.searchParams.get("clientId") || crypto.randomUUID();

          // Upgrade to WebSocket
          const success = server.upgrade(req, {
            data: { clientId },
          });

          if (!success) {
            return new Response("WebSocket upgrade failed", { status: 400 });
          }

          return undefined; // Connection upgraded
        },
      },

      // API endpoint: receive text input from client
      "/api/listen": {
        async POST(req) {
          try {
            const body = (await req.json()) as { text: string };

            if (!body.text) {
              return Response.json({ error: "Missing text" }, { status: 400 });
            }

            // TODO: Push text into listen queue
            const success = pushClientInput(body.text);

            if (success) {
              return Response.json({ ok: true });
            } else {
              return Response.json({ error: "No pending listen() call" }, { status: 400 });
            }
          } catch (error) {
            console.error("[API] Error in /api/listen:", error);
            return Response.json({ error: String(error) }, { status: 500 });
          }
        },
      },
    },

    // WebSocket handlers
    websocket: {
      open(ws: ServerWebSocket<{ clientId: string }>) {
        const { clientId } = ws.data;
        const accepted = wsManager.handleConnection(ws, clientId);

        // TODO: Close connection if rejected
        if (!accepted) {
          ws.close(1008, "Another client is already connected");
        }
      },

      message(ws: ServerWebSocket<{ clientId: string }>, message: string | Buffer) {
        wsManager.handleMessage(message);
      },

      close(ws: ServerWebSocket<{ clientId: string }>) {
        const { clientId } = ws.data;
        wsManager.handleDisconnection(clientId);
      },
    },

    development:
      process.env.NODE_ENV !== "production"
        ? {
            hmr: true,
            console: true,
          }
        : undefined,
  });

  console.error(`[HTTP] Server running at ${server.url}`);
  console.error(`[HTTP] WebSocket endpoint: ws://localhost:${port}/ws`);

  return server;
}
