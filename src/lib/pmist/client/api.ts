// Typed fetch helpers for the PMIST Voice AI Admission Assistant.
// All requests use relative URLs with JSON bodies, per the API contract in worklog.md.
import type {
  ChatResponse,
  CoursesResponse,
  Language,
  RoadmapResponse,
  TtsResponse,
} from "@/lib/pmist/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new Error(
      err instanceof Error ? `Network error: ${err.message}` : "Network error",
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export function sendChat(
  sessionId: string,
  message: string,
): Promise<ChatResponse> {
  return requestJson<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ sessionId, message }),
  });
}

export function getRoadmap(
  sessionId: string,
  courseCode: string,
): Promise<RoadmapResponse> {
  return requestJson<RoadmapResponse>("/api/roadmap", {
    method: "POST",
    body: JSON.stringify({ sessionId, courseCode }),
  });
}

export async function transcribe(audioBase64: string): Promise<string> {
  const data = await requestJson<{ text: string }>("/api/asr", {
    method: "POST",
    body: JSON.stringify({ audioBase64 }),
  });
  return data.text;
}

export function synthesize(
  text: string,
  language: Language,
): Promise<TtsResponse> {
  return requestJson<TtsResponse>("/api/tts", {
    method: "POST",
    body: JSON.stringify({ text, language }),
  });
}

export function fetchCourses(): Promise<CoursesResponse> {
  return requestJson<CoursesResponse>("/api/courses");
}

export async function resetSession(sessionId: string): Promise<void> {
  await requestJson<{ ok: boolean }>("/api/session/reset", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}
