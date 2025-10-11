/**
 * WebSocket Manager
 * Handles single WebSocket connection - rejects additional clients
 */

import type { ServerWebSocket } from "bun";

export interface WSMessage {
  type: "hello" | "audio" | "text" | "action" | "info" | "error" | "rejected";
  clientId?: string;
  text?: string;
  error?: string;
  mime?: string;
  b64?: string;
}

export class WebSocketManager {
  // TODO: Track single active client
  private activeClient: { id: string; ws: ServerWebSocket<{ clientId: string }> } | null = null;

  handleConnection(ws: ServerWebSocket<{ clientId: string }>, clientId: string): boolean {
    // TODO: Reject if there's already an active client
    if (this.activeClient) {
      console.error("[WS] Rejecting client, already connected:", this.activeClient.id);

      // Send rejection message
      try {
        ws.send(JSON.stringify({
          type: "rejected",
          error: "Another client is already connected. Only one connection is allowed at a time.",
        }));
      } catch (error) {
        console.error("[WS] Error sending rejection:", error);
      }

      return false;
    }

    console.error("[WS] Client connected:", clientId);
    this.activeClient = { id: clientId, ws };

    // TODO: Send hello message
    this.send({
      type: "hello",
      clientId,
    });

    return true;
  }

  handleDisconnection(clientId: string) {
    if (this.activeClient && this.activeClient.id === clientId) {
      console.error("[WS] Client disconnected:", clientId);
      this.activeClient = null;
    }
  }

  handleMessage(message: string | Buffer) {
    console.error("[WS] Message from client:", message);
    // TODO: Handle client messages if needed
  }

  send(message: WSMessage): boolean {
    if (!this.activeClient) {
      console.error("[WS] No active client");
      return false;
    }

    try {
      this.activeClient.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("[WS] Error sending to client:", error);
      return false;
    }
  }

  isConnected(): boolean {
    return this.activeClient !== null;
  }

  getClientId(): string | null {
    return this.activeClient ? this.activeClient.id : null;
  }
}
