// Shared API contract types for PMIST Voice AI Admission Assistant
export type Language = "en" | "ta" | "tanglish";

export type Stage = "welcome" | "discovery" | "recommend" | "followup";

export interface CourseSummary {
  code: string;
  name: string;
  level: string; // "UG" | "PG"
  stream: string;
  duration: string;
  description: string;
  skills: string[];
  careers: string[];
  isPlaceholder: boolean;
}

export interface Recommendation extends CourseSummary {
  whyItFits: string;
  isTop: boolean;
}

export interface Roadmap {
  courseCode: string;
  courseName: string;
  personalNote?: string;
  foundations: string[];
  skills: string[];
  projects: string[];
  internships: string[];
  careers: string[];
  nextSteps: string[];
  disclaimer: string;
}

export interface ProfileSummary {
  name?: string;
  interests: string[];
  careerGoal?: string;
  language: Language;
}

export interface ChatResponse {
  reply: string;
  speechText: string;
  language: Language;
  stage: Stage;
  recommendations?: Recommendation[];
  roadmap?: Roadmap | null;
  profile: ProfileSummary;
  error?: string;
}

export interface RoadmapResponse {
  roadmap: Roadmap;
  speechText: string;
}

export interface AsrResponse {
  text: string;
  error?: string;
}

export interface TtsRequest {
  text: string;
  language: Language;
}

export interface TtsResponse {
  audioBase64: string | null;
  mime: string;
  fallback: "browser" | null; // "browser" => client should use speechSynthesis
  error?: string;
}

export interface CoursesResponse {
  courses: CourseSummary[];
  verified: boolean;
}

export const LANGUAGE_LABEL: Record<Language, string> = {
  en: "English",
  ta: "தமிழ் (Tamil)",
  tanglish: "Tanglish",
};
