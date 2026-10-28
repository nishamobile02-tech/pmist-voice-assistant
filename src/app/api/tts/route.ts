import { NextRequest, NextResponse } from "next/server";
import { synthesize } from "@/lib/ai/tts";
import type { Language } from "@/lib/pmist/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: string; language?: Language };
    const text = String(body.text ?? "").trim();
    const language: Language =
      body.language === "ta" || body.language === "tanglish" ? body.language : "en";
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    if (text.length > 1200) {
      return NextResponse.json({ error: "text too long" }, { status: 413 });
    }
    const result = await synthesize(text, language);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/tts] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Speech synthesis failed" },
      { status: 500 }
    );
  }
}
