/**
 * HTTP Server with WebSocket support
 * Serves the React UI and handles WebSocket connections for audio streaming
 */

import { serve, type ServerWebSocket, file } from "bun";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { WebSocketManager } from "./websocket.js";
import { pushClientInput } from "../mcp/tools.js";

// Determine if we're running from source or installed package
const __dirname = dirname(fileURLToPath(import.meta.url));
const isInstalled = __dirname.includes("node_modules");

export function startHTTPServer(wsManager: WebSocketManager) {
  const port = parseInt(process.env.MCP_HTTP_PORT || "3000");

  // Get dist directory path
  const distDir = isInstalled
    ? join(__dirname, "..", "..", "dist")  // From node_modules/voice-mcp/src/server
    : join(__dirname, "..", "..", "dist"); // From local src/server

  console.error(`[HTTP] Serving from dist: ${distDir}`);

  const server = serve({
    port,

    async fetch(req) {
      const url = new URL(req.url);
      const { pathname } = url;

      // WebSocket upgrade
      if (pathname === "/ws") {
        const clientId = url.searchParams.get("clientId") || crypto.randomUUID();
        const success = server.upgrade(req, {
          data: { clientId },
        });
        if (!success) {
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        return undefined;
      }

      // API endpoint: receive text input from client
      if (pathname === "/api/listen" && req.method === "POST") {
        try {
          const body = (await req.json()) as { text: string };
          if (!body.text) {
            return Response.json({ error: "Missing text" }, { status: 400 });
          }
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
      }

      // Serve static files from dist
      // Strip leading slash from pathname to avoid path.join treating it as absolute
      const cleanPath = pathname === "/" ? "index.html" : pathname.slice(1);
      const filePath = join(distDir, cleanPath);
      const distFile = file(filePath);

      if (await distFile.exists()) {
        // Determine content type based on file extension
        const ext = cleanPath.split('.').pop()?.toLowerCase();
        const contentType = ext === 'js' ? 'application/javascript' :
                          ext === 'css' ? 'text/css' :
                          ext === 'html' ? 'text/html' :
                          ext === 'svg' ? 'image/svg+xml' :
                          ext === 'json' ? 'application/json' :
                          ext === 'map' ? 'application/json' :
                          'application/octet-stream';

        return new Response(distFile, {
          headers: { 'Content-Type': contentType }
        });
      }

      // Fallback to index.html for SPA routing
      return new Response(file(join(distDir, "index.html")), {
        headers: { 'Content-Type': 'text/html' }
      });
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
