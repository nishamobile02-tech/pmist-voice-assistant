import { db } from "@/lib/db";
import { readFileSync } from "fs";
import path from "path";
import type { CourseSummary } from "./types";

export interface CourseRecord extends CourseSummary {
  interests: string[];
  bestSuitedFor: string;
  roadmapSteps: string[];
  isNew2026: boolean;
  association: string | null;
}

interface CourseFile {
  meta: { verified: boolean; note: string; source: string; academicYear: string };
  courses: Array<{
    code: string;
    name: string;
    level: string;
    stream: string;
    duration: string;
    description: string;
    bestSuitedFor: string;
    interests: string[];
    skills: string[];
    careers: string[];
    roadmapSteps: string[];
    isNew2026?: boolean;
    association?: string;
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
  bestSuitedFor: string;
  roadmapSteps: string;
  isNew2026: boolean;
  association: string | null;
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
    bestSuitedFor: row.bestSuitedFor,
    roadmapSteps: parseJsonArray(row.roadmapSteps),
    isNew2026: row.isNew2026,
    association: row.association,
    isPlaceholder: row.isPlaceholder,
  };
}

function loadCatalogueFile(): CourseFile {
  const filePath = path.join(process.cwd(), "src", "lib", "pmist", "data", "courses.json");
  return JSON.parse(readFileSync(filePath, "utf-8")) as CourseFile;
}

function toRow(c: CourseFile["courses"][number]) {
  return {
    code: c.code,
    name: c.name,
    level: c.level,
    stream: c.stream,
    duration: c.duration,
    description: c.description,
    interests: JSON.stringify(c.interests),
    skills: JSON.stringify(c.skills),
    careers: JSON.stringify(c.careers),
    bestSuitedFor: c.bestSuitedFor ?? "",
    roadmapSteps: JSON.stringify(c.roadmapSteps ?? []),
    isNew2026: Boolean(c.isNew2026),
    association: c.association ?? null,
    isPlaceholder: false, // official PMIST working inventory (verify against 2026-27 brochure)
  };
}

/**
 * Load all courses from the authoritative DB. If the table is empty,
 * seed it once from the bundled courses.json file (official PMIST inventory).
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

export function getCatalogueMeta() {
  return loadCatalogueFile().meta;
}

/** One-time seeding from the bundled JSON catalogue (authoritative source file). */
export async function seedCoursesFromJson(): Promise<number> {
  const file = loadCatalogueFile();
  const existing = await db.course.count();
  if (existing > 0) return 0;
  await db.course.createMany({ data: file.courses.map(toRow) });
  return file.courses.length;
}

/**
 * Full sync with the bundled official catalogue (idempotent):
 * - upserts every course from courses.json (marks isPlaceholder=false)
 * - removes any DB rows that are no longer part of the official list
 * Returns { upserted, removed }.
 */
export async function syncCoursesFromJson(): Promise<{ upserted: number; removed: number }> {
  const file = loadCatalogueFile();
  const officialCodes = new Set(file.courses.map((c) => c.code));

  for (const c of file.courses) {
    await db.course.upsert({
      where: { code: c.code },
      create: toRow(c),
      update: toRow(c),
    });
  }

  const stale = await db.course.findMany({
    where: { code: { notIn: [...officialCodes] } },
    select: { code: true },
  });
  if (stale.length > 0) {
    await db.course.deleteMany({
      where: { code: { in: stale.map((s) => s.code) } },
    });
  }

  return { upserted: file.courses.length, removed: stale.length };
}
