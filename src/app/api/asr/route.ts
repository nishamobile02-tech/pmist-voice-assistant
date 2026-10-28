import { NextRequest, NextResponse } from "next/server";
import { transcribeBase64 } from "@/lib/ai/asr";

export const runtime = "nodejs";
export const maxDuration = 60;

// Limit uploads to ~8 MB of base64 audio (about 2-3 minutes of WAV speech)
const MAX_BASE64_LEN = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { audioBase64?: string; mime?: string };
    const audioBase64 = String(body.audioBase64 ?? "").replace(/^data:[^,]+,/, "");
    if (!audioBase64) {
      return NextResponse.json({ error: "audioBase64 is required" }, { status: 400 });
    }
    if (audioBase64.length > MAX_BASE64_LEN) {
      return NextResponse.json({ error: "Recording too long. Please keep it under 2 minutes." }, { status: 413 });
    }
    const result = await transcribeBase64(audioBase64);
    if (!result.text) {
      return NextResponse.json(
        { error: "I could not hear any speech. Please try again or type your message." },
        { status: 422 }
      );
    }
    return NextResponse.json({ text: result.text, provider: result.provider });
  } catch (err) {
    console.error("[/api/asr] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Speech recognition failed" },
      { status: 500 }
    );
  }
}
