import { NextRequest, NextResponse } from "next/server";
import { handleChat } from "@/lib/pmist/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { sessionId?: string; message?: string };
    const sessionId = String(body.sessionId ?? "").slice(0, 80);
    const message = String(body.message ?? "");
    if (!sessionId || !message.trim()) {
      return NextResponse.json({ error: "sessionId and message are required" }, { status: 400 });
    }
    const result = await handleChat(sessionId, message);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/chat] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat processing failed" },
      { status: 500 }
    );
  }
}
