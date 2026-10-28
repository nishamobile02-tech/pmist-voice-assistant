import { db } from "@/lib/db";
import { chatComplete, extractJson, type ChatTurn } from "@/lib/ai/llm";
import { detectLanguage, toSpeechText } from "./language";
import { getAllCourses, getCourseByCode, type CourseRecord } from "./course-store";
import { matchCourses, type CourseMatch } from "./course-matcher";
import { ruleBasedReply } from "./rule-based";
import type { ChatResponse, Language, Recommendation, Stage } from "./types";

interface ProfileState {
  name?: string;
  language: Language;
  interests: string[];
  careerGoal?: string;
  stage: Stage;
  turnCount: number;
  lastRecommendedCodes: string[];
}

interface LlmOutput {
  reply?: string;
  profileUpdates?: {
    name?: string | null;
    interests?: string[];
    careerGoal?: string | null;
  };
  recommendedCodes?: string[];
  readyToRecommend?: boolean;
}

const INSTITUTION = "Periyar Maniammai Institute of Science and Technology (PMIST), Thanjavur";

function cleanInterests(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((v) => String(v).trim())
    .filter((v) => v.length > 1 && v.length < 60)
    .slice(0, 10);
}

function stageGoal(stage: Stage, hasCandidates: boolean): string {
  switch (stage) {
    case "welcome":
      return "The student has not told you their name yet. Your ONLY goal: warmly learn their name (ask naturally, one short question).";
    case "discovery":
      return "Learn what subjects they enjoy and what activities/careers excite them. Ask ONE short friendly question per turn (favourite subject, do they like maths/programming/designing/business/biology, future career dream). Do not interrogate with a list. When you already have a clear picture, invite them to hear your course suggestions.";
    case "recommend":
      return hasCandidates
        ? "Present your course suggestion confidently ('I suggest...' / 'My suggestion is...') using ONLY the CANDIDATE COURSES. Explain briefly why the top pick fits their interests; mention at most 2 alternatives by exact official name and their codes."
        : "No verified matching course exists in the PMIST catalogue for their interests. Say this kindly, do NOT invent any course, and offer to show available PMIST courses or to talk about another interest.";
    case "followup":
      return "Answer their follow-up question conversationally. You may elaborate only on courses listed in CANDIDATE COURSES. If they ask something beyond courses (eligibility, fees, cutoffs), warmly tell them the admissions office will confirm those details.";
  }
}

function buildSystemPrompt(profile: ProfileState, candidates: CourseRecord[] | null, languageHint: Language): string {
  const candidateBlock =
    candidates && candidates.length > 0
      ? `CANDIDATE COURSES (the ONLY courses you may name or recommend — use their exact official names and codes):\n${candidates
          .map(
            (c) =>
              `- code: ${c.code} | name: ${c.name} | ${c.level}, ${c.duration}, ${c.stream} | about: ${c.description}`
          )
          .join("\n")}`
      : "CANDIDATE COURSES: none this turn.";

  return `You are "Vaani", the friendly admission voice assistant of ${INSTITUTION}.

PERSONA: warm, encouraging, respectful — like a kind senior counselor. Keep replies SHORT (2-4 spoken sentences, under 70 words) because they are read aloud.

LANGUAGE RULE (very important): reply in the SAME style the student used:
- English -> friendly simple English.
- Tamil (Tamil script) -> reply in simple spoken Tamil script.
- Tanglish (Tamil words in English letters) -> reply in Tanglish, exactly like the student writes.
Detected student language this turn: ${languageHint}.

STAGE GOAL: ${stageGoal(profile.stage, Boolean(candidates && candidates.length))}

KNOWN STUDENT PROFILE: name=${profile.name ?? "unknown"}; interests=${JSON.stringify(profile.interests)}; careerGoal=${profile.careerGoal ?? "unknown"}.
Do not re-ask things already known.

${candidateBlock}

HARD COURSE RULES:
- You may ONLY mention courses from CANDIDATE COURSES above, by exact name and code. If it is not in that list, it does not exist for you.
- NEVER invent, translate, shorten or guess course names or codes. NEVER mention courses of other colleges. A career path (like "game developer") is NOT a course.
- If no candidate fits, say you could not find a verified matching course.
- Never state eligibility, cut-off marks, fees or placement statistics. Suggestions are not admission decisions.

OUTPUT: reply with STRICT JSON only (no markdown, no extra text), exactly this shape:
{"reply":"<your spoken reply>","profileUpdates":{"name":"<name or null>","interests":["<subject/interest words mentioned>"],"careerGoal":"<career they want or null>"},"recommendedCodes":["<code from candidates only>"],"readyToRecommend":true|false}

Example (when recommending):
{"reply":"Super Arjun! I suggest B.Tech Computer Science and Engineering [BT-CSE]. It matches your love for programming and game development. We also have B.Tech Artificial Intelligence and Data Science [BT-AIDS] if AI excites you more.","profileUpdates":{"name":null,"interests":["game development"],"careerGoal":null},"recommendedCodes":["BT-CSE","BT-AIDS"],"readyToRecommend":true}
- profileUpdates: ONLY new info from this turn; null for unmentioned fields.
- recommendedCodes: ONLY when recommending this turn; codes must be from CANDIDATE COURSES.
- readyToRecommend: true when the student asks for a suggestion OR their interests are clear.`;
}

async function loadOrCreateProfile(sessionId: string): Promise<ProfileState> {
  const row = await db.studentProfile.findUnique({ where: { sessionId } });
  if (!row) {
    await db.studentProfile.create({
      data: { sessionId, language: "en", stage: "welcome" },
    });
    return {
      name: undefined,
      language: "en",
      interests: [],
      stage: "welcome",
      turnCount: 0,
      lastRecommendedCodes: [],
      careerGoal: undefined,
    };
  }
  return {
    name: row.name ?? undefined,
    language: (row.language as Language) || "en",
    interests: (() => {
      try {
        return JSON.parse(row.interests) as string[];
      } catch {
        return [];
      }
    })(),
    careerGoal: row.careerGoal ?? undefined,
    stage: (row.stage as Stage) || "welcome",
    turnCount: row.turnCount,
    lastRecommendedCodes: (() => {
      try {
        return JSON.parse(row.lastRecommendedCodes) as string[];
      } catch {
        return [];
      }
    })(),
  };
}

async function loadHistory(sessionId: string): Promise<ChatTurn[]> {
  const rows = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  return rows.map((r) => ({
    role: r.role === "user" ? ("user" as const) : ("assistant" as const),
    content: r.content,
  }));
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve model-emitted recommendation strings ("BT-CSE", "bca",
 * "B.Tech Computer Science...") to candidate course codes.
 * Returns { resolved: candidateCodes[], unknown: emittedButNotAllowed[] }.
 */
function resolveRecommendations(
  emitted: string[],
  candidates: CourseRecord[]
): { resolved: string[]; unknown: string[] } {
  const byCode = new Map(candidates.map((c) => [c.code.toUpperCase(), c.code]));
  const byName = new Map(candidates.map((c) => [normalizeName(c.name), c.code]));
  const resolved: string[] = [];
  const unknown: string[] = [];
  for (const raw of emitted) {
    const key = String(raw).trim();
    if (!key) continue;
    const code = byCode.get(key.toUpperCase()) ?? byName.get(normalizeName(key));
    if (code && !resolved.includes(code)) resolved.push(code);
    else if (!code) unknown.push(key);
  }
  return { resolved, unknown };
}

/** Guard: does the reply mention any course NOT in the allowed set? */
function findInvalidCourseMentions(reply: string, allowed: CourseRecord[], all: CourseRecord[]): string[] {
  const banned: string[] = [];
  const replyNorm = normalizeName(reply);
  const replyLower = reply.toLowerCase();
  const allowedNames = new Set(allowed.map((c) => normalizeName(c.name)));
  for (const course of all) {
    if (allowedNames.has(normalizeName(course.name))) continue;
    const fullName = normalizeName(course.name);
    // short name = part before "(" (e.g. "BCA") when present, or the code
    const shortName = course.name.split("(")[0].trim();
    const shortNorm = normalizeName(shortName);
    const codeNorm = normalizeName(course.code);
    const fullHit = fullName.length > 8 && replyNorm.includes(fullName);
    const shortHit =
      shortNorm.length >= 2 &&
      shortNorm.length <= 6 &&
      new RegExp(`(^|[^a-z0-9])${shortNorm}([^a-z0-9]|$)`, "i").test(replyLower);
    const codeHit =
      codeNorm.length >= 2 &&
      new RegExp(`(^|[^a-z0-9])${codeNorm}([^a-z0-9]|$)`, "i").test(replyLower);
    if (fullHit || shortHit || codeHit) banned.push(course.name);
  }
  return banned;
}

function toRecommendations(codes: string[], matches: CourseMatch[], language: Language): Recommendation[] {
  const byCode = new Map(matches.map((m) => [m.course.code, m]));
  const result: Recommendation[] = [];
  codes.forEach((code, idx) => {
    const match = byCode.get(code);
    if (!match) return; // hard reject anything not in candidate list
    const tags = match.matchedTags.slice(0, 4).join(", ");
    const reason =
      `Matches your interests (${tags || "your profile"})` +
      ` — you would build skills like ${match.course.skills.slice(0, 3).join(", ")}.`;
    result.push({
      code: match.course.code,
      name: match.course.name,
      level: match.course.level,
      stream: match.course.stream,
      duration: match.course.duration,
      description: match.course.description,
      skills: match.course.skills,
      careers: match.course.careers,
      isPlaceholder: match.course.isPlaceholder,
      whyItFits: reason,
      isTop: idx === 0,
    });
  });
  return result;
}

const RECOMMEND_TRIGGERS =
  /(recommend|suggest|which course|what course|suitable course|course for me|courses available|show (me )?courses|list( of)? courses|enaku course|enakku course|course sollu|edhavadhu course|sollunga|suggestion)/i;
const ROADMAP_TRIGGERS = /(roadmap|road map|career path|plan for future|future plan|vazhi|vali)/i;

function honestNoMatchReply(language: Language): string {
  if (language === "ta") {
    return "உங்கள் ஆர்வங்களுக்கு ஏற்ற உறுதிப்படுத்தப்பட்ட பாடநெறி எனக்குக் கிடைக்கவில்லை. PMIST-ல் உள்ள பாடநெறிகளைப் பார்க்கவா விரும்புகிறீர்கள், அல்லது வேறு எதைப் பற்றி பேசலாம்?";
  }
  if (language === "tanglish") {
    return "Un interests-ku matches panna verified course enakku kedaikala. PMIST-la irukura courses paarthurukalaama, illa vera edhavadhu interest irundha sollunga?";
  }
  return "I couldn't find a verified matching course for that interest in our PMIST catalogue. Would you like to hear the courses PMIST offers, or tell me a bit more about what you enjoy?";
}

export async function handleChat(sessionId: string, message: string): Promise<ChatResponse> {
  const trimmed = (message || "").trim().slice(0, 800);
  if (!trimmed) throw new Error("Message is required");

  const profile = await loadOrCreateProfile(sessionId);
  const history = await loadHistory(sessionId);
  const detected: Language = detectLanguage(trimmed);
  const language: Language = detected;

  const wantsRecommendation = RECOMMEND_TRIGGERS.test(trimmed);
  const wantsCourseList =
    /(show|list|see|all|available|ella)[\s\S]{0,14}courses?/i.test(trimmed) || /^courses$/i.test(trimmed.trim());

  // ---- Stage machine -------------------------------------------------------
  let stage = profile.stage;
  if (stage === "welcome" && profile.name) stage = "discovery";
  if (stage === "discovery" && (wantsRecommendation || (profile.interests.length >= 1 && profile.turnCount >= 3))) {
    stage = "recommend";
  }
  if (stage === "welcome" && wantsRecommendation) stage = "recommend";

  const allCourses = await getAllCourses();

  // ---- Candidate selection (deterministic backend matching) ---------------
  let candidates: CourseRecord[] | null = null;
  let matches: CourseMatch[] = [];

  const needsCandidates = stage === "recommend" || stage === "followup";
  if (needsCandidates) {
    const interestSources = [...profile.interests, profile.careerGoal ?? "", trimmed];
    matches = matchCourses(interestSources, allCourses, 3);
    if (stage === "recommend" && matches.length === 0) {
      candidates = null; // honest "no verified match" path
    } else {
      candidates = matches.map((m) => m.course);
    }
    // In followup, also allow the previously recommended courses as context
    if (stage === "followup" && profile.lastRecommendedCodes.length > 0) {
      const prev = profile.lastRecommendedCodes
        .map((code) => allCourses.find((c) => c.code === code))
        .filter((c): c is CourseRecord => Boolean(c));
      const merged = [...(candidates ?? [])];
      for (const c of prev) if (!merged.some((m) => m.code === c.code)) merged.push(c);
      candidates = merged;
    }
  }

  // ---- LLM call ------------------------------------------------------------
  const systemPrompt = buildSystemPrompt({ ...profile, stage }, candidates, language);
  const messages: ChatTurn[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: trimmed },
  ];

  let raw: string;
  try {
    raw = await chatComplete(messages, { temperature: 0.7, json: true });
  } catch (err) {
    // Offline-safe degraded mode: guided rule-based conversation (no cloud fallback).
    console.warn("[chat] LLM unavailable, using rule-based mode:", err instanceof Error ? err.message : err);
    const rule = ruleBasedReply(stage, { ...profile, turnCount: profile.turnCount }, trimmed, matches, language);
    const ruleMatches = matchCourses(
      [...Array.from(new Set([...profile.interests, ...rule.profileUpdates.interests])), rule.profileUpdates.careerGoal ?? ""],
      allCourses,
      3
    );
    const ruleRecos =
      rule.recommendedCodes.length > 0
        ? toRecommendations(rule.recommendedCodes, ruleMatches, language)
        : undefined;
    const nextStage = rule.stage;
    const ruleInterests = Array.from(new Set([...profile.interests, ...rule.profileUpdates.interests])).slice(0, 12);
    const turnCount = profile.turnCount + 1;
    const profileData = {
      name: rule.profileUpdates.name ?? profile.name,
      language,
      interests: JSON.stringify(ruleInterests),
      careerGoal: profile.careerGoal,
      stage: nextStage,
      turnCount,
      lastRecommendedCodes: JSON.stringify(ruleRecos?.map((r) => r.code) ?? []),
    };
    await db.studentProfile.upsert({
      where: { sessionId },
      create: { sessionId, ...profileData },
      update: profileData,
    });
    await db.chatMessage.create({ data: { sessionId, role: "user", content: trimmed, language } });
    await db.chatMessage.create({ data: { sessionId, role: "assistant", content: rule.reply, language } });
    return {
      reply: rule.reply,
      speechText: toSpeechText(rule.reply),
      language,
      stage: nextStage,
      recommendations: ruleRecos && ruleRecos.length > 0 ? ruleRecos : undefined,
      roadmap: null,
      profile: {
        name: rule.profileUpdates.name ?? profile.name,
        interests: ruleInterests,
        careerGoal: profile.careerGoal,
        language,
      },
      error: err instanceof Error ? err.message : "LLM unavailable",
    };
  }

  console.log("[chat] raw LLM output:", raw.slice(0, 600));
  const parsed = extractJson<LlmOutput>(raw) ?? { reply: raw };

  // ---- Merge profile updates ----------------------------------------------
  const updates = parsed.profileUpdates ?? {};
  const newName =
    updates.name && String(updates.name).trim() ? String(updates.name).trim().slice(0, 60) : profile.name;
  const newInterests = Array.from(
    new Set([...profile.interests, ...cleanInterests(updates.interests)])
  ).slice(0, 12);
  const newCareerGoal =
    updates.careerGoal && String(updates.careerGoal).trim()
      ? String(updates.careerGoal).trim().slice(0, 100)
      : profile.careerGoal;

  let reply = (parsed.reply ?? "").trim() || "Could you say that again in a little more detail?";
  let recommendations: Recommendation[] | undefined;
  let recommendedCodes: string[] = [];

  // ---- Recommendation validation (hard backend rule) -----------------------
  if (candidates && candidates.length > 0 && parsed.recommendedCodes && parsed.recommendedCodes.length > 0) {
    const { resolved, unknown } = resolveRecommendations(parsed.recommendedCodes, candidates);
    const invalidMentions = findInvalidCourseMentions(reply, candidates, allCourses);

    if (unknown.length > 0 || invalidMentions.length > 0) {
      // Model tried to recommend a non-verified course -> one corrective pass
      console.warn("[chat] invalid course output:", { unknown, invalidMentions });
      const correction = `CORRECTION: your previous reply mentioned course(s) that are NOT in the verified PMIST catalogue (${[...unknown, ...invalidMentions].join("; ")}). Rewrite your reply mentioning ONLY these verified courses: ${candidates
        .map((c) => `${c.name} [${c.code}]`)
        .join("; ")}. Same strict JSON format.`;
      try {
        const raw2 = await chatComplete([...messages, { role: "user", content: correction }], {
          temperature: 0.4,
          json: true,
        });
        const parsed2 = extractJson<LlmOutput>(raw2) ?? {};
        if (parsed2.reply && parsed2.reply.trim()) reply = parsed2.reply.trim();
        const second = resolveRecommendations(parsed2.recommendedCodes ?? [], candidates);
        if (second.unknown.length === 0 && second.resolved.length > 0) recommendedCodes = second.resolved;
      } catch {
        // keep first reply; codes stay empty -> honest fallback below
      }
      const stillInvalid = findInvalidCourseMentions(reply, candidates, allCourses);
      if (stillInvalid.length > 0) {
        reply = honestNoMatchReply(language);
        recommendedCodes = [];
      }
    } else {
      recommendedCodes = resolved;
    }
  } else if (candidates && candidates.length > 0) {
    const invalidMentions = findInvalidCourseMentions(reply, candidates, allCourses);
    if (invalidMentions.length > 0) {
      console.warn("[chat] invalid course mention without codes:", invalidMentions);
      reply = honestNoMatchReply(language);
    }
  }

  // ---- Attach recommendation cards (all codes already validated above) -----
  if (recommendedCodes.length > 0 && matches.length > 0) {
    recommendations = toRecommendations(recommendedCodes, matches, language);
    stage = "followup";
  } else if (stage === "recommend" && candidates && candidates.length > 0 && matches.length > 0) {
    // model replied without usable codes: offer the top deterministic match as a suggestion
    recommendations = toRecommendations([matches[0].course.code], matches, language);
    stage = "followup";
  } else if (wantsCourseList && (candidates && candidates.length > 0 || stage === "followup")) {
    const listSource = candidates && candidates.length >= 4 ? candidates : allCourses.slice(0, 6);
    recommendations = listSource.slice(0, 6).map((c) => ({
      code: c.code,
      name: c.name,
      level: c.level,
      stream: c.stream,
      duration: c.duration,
      description: c.description,
      skills: c.skills,
      careers: c.careers,
      isPlaceholder: c.isPlaceholder,
      whyItFits: "Available at PMIST as listed in our current catalogue (development data).",
      isTop: false,
    }));
  } else if (stage === "recommend") {
    stage = "discovery"; // no verified match: continue conversation
  }

  if (recommendations && recommendations.length > 0) {
    recommendedCodes = recommendations.map((r) => r.code);
    stage = "followup";
  }

  // advance stages: welcome -> discovery once we have a name
  if (stage === "welcome" && newName) stage = "discovery";

  // ---- Persist --------------------------------------------------------------
  const turnCount = profile.turnCount + 1;
  const profileData = {
    name: newName,
    language,
    interests: JSON.stringify(newInterests),
    careerGoal: newCareerGoal,
    stage,
    turnCount,
    lastRecommendedCodes: JSON.stringify(recommendedCodes),
  };
  await db.studentProfile.upsert({
    where: { sessionId },
    create: { sessionId, ...profileData },
    update: profileData,
  });

  await db.chatMessage.create({ data: { sessionId, role: "user", content: trimmed, language } });
  await db.chatMessage.create({ data: { sessionId, role: "assistant", content: reply, language } });

  return {
    reply,
    speechText: toSpeechText(reply),
    language,
    stage,
    recommendations: recommendations && recommendations.length > 0 ? recommendations : undefined,
    roadmap: null,
    profile: {
      name: newName,
      interests: newInterests,
      careerGoal: newCareerGoal,
      language,
    },
  };
}
