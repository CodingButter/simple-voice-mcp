/**
 * MCP Tool implementations
 * These tools are exposed to the LLM through the MCP protocol
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { WebSocketManager } from "../server/websocket.js";
import type { TTSManager } from "../server/tts.js";

// TODO: Implement queue for listen() tool (single client mode)
const listenQueue: Array<{ resolve: (value: string[]) => void }> = [];

// TODO: Message accumulation buffer - stores all messages since last listen
const messageBuffer: string[] = [];

export function registerTools(
  server: Server,
  wsManager: WebSocketManager,
  ttsManager: TTSManager
) {
  // Register tools list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "speak",
          description: "Generate and stream text-to-speech audio to the connected client. The audio will be played in the client's browser. Optionally wait for user response after speaking.",
          inputSchema: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "The text to convert to speech",
              },
              listen: {
                type: "boolean",
                description: "If true, wait for user input after speaking and return their response. Use this when asking questions or having a conversation. If false or omitted, returns immediately.",
              },
              timeout_ms: {
                type: "number",
                description: "Timeout in milliseconds when listen=true (default: 60000)",
              },
              voiceId: {
                type: "string",
                description: "Optional ElevenLabs voice ID (defaults to Rachel)",
              },
              modelId: {
                type: "string",
                description: "Optional ElevenLabs model ID (defaults to eleven_flash_v2_5)",
              },
            },
            required: ["text"],
          },
        },
        {
          name: "listen",
          description: "Wait for text input from the connected client. This will block until the user sends text via the UI. Returns all messages received since the last listen call, so if the user sent multiple messages while you were working, you'll see all of them.",
          inputSchema: {
            type: "object",
            properties: {
              timeout_ms: {
                type: "number",
                description: "Timeout in milliseconds (default: 60000)",
              },
            },
            required: [],
          },
        },
        {
          name: "action",
          description: "Send ONLY concrete actions being performed to the client UI (e.g., 'Reading file X', 'Building project', 'Analyzing code'). This appears as a collapsible section in the chat. DO NOT use this for commentary, explanations, or observations - those should be spoken with speak(). Only use action() to show what you are actively doing while working on a task.",
          inputSchema: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "The specific action being performed (e.g., 'Reading useWebSocket.ts', 'Running build command', 'Fixing audio scheduling')",
              },
            },
            required: ["text"],
          },
        },
      ],
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "speak": {
        const { text, listen, timeout_ms, voiceId, modelId } = args as {
          text: string;
          listen?: boolean;
          timeout_ms?: number;
          voiceId?: string;
          modelId?: string;
        };

        console.error("[speak] Called with text length:", text.length, "listen:", listen);

        if (!wsManager.isConnected()) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ ok: false, error: "No client connected" }),
              },
            ],
            isError: true,
          };
        }

        try {
          // Send the text to the client first (for display in chat)
          wsManager.send({
            type: "text",
            text,
          });

          // Then stream the audio
          await ttsManager.streamAudio(text, { voiceId, modelId });

          // If listen is true, wait for user response
          if (listen) {
            const timeout = timeout_ms || 60000;
            console.error("[speak] Waiting for user response (listen=true)");

            try {
              const messages = await waitForClientInput(timeout);

              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      ok: true,
                      message: "Audio streamed successfully",
                      messages // Return all accumulated messages
                    }),
                  },
                ],
              };
            } catch (error) {
              // Timeout is not an error - return empty messages array
              console.error("[speak] Listen timeout - no messages received");
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      ok: true,
                      message: "Audio streamed successfully",
                      messages: [] // Empty array on timeout
                    }),
                  },
                ],
              };
            }
          }

          // Normal speak without listen
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ ok: true, message: "Audio streamed successfully" }),
              },
            ],
          };
        } catch (error) {
          console.error("[speak] Error:", error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ ok: false, error: String(error) }),
              },
            ],
            isError: true,
          };
        }
      }

      case "listen": {
        const { timeout_ms } = args as {
          timeout_ms?: number;
        };

        const timeout = timeout_ms || 60000; // Default 60s timeout

        console.error("[listen] Waiting for input from client");

        if (!wsManager.isConnected()) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "No client connected" }),
              },
            ],
            isError: true,
          };
        }

        try {
          const messages = await waitForClientInput(timeout);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ messages }),
              },
            ],
          };
        } catch (error) {
          // Timeout is not an error - just return empty messages array
          console.error("[listen] Timeout - no messages received");
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ messages: [] }),
              },
            ],
          };
        }
      }

      case "action": {
        const { text } = args as {
          text: string;
        };

        console.error("[action] Sending action:", text);

        if (!wsManager.isConnected()) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ ok: false, error: "No client connected" }),
              },
            ],
            isError: true,
          };
        }

        try {
          wsManager.send({
            type: "action",
            text,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ ok: true }),
              },
            ],
          };
        } catch (error) {
          console.error("[action] Error:", error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ ok: false, error: String(error) }),
              },
            ],
            isError: true,
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
}

// TODO: Helper to wait for client input with timeout
// Returns all messages accumulated since last listen call
async function waitForClientInput(timeout: number): Promise<string[]> {
  // Check if there are already buffered messages
  if (messageBuffer.length > 0) {
    console.error("[waitForClientInput] Returning buffered messages:", messageBuffer.length);
    const messages = [...messageBuffer];
    messageBuffer.length = 0; // Clear buffer
    return messages;
  }

  // No buffered messages, wait for new input
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      // Remove from queue on timeout
      const index = listenQueue.findIndex((item) => item.resolve === resolve);
      if (index !== -1) {
        listenQueue.splice(index, 1);
      }
      reject(new Error("Timeout waiting for client input"));
    }, timeout);

    // Add to queue
    listenQueue.push({
      resolve: (messages: string[]) => {
        clearTimeout(timeoutId);
        resolve(messages);
      },
    });
  });
}

// TODO: Called by HTTP endpoint when client submits text
export function pushClientInput(text: string) {
  console.error("[pushClientInput] Text:", text);

  // Always accumulate the message in the buffer
  messageBuffer.push(text);
  console.error("[pushClientInput] Message buffer size:", messageBuffer.length);

  if (listenQueue.length === 0) {
    console.error("[pushClientInput] No pending listen() call - message buffered");
    return false;
  }

  // Resolve the first pending listen() call with ALL accumulated messages
  const item = listenQueue.shift()!;
  const messages = [...messageBuffer]; // Copy all messages
  messageBuffer.length = 0; // Clear buffer
  console.error("[pushClientInput] Resolving with", messages.length, "messages");
  item.resolve(messages);
  return true;
}
