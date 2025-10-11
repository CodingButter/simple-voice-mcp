/**
 * Chat message bubble component (Messenger-style)
 * Supports collapsible actions section for assistant messages
 */

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/hooks/useWebSocket";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const isAssistant = message.role === "assistant";
  const hasActions = message.actions && message.actions.length > 0;

  return (
    <div
      className={cn(
        "flex w-full mb-3",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      <div className={cn("max-w-[70%] flex flex-col", isAssistant ? "items-start" : "items-end")}>
        {/* Message bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2 break-words",
            isAssistant
              ? "bg-muted text-foreground rounded-tl-none"
              : "bg-primary text-primary-foreground rounded-tr-none"
          )}
        >
          {message.text || <span className="text-muted-foreground italic">Audio response</span>}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground mt-1 px-2">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>

        {/* Actions section (collapsible) */}
        {hasActions && (
          <div className="w-full mt-2">
            <button
              onClick={() => setActionsExpanded(!actionsExpanded)}
              className={cn(
                "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground",
                "transition-colors px-2 py-1 rounded",
                "hover:bg-muted/50"
              )}
            >
              {actionsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>
                {actionsExpanded ? "Hide" : "Show"} actions ({message.actions?.length})
              </span>
            </button>

            {actionsExpanded && (
              <div className="mt-2 space-y-1">
                {message.actions?.map((action, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "text-xs px-3 py-2 rounded-lg",
                      "bg-muted/50 text-muted-foreground",
                      "border border-border"
                    )}
                  >
                    <span className="font-mono">{action}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
