# PMIST Voice AI Admission Assistant

A friendly, multilingual **AI voice assistant for the admission department of Periyar Maniammai Institute of Science and Technology (PMIST)**, Thanjavur. It chats naturally with prospective students (English / Tamil / Tanglish), understands their interests, recommends **only verified PMIST courses**, and generates personalised educational & career roadmaps — with full voice input and voice output.

> ⚠️ **Course data status:** the bundled catalogue (`src/lib/pmist/data/courses.json`) is **development placeholder data** based on publicly known PMIST programmes. It is clearly flagged in the UI and in the database (`isPlaceholder = true`). Replace it with the **official PMIST course list** before any real use (see *Replacing the course list*).

---

## 1. What it does

1. Welcomes the student and asks their name
2. Converses naturally to discover favourite subjects, interests and career dreams
3. Matches interests against the verified course database using **deterministic backend logic**
4. Recommends a small set of courses — every course name is **validated against the database in backend code** before it can be shown or spoken (the model cannot invent courses)
5. Explains why each recommendation fits, with skills and career directions
6. Generates a personalised roadmap (foundations → skills → projects → internships → careers → next steps), clearly labelled as general guidance, not the official syllabus
7. Speaks every reply aloud and keeps listening — with text-input fallback everywhere

### Language support
| Style | Behaviour |
|---|---|
| English | Replies in friendly simple English |
| Tamil (தமிழ் script) | Replies in spoken Tamil script |
| Tanglish (Tamil in English letters) | Replies in Tanglish, mirroring the student |

Detection is automatic (Unicode + word heuristics); the current language is shown as a badge in the header.

---

## 2. Architecture

This project is a **single unified Next.js 16 fullstack app** (React frontend + REST API routes in one deployment), which maps to the classic client/server split like this:

| Spec structure | This project |
|---|---|
| `client/` (React) | `src/app/page.tsx`, `src/components/pmist/*`, `src/lib/pmist/client/*` |
| `server/routes/` | `src/app/api/{chat,roadmap,asr,tts,courses,session/reset}/route.ts` |
| `server/services/llmService` | `src/lib/ai/llm.ts` + `src/lib/pmist/orchestrator.ts` |
| `server/services/speechRecognition` | `src/lib/ai/asr.ts` |
| `server/services/textToSpeech` | `src/lib/ai/tts.ts` |
| `server/services/courseMatcher` | `src/lib/pmist/course-matcher.ts` |
| `server/services/roadmapService` | `src/lib/pmist/roadmap-service.ts` |
| `server/data/courses.json` | `src/lib/pmist/data/courses.json` |

### AI providers are switchable (offline requirement)

Every AI capability goes through a provider switch in `.env`:

| Capability | `zai` (managed demo) | fully offline option |
|---|---|---|
| LLM chat | `AI_PROVIDER=zai` | `AI_PROVIDER=ollama` (Ollama local model) |
| Speech-to-text | `ASR_PROVIDER=zai` | `ASR_PROVIDER=whisper` (whisper.cpp server) |
| Text-to-speech | `TTS_PROVIDER=zai` | `TTS_PROVIDER=piper` (piper-http server) |

**If the LLM is unreachable, the app does NOT fall back to any cloud service.** It degrades to a built-in **rule-based guided conversation engine** (`src/lib/pmist/rule-based.ts`) that is 100% local and still enforces the verified-course rule. Tamil TTS falls back to the browser/OS voice (see *Known limitations*).

### Hard course restriction (backend-enforced)

- Courses live in the `Course` table (seeded from `courses.json`) — the single source of truth.
- Candidate courses are selected by the deterministic matcher (`course-matcher.ts`).
- Every model-emitted recommendation is re-resolved against the candidate list; anything unknown triggers a corrective re-generation, and repeated violations are replaced with an honest "no verified match" reply.
- Course names in free text are also checked — mentioning a non-verified course gets neutralised.
- **No course outside the database can ever reach the UI or the speech output.**

---

## 3. Quick start (managed demo mode)

Requirements: Node.js 20+ or Bun, a PostgreSQL database.

```bash
# 1. install dependencies
npm install        # or: bun install

# 2. configure environment
cp .env.example .env   # then edit DATABASE_URL

# 3. create the database tables + seed the course catalogue
npx prisma db push
# the catalogue auto-seeds on first use; to seed explicitly (bun):
bun scripts/seed-courses.ts

# 4. run
npm run dev        # http://localhost:3000
```

`.env` keys (see `.env.example`):

```
DATABASE_URL="postgresql://..."
AI_PROVIDER=zai        # or ollama
ASR_PROVIDER=zai       # or whisper
TTS_PROVIDER=zai       # or piper
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma2:9b
WHISPER_URL=http://127.0.0.1:8080
PIPER_URL=http://127.0.0.1:8081
```

> In managed demo mode the AI gateway credentials are read from `.z-ai-config` (dev sandbox) or the `ZAI_CONFIG_JSON` environment variable. External hosts without that config automatically use the offline-safe rule-based engine for chat; voice output still works via the browser TTS fallback.

---

## 4. Fully offline deployment (college computers)

After the one-time setup below, **no internet connection is needed**. Works on Computer A (RTX 4050 6GB) and Computer B (RTX 4060).

### 4.1 LLM — Ollama

```bash
# install Ollama: https://ollama.com/download
ollama pull gemma2:9b          # good multilingual quality (EN/TA/Tanglish), ~5.4GB
# lighter alternative for 6GB VRAM:
ollama pull qwen2.5:7b-instruct-q4_K_M
# test Tamil quality before finalising:
ollama run gemma2:9b "Enakku computer science pudikkum. Edhu course nalla irukkum?"
```

`.env`:
```
AI_PROVIDER=ollama
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma2:9b
```

### 4.2 Speech-to-text — whisper.cpp server

```bash
git clone https://github.com/ggml-org/whisper.cpp && cd whisper.cpp
bash ./models/download-ggml-model.sh base.en    # English
bash ./models/download-ggml-model.sh small      # multilingual (better for Tamil/Tanglish)
cmake -B build && cmake --build build -j --config Release

# start the server on port 8080
./build/bin/whisper-server -m models/ggml-small.bin --port 8080
```

`.env`: `ASR_PROVIDER=whisper`, `WHISPER_URL=http://127.0.0.1:8080`

The browser records 16 kHz mono WAV (Web Audio API) and POSTs it to `/api/asr`, which forwards to whisper.cpp — audio is never stored.

### 4.3 Text-to-speech — Piper

Piper ships as a command-line tool; run it behind a tiny HTTP wrapper (any `piper-http` server exposes `POST /api/tts {text, voice}`):

```bash
# download voices (wav -> 22050Hz)
# English:  en_GB-alan-medium   |  Tamil (community): ta_IN voices on HuggingFace rhasspy/piper-voices
pip install piper-tts
echo "Welcome to PMIST" | piper -m en_GB-alan-medium.onnx -f test.wav
```

`.env`:
```
TTS_PROVIDER=piper
PIPER_URL=http://127.0.0.1:8081
PIPER_EN_VOICE=en_GB-alan-medium
PIPER_TA_VOICE=ta_IN-va_swara-medium
```

If Piper is unreachable or a Tamil voice is missing, the client automatically uses the browser's `speechSynthesis` with `ta-IN` / `en-IN` voices — never a cloud service.

### 4.4 Run everything offline

```bash
# terminal 1 (once): local model servers
ollama serve
./whisper.cpp/build/bin/whisper-server -m whisper.cpp/models/ggml-small.bin --port 8080
<your piper-http server> --port 8081

# terminal 2
npm run dev     # or: npm run build && npm start
```

Disconnect the internet — the full voice loop (mic → local ASR → local LLM → verified course matching → local TTS → speakers) keeps working.

---

## 5. Replacing the course list (IMPORTANT before real use)

1. Get the official PMIST course list from the admission department.
2. Edit `src/lib/pmist/data/courses.json` — each entry:

```json
{
  "code": "BT-CSE",                       // unique short code used by the matcher
  "name": "B.Tech Computer Science and Engineering",  // exact official name
  "level": "UG",                          // "UG" | "PG"
  "stream": "Engineering & Technology",
  "duration": "4 years",
  "description": "one or two factual sentences",
  "interests": ["programming", "ai", "games"],  // matching tags (English words work best)
  "skills": ["Programming (C, Java, Python)", "..."],
  "careers": ["Software Engineer", "..."]
}
```

3. Clear the DB table and re-seed:
```bash
npx prisma db push --accept-data-loss   # or delete rows manually
bun scripts/seed-courses.ts
```
4. Set `"verified": true` in the JSON meta **only after the list is confirmed**, and re-seed — the amber "placeholder" banner disappears and `isPlaceholder` becomes `false`.

The matcher is deterministic — keep `interests` tags as simple English words/phrases.

---

## 6. REST API

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/api/chat` | POST | `{sessionId, message}` | `{reply, speechText, language, stage, recommendations?, roadmap?, profile, error?}` |
| `/api/roadmap` | POST | `{sessionId, courseCode}` | `{roadmap, speechText}` |
| `/api/asr` | POST | `{audioBase64}` (16kHz WAV) | `{text}` |
| `/api/tts` | POST | `{text, language}` | `{audioBase64, mime, fallback}` — `fallback:"browser"` → client speaks via OS voice |
| `/api/courses` | GET | — | `{courses[], verified}` |
| `/api/session/reset` | POST | `{sessionId}` | `{ok}` — clears that conversation (privacy) |

Sessions are keyed by a browser-generated `sessionId`. Chat messages/profiles older than 24h are purged automatically on any reset; audio is never persisted.

---

## 7. Deployment

### Vercel (live)
- Deployed at **https://pmist-voice-assistant.vercel.app** (project `pmist-voice-assistant`).
- Env vars set: `DATABASE_URL` (Neon PostgreSQL), `AI_PROVIDER=zai`.
- On Vercel the LLM/ASR/TTS managed gateway is not configured, so chat runs on the built-in **offline-safe rule-based engine** (typed conversation + verified recommendations + roadmaps work; voice output uses the browser's OS voices).

### Render
Service creation via API returned `402 Payment Required` (Render now requires a payment method on file even for free services). Manual steps:
1. dashboard.render.com → **New → Web Service** → connect GitHub repo `nishamobile02-tech/pmist-voice-assistant` (public)
2. Build: `npm install && npx prisma generate && npm run build` · Start: `node .next/standalone/server.js`
3. Env vars: `DATABASE_URL`, `AI_PROVIDER=zai`, `NODE_VERSION=20`

---

## 8. Privacy & reliability

- Speech is processed by the configured ASR provider only; recordings are **never stored**.
- Restart button clears the session's chat + profile from the database; sessions idle >24h are auto-purged.
- No cloud fallback: if a local model fails you get an explicit error or the local rule-based engine — never a silent cloud call.
- Recommendations are informational guidance only — the app never claims admission eligibility.

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `P1001 can't reach database` | Check `DATABASE_URL`; for Neon remove `channel_binding` param |
| Mic button does nothing | Allow microphone permission; use Chrome/Edge; text input always works |
| "I couldn't hear that" toast | Whisper didn't detect speech — speak closer to the mic; check the whisper-server log |
| LLM errors in chat | `ollama serve` running? `AI_PROVIDER`/`OLLAMA_MODEL` correct? App keeps working in rule-based mode meanwhile |
| No voice output | Check speakers; "Stop speaking" button; Tamil uses browser OS voice (needs a Tamil voice installed) |
| Course list empty | `bun scripts/seed-courses.ts` or hit `/api/courses` once (auto-seeds) |
| Prisma validation error on `postgresql://` | A shell `DATABASE_URL` env is overriding `.env` — `unset DATABASE_URL` |

## 10. Known limitations (honest notes)

- **Course data is placeholder** until the official PMIST list is supplied and verified.
- **Tamil TTS**: the managed demo engine has no Tamil voice — Tamil replies use the browser's `ta-IN` OS voice (quality depends on the OS). For best offline Tamil speech, install a Piper Tamil voice.
- **Tanglish ASR accuracy** varies (code-mixed speech); recognition accuracy should be tested per machine. Text fallback always available.
- The managed LLM occasionally needs the backend's corrective pass to obey the course list — validation is enforced in code regardless.
- Render deployment pending payment-method setup (see §7).
