"use client";

// VoiceControls — sticky bottom bar with mic button, text input and send.
import { Mic, MicOff, Send, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChatStatus } from "@/components/pmist/StatusPill";

interface VoiceControlsProps {
  status: ChatStatus;
  input: string;
  onInputChange: (value: string) => void;
  onMicClick: () => void;
  onSend: () => void;
  onStopSpeaking: () => void;
}

export function VoiceControls({
  status,
  input,
  onInputChange,
  onMicClick,
  onSend,
  onStopSpeaking,
}: VoiceControlsProps) {
  const isRecording = status === "recording";
  const isBusy =
    status === "transcribing" || status === "thinking" || status === "speaking";

  return (
    <footer className="sticky bottom-0 z-40 mt-auto border-t border-[#E8E0D4] bg-white p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <form
        className="mx-auto flex w-full max-w-6xl items-center gap-2 sm:gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <Button
          type="button"
          onClick={onMicClick}
          disabled={isBusy}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
          className={cn(
            "h-14 w-14 shrink-0 rounded-full text-white",
            isRecording
              ? "animate-pulse bg-red-600 hover:bg-red-700"
              : "bg-[#7A1E2B] hover:bg-[#5F1721]",
          )}
        >
          {isRecording ? (
            <MicOff className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Mic className="h-6 w-6" aria-hidden="true" />
          )}
        </Button>

        <Input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Type your message…"
          aria-label="Type your message"
          className="h-11 min-h-11 flex-1 rounded-full border-[#E8E0D4] bg-white"
        />

        <Button
          type="submit"
          disabled={!input.trim() || isBusy}
          aria-label="Send message"
          className="h-12 w-12 shrink-0 rounded-full bg-[#7A1E2B] text-white hover:bg-[#5F1721]"
        >
          <Send className="h-5 w-5" aria-hidden="true" />
        </Button>

        {status === "speaking" && (
          <Button
            type="button"
            variant="outline"
            onClick={onStopSpeaking}
            aria-label="Stop speaking"
            className="h-12 shrink-0 rounded-full border-red-600 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Square className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </form>
    </footer>
  );
}
