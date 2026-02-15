import React from "react";
import type { SessionMetadata } from "../types";
import { formatTime } from "../utils";

interface HistorySidebarProps {
  sessions: SessionMetadata[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onClose: () => void;
}

export function HistorySidebar({
  sessions,
  currentId,
  onSelect,
  onDelete,
  onClose,
}: HistorySidebarProps) {
  return (
    <div className="absolute top-0 left-0 bottom-0 w-[260px] bg-bg-primary border-r border-border z-10 flex flex-col animate-slide-right shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-[12px] font-bold text-text-secondary uppercase tracking-[0.5px] m-0">History</h3>
        <button 
          onClick={onClose} 
          className="w-[28px] h-[28px] p-0 bg-transparent text-text-tertiary rounded-lg flex items-center justify-center transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-xs p-5 text-center">
             No past chats
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className={`flex items-center justify-between px-3 py-2.5 mb-0.5 rounded-lg cursor-pointer transition-all text-left border border-transparent group ${
                s.id === currentId 
                  ? "bg-accent-primary/5 border-accent-primary/20" 
                  : "hover:bg-bg-hover"
              }`}
              onClick={() => onSelect(s.id)}
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="text-[length:var(--font-size-base)] text-text-primary whitespace-nowrap overflow-hidden text-ellipsis mb-0.5 font-medium">
                   {s.title || "New Chat"}
                </div>
                <div className="text-[length:var(--font-size-xxs)] text-text-tertiary">
                   {formatTime(s.updatedAt)}
                </div>
              </div>
              <button
                className="w-6 h-6 border-none bg-transparent text-text-tertiary rounded-lg flex items-center justify-center cursor-pointer opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500"
                onClick={(e) => onDelete(s.id, e)}
                title="Delete chat"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
