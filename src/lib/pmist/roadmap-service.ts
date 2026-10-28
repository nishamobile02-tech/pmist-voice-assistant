import { db } from "@/lib/db";
import { chatComplete, extractJson, type ChatTurn } from "@/lib/ai/llm";
import { toSpeechText } from "./language";
import { getCourseByCode } from "./course-store";
import type { Language, Roadmap } from "./types";

const DISCLAIMER =
  "General guidance generated from your interests — this is NOT the official PMIST syllabus, eligibility rule or admission criteria. Please confirm official details with the PMIST admissions office.";

interface RoadmapLlm {
  personalNote?: string;
  foundations?: string[];
  skills?: string[];
  projects?: string[];
  internships?: string[];
  careers?: string[];
  nextSteps?: string[];
}

function cleanList(list: unknown, fallback: string[], max = 8): string[] {
  const items = Array.isArray(list)
    ? list.map((v) => String(v).trim()).filter((v) => v.length > 1 && v.length < 120).slice(0, max)
    : [];
  return items.length > 0 ? items : fallback;
}

export async function generateRoadmap(
  sessionId: string,
  courseCode: string
): Promise<{ roadmap: Roadmap; speechText: string; language: Language }> {
  const course = await getCourseByCode(courseCode);
  if (!course) throw new Error("Course not found in the verified PMIST catalogue");

  // Pull the last few conversation turns for personalisation context
  const history = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const convo = history
    .reverse()
    .map((m) => `${m.role === "user" ? "Student" : "Assistant"}: ${m.content}`)
    .join("\n");

  const system = `You create personalised study-and-career roadmaps for prospective students of Periyar Maniammai Institute of Science and Technology (PMIST), Thanjavur.
You will be given the verified course description and a short conversation with the student.
Produce a roadmap using ONLY general, well-known guidance for this field. NEVER invent semester-wise subjects, accreditation details, fee, cutoff or placement facts.
Reply with STRICT JSON only:
{"personalNote":"1-2 warm sentences connecting THIS student's interests to the course","foundations":["..."],"skills":["..."],"projects":["..."],"internships":["..."],"careers":["..."],"nextSteps":["..."]}
Keep every list to 3-6 short items. "nextSteps" must include a gentle pointer to contact the PMIST admissions office for official details.`;

  const user = `COURSE (verified): ${course.name} (${course.level}, ${course.duration}) — ${course.description}
Skills from catalogue: ${course.skills.join("; ")}
Careers from catalogue: ${course.careers.join("; ")}

RECENT CONVERSATION:
${convo}`;

  const messages: ChatTurn[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  let llm: RoadmapLlm = {};
  try {
    const raw = await chatComplete(messages, { temperature: 0.6, json: true });
    llm = extractJson<RoadmapLlm>(raw) ?? {};
  } catch {
    llm = {}; // fall back to catalogue-only roadmap below
  }

  const roadmap: Roadmap = {
    courseCode: course.code,
    courseName: course.name,
    personalNote: llm.personalNote?.slice(0, 400),
    foundations: cleanList(llm.foundations, [
      "Strengthen your Class 11-12 basics related to this stream",
      "Build simple daily study habits around the subject you enjoy",
    ]),
    skills: cleanList(llm.skills, course.skills),
    projects: cleanList(llm.projects, [
      "One small self-study project related to this field each year",
      "A final-year style project you can demo to others",
    ]),
    internships: cleanList(llm.internships, [
      "Look for summer internships or shadowing opportunities in this field",
      "Join college clubs and workshops to practice early",
    ]),
    careers: cleanList(llm.careers, course.careers),
    nextSteps: cleanList(llm.nextSteps, [
      "Note your questions about this course",
      "Contact the PMIST admissions office for official eligibility and admission details",
    ]),
    disclaimer: DISCLAIMER,
  };

  const speechText = toSpeechText(
    roadmap.personalNote
      ? `Here is a personalised roadmap for ${course.name}. ${roadmap.personalNote} You can read the full roadmap on the screen, and the admissions office can confirm the official details.`
      : `Here is your personalised roadmap for ${course.name}. The details are on your screen, and the admissions office can confirm official information.`
  );

  // remember the language for this session's next reply
  const profile = await db.studentProfile.findUnique({ where: { sessionId } });
  const language = (profile?.language as Language) || "en";

  return { roadmap, speechText, language };
}
