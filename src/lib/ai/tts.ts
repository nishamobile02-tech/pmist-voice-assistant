// Text-to-speech provider abstraction.
// - "zai": managed TTS (hosted demo). Good English; no Tamil voice -> browser fallback for Tamil.
// - "piper": piper-http server (fully offline). Supports en + (community) ta voices.
import type { Language } from "@/lib/pmist/types";
import type { TtsResponse } from "@/lib/pmist/types";

const MAX_LEN = 1000; // z-ai limit is 1024; keep headroom

export async function synthesize(text: string, language: Language): Promise<TtsResponse> {
  const provider = (process.env.TTS_PROVIDER || "zai").toLowerCase();
  const clean = text.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);

  if (provider === "piper") {
    try {
      const url = process.env.PIPER_URL || "http://127.0.0.1:8081";
      const voice =
        language === "ta"
          ? process.env.PIPER_TA_VOICE || "ta_IN-va_swara-medium"
          : process.env.PIPER_EN_VOICE || "en_GB-alan-medium";
      const res = await fetch(`${url}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, voice }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`piper error ${res.status}`);
      const buf = Buffer.from(new Uint8Array(await res.arrayBuffer()));
      return {
        audioBase64: buf.toString("base64"),
        mime: "audio/wav",
        fallback: null,
      };
    } catch {
      // never fall back to cloud: degrade to browser speech
      return { audioBase64: null, mime: "", fallback: "browser" };
    }
  }

  // Default: managed demo TTS
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();
    // English-capable, warm voice. Tamil is NOT supported by this engine:
    // for "ta" we return the browser-fallback so the client uses the OS voice.
    const voice = language === "tanglish" ? "jam" : "tongtong";
    if (language === "ta") {
      return { audioBase64: null, mime: "", fallback: "browser" };
    }
    const response = await zai.audio.tts.create({
      input: clean,
      voice,
      speed: 0.95,
      response_format: "wav",
      stream: false,
    });
    const buf = Buffer.from(new Uint8Array(await response.arrayBuffer()));
    return { audioBase64: buf.toString("base64"), mime: "audio/wav", fallback: null };
  } catch {
    return { audioBase64: null, mime: "", fallback: "browser" };
  }
}
