// Seed the authoritative PMIST course catalogue into the database.
// Usage: bun scripts/seed-courses.ts   (run from the project root; bun auto-loads .env)
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import path from "path";

async function main() {
  const filePath = path.join(process.cwd(), "src", "lib", "pmist", "data", "courses.json");
  const file = JSON.parse(readFileSync(filePath, "utf-8")) as {
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
  };

  const prisma = new PrismaClient();
  let seeded = 0;
  for (const c of file.courses) {
    const exists = await prisma.course.findUnique({ where: { code: c.code } });
    if (exists) continue;
    await prisma.course.create({
      data: {
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
      },
    });
    seeded++;
  }
  const total = await prisma.course.count();
  console.log(`Seeded ${seeded} new courses. Total in DB: ${total}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
