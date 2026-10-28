import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { sessionId?: string };
    const sessionId = String(body.sessionId ?? "").slice(0, 80);
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    // Privacy: restart clears the temporary conversation context
    await db.chatMessage.deleteMany({ where: { sessionId } });
    await db.studentProfile.deleteMany({ where: { sessionId } });

    // Opportunistic cleanup of sessions idle for over 24h (privacy hygiene)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stale = await db.studentProfile.findMany({
      where: { updatedAt: { lt: cutoff } },
      select: { sessionId: true },
    });
    if (stale.length > 0) {
      const ids = stale.map((s) => s.sessionId);
      await db.chatMessage.deleteMany({ where: { sessionId: { in: ids } } });
      await db.studentProfile.deleteMany({ where: { sessionId: { in: ids } } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/session/reset] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reset failed" },
      { status: 500 }
    );
  }
}
