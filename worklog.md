# PMIST Voice AI Admission Assistant — Worklog

Project: Offline-style AI voice assistant for PMIST admissions (Next.js 16 unified fullstack).
User-visible route: `/` only. API routes provide backend services.

---
Task ID: 1, 2
Agent: main (Z.ai Code)
Task: Project recon, DB setup

Work Log:
- Read LLM/ASR/TTS skill docs (z-ai-web-dev-sdk; backend only).
- Tested Neon PostgreSQL TCP connectivity: OK.
- Switched prisma/schema.prisma to postgresql, models: Course, ChatMessage, StudentProfile.
- Removed unsupported `channel_binding` param from DATABASE_URL; pushed schema with `prisma db push` — OK (neondb).
- NOTE: shell exports a stale `DATABASE_URL=file:...` that overrides .env. Must `export DATABASE_URL=<neon url>` in each fresh shell before prisma CLI. Dev server restarted with correct env.
- Added AI provider switch env vars (AI_PROVIDER/ASR_PROVIDER/TTS_PROVIDER + OLLAMA_URL/WHISPER_URL/PIPER_URL) to .env so the college can flip to fully-offline Ollama/whisper.cpp/Piper without code changes.

Stage Summary:
- Neon PostgreSQL is the live DB (Course, ChatMessage, StudentProfile tables).
- Dev server on :3000 healthy.

## API CONTRACT (authoritative — frontend and backend must both follow)

Types live in `src/lib/pmist/types.ts`.

- POST /api/chat  body {sessionId: string, message: string} → ChatResponse {reply, speechText, language: "en"|"ta"|"tanglish", stage, recommendations?: Recommendation[], roadmap?: Roadmap|null, profile: {name?, interests[], careerGoal?, language}, error?: string}
- POST /api/roadmap body {sessionId, courseCode} → {roadmap: Roadmap, speechText: string}
- POST /api/asr body {audioBase64: string, mime?: string} → {text: string} | {error}
- POST /api/tts body {text: string, language: "en"|"ta"|"tanglish"} → {audioBase64: string|null, mime: string, fallback: "browser"|null}  (Tamil → fallback:"browser", client uses speechSynthesis)
- GET /api/courses → {courses: CourseSummary[], verified: boolean}
- POST /api/session/reset body {sessionId} → {ok: true}
- Errors: non-2xx {error: string}

Frontend files (subagent scope): src/app/page.tsx, src/app/layout.tsx (metadata only), src/components/pmist/*, src/lib/pmist/client/*.
Backend files (main scope): src/app/api/**, src/lib/pmist/** (except client/), scripts/seed-courses.ts, src/lib/ai/*.

Hard rules: only courses from the DB may be recommended (validated in backend); UI must show "placeholder data pending official verification" banner while courses are unverified; do not store audio; restart clears session data.

---
Task ID: 4-a
Agent: full-stack-developer (frontend)
Task: Build PMIST voice assistant frontend UI

Work Log:
- Read worklog.md API contract + src/lib/pmist/types.ts; audited existing shadcn/ui components (button, input, card, badge, alert-dialog, sonner) and confirmed sonner/lucide-react deps.
- Created src/lib/pmist/client/api.ts — typed fetch helpers (sendChat, getRoadmap, transcribe, synthesize, fetchCourses, resetSession) on a shared requestJson wrapper that throws Error(payload.error) on non-2xx and wraps network failures; all relative URLs with JSON bodies.
- Created src/lib/pmist/client/recorder.ts — WavRecorder class: getUserMedia (mono, echoCancellation, noiseSuppression) → AudioContext → ScriptProcessorNode(4096,1,1) into Float32 chunk array, wired to a zero-gain destination to keep it pulling; stop() releases tracks/context, merges chunks, linear-interp downsamples to 16 kHz, encodes 16-bit PCM WAV (44-byte header), converts to base64 via chunked String.fromCharCode (0x8000); clean abort if stop() without start(); isRecording getter.
- Created src/lib/pmist/client/speaker.ts — speak(): plays data-URI Audio when tts.audioBase64 present, else speechSynthesis fallback (ta→ta-IN, tanglish/en→en-IN, preferred voice via lang startsWith, rate 1) when fallback==="browser", else immediate onEnd; 100ms onEnd grace when speechSynthesis/voices unavailable; stopSpeaking() pauses+resets module-level Audio and cancels speechSynthesis.
- Created src/components/pmist/: Header (sticky, maroon GraduationCap mark, LANGUAGE_LABEL badge, Restart via RestartDialog), RestartDialog (AlertDialog, clears history+profile copy), PlaceholderBanner (amber, only when courses verified===false), MessageBubble (user maroon rounded-br-md right / assistant white card with maroon avatar left, whitespace-pre-wrap), ChatWindow (main[role=log][aria-live=polite], auto-scroll, thin rose scrollbar), StatusPill (recording red pulse / transcribing / thinking Loader2 / speaking Volume2, sr-only aria-live, hidden when idle), VoiceControls (sticky safe-area footer: 56px maroon mic toggling red pulsing while recording + disabled when busy, 44px input, send, red stop-speaking button while speaking, Enter submits form), CourseCard (level/stream/duration outline badges, whyItFits, skill chips, careers w/ Briefcase, amber ring + "Best match" when isTop, placeholder footnote, "View roadmap" CTA), RoadmapView (6 icon sections, personalNote, fixed disclaimer, back button), RecommendationPanel (replaces list with roadmap when open; hidden when empty).
- Rewrote src/app/page.tsx — cream #FAF7F2 / maroon #7A1E2B / amber palette; sessionId lazy useRef(crypto.randomUUID()); state machine status idle|recording|transcribing|thinking|speaking; flow: send → user bubble → sendChat → reply bubble + language/profile/recommendations/roadmap updates → synthesize(speechText) → speak with onEnd→idle, TTS network error falls back to browser speechSynthesis; mic: WavRecorder start/stop → transcribe → empty-text toast or handleSend; stop-speaking resolves the pending speak promise via speakResolveRef; restart calls /api/session/reset (errors ignored), reseeds welcome bubble, toast "Conversation cleared"; on mount seeds welcome bubble (no autoplay) + fetchCourses for verified flag (banner hidden if API unreachable); layout min-h-screen flex-col with lg grid 1fr/400px, recommendations sticky right column on lg / below chat on mobile.
- Updated src/app/layout.tsx metadata (title "PMIST Admission Assistant — Voice AI", PMIST description/keywords, /logo.svg icon) and swapped Toaster to @/components/ui/sonner with richColors position="top-center".
- Quality gates: bun run lint → clean; bunx tsc --noEmit → clean for all task-4-a files (only pre-existing errors remain in examples/ and skills/, outside scope); re-read every produced file for unused imports / any leaks / path correctness; verified GET / rendered 200 in dev.log before handoff.

Stage Summary:
- Frontend complete per API contract: voice-first chat UI (mic→WAV 16k base64→/api/asr→/api/chat→/api/tts with browser speechSynthesis fallback), typed-input fallback, recommendations panel with roadmap drill-down, restart with confirm, unverified-courses amber banner, sonner toasts, a11y (aria-labels/live regions, ≥44px targets, semantic header/main/footer).
- Assumptions: /api/asr returns {text} and /api/tts returns 2xx TtsResponse per contract; roadmap speechText is spoken using the last detected language; courses fetch failure hides (never fakes) the banner; stop-speaking intentionally ends the speak cycle without an error toast.
- Produced artifacts: src/lib/pmist/client/{api,recorder,speaker}.ts, src/components/pmist/{Header,RestartDialog,PlaceholderBanner,ChatWindow,MessageBubble,StatusPill,VoiceControls,CourseCard,RoadmapView,RecommendationPanel}.tsx, src/app/page.tsx, src/app/layout.tsx.

---
Task ID: 4-b
Agent: main (Z.ai Code)
Task: Backend - AI providers, course matcher, orchestrator, API routes

Work Log:
- src/lib/ai/{llm,asr,tts}.ts: provider-switchable (zai managed | ollama/whisper.cpp/piper offline) via env AI_PROVIDER/ASR_PROVIDER/TTS_PROVIDER.
- src/lib/pmist/: language.ts (en/ta/tanglish detection + speech text cleaner), course-store.ts (DB loader + JSON seeder), course-matcher.ts (deterministic synonym/tag scoring), orchestrator.ts (stage machine welcome->discovery->recommend->followup, strict recommendation validation with one corrective LLM pass), roadmap-service.ts (personalised roadmap, catalogue-grounded, disclaimer).
- API routes: /api/chat, /api/roadmap, /api/asr, /api/tts, /api/courses, /api/session/reset (24h stale-session cleanup).
- scripts/seed-courses.ts: 16 placeholder courses seeded to Neon.
- Fixed recommendation drop bug: loose code/name resolution + corrective regeneration + normalized invalid-mention detection.

Stage Summary:
- curl-verified: name turn, Tanglish interests, recommendation cards (BT-CSE/BT-AIDS validated), roadmap (3.2s, all sections), MBBS correctly rejected with no fabricated course, Tamil-script reply, TTS WAV 148KB, reset OK.
- LLM raw output logged to dev.log via console.log for debugging.

---
Task ID: 5, 6, 7
Agent: main (Z.ai Code)
Task: API tests, integration, Agent Browser verification

Work Log:
- bun run lint + tsc --noEmit: clean (0 errors/warnings).
- Agent Browser E2E on http://localhost:3000/: page renders (no hydration errors, clean console); golden path verified — typed name turn -> friendly reply; interests + "Recommend a course" -> reply naming ONLY verified courses (BT-CSE, BT-AIDS) + validated recommendation cards with Best match badge/skills/careers/placeholder note; View roadmap -> personalised roadmap with all sections + disclaimer; Restart dialog clears conversation; placeholder banner shows (verified=false); Tanglish input -> Tanglish reply; TTS audio audibly plays with Stop-speaking button and busy-guards.
- Mobile 390x844: layout holds, sticky footer intact; fixed header truncation on small screens.
- Mic path: microphone capture needs real user permission in headless browser — verified button states/busy-guards/WAV pipeline by code review + API test; ASR endpoint tested server-side.

Stage Summary:
- App fully working in browser: chat, recommendations, roadmap, TTS playback, restart, responsive.

---
Task ID: 8, 9, 10, 11
Agent: main (Z.ai Code)
Task: GitHub push, deployments, README, final verification

Work Log:
- GitHub: repo nishamobile02-tech/pmist-voice-assistant created and pushed (public for college submission). Verified no secrets tracked (.env untracked, git grep clean for all 4 tokens).
- Added offline-safe rule-based fallback engine (src/lib/pmist/rule-based.ts) wired into orchestrator catch-path: when the LLM is unreachable, conversation continues locally with stage machine + validated matcher recommendations (no cloud fallback, spec-compliant). Unit-tested in en/tanglish/ta.
- Added ZAI_CONFIG_JSON portable config hook (zai-config.ts) for external hosts.
- Vercel: deployed https://pmist-voice-assistant.vercel.app (DATABASE_URL + AI_PROVIDER=zai). Smoke-tested live: root 200, /api/courses works via Neon, chat works via rule-based engine with validated course codes.
- Render: service creation via API returns 402 Payment Required (Render requires payment method on file even for free tier). Documented manual steps in README.
- README.md: full deliverable docs (architecture mapping, offline Ollama/whisper.cpp/Piper runbook, course DB format, API reference, deployment, privacy, troubleshooting, honest limitations).
- Final browser re-verification after changes: Tanglish business/accounts flow -> B.Com + BBA validated cards, TTS speaking, clean console.

Stage Summary:
- Delivered: working app (local + Vercel), GitHub repo, README runbook, offline provider switches, rule-based degraded mode.
- Honest gaps: Render deploy needs user's payment setup; course data still placeholder pending official PMIST list; Tamil TTS via browser OS voice in demo mode.

---
Task ID: 12
Agent: main (Z.ai Code)
Task: Integrate the official PMIST course list (52 courses) supplied by the user

Work Log:
- User supplied the official course document (PMIST_Open_House_Course_Career_Chatbot.docx): 52 programmes (22 B.Tech + B.Arch + 12 Computing/Arts&Science UG + 6 Commerce + 4 BBA + 3 Humanities + 2 Education + 3 new 2026-27 TATTI courses), each with "best suited for" line, 5 roadmap steps and career directions, plus the subject-to-course matching table.
- prisma/schema.prisma: Course model += bestSuitedFor, roadmapSteps (JSON), isNew2026, association; db:push to Neon OK.
- src/lib/pmist/data/courses.json: fully rewritten with the 52 verified courses (verbatim official roadmap steps/careers; standard programme durations; isNew2026+TATTI flags; subjectGroups matching table embedded in meta).
- course-store.ts: new fields in CourseRecord/toRecord; seeding marks isPlaceholder=false; added syncCoursesFromJson() (idempotent upsert + stale-row deletion); /api/courses now returns meta (source, academicYear, note).
- scripts/seed-courses.ts: full-sync upsert — synced 52 official courses, removed 13 stale placeholder rows, 0 placeholders remaining.
- course-matcher.ts: ~120 new synonyms (uav/drones, ev/battery, fintech, hospitality, logistics, film/journalism, renewable, teaching, company secretary, etc.).
- roadmap-service.ts: roadmap sections now map the 5 OFFICIAL steps positionally (foundations→skills→projects→internships→next steps) + official careers; LLM only writes the personal note; new disclaimer.
- orchestrator.ts: candidates prompt uses bestSuitedFor; reply-text validation now against the WHOLE verified catalogue (real course outside this turn's candidates no longer falsely wiped); new guard blocks invented courses when candidates=null (MBBS case); honest no-match reply no longer paired with course cards; course-list wording de-placeholdered.
- UI: PlaceholderBanner.tsx adds VerifiedBanner (green, 52-programme count + meta note); page.tsx renders it when verified; CourseCard shows "New 2026-27 · with TATTI" badge; prompt example updated to real codes.
- Fixed: unquoted "drone pilot" synonym key (compile error), 7 duplicate synonym keys, page.tsx count typing.
- Verified: /api/courses → verified=true, count=52; Tanglish business flow → CO-BCOM/MG-BBA/CO-BCOM-CA; drone-pilot EN flow → BT-AE-UAV top match; MBBS → honest rejection, no fake codes; roadmap for BT-AE-UAV shows official steps verbatim; lint + tsc clean (app scope).
- Agent Browser E2E: green verified banner renders; Kavya→drawing/buildings→B.Arch [AR-BARCH] card + official roadmap (all sections + disclaimer); Tanglish Divya→BBA Digital Marketing [MG-BBA-DM] + alternatives; restart clears; TTS speaks with Stop button; mobile 390x844 holds; zero console/page errors.
- README.md: status note → VERIFIED (52 programmes), "Updating the course list" section rewritten (new JSON fields + idempotent sync), API table meta, limitations updated.

Stage Summary:
- The last "pending official course list" gap is closed: the assistant now recommends ONLY the 52 officially supplied PMIST programmes and roadmaps come verbatim from the official document (LLM invents nothing but the personal note).
- Dev server restarted with exported Neon DATABASE_URL (fresh shells override .env with stale file: URL — remember to export).
- Remaining honest caveats: confirm catalogue against the final 2026-27 brochure per PMIST's own note; Tamil TTS still browser-voice in demo mode.
