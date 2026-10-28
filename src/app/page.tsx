"use client";

// PMIST Voice AI Admission Assistant — main page.
// Voice-first (mic → ASR → chat → TTS) with typed fallback, course
// recommendations and personalised roadmaps.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ChatWindow } from "@/components/pmist/ChatWindow";
import { Header } from "@/components/pmist/Header";
import { PlaceholderBanner } from "@/components/pmist/PlaceholderBanner";
import { RecommendationPanel } from "@/components/pmist/RecommendationPanel";
import type { ChatMessage } from "@/components/pmist/MessageBubble";
import type { ChatStatus } from "@/components/pmist/StatusPill";
import { VoiceControls } from "@/components/pmist/VoiceControls";
import {
  fetchCourses,
  getRoadmap,
  resetSession,
  sendChat,
  synthesize,
  transcribe,
} from "@/lib/pmist/client/api";
import { WavRecorder } from "@/lib/pmist/client/recorder";
import { speak, stopSpeaking } from "@/lib/pmist/client/speaker";
import type {
  Language,
  ProfileSummary,
  Recommendation,
  Roadmap,
  TtsResponse,
} from "@/lib/pmist/types";

const WELCOME_TEXT =
  "Hi! Welcome to PMIST! 😊 What's your name? You can talk to me using the microphone below, or just type.";

function seedMessages(): ChatMessage[] {
  return [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: WELCOME_TEXT,
    },
  ];
}

function fallbackTts(): TtsResponse {
  return { audioBase64: null, mime: "", fallback: "browser" };
}

export default function Page() {
  const sessionIdRef = useRef<string>("");
  if (sessionIdRef.current === "") {
    sessionIdRef.current = crypto.randomUUID();
  }
  const sessionId = sessionIdRef.current;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [language, setLanguage] = useState<Language>("en");
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(
    null,
  );
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [profile, setProfile] = useState<ProfileSummary>({
    interests: [],
    language: "en",
  });
  const [verified, setVerified] = useState<boolean | null>(null);
  const [input, setInput] = useState("");

  const recorderRef = useRef<WavRecorder | null>(null);
  const speakResolveRef = useRef<(() => void) | null>(null);

  // Mount: seed the welcome bubble (no auto-speak — browsers block autoplay)
  // and load course verification status for the placeholder banner.
  useEffect(() => {
    setMessages(seedMessages());
    let cancelled = false;
    fetchCourses()
      .then((res) => {
        if (!cancelled) setVerified(res.verified);
      })
      .catch(() => {
        // Backend may not be reachable yet — banner stays hidden.
        console.warn("[pmist] /api/courses unavailable; skipping verification flag.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Speak a text via server TTS with browser fallback, resolving when done.
  const speakText = (text: string, lang: Language): Promise<void> => {
    return synthesize(text, lang)
      .catch(() => fallbackTts())
      .then(
        (tts) =>
          new Promise<void>((resolve) => {
            speakResolveRef.current = resolve;
            setStatus("speaking");
            speak(
              tts,
              text,
              lang,
              () => resolve(),
              () => resolve(),
            );
          }),
      );
  };

  async function handleSend(rawText: string): Promise<void> {
    const text = rawText.trim();
    if (!text) return;

    stopSpeaking();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text },
    ]);
    setStatus("thinking");

    try {
      const res = await sendChat(sessionId, text);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: res.reply },
      ]);
      setLanguage(res.language);
      setProfile(res.profile);
      if (res.recommendations && res.recommendations.length > 0) {
        setRecommendations(res.recommendations);
        setRoadmap(res.roadmap ?? null);
      } else if (res.roadmap) {
        setRoadmap(res.roadmap);
      }
      await speakText(res.speechText, res.language);
    } catch (err) {
      console.error("[pmist] chat failed:", err);
      toast.error("Something went wrong", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Sorry, something went wrong on my side. Please try again.",
        },
      ]);
    } finally {
      speakResolveRef.current = null;
      setStatus("idle");
      setInput("");
    }
  }

  function handleSendClick(): void {
    if (status !== "idle") return;
    void handleSend(input);
  }

  async function handleMicClick(): Promise<void> {
    if (status === "recording") {
      const recorder = recorderRef.current;
      if (!recorder) return;
      try {
        setStatus("transcribing");
        const { base64 } = await recorder.stop();
        const text = await transcribe(base64);
        if (!text.trim()) {
          toast.error("I couldn't hear that. Please try again or type your message.");
          setStatus("idle");
          return;
        }
        await handleSend(text);
      } catch (err) {
        console.error("[pmist] voice input failed:", err);
        toast.error("Voice input failed", {
          description: "Please try again or type your message instead.",
        });
        setStatus("idle");
      }
      return;
    }

    if (status === "idle") {
      try {
        if (!recorderRef.current) recorderRef.current = new WavRecorder();
        await recorderRef.current.start();
        setStatus("recording");
      } catch (err) {
        console.error("[pmist] microphone unavailable:", err);
        toast.error("Couldn't access the microphone", {
          description: "Please allow microphone access or type your message instead.",
        });
        setStatus("idle");
      }
    }
  }

  function handleStopSpeaking(): void {
    stopSpeaking();
    speakResolveRef.current?.();
    speakResolveRef.current = null;
    setStatus("idle");
  }

  async function handleSelectCourse(courseCode: string): Promise<void> {
    if (status !== "idle") return;
    setStatus("thinking");
    try {
      const res = await getRoadmap(sessionId, courseCode);
      setRoadmap(res.roadmap);
      await speakText(res.speechText, language);
    } catch (err) {
      console.error("[pmist] roadmap failed:", err);
      toast.error("Couldn't build the roadmap", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      speakResolveRef.current = null;
      setStatus("idle");
    }
  }

  async function handleRestart(): Promise<void> {
    stopSpeaking();
    speakResolveRef.current?.();
    speakResolveRef.current = null;
    try {
      await resetSession(sessionId);
    } catch {
      // Ignore reset failures — local state is cleared regardless.
    }
    setMessages(seedMessages());
    setRecommendations(null);
    setRoadmap(null);
    setProfile({ interests: [], language: "en" });
    setLanguage("en");
    setInput("");
    setStatus("idle");
    toast.success("Conversation cleared");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F2]">
      <Header language={language} onRestart={handleRestart} />

      {verified === false && (
        <div className="mx-auto w-full max-w-6xl px-3 pt-4 sm:px-6">
          <PlaceholderBanner />
        </div>
      )}

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-3 py-4 sm:px-6 lg:grid-cols-[1fr_400px]">
        <ChatWindow messages={messages} status={status} />

        {(recommendations || roadmap) && (
          <div className="self-start lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-y-auto [scrollbar-color:#fda4af_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-rose-300 [&::-webkit-scrollbar]:w-1.5">
            <RecommendationPanel
              profile={profile}
              recommendations={recommendations}
              roadmap={roadmap}
              onSelectCourse={(courseCode) => void handleSelectCourse(courseCode)}
              onBackToRecommendations={() => setRoadmap(null)}
            />
          </div>
        )}
      </div>

      <VoiceControls
        status={status}
        input={input}
        onInputChange={setInput}
        onMicClick={() => void handleMicClick()}
        onSend={handleSendClick}
        onStopSpeaking={handleStopSpeaking}
      />
    </div>
  );
}
