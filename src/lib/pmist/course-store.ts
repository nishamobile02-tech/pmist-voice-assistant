import { db } from "@/lib/db";
import { readFileSync } from "fs";
import path from "path";
import type { CourseSummary } from "./types";

export interface CourseRecord extends CourseSummary {
  interests: string[];
}

interface CourseFile {
  meta: { verified: boolean; note: string };
  courses: Array<{
    code: string;
    name: string;
    level: string;
    stream: string;
    duration: string;
    description: string;
    interests: string[];
    skills: string[];
    careers: string[];
  }>;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toRecord(row: {
  code: string;
  name: string;
  level: string;
  stream: string;
  duration: string;
  description: string;
  interests: string;
  skills: string;
  careers: string;
  isPlaceholder: boolean;
}): CourseRecord {
  return {
    code: row.code,
    name: row.name,
    level: row.level,
    stream: row.stream,
    duration: row.duration,
    description: row.description,
    interests: parseJsonArray(row.interests),
    skills: parseJsonArray(row.skills),
    careers: parseJsonArray(row.careers),
    isPlaceholder: row.isPlaceholder,
  };
}

/**
 * Load all courses from the authoritative DB. If the table is empty,
 * seed it once from the bundled courses.json file.
 */
export async function getAllCourses(): Promise<CourseRecord[]> {
  let rows = await db.course.findMany({ orderBy: { code: "asc" } });
  if (rows.length === 0) {
    await seedCoursesFromJson();
    rows = await db.course.findMany({ orderBy: { code: "asc" } });
  }
  return rows.map(toRecord);
}

export async function getCoursesVerifiedFlag(): Promise<boolean> {
  const anyReal = await db.course.findFirst({ where: { isPlaceholder: false } });
  return Boolean(anyReal);
}

export async function getCourseByCode(code: string): Promise<CourseRecord | null> {
  const row = await db.course.findUnique({ where: { code } });
  return row ? toRecord(row) : null;
}

/** One-time seeding from the bundled JSON catalogue (authoritative source file). */
export async function seedCoursesFromJson(): Promise<number> {
  const filePath = path.join(process.cwd(), "src", "lib", "pmist", "data", "courses.json");
  const file = JSON.parse(readFileSync(filePath, "utf-8")) as CourseFile;
  const existing = await db.course.count();
  if (existing > 0) return 0;
  await db.course.createMany({
    data: file.courses.map((c) => ({
      code: c.code,
      name: c.name,
      level: c.level,
      stream: c.stream,
      duration: c.duration,
      description: c.description,
      interests: JSON.stringify(c.interests),
      skills: JSON.stringify(c.skills),
      careers: JSON.stringify(c.careers),
      isPlaceholder: true, // placeholder until official PMIST list is verified
    })),
  });
  return file.courses.length;
}
