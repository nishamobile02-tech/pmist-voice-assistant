import { NextResponse } from "next/server";
import { getAllCourses, getCoursesVerifiedFlag } from "@/lib/pmist/course-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const courses = await getAllCourses();
    const verified = await getCoursesVerifiedFlag();
    return NextResponse.json({
      courses: courses.map((c) => ({
        code: c.code,
        name: c.name,
        level: c.level,
        stream: c.stream,
        duration: c.duration,
        description: c.description,
        skills: c.skills,
        careers: c.careers,
        isPlaceholder: c.isPlaceholder,
      })),
      verified,
    });
  } catch (err) {
    console.error("[/api/courses] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load course catalogue" },
      { status: 500 }
    );
  }
}
