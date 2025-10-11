/**
 * Standalone action group component
 * Displays real-time actions as a collapsible section
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionGroup as ActionGroupType } from "@/hooks/useWebSocket";

interface ActionGroupProps {
  actionGroup: ActionGroupType;
  onToggle: (groupId: string) => void;
}

export function ActionGroup({ actionGroup, onToggle }: ActionGroupProps) {
  return (
    <div className="flex w-full mb-3 justify-start">
      <div className="max-w-[70%] flex flex-col items-start">
        {/* Collapsible header */}
        <button
          onClick={() => onToggle(actionGroup.id)}
          className={cn(
            "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground",
            "transition-colors px-3 py-2 rounded-lg",
            "hover:bg-muted/50 bg-muted/30 border border-border/50"
          )}
        >
          {actionGroup.isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <span className="font-medium">
            {actionGroup.isExpanded ? "Hide" : "Show"} actions ({actionGroup.actions.length})
          </span>
        </button>

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground mt-1 px-2">
          {new Date(actionGroup.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>

        {/* Actions list */}
        {actionGroup.isExpanded && (
          <div className="mt-2 space-y-1 w-full">
            {actionGroup.actions.map((action, idx) => (
              <div
                key={idx}
                className={cn(
                  "text-xs px-3 py-2 rounded-lg",
                  "bg-muted/50 text-muted-foreground",
                  "border border-border/50"
                )}
              >
                <span className="font-mono">{action}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
