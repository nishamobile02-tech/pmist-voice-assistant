"use client";

// ChatWindow — scrollable conversation log with auto-scroll and status strip.
import { useEffect, useRef } from "react";

import { MessageBubble, type ChatMessage } from "@/components/pmist/MessageBubble";
import { StatusPill, type ChatStatus } from "@/components/pmist/StatusPill";

interface ChatWindowProps {
  messages: ChatMessage[];
  status: ChatStatus;
}

export function ChatWindow({ messages, status }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  return (
    <main
      role="log"
      aria-live="polite"
      aria-label="Conversation"
      className="flex h-[calc(100dvh-11.5rem)] min-h-[400px] flex-col overflow-hidden rounded-xl border border-[#E8E0D4] bg-[#FDFBF7] shadow-sm"
    >
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto p-4 [scrollbar-color:#fda4af_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-rose-300 [&::-webkit-scrollbar]:w-1.5"
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
      <div className="border-t border-[#EFE7DA] bg-white/70 px-4 py-2">
        <StatusPill status={status} />
      </div>
    </main>
  );
}
