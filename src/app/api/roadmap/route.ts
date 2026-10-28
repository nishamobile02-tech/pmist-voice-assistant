import { NextRequest, NextResponse } from "next/server";
import { generateRoadmap } from "@/lib/pmist/roadmap-service";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { sessionId?: string; courseCode?: string };
    const sessionId = String(body.sessionId ?? "").slice(0, 80);
    const courseCode = String(body.courseCode ?? "").slice(0, 40);
    if (!sessionId || !courseCode) {
      return NextResponse.json({ error: "sessionId and courseCode are required" }, { status: 400 });
    }
    const result = await generateRoadmap(sessionId, courseCode);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/roadmap] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Roadmap generation failed" },
      { status: 500 }
    );
  }
}
