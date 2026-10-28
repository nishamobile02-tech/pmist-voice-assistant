// Sync the authoritative PMIST course catalogue (official working inventory)
// into the database. Idempotent: upserts every course from courses.json and
// removes stale rows. Usage: bun scripts/seed-courses.ts  (bun auto-loads .env)
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import path from "path";

interface CourseJson {
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
}

async function main() {
  const filePath = path.join(process.cwd(), "src", "lib", "pmist", "data", "courses.json");
  const file = JSON.parse(readFileSync(filePath, "utf-8")) as { courses: CourseJson[] };

  const prisma = new PrismaClient();

  const toRow = (c: CourseJson) => ({
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
    isPlaceholder: false, // official PMIST working inventory
  });

  let upserted = 0;
  for (const c of file.courses) {
    await prisma.course.upsert({
      where: { code: c.code },
      create: toRow(c),
      update: toRow(c),
    });
    upserted++;
  }

  // Remove courses that are no longer part of the official catalogue
  const officialCodes = new Set(file.courses.map((c) => c.code));
  const stale = await prisma.course.findMany({
    where: { code: { notIn: [...officialCodes] } },
    select: { code: true, name: true },
  });
  for (const s of stale) {
    await prisma.course.delete({ where: { code: s.code } });
  }

  const total = await prisma.course.count();
  const placeholders = await prisma.course.count({ where: { isPlaceholder: true } });
  console.log(
    `Synced ${upserted} official courses (removed ${stale.length} stale). Total in DB: ${total}, placeholders remaining: ${placeholders}`
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
