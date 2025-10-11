/**
 * Main chat interface component
 * Integrates WebSocket, Speech Recognition, and message display
 */

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send, Settings, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSpeechRecognition, type RecognitionMode } from "@/hooks/useSpeechRecognition";
import { ChatMessage } from "./ChatMessage";
import { ActionGroup } from "./ActionGroup";

export function ChatInterface() {
  const [inputText, setInputText] = useState("");
  const [recognitionMode, setRecognitionMode] = useState<RecognitionMode>(() => {
    return (localStorage.getItem("recognitionMode") as RecognitionMode) || "manual";
  });
  const [showSettings, setShowSettings] = useState(false);
  const [pttKey, setPttKey] = useState<string>(() => {
    return localStorage.getItem("pttKey") || " "; // Default: spacebar
  });
  const [autoDelay, setAutoDelay] = useState<number>(() => {
    return parseInt(localStorage.getItem("autoDelay") || "1500");
  });
  const [isCapturingKey, setIsCapturingKey] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isPttKeyPressedRef = useRef(false);

  // Initialize WebSocket connection
  const { clientId, messages, actionGroups, isConnected, isRejected, sendMessage, showAudioPermissionModal, grantAudioPermission, toggleActionGroup } = useWebSocket();

  // TODO: Initialize Speech Recognition with callbacks
  const {
    isListening,
    isSpeaking,
    transcript,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
    sendTranscript,
    setTranscript,
  } = useSpeechRecognition({
    onResult: (text) => {
      sendMessage(text);
      // Immediately clear input after sending
      setInputText("");
      setTranscript("");
    },
  }, recognitionMode, autoDelay);

  // TODO: Auto-scroll to bottom when new messages or actions arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, actionGroups]);

  // TODO: Additional scroll observer for dynamic content height changes
  useEffect(() => {
    const messagesContainer = messagesEndRef.current?.parentElement;
    if (!messagesContainer) return;

    // Create a MutationObserver to watch for content changes
    const observer = new MutationObserver(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    // Observe changes to the messages container
    observer.observe(messagesContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  // TODO: Always show transcript in input field (live text display)
  useEffect(() => {
    setInputText(transcript);
  }, [transcript]);

  // TODO: Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem("recognitionMode", recognitionMode);
  }, [recognitionMode]);

  useEffect(() => {
    localStorage.setItem("pttKey", pttKey);
  }, [pttKey]);

  useEffect(() => {
    localStorage.setItem("autoDelay", autoDelay.toString());
  }, [autoDelay]);

  // TODO: Keyboard PTT support
  useEffect(() => {
    if (recognitionMode !== "ptt" || !isSpeechSupported) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input field or capturing key
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (isCapturingKey) return;

      // Check if it's the PTT key
      if (e.key === pttKey && !isPttKeyPressedRef.current) {
        e.preventDefault();
        isPttKeyPressedRef.current = true;
        startListening();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Ignore if capturing key
      if (isCapturingKey) return;

      // Check if it's the PTT key
      if (e.key === pttKey && isPttKeyPressedRef.current) {
        e.preventDefault();
        isPttKeyPressedRef.current = false;
        stopListening();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [recognitionMode, pttKey, isSpeechSupported, startListening, stopListening, isCapturingKey]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    sendMessage(inputText);
    setInputText("");
    setTranscript("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleMicrophone = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleKeyCapture = (e: React.KeyboardEvent) => {
    if (!isCapturingKey) return;
    e.preventDefault();
    setPttKey(e.key);
    setIsCapturingKey(false);
  };

  const getKeyDisplayName = (key: string) => {
    if (key === " ") return "Space";
    if (key === "Control") return "Ctrl";
    if (key === "Shift") return "Shift";
    if (key === "Alt") return "Alt";
    if (key === "Meta") return "Cmd/Win";
    return key.toUpperCase();
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 md:px-8 lg:px-12 py-3 flex items-center justify-between w-full">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold">Voice MCP Chat</h1>
          <p className="text-sm text-muted-foreground truncate">
            {isRejected ? (
              <>
                <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-2" />
                Connection Rejected - Another client is connected
              </>
            ) : isConnected ? (
              <>
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                Connected
              </>
            ) : (
              <>
                <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2" />
                Disconnected
              </>
            )}
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSettings(!showSettings)}
          className="shrink-0"
        >
          <Settings size={20} />
        </Button>
      </div>

      {/* Rejection Warning */}
      {isRejected && (
        <div className="mx-4 md:mx-8 lg:mx-12 mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive font-medium">
            ⚠️ Connection Rejected
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Another client is already connected. Only one connection is allowed at a time. Please close the other connection and refresh this page.
          </p>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <Card className="mx-4 md:mx-8 lg:mx-12 my-4 p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Recognition Mode</label>
            <Select
              value={recognitionMode}
              onValueChange={(value) => setRecognitionMode(value as RecognitionMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">
                  Manual - Click send button
                </SelectItem>
                <SelectItem value="ptt">PTT - Hold to speak</SelectItem>
                <SelectItem value="auto">Auto - Sends after silence</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {recognitionMode === "manual" && "Click mic to record, then click send"}
              {recognitionMode === "ptt" && "Hold mic button or press key while speaking"}
              {recognitionMode === "auto" && `Automatically sends after ${(autoDelay / 1000).toFixed(1)}s of silence`}
            </p>
          </div>

          {/* PTT Key Configuration */}
          {recognitionMode === "ptt" && (
            <div>
              <label className="text-sm font-medium mb-2 block">PTT Keyboard Key</label>
              <Button
                variant={isCapturingKey ? "default" : "outline"}
                onClick={() => setIsCapturingKey(true)}
                onKeyDown={handleKeyCapture}
                className="w-full"
              >
                {isCapturingKey ? "Press any key..." : `Key: ${getKeyDisplayName(pttKey)}`}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Click the button and press a key to set as PTT hotkey
              </p>
            </div>
          )}

          {/* Auto Delay Configuration */}
          {recognitionMode === "auto" && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Auto-Send Delay: {(autoDelay / 1000).toFixed(1)}s
              </label>
              <input
                type="range"
                min="500"
                max="5000"
                step="100"
                value={autoDelay}
                onChange={(e) => setAutoDelay(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0.5s</span>
                <span>5.0s</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Time to wait after you stop speaking before sending
              </p>
            </div>
          )}

          {!isSpeechSupported && (
            <div className="text-sm text-destructive">
              ⚠️ Web Speech API not supported in this browser
            </div>
          )}
        </Card>
      )}

      {/* Audio Permission Modal */}
      {showAudioPermissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="mx-4 p-6 max-w-md w-full space-y-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Volume2 className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold">Enable Audio Playback</h2>
                <p className="text-sm text-muted-foreground">
                  Your browser requires permission to play audio
                </p>
              </div>
            </div>
            <p className="text-sm">
              To hear voice responses, please click the button below. This is required by your browser's autoplay policy.
            </p>
            <Button
              onClick={grantAudioPermission}
              className="w-full"
              size="lg"
            >
              Allow Audio
            </Button>
          </Card>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-4 w-full">
        <div className="space-y-2">
          {messages.length === 0 && actionGroups.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center space-y-2">
                <p className="text-lg">No messages yet</p>
                <p className="text-sm">Start a conversation by speaking or typing</p>
              </div>
            </div>
          ) : (
            // Merge messages and action groups, sort by timestamp
            [...messages.map(m => ({ type: 'message' as const, item: m, timestamp: m.timestamp })),
             ...actionGroups.map(a => ({ type: 'action' as const, item: a, timestamp: a.timestamp }))]
              .sort((a, b) => a.timestamp - b.timestamp)
              .map((entry) =>
                entry.type === 'message' ? (
                  <ChatMessage key={entry.item.id} message={entry.item} />
                ) : (
                  <ActionGroup key={entry.item.id} actionGroup={entry.item} onToggle={toggleActionGroup} />
                )
              )
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-card px-4 md:px-8 lg:px-12 py-3 w-full">
        <div className="flex items-end gap-2">
          {/* Microphone Button */}
          <Button
            variant={isListening ? "destructive" : "outline"}
            size="icon"
            onClick={recognitionMode === "manual" ? toggleMicrophone : undefined}
            onMouseDown={recognitionMode === "ptt" ? startListening : undefined}
            onMouseUp={recognitionMode === "ptt" ? stopListening : undefined}
            onTouchStart={recognitionMode === "ptt" ? startListening : undefined}
            onTouchEnd={recognitionMode === "ptt" ? stopListening : undefined}
            disabled={!isSpeechSupported || recognitionMode === "auto"}
            className={cn(
              "shrink-0",
              isListening && "animate-pulse",
              recognitionMode === "auto" && "opacity-50 cursor-not-allowed"
            )}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </Button>

          {/* Text Input */}
          <div className="flex-1">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={
                recognitionMode === "auto"
                  ? "Auto mode active - just speak..."
                  : recognitionMode === "ptt"
                    ? `Hold mic or press ${getKeyDisplayName(pttKey)} to speak...`
                    : "Type a message or use the microphone..."
              }
              className="resize-none"
              disabled={recognitionMode === "auto"}
            />
            {/* Voice Recognition Status */}
            {isListening && (
              <p className="text-xs text-muted-foreground mt-1">
                {isSpeaking ? (
                  <span className="text-primary">🎤 Speaking detected...</span>
                ) : (
                  <span>
                    {recognitionMode === "manual" && "🎤 Listening... (click mic again to stop)"}
                    {recognitionMode === "ptt" && `🎤 Listening... (release ${getKeyDisplayName(pttKey)} to send)`}
                    {recognitionMode === "auto" && `🎤 Listening... (will send after ${(autoDelay / 1000).toFixed(1)}s silence)`}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Send Button */}
          <Button
            onClick={recognitionMode === "manual" && isListening ? sendTranscript : handleSendMessage}
            disabled={!inputText.trim() || !isConnected}
            className="shrink-0"
          >
            <Send size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
}
