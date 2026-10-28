"use client";

// Header — sticky app bar with branding, detected-language badge and restart.
import { GraduationCap, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RestartDialog } from "@/components/pmist/RestartDialog";
import { LANGUAGE_LABEL, type Language } from "@/lib/pmist/types";

interface HeaderProps {
  language: Language;
  onRestart: () => void;
}

export function Header({ language, onRestart }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8E0D4] bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7A1E2B] text-white"
            aria-hidden="true"
          >
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight text-foreground sm:text-base">
              PMIST Admission Assistant
            </p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              Periyar Maniammai Institute of Science &amp; Technology, Thanjavur
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant="outline"
            className="border-[#7A1E2B]/30 bg-[#7A1E2B]/5 text-[#7A1E2B]"
            aria-label={`Conversation language: ${LANGUAGE_LABEL[language]}`}
          >
            {LANGUAGE_LABEL[language]}
          </Badge>
          <RestartDialog onConfirm={onRestart}>
            <Button
              variant="outline"
              size="sm"
              aria-label="Restart conversation"
              className="h-9 border-[#E8E0D4] hover:bg-[#FAF3EC] hover:text-[#7A1E2B]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Restart</span>
            </Button>
          </RestartDialog>
        </div>
      </div>
    </header>
  );
}
