import { NextResponse } from "next/server";
import {
  getAllCourses,
  getCatalogueMeta,
  getCoursesVerifiedFlag,
} from "@/lib/pmist/course-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [courses, verified] = await Promise.all([
      getAllCourses(),
      getCoursesVerifiedFlag(),
    ]);
    const meta = getCatalogueMeta();
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
        bestSuitedFor: c.bestSuitedFor,
        isNew2026: c.isNew2026,
        association: c.association,
        isPlaceholder: c.isPlaceholder,
      })),
      verified,
      meta: {
        source: meta.source,
        academicYear: meta.academicYear,
        note: meta.note,
      },
    });
  } catch (err) {
    console.error("[/api/courses] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load course catalogue" },
      { status: 500 }
    );
  }
}
