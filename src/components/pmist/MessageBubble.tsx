"use client";

// MessageBubble — a single chat message (user or assistant).
import { GraduationCap } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#7A1E2B] px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm sm:max-w-[75%]">
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div
        className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7A1E2B] text-white"
        aria-hidden="true"
      >
        <GraduationCap className="h-4 w-4" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-[#E8E0D4] bg-white px-4 py-2.5 text-sm leading-relaxed text-foreground shadow-sm sm:max-w-[75%]">
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
      </div>
    </div>
  );
}
