import { db } from "@/lib/db";
import { chatComplete, extractJson, type ChatTurn } from "@/lib/ai/llm";
import { toSpeechText } from "./language";
import { getCourseByCode } from "./course-store";
import type { Language, Roadmap } from "./types";

const DISCLAIMER =
  "Roadmap from the official PMIST course-career inventory (working catalogue). General guidance only — NOT the official syllabus, eligibility rule or admission criteria. Confirm every detail with the PMIST admissions office and the current 2026-27 official brochure.";

interface RoadmapLlm {
  personalNote?: string;
}

/**
 * Personalised roadmap built ON TOP of the official PMIST course-career document:
 * the 5 verified roadmap steps map positionally to the roadmap sections
 * (build foundations -> study skills -> practise/project -> internship -> explore careers),
 * so every displayed step is grounded in the supplied document, never invented.
 * The LLM contributes ONLY the warm personal note connecting this student to the course.
 */
export async function generateRoadmap(
  sessionId: string,
  courseCode: string
): Promise<{ roadmap: Roadmap; speechText: string; language: Language }> {
  const course = await getCourseByCode(courseCode);
  if (!course) throw new Error("Course not found in the verified PMIST catalogue");

  // Official steps (fallbacks only if a course entry were ever incomplete)
  const steps = course.roadmapSteps.length >= 5
    ? course.roadmapSteps
    : [
        "Strengthen your Class 11-12 basics related to this stream",
        "Study the core subjects of this programme as offered at PMIST",
        "Complete a small supervised project in this field",
        "Seek internship or practical exposure where available",
        "Explore related career paths or postgraduate study",
      ];

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

  let personalNote: string | undefined;
  try {
    const system = `You personalise roadmaps for prospective students of Periyar Maniammai Institute of Science and Technology (PMIST), Thanjavur.
Write ONLY a warm 1-2 sentence personal note connecting THIS student's interests to the course.
NEVER invent courses, subjects, eligibility, fees, cutoffs or placement facts.
Reply with STRICT JSON only: {"personalNote":"..."}`;
    const user = `COURSE (official): ${course.name} — best suited to students interested in ${course.bestSuitedFor}
STUDENT INTERESTS: ${convo.slice(-600)}`;
    const messages: ChatTurn[] = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
    const raw = await chatComplete(messages, { temperature: 0.6, json: true });
    const llm = extractJson<RoadmapLlm>(raw);
    if (llm?.personalNote && llm.personalNote.trim().length > 3) {
      personalNote = llm.personalNote.trim().slice(0, 400);
    }
  } catch {
    personalNote = undefined; // catalogue-only roadmap, still fully official
  }

  const nextSteps = [steps[4]];
  if (!/admission/i.test(steps[4])) {
    nextSteps.push(
      "Contact the PMIST admissions office (or the current 2026-27 official brochure) to confirm eligibility and admission details."
    );
  }

  const roadmap: Roadmap = {
    courseCode: course.code,
    courseName: course.name,
    personalNote,
    foundations: [steps[0]],
    skills: [steps[1]],
    projects: [steps[2]],
    internships: [steps[3]],
    careers: course.careers,
    nextSteps,
    disclaimer: DISCLAIMER,
  };

  const speechText = toSpeechText(
    personalNote
      ? `Here is a personalised roadmap for ${course.name}. ${personalNote} The full official roadmap is on your screen, and the admissions office can confirm the official details.`
      : `Here is your roadmap for ${course.name}, based on our official course-career guide. The full steps are on your screen, and the admissions office can confirm official information.`
  );

  // remember the language for this session's next reply
  const profile = await db.studentProfile.findUnique({ where: { sessionId } });
  const language = (profile?.language as Language) || "en";

  return { roadmap, speechText, language };
}
