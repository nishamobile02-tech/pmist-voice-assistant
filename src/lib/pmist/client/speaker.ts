// Speaker — plays assistant speech: server TTS audio when available,
// otherwise falls back to the browser's speechSynthesis engine.
import type { Language, TtsResponse } from "@/lib/pmist/types";

let currentAudio: HTMLAudioElement | null = null;

const LANG_TAGS: Record<Language, string> = {
  ta: "ta-IN",
  tanglish: "en-IN",
  en: "en-IN",
};

export function speak(
  tts: TtsResponse,
  fallbackText: string,
  language: Language,
  onEnd: () => void,
  onError?: (e: Error) => void,
): void {
  stopSpeaking();

  // 1) Server-provided audio (e.g. Piper / cloud TTS).
  if (tts.audioBase64) {
    const audio = new Audio(`data:${tts.mime};base64,${tts.audioBase64}`);
    currentAudio = audio;
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null;
      onEnd();
    };
    audio.onerror = () => {
      if (currentAudio === audio) currentAudio = null;
      onError?.(new Error("Audio playback failed"));
    };
    audio.play().catch((err: unknown) => {
      if (currentAudio === audio) currentAudio = null;
      onError?.(err instanceof Error ? err : new Error("Audio playback blocked"));
    });
    return;
  }

  // 2) Browser speechSynthesis fallback (Tamil and any TTS-less deployments).
  if (tts.fallback === "browser") {
    speakWithBrowser(fallbackText, language, onEnd, onError);
    return;
  }

  // 3) Nothing to play — finish immediately so the UI never hangs.
  onEnd();
}

export function stopSpeaking(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // ignore — element may already be detached
    }
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function speakWithBrowser(
  text: string,
  language: Language,
  onEnd: () => void,
  onError?: (e: Error) => void,
): void {
  const synth =
    typeof window !== "undefined" && "speechSynthesis" in window
      ? window.speechSynthesis
      : undefined;

  if (!synth) {
    // speechSynthesis unavailable — degrade gracefully instead of hanging.
    setTimeout(onEnd, 100);
    return;
  }

  const voices = synth.getVoices();
  if (voices.length === 0) {
    // No voices available — degrade gracefully instead of hanging.
    setTimeout(onEnd, 100);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const langTag = LANG_TAGS[language];
  const voice = pickVoice(voices, langTag);
  if (voice) utterance.voice = voice;
  utterance.lang = langTag;
  utterance.rate = 1;

  utterance.onend = () => onEnd();
  utterance.onerror = (event: SpeechSynthesisErrorEvent) =>
    onError?.(new Error(event.error || "Speech synthesis failed"));

  synth.speak(utterance);
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  langTag: string,
): SpeechSynthesisVoice | null {
  const normalize = (lang: string) => lang.replace("_", "-").toLowerCase();
  const target = normalize(langTag);
  const primary = target.split("-")[0];
  return (
    voices.find((v) => normalize(v.lang) === target) ??
    voices.find((v) => normalize(v.lang).startsWith(primary)) ??
    null // otherwise let the browser use its default voice
  );
}
