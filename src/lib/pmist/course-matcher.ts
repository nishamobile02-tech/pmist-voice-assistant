import type { CourseRecord } from "./course-store";

export interface CourseMatch {
  course: CourseRecord;
  score: number;
  matchedTags: string[];
}

// Maps casual student words to course interest tags.
const SYNONYMS: Record<string, string[]> = {
  cs: ["computer science", "programming"],
  cse: ["computer science", "programming"],
  computers: ["computers", "computer science"],
  computer: ["computers", "computer science"],
  coding: ["programming", "coding"],
  code: ["programming", "coding"],
  programmer: ["programming"],
  software: ["software"],
  apps: ["app development", "apps"],
  games: ["game development"],
  gaming: ["game development"],
  game: ["game development"],
  ai: ["artificial intelligence", "ai", "machine learning"],
  "a.i": ["artificial intelligence"],
  ml: ["machine learning"],
  data: ["data analytics", "data science", "big data"],
  web: ["web development"],
  websites: ["web development"],
  robots: ["robotics"],
  robot: ["robotics"],
  electronics: ["electronics", "circuits"],
  circuits: ["circuits", "electronics"],
  iot: ["iot"],
  gadgets: ["gadgets"],
  electrical: ["electrical", "power"],
  electricity: ["electricity", "power"],
  solar: ["solar", "renewable energy"],
  cars: ["cars", "automobiles"],
  car: ["cars", "automobiles"],
  bikes: ["automobiles"],
  machines: ["machines"],
  manufacturing: ["manufacturing"],
  autodesk: ["designing machines", "cad"],
  cad: ["designing machines"],
  buildings: ["buildings", "construction"],
  construction: ["construction"],
  bridges: ["bridges"],
  structures: ["structures"],
  biology: ["biology"],
  bio: ["biology"],
  biotech: ["biotechnology"],
  genetics: ["genetics", "dna"],
  dna: ["dna", "genetics"],
  medical: ["medicine", "medical research"],
  doctor: ["medicine", "healthcare"],
  nurse: ["healthcare"],
  lab: ["laboratory", "labs"],
  labs: ["laboratory", "labs"],
  experiments: ["science experiments", "labs"],
  chemistry: ["chemistry"],
  physics: ["physics"],
  maths: ["maths", "mathematics"],
  math: ["maths", "mathematics"],
  mathematics: ["maths", "mathematics"],
  stats: ["statistics"],
  statistics: ["statistics"],
  agriculture: ["agriculture"],
  farming: ["farming", "agriculture"],
  farm: ["farm machines", "agriculture"],
  soil: ["soil"],
  plants: ["biology", "agriculture science"],
  environment: ["environment"],
  nature: ["nature"],
  food: ["food processing"],
  drawing: ["drawing", "sketching"],
  sketching: ["sketching", "drawing"],
  art: ["art"],
  painting: ["painting", "art"],
  design: ["design", "designing"],
  designing: ["designing"],
  interior: ["interior design"],
  architecture: ["architecture", "buildings"],
  creativity: ["creativity"],
  creative: ["creativity"],
  psychology: ["psychology"],
  mind: ["human mind"],
  counselling: ["counselling"],
  helping: ["helping people"],
  people: ["talking to people", "understanding people"],
  behavior: ["behaviour"],
  behaviour: ["behaviour"],
  mental: ["mental health"],
  business: ["business", "management"],
  startup: ["startups", "entrepreneurship"],
  startups: ["startups", "entrepreneurship"],
  entrepreneur: ["entrepreneurship"],
  marketing: ["marketing"],
  sales: ["sales", "marketing"],
  money: ["money", "finance"],
  finance: ["finance"],
  accounts: ["accounts", "accounting"],
  accounting: ["accounting"],
  commerce: ["commerce"],
  tax: ["taxation"],
  taxation: ["taxation"],
  bank: ["banking"],
  banking: ["banking"],
  audit: ["audit"],
  economy: ["economy"],
  stock: ["finance", "economy"],
  stocks: ["finance", "economy"],
  leadership: ["leadership", "leading teams"],
  management: ["management"],
  events: ["organising events"],
  teaching: ["teaching"],
  research: ["research"],
  higherstudies: ["higher studies"],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Explicit backend matching (spec §4/§5): score every verified course against
 * the student's interest bag-of-words. Deterministic — no model involved.
 */
export function matchCourses(
  interestSources: string[],
  courses: CourseRecord[],
  topN = 3
): CourseMatch[] {
  const bag = new Set<string>();
  for (const source of interestSources) {
    for (const token of tokenize(source)) bag.add(token);
    // also keep whole phrases so multi-word tags can match exactly
    const lower = source.toLowerCase();
    bag.add(lower.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim());
  }

  const expanded = new Set<string>(bag);
  for (const token of bag) {
    const syn = SYNONYMS[token];
    if (syn) syn.forEach((s) => expanded.add(s));
  }

  const matches: CourseMatch[] = courses.map((course) => {
    const matchedTags = new Set<string>();
    let score = 0;
    for (const tag of course.interests) {
      const tagLower = tag.toLowerCase();
      // exact phrase match
      if (expanded.has(tagLower)) {
        matchedTags.add(tag);
        score += 3;
        continue;
      }
      // word-level overlap (tag word present in bag or vice versa)
      const tagWords = tokenize(tag);
      let wordHits = 0;
      for (const tw of tagWords) {
        if (expanded.has(tw)) wordHits++;
      }
      if (tagWords.length > 0 && wordHits === tagWords.length) {
        matchedTags.add(tag);
        score += 2;
      } else if (wordHits > 0 && tagWords.length > 0 && tagWords.length <= 2) {
        matchedTags.add(tag);
        score += 1;
      }
    }
    return { course, score, matchedTags: [...matchedTags] };
  });

  return matches
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
