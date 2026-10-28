// Portable configuration hook for the managed AI gateway.
//
// In the development sandbox the SDK reads credentials from /etc/.z-ai-config.
// On an external host (Vercel/Render/Docker) you can supply the same JSON via
// the ZAI_CONFIG_JSON environment variable — it is materialised once at boot.
// For the fully-offline college deployment this is NOT needed: set
// AI_PROVIDER=ollama, ASR_PROVIDER=whisper and TTS_PROVIDER=piper instead.
import { existsSync, writeFileSync } from "fs";
import path from "path";

let ensured = false;

export function ensureZaiConfig(): void {
  if (ensured) return;
  ensured = true;
  try {
    if (existsSync("/etc/.z-ai-config")) return;
    const cwdConfig = path.join(process.cwd(), ".z-ai-config");
    if (existsSync(cwdConfig)) return;
    const raw = process.env.ZAI_CONFIG_JSON;
    if (!raw) return;
    JSON.parse(raw); // validate
    writeFileSync(cwdConfig, raw, { mode: 0o600 });
  } catch (err) {
    console.warn("[zai-config] could not materialise ZAI_CONFIG_JSON:", err instanceof Error ? err.message : err);
  }
}
