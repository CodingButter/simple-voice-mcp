/**
 * WebSocket hook for connecting to the voice MCP server
 */

import { useState, useEffect, useCallback, useRef } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  actions?: string[]; // Action messages attached to this response
}

export interface ActionGroup {
  id: string;
  actions: string[];
  timestamp: number;
  isExpanded: boolean;
}

interface WSMessage {
  type: "hello" | "audio" | "text" | "action" | "info" | "error" | "rejected";
  clientId?: string;
  text?: string;
  error?: string;
  mime?: string;
  b64?: string;
}

// Helper function to strip SSML tags from text
function stripSSML(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // Remove all XML/SSML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

export function useWebSocket() {
  const [clientId, setClientId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [actionGroups, setActionGroups] = useState<ActionGroup[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [currentActions, setCurrentActions] = useState<string[]>([]);
  const [showAudioPermissionModal, setShowAudioPermissionModal] = useState(false);
  const currentActionGroupRef = useRef<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const currentAssistantMessageRef = useRef<string | null>(null);
  const userInteractedRef = useRef(false);
  const isAppendingRef = useRef(false); // Prevent concurrent appends

  // Initialize MediaSource for audio streaming
  const initMediaSource = useCallback(() => {
    if (mediaSourceRef.current) return; // Already initialized

    console.error("[Audio] Initializing MediaSource");

    // Create audio element
    const audio = new Audio();
    audio.autoplay = true; // Start playing as soon as data is available
    audioElementRef.current = audio;

    // Create MediaSource
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    audio.src = URL.createObjectURL(mediaSource);

    // Wait for MediaSource to open
    mediaSource.addEventListener("sourceopen", () => {
      console.error("[Audio] MediaSource opened");

      try {
        // Create SourceBuffer for MP3 audio
        const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
        sourceBufferRef.current = sourceBuffer;

        // When update finishes, append next chunk from queue
        sourceBuffer.addEventListener("updateend", () => {
          isAppendingRef.current = false;
          appendNextChunk();
        });

        // Start appending queued chunks
        appendNextChunk();
      } catch (error) {
        console.error("[Audio] Failed to create SourceBuffer:", error);
      }
    });

    // Handle MediaSource errors
    mediaSource.addEventListener("sourceended", () => {
      console.error("[Audio] MediaSource ended");
    });

    mediaSource.addEventListener("sourceclose", () => {
      console.error("[Audio] MediaSource closed");
    });
  }, []);

  // Append next chunk from queue to SourceBuffer
  const appendNextChunk = useCallback(() => {
    const sourceBuffer = sourceBufferRef.current;

    if (!sourceBuffer || isAppendingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    try {
      isAppendingRef.current = true;
      const chunk = audioQueueRef.current.shift()!;
      sourceBuffer.appendBuffer(chunk);
    } catch (error) {
      console.error("[Audio] Failed to append chunk:", error);
      isAppendingRef.current = false;
    }
  }, []);

  // Grant audio permission and start playback
  const grantAudioPermission = useCallback(async () => {
    userInteractedRef.current = true;
    setShowAudioPermissionModal(false);

    try {
      // Initialize MediaSource
      initMediaSource();

      // Start playing
      if (audioElementRef.current) {
        await audioElementRef.current.play();
      }
    } catch (error) {
      console.error("[Audio] Failed to grant permission:", error);
    }
  }, [initMediaSource]);

  useEffect(() => {
    return () => {
      // Cleanup MediaSource on unmount
      if (mediaSourceRef.current && mediaSourceRef.current.readyState === "open") {
        mediaSourceRef.current.endOfStream();
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = "";
      }
    };
  }, []);

  // Queue audio chunk and start appending if ready
  const queueAudioChunk = useCallback((chunk: ArrayBuffer) => {
    audioQueueRef.current.push(chunk);

    // Initialize MediaSource on first chunk if user has interacted
    if (!mediaSourceRef.current && userInteractedRef.current) {
      initMediaSource();
    } else if (!userInteractedRef.current) {
      // Show permission modal if user hasn't interacted
      setShowAudioPermissionModal(true);
    }

    // Try to append if MediaSource is ready
    appendNextChunk();
  }, [initMediaSource, appendNextChunk]);

  // WebSocket message handler
  const handleWSMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case "hello":
        console.log("[WS] Hello from server, clientId:", message.clientId);
        setIsRejected(false);
        break;

      case "rejected":
        console.error("[WS] Connection rejected:", message.error);
        setIsRejected(true);
        setIsConnected(false);
        break;

      case "text":
        // Create assistant message with the spoken text (strip SSML tags for display)
        // Always create a new message bubble for each speak() call
        if (message.text) {
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            text: stripSSML(message.text),
            timestamp: Date.now(),
            actions: currentActions.length > 0 ? [...currentActions] : undefined,
          };
          currentAssistantMessageRef.current = assistantMessage.id;
          setMessages((prev) => [...prev, assistantMessage]);
          setCurrentActions([]);
          // Reset action group for new message
          currentActionGroupRef.current = null;
        }
        break;

      case "audio":
        // Decode base64 audio and queue it for MediaSource
        if (message.b64) {
          const audioData = Uint8Array.from(atob(message.b64), (c) => c.charCodeAt(0));
          queueAudioChunk(audioData.buffer);
        }
        break;

      case "action":
        // Create or update standalone action group
        if (message.text) {
          if (currentActionGroupRef.current) {
            // Update existing action group
            setActionGroups((prev) =>
              prev.map((group) =>
                group.id === currentActionGroupRef.current
                  ? { ...group, actions: [...group.actions, message.text!] }
                  : group
              )
            );
          } else {
            // Create new action group
            const newGroup: ActionGroup = {
              id: crypto.randomUUID(),
              actions: [message.text!],
              timestamp: Date.now(),
              isExpanded: true, // Auto-expand new groups
            };
            currentActionGroupRef.current = newGroup.id;
            setActionGroups((prev) => [...prev, newGroup]);
          }
        }
        break;

      case "info":
        console.log("[WS] Info:", message.text);
        break;

      case "error":
        console.error("[WS] Error:", message.error);
        break;
    }
  }, [currentActions, queueAudioChunk]);

  // Connect to WebSocket
  useEffect(() => {
    const id = crypto.randomUUID();
    setClientId(id);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?clientId=${id}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected");
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error("[WS] Error:", error);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WSMessage;
        handleWSMessage(message);
      } catch (error) {
        console.error("[WS] Failed to parse message:", error);
      }
    };

    return () => {
      ws.close();
    };
  }, [handleWSMessage]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!clientId || !text.trim()) return;

      // Reset assistant message ref for new conversation turn
      currentAssistantMessageRef.current = null;

      // Add user message to chat
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        text: text.trim(),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // TODO: Send text to server via POST /api/listen
      try {
        const response = await fetch("/api/listen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        // TODO: After sending, attach any accumulated actions to an assistant message
        // For now, just create a placeholder assistant message
        // In reality, the LLM response would come through the WebSocket
        if (currentActions.length > 0) {
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            text: "", // Audio will be streamed
            timestamp: Date.now(),
            actions: [...currentActions],
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setCurrentActions([]);
        }
      } catch (error) {
        console.error("[API] Failed to send message:", error);
      }
    },
    [clientId, currentActions]
  );

  const toggleActionGroup = useCallback((groupId: string) => {
    setActionGroups((prev) =>
      prev.map((group) =>
        group.id === groupId ? { ...group, isExpanded: !group.isExpanded } : group
      )
    );
  }, []);

  return {
    clientId,
    messages,
    actionGroups,
    isConnected,
    isRejected,
    sendMessage,
    showAudioPermissionModal,
    grantAudioPermission,
    toggleActionGroup,
  };
}
