import type { CourseMatch } from "./course-matcher";
import type { Language, Stage } from "./types";

/**
 * Rule-based fallback conversation engine (offline-safe).
 * Used when the configured LLM is unreachable (e.g. serverless deployment
 * without a local model). It follows the same stage machine and only ever
 * names courses that were validated by the backend matcher.
 */
export interface RuleBasedResult {
  reply: string;
  profileUpdates: { name?: string; interests: string[]; careerGoal?: string };
  recommendedCodes: string[];
  stage: Stage;
}

const NAME_PATTERNS = [
  /(?:my name is|i am|i'm|this is|call me)\s+([a-zA-Z][a-zA-Z ]{1,30})/i,
  /(?:en|en)\s*peyar\s+([a-zA-Z][a-zA-Z ]{1,30})/i,
  /^([A-Z][a-z]+)\s*here$/i,
];

function extractName(text: string): string | undefined {
  for (const pattern of NAME_PATTERNS) {
    const m = text.match(pattern);
    if (m?.[1]) {
      const name = m[1].trim().split(/\s+/).slice(0, 2).join(" ");
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }
  return undefined;
}

const SUBJECT_HINTS = [
  "computer science", "programming", "coding", "maths", "mathematics", "physics",
  "chemistry", "biology", "commerce", "accounts", "business", "economics",
  "english", "history", "geography", "psychology", "drawing", "art", "design",
  "agriculture", "electronics", "statistics", "computer", "ai", "robotics",
];

function extractInterests(text: string): string[] {
  const lower = text.toLowerCase();
  const found = SUBJECT_HINTS.filter((s) => lower.includes(s));
  // Tanglish / plain interests like "games", "business" etc. already handled by matcher bag
  return found.slice(0, 5);
}

function t(language: Language, en: string, tan: string, ta: string): string {
  return language === "ta" ? ta : language === "tanglish" ? tan : en;
}

export function ruleBasedReply(
  stage: Stage,
  profile: { name?: string; interests: string[]; careerGoal?: string; turnCount: number },
  trimmed: string,
  matches: CourseMatch[],
  language: Language
): RuleBasedResult {
  const name = extractName(trimmed) ?? profile.name;
  const newInterests = Array.from(new Set([...profile.interests, ...extractInterests(trimmed)]));
  let nextStage = stage;

  // Stage 1: learn the name
  if (!name) {
    return {
      reply: t(
        language,
        "Hi! Welcome to PMIST! 😊 What's your name?",
        "Hi! PMIST-ku welcome! Ungal peyar enna? 😊",
        "வணக்கம்! PMIST-க்கு வரவேற்கிறோம்! உங்கள் பெயர் என்ன? 😊"
      ),
      profileUpdates: { interests: [] },
      recommendedCodes: [],
      stage: "welcome",
    };
  }

  // Just learned the name -> greet + start discovery
  if (stage === "welcome") {
    nextStage = "discovery";
    return {
      reply: t(
        language,
        `Nice to meet you, ${name}! How are you today? Tell me — which subject do you enjoy studying the most?`,
        `Unga peyar therinjathu romba sandhosham, ${name}! Eppaadi irukeenga? Ungalaku edhu subject romba pudikkum?`,
        `உங்களை சந்தித்ததில் மகிழ்ச்சி, ${name}! எப்படி இருக்கிறீர்கள்? எந்த பாடம் உங்களுக்கு மிகவும் பிடிக்கும்?`
      ),
      profileUpdates: { name, interests: newInterests },
      recommendedCodes: [],
      stage: nextStage,
    };
  }

  // Explicit or earned recommendation
  const askRecommend =
    /(recommend|suggest|which course|what course|suitable|course for me|sollunga|suggestion)/i.test(trimmed);
  const enough = newInterests.length >= 2 || profile.turnCount >= 4;

  if ((askRecommend || enough) && matches.length > 0) {
    const top = matches[0];
    const second = matches[1];
    nextStage = "followup";
    const secondLine = second
      ? t(
          language,
          ` You may also like ${second.course.name} [${second.course.code}].`,
          ` ${second.course.name} [${second.course.code}] um paakalaam.`,
          ` ${second.course.name} [${second.course.code}]-ஐயும் பார்க்கலாம்.`
        )
      : "";
    return {
      reply: t(
        language,
        `Based on your interests, I suggest ${top.course.name} [${top.course.code}] — it matches your love for ${top.matchedTags.slice(0, 3).join(", ")}.${secondLine} Would you like more details or a roadmap?`,
        `Un interests paathu, en suggestion: ${top.course.name} [${top.course.code}] — ungalaku ${top.matchedTags.slice(0, 3).join(", ")} ellam match aagum.${secondLine} Details venuma, illa roadmap paakalaama?`,
        `உங்கள் ஆர்வங்களின் அடிப்படையில், என் பரிந்துரை: ${top.course.name} [${top.course.code}] — இது உங்கள் ${top.matchedTags.slice(0, 3).join(", ")} ஆர்வத்துடன் பொருந்துகிறது.${secondLine} மேலும் விவரம் வேண்டுமா?`
      ),
      profileUpdates: { name, interests: newInterests },
      recommendedCodes: second ? [top.course.code, second.course.code] : [top.course.code],
      stage: nextStage,
    };
  }

  if (askRecommend && matches.length === 0) {
    return {
      reply: t(
        language,
        "I couldn't find a verified matching course for that interest in our PMIST catalogue. Would you like to hear the courses PMIST offers, or tell me a bit more about what you enjoy?",
        "Un interest-ku match aana verified course enakku kedaikala. PMIST courses ellam paarthurukalaama? Illa innum konjam sollunga.",
        "உங்கள் ஆர்வத்திற்கு பொருந்தும் உறுதிப்படுத்தப்பட்ட பாடநெறி கிடைக்கவில்லை. PMIST பாடநெறிகளை பார்க்கவா விரும்புகிறீர்கள்?"
      ),
      profileUpdates: { name, interests: newInterests },
      recommendedCodes: [],
      stage: "discovery",
    };
  }

  // Discovery follow-ups
  if (newInterests.length === 0) {
    return {
      reply: t(
        language,
        "That's nice! Which subject do you enjoy the most — maths, science, computers, biology, commerce or arts?",
        "Super! Ethu subject ungalaku romba pudikkum — maths, science, computers, biology, commerce illa arts?",
        "நன்று! எந்த பாடம் மிகவும் பிடிக்கும் — கணிதம், அறிவியல், கணினி, உயிரியல், வணிகம் அல்லது கலை?"
      ),
      profileUpdates: { name, interests: newInterests },
      recommendedCodes: [],
      stage: "discovery",
    };
  }

  if (!profile.careerGoal) {
    return {
      reply: t(
        language,
        `Nice — ${newInterests.slice(0, 3).join(", ")} are great areas! What would you like to do in your future career?`,
        `Arumai — ${newInterests.slice(0, 3).join(", ")} ellaam nalla field! Future-la enna pannanum nu aasai?`,
        `அருமை — ${newInterests.slice(0, 3).join(", ")} நல்ல துறைகள்! எதிர்காலத்தில் என்ன செய்ய விரும்புகிறீர்கள்?`
      ),
      profileUpdates: { name, interests: newInterests },
      recommendedCodes: [],
      stage: "discovery",
    };
  }

  // Fallback: invite recommendation
  return {
    reply: t(
      language,
      `Thanks for sharing! Shall I suggest PMIST courses that match your interests (${newInterests.slice(0, 3).join(", ")})?`,
      `Super! Un interests-ku match aana PMIST courses sollatta (${newInterests.slice(0, 3).join(", ")})?`,
      `சூப்பர்! உங்கள் ஆர்வங்களுக்கு பொருந்தும் PMIST பாடநெறிகளை பரிந்துரைக்கட்டா?`
    ),
    profileUpdates: { name, interests: newInterests },
    recommendedCodes: [],
    stage: "recommend",
  };
}
