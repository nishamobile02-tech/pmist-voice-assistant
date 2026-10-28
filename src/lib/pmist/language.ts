import type { Language } from "./types";

const TAMIL_UNICODE = /[\u0B80-\u0BFF]/;

// Common Tamil words written in English letters (Tanglish markers)
const TANGLISH_MARKERS = [
  "enakku", "ennaku", "unakku", "unga", "ungal", "enna", "enna", "epdi", "eppadi",
  "pudikkum", "pudikum", "purinjithu", "purinjidhu", "romba", "konjam", "illa", "illai",
  "irukku", "iruku", "irukiren", "naan", "nan", "naama", "nee", "neenga", "vanakkam",
  "vanakam", "nandri", "seri", "semma", "super", "aama", "aam", "vendam", "venum",
  "sollu", "solu", "paaru", "paru", "panren", "panra", "padikiren", "kathukiren",
  "machan", "machan", "thambi", "akka", "anna", "edhavadhu", "edhu", "evlo", "eppO",
  "pesi", "pesuren", "theriyum", "theriyala", "peyar", "en peyar", "tamil", "tanglish",
  "kathuka", "padika", "panna", "panratha", "sirappa", "kurippa", "intrest", "istam",
  "ishtam", "pudikradhu", "pudikarthu",
];

/**
 * Detect the student's language style:
 * - "ta"  : Tamil script present
 * - "tanglish" : Tamil written in English letters (heuristic word match)
 * - "en"  : otherwise
 */
export function detectLanguage(text: string): Language {
  if (TAMIL_UNICODE.test(text)) return "ta";
  const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const hits = words.filter((w) => TANGLISH_MARKERS.includes(w)).length;
  if (hits >= 2 || (hits >= 1 && words.length <= 6)) return "tanglish";
  return "en";
}

/** Strip emoji / markdown so TTS engines read clean sentences. */
export function toSpeechText(text: string): string {
  return text
    .replace(/[*_#`~>|]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
