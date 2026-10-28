"use client";

// StatusPill — animated assistant status indicator.
// Hidden (screen-reader only) when the assistant is idle.
import { Loader2, Volume2 } from "lucide-react";

export type ChatStatus = "idle" | "recording" | "transcribing" | "thinking" | "speaking";

interface StatusPillProps {
  status: ChatStatus;
}

const SR_LABELS: Record<ChatStatus, string> = {
  idle: "Assistant is idle.",
  recording: "Assistant is listening. Please speak now.",
  transcribing: "Recognizing your speech.",
  thinking: "Assistant is thinking.",
  speaking: "Assistant is speaking.",
};

export function StatusPill({ status }: StatusPillProps) {
  if (status === "idle") {
    return (
      <p className="sr-only" aria-live="polite">
        {SR_LABELS.idle}
      </p>
    );
  }

  return (
    <div aria-live="polite" className="flex min-h-5 items-center gap-2">
      {status === "recording" && (
        <span className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
          </span>
          <span className="text-sm font-medium text-red-700">Listening…</span>
        </span>
      )}

      {status === "transcribing" && (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#7A1E2B]" aria-hidden="true" />
          <span className="text-sm font-medium text-muted-foreground">
            Recognizing speech…
          </span>
        </span>
      )}

      {status === "thinking" && (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#7A1E2B]" aria-hidden="true" />
          <span className="text-sm font-medium text-muted-foreground">Thinking…</span>
        </span>
      )}

      {status === "speaking" && (
        <span className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 animate-pulse text-[#7A1E2B]" aria-hidden="true" />
          <span className="text-sm font-medium text-muted-foreground">Speaking…</span>
        </span>
      )}

      <span className="sr-only">{SR_LABELS[status]}</span>
    </div>
  );
}
