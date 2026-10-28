// Speech-to-text provider abstraction.
// - "zai": managed ASR (hosted demo)
// - "whisper": whisper.cpp server (fully offline, e.g. `whisper-server -m models/ggml-base.bin --port 8080`)
export interface AsrResult {
  text: string;
  provider: string;
}

export async function transcribeBase64(audioBase64: string): Promise<AsrResult> {
  const provider = (process.env.ASR_PROVIDER || "zai").toLowerCase();

  if (provider === "whisper") {
    const url = process.env.WHISPER_URL || "http://127.0.0.1:8080";
    const bytes = Buffer.from(audioBase64, "base64");
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type: "audio/wav" }), "audio.wav");
    form.append("response_format", "json");
    form.append("temperature", "0");
    const res = await fetch(`${url}/inference`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`whisper.cpp server error ${res.status}`);
    const data = (await res.json()) as { text?: string };
    return { text: (data.text ?? "").trim(), provider: "whisper.cpp" };
  }

  // Default: managed demo ASR
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const response = await zai.audio.asr.create({ file_base64: audioBase64 });
  return { text: (response.text ?? "").trim(), provider: "zai" };
}
