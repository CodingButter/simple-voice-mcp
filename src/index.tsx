#!/usr/bin/env bun
/**
 * Main entry point for the Voice MCP Server
 * Starts both the MCP server (stdio) and HTTP/WebSocket server
 *
 * CRITICAL: No console.log to stdout - MCP uses it for JSON-RPC!
 * Use console.error() for all logging (goes to stderr)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketManager } from "./server/websocket.js";
import { TTSManager } from "./server/tts.js";
import { registerTools } from "./mcp/tools.js";
import { startHTTPServer } from "./server/http.js";

// Validate required environment variables
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
if (!ELEVENLABS_API_KEY) {
  console.error("[ERROR] ELEVENLABS_API_KEY environment variable is required!");
  process.exit(1);
}

// TODO: Initialize managers
const wsManager = new WebSocketManager();
const ttsManager = new TTSManager(wsManager, ELEVENLABS_API_KEY);

// TODO: Start HTTP/WebSocket server
const httpServer = await startHTTPServer(wsManager);

// TODO: Create and start MCP server
const mcpServer = new Server(
  {
    name: "voice-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {
        listChanged: true,
      },
    },
  }
);

// TODO: Register MCP tools
registerTools(mcpServer, wsManager, ttsManager);

// TODO: Connect MCP server to stdio transport
const transport = new StdioServerTransport();
mcpServer.connect(transport).then(() => {
  console.error("[MCP] Server started and connected via stdio");
}).catch((error) => {
  console.error("[MCP] Failed to start server:", error);
  process.exit(1);
});

// Handle shutdown gracefully
process.on("SIGINT", () => {
  console.error("[Shutdown] Received SIGINT, shutting down...");
  mcpServer.close();
  httpServer.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("[Shutdown] Received SIGTERM, shutting down...");
  mcpServer.close();
  httpServer.stop();
  process.exit(0);
});
