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
  // ---- official 52-course catalogue coverage ----
  uav: ["uav", "drones", "aerospace"],
  drones: ["drones", "uav", "aerospace"],
  drone: ["drones", "uav", "aerospace"],
  aeroplane: ["aeroplanes", "aircraft", "aerospace"],
  airplane: ["aeroplanes", "aircraft", "aerospace"],
  aircraft: ["aircraft", "aerospace"],
  aeronautics: ["aerospace", "flight"],
  flight: ["flight", "aerospace"],
  rockets: ["rockets", "aerospace"],
  space: ["space systems", "aerospace"],
  isro: ["aerospace", "space systems"],
  defence: ["aerospace", "security"],
  ev: ["electric vehicles", "ev", "batteries"],
  "electric vehicles": ["electric vehicles", "ev"],
  battery: ["batteries", "electric vehicles"],
  batteries: ["batteries", "electric vehicles"],
  automobile: ["automobiles", "electric vehicles"],
  automobiles: ["automobiles"],
  mechanical: ["machines", "manufacturing", "mechanical"],
  thermodynamics: ["thermodynamics", "thermal systems"],
  hvac: ["hvac", "thermal systems"],
  energy: ["energy", "power"],
  renewable: ["renewable energy", "solar"],
  renewables: ["renewable energy", "solar"],
  sustainability: ["sustainability", "renewable energy"],
  gis: ["gis", "mapping", "remote sensing"],
  "remote sensing": ["remote sensing", "gis"],
  mapping: ["mapping", "gis"],
  surveying: ["surveying", "construction"],
  water: ["water", "hydrology", "water systems"],
  hydrology: ["hydrology", "water systems"],
  irrigation: ["irrigation", "water systems"],
  cybersecurity: ["cyber security", "security"],
  "cyber security": ["cyber security", "security"],
  cyber: ["cyber security", "security"],
  hacking: ["security", "ethical hacking"],
  hacker: ["security", "ethical hacking"],
  networks: ["networks", "cyber security"],
  networking: ["networks"],
  "ar/vr": ["ar", "vr", "interactive experiences"],
  arvr: ["ar", "vr", "interactive experiences"],
  metaverse: ["ar", "vr", "3d worlds"],
  "3d": ["3d worlds", "3d content"],
  animation: ["animation", "multimedia", "vfx"],
  vfx: ["vfx", "animation"],
  anime: ["animation", "multimedia"],
  cartoons: ["animation", "multimedia"],
  multimedia: ["multimedia", "animation"],
  film: ["film", "movies", "video"],
  films: ["film", "movies", "video"],
  movie: ["movies", "film", "video"],
  movies: ["movies", "film", "video"],
  cinema: ["film", "movies"],
  camera: ["camera", "photography", "film"],
  photography: ["photography", "camera"],
  videography: ["video", "film"],
  editing: ["editing", "video"],
  sound: ["sound", "film"],
  youtube: ["video", "media", "film"],
  anchoring: ["news", "media", "journalism"],
  journalist: ["journalism", "news"],
  journalism: ["journalism", "news", "media"],
  news: ["news", "journalism", "media"],
  media: ["media", "journalism"],
  masscomm: ["journalism", "media", "communication"],
  english: ["english", "literature"],
  literature: ["literature", "english"],
  tamil: ["tamil"],
  writer: ["writing", "english"],
  writing: ["writing"],
  poet: ["literature", "writing"],
  teacher: ["teaching"],
  teachers: ["teaching"],
  teachingcareer: ["teaching"],
  professor: ["teaching", "research"],
  mentor: ["mentoring", "teaching"],
  tutor: ["teaching", "tutoring"],
  bcom: ["commerce", "accounting"],
  "b.com": ["commerce", "accounting"],
  fintech: ["fintech", "finance"],
  "fintech and ai": ["fintech", "finance", "artificial intelligence"],
  accountant: ["accounting", "accountancy"],
  ca: ["accounting", "auditing", "taxation"],
  auditor: ["auditing", "accounting"],
  auditing: ["auditing", "accounting"],
  companysecretary: ["company secretary", "governance"],
  "company secretary": ["company secretary", "governance"],
  secretary: ["company secretary", "governance"],
  mba: ["management", "business"],
  hospitality: ["hospitality", "hotels", "tourism"],
  hotel: ["hotels", "hospitality", "tourism"],
  hotels: ["hotels", "hospitality"],
  chef: ["hospitality", "food"],
  tourism: ["tourism", "hospitality"],
  travel: ["tourism", "logistics"],
  logistics: ["logistics", "supply chain"],
  "supply chain": ["supply chain", "logistics"],
  shipping: ["logistics", "supply chain"],
  warehouse: ["logistics", "inventory"],
  transport: ["transport", "logistics"],
  hr: ["management", "hr support"],
  "digital marketing": ["digital marketing", "marketing"],
  instagram: ["social media", "digital marketing"],
  socialmedia: ["social media", "digital marketing"],
  seo: ["digital marketing", "analytics"],
  brand: ["marketing", "business"],
  advertising: ["marketing", "digital marketing"],
  healthcare: ["healthcare", "hospitals", "health"],
  hospital: ["hospitals", "healthcare"],
  hospitals: ["hospitals", "healthcare"],
  pharmacy: ["pharma", "biotechnology", "chemistry"],
  pharma: ["pharma", "biotechnology"],
  microbiology: ["microbiology", "biology"],
  robotics: ["robotics", "automation"],
  automation: ["automation", "robotics"],
  embedded: ["embedded systems", "electronics"],
  arduino: ["embedded systems", "electronics", "robotics"],
  bca: ["practical software", "computer science", "programming"],
  "biotechnology with computer science": ["bioinformatics", "biology", "computer science"],
  bioinformatics: ["bioinformatics", "biology", "data"],
  "data analytics": ["data analytics", "data", "analytics"],
  "data science": ["data science", "data", "analytics"],
  barch: ["architecture", "buildings"],
  "b.arch": ["architecture", "buildings"],
  civil: ["construction", "buildings", "infrastructure"],
  mechanicalengineering: ["machines", "manufacturing"],
  eee: ["electrical", "power", "electricity"],
  ece: ["electronics", "communication", "signals"],
  aiml: ["artificial intelligence", "machine learning"],
  "ai&ml": ["artificial intelligence", "machine learning"],
  "ai and ml": ["artificial intelligence", "machine learning"],
  llm: ["artificial intelligence", "machine learning"],
  chatgpt: ["artificial intelligence", "ai"],
  datascience: ["data science", "data", "analytics"],
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
