# STICKMAN STUDIO — STATUS.md
## Single Source of Truth: Project State + Product Definition

**Last Updated:** 2026-09-27 (Checkpoint 11)
**Workspace:** `E:\stickman-video-automation\`
**Studio URL:** `http://127.0.0.1:45450`
**DB:** `studio/data/studio.sqlite` (WAL Mode, 12 normalized tables)
**Shell:** Node.js/Express + Chrome `--app` mode (LOCKED DECISION)
**Primary AI:** `openai/gpt-oss-120b` on Groq (LOCKED DECISION)
**Fallback AI:** Ollama (local emergency only)
**Hardware:** 16 GB physical RAM (15.78 GiB OS visible), Windows 10/11

---

## SECTION 0 — WHAT THIS TOOL DOES (DO NOT FORGET)

Stickman Studio is a LOCAL-FIRST Windows desktop video production engine.

It is NOT a prompt generator. It is NOT an image downloader. It is NOT an FFmpeg wrapper.
It is a COMPLETE ORCHESTRATION SYSTEM: source material → production-ready 1080p MP4.

### THE PIPELINE (END TO END)

```
SCRIPT / PROMPT LIST
      ↓
PROMPTS (Mode 1: AI-generated | Mode 2: user-supplied)
      ↓
WORKER DISPATCH (Flow/Meta Chrome extensions, up to 10 workers)
      ↓
AI IMAGE GENERATION (real browser: flow.google.com / meta.ai)
      ↓
IMAGE VALIDATION (magic bytes + dimensions + 5KB + SHA-256)
      ↓
CENTRAL IMAGE STORE (Projects/<slug>/central_images/)
      ↓
REPAIR QUEUE (auto-detect missing/corrupt; priority re-gen)
      ↓
VOICEOVER MASTER TIMELINE (voiceover = master clock)
      ↓
CAPTIONS (Groq Whisper whisper-large-v3 → word-level ASS)
      ↓
SFX (semantic, scene-aware, low density)
      ↓
BACKGROUND MUSIC (optional, 7% ducked under voice)
      ↓
FFMPEG RENDER (1920x1080 30fps H.264/AAC MP4)
      ↓
FFPROBE VALIDATION
      ↓
PRODUCTION-READY VIDEO
```

---

## SECTION 1 — THE TWO MODES

### MODE 1 — GENERATE EVERYTHING
User gives: Title + Master Prompt + Script + Voiceover + Character Reference + Optional Music + Pacing
System: Story Analysis → Story Bible → Character Bible → Scene Plan → Prompt Count → Sequential Prompts → Fidelity QA → Worker Dispatch → Generation → Download → Validate → Timeline → Post-Production → Render

### MODE 2 — EXISTING PROMPT LIST
User gives: Prompt file (.txt/.md) + Voiceover + Character Reference
System: Parse → Validate Sequence → Check Gaps → Create Jobs → Worker Allocation → Generation → Download → Validate → Timeline → Post-Production → Render
Mode 2 does NOT regenerate prompts via AI.

### VOICEOVER = MASTER TIMELINE (NEVER BREAK THIS)
Formula: image_count = voiceover_duration_seconds x images_per_second
Default: 2 images / 4 sec = 0.50 images/sec
Example: 06:36 (396s) x 0.50 = 198 prompts
Example: 18:42 (1122s) x 0.50 = 561 prompts
Pacing presets: 1/4s, 2/4s, 3/4s, 4/4s, 5/4s, Custom

---

## SECTION 2 — ARCHITECTURE LOCKS (9 DECISIONS)

| # | Domain | LOCKED TO |
|---|---|---|
| 1 | Desktop Shell | Node.js/Express + Chrome --app (NO Tauri, NO Electron) |
| 2 | Prompt Numbering | Sequential 001_ IDs are MANDATORY |
| 3 | Image Directory | Projects/<slug>/central_images/ (canonical) |
| 4 | Size Boundary | >= 5,120 bytes (5.0 KB) minimum |
| 5 | Transcription | Groq Whisper whisper-large-v3 → fallback local STT |
| 6 | AI Model | openai/gpt-oss-120b on Groq |
| 7 | Music Volume | 7% (volume=0.07), voiceover always dominant |
| 8 | Bridge Lifecycle | 2.5s job poll / 5.0s heartbeat / 120s lease / auto-reconnect |
| 9 | Test Honesty | REAL / MOCK / AUDIT / BLOCKED / UNVERIFIED labels only |

---

## SECTION 3 — WORKER ARCHITECTURE

- Workers: Real isolated Chrome profiles (Workers/Worker-W01 ... Worker-W10)
- Max: 10 ACTIVE workers (user-configured, NEVER auto-reduced, NEVER auto-all-10)
- Bridge: Embedded bridge-client.js inside EACH existing extension (NO third extension)
- Extensions (TWO only — DO NOT BUILD A THIRD):
  - extensions/veo-automation-with Mbmirza → flow.google.com
  - extensions/meta automation → meta.ai
- When Studio is offline: extensions continue in standalone/manual mode

### Worker States (DO NOT INVENT NEW ONES):
CREATED → STARTING → EXTENSION_READY → LOGIN_REQUIRED → READY
→ INITIALIZING_REFERENCE → REFERENCE_READY → ASSIGNED → GENERATING
→ DOWNLOADING → VALIDATING → IDLE → PAUSED → ERROR → OFFLINE

### Job States:
QUEUED → ASSIGNED → ACKNOWLEDGED → GENERATING → DOWNLOAD_PENDING
→ DOWNLOADING → VALIDATING → COMPLETED
Failure: FAILED → RETRYING / REPAIR_PENDING / BLOCKED

---

## SECTION 4 — IMAGE VALIDATION (7-TIER, NON-NEGOTIABLE)

Every downloaded image MUST pass:
1. File exists on disk
2. Prompt ID matches filename
3. Magic bytes valid (PNG/JPEG/WebP)
4. Dimensions valid
5. File size >= 5,120 bytes
6. SHA-256 calculated and stored
7. Central storage transaction succeeds

Only validated images enter central_images/. Raw downloads stay in downloads_raw/.

---

## SECTION 5 — STORY FIDELITY RULES

THE SCRIPT IS THE ONLY VISUAL TRUTH.

NEVER invent: characters / objects / locations / actions / events /
historical facts / dates / measurements / dialogue / dramatic events /
visual symbolism not in the narration.

If script says "possibly" → preserve uncertainty in prompt.
If script says "unknown" → do NOT confirm as fact.
If script ends abruptly → FLAG IT, do not invent ending.
If scene has one character → do NOT add another.

Visual universe: 2D hand-drawn stickman / illustrated world ONLY.
BANNED: photorealism / realistic humans / stock photos / realistic food /
realistic mountains / realistic fire / 3D CGI / live-action.

Character identity LOCKED: head, face, limbs, hands, feet, line weight,
clothing, colors, silhouette, accessories.
Only pose/action/expression/location/framing may change per script.

---

## SECTION 6 — DATABASE SCHEMA (12 TABLES, WAL MODE)

studio/data/studio.sqlite tables:
settings | system_logs | projects | character_references
prompts | prompt_versions | workers | jobs
timeline_items | captions | audio_tracks | renders

Unique constraint: no duplicate prompt indexes within a project.

---

## SECTION 7 — CRASH RECOVERY

A. Studio Crash: SQLite persists. Completed prompts stay completed.
   Stale in-flight → reconciliation → repair queue.

B. Worker/Chrome Crash: Heartbeat stops → lease expires → worker OFFLINE
   → unfinished job → REPAIR_PENDING → replacement worker checks reference state
   → INITIALIZE_REFERENCE if needed → then receives repair job.
   A crashed worker NEVER causes completed images to regenerate automatically.

---

## SECTION 8 — VERIFICATION VOCABULARY (MANDATORY)

| Label | Meaning |
|---|---|
| REAL | Physically executed: real Chrome / live API / physical disk / real FFmpeg |
| HISTORICAL REAL | Real evidence from prior session (timestamped, documented) |
| MOCK / SIMULATION | Synthetic data, mock cluster, in-process simulation |
| AUDIT | Source code / schema / disk structure inspection only |
| BLOCKED | Waiting on human action (API key, login, physical action) |
| UNVERIFIED | Code exists but live test not yet performed |

NEVER label MOCK, SIMULATION, AUDIT, or CODE INSPECTION as REAL.

---

## SECTION 9 — PHASE IMPLEMENTATION STATUS

| Phase | What | Status | Evidence |
|---|---|---|---|
| Phase 1: Foundation | Node/Express, Chrome App Mode, SQLite 12 tables, WAL, Project CRUD | DONE | REAL (PID 4840, 59 audit checks) |
| Phase 2: Flow Worker W01 | Chrome profile, bridge-client, prompt dispatch, heartbeat, lease | DONE | HISTORICAL REAL (2026-09-27 06:54 UTC; 1376x768 WebP 122KB) |
| Phase 2: Meta Worker W02 | Bridge embedded, LOGIN_REQUIRED in SQLite | DONE (code) | BLOCKED — awaiting Meta login |
| Phase 2: Orchestration | Range allocation, stale reaper, lease expiry, repair failover | DONE | MOCK/SIMULATION (verify_phase2.js harness) |
| Phase 3: Mode 2 Ingestion | Magic bytes, 5KB, SHA-256, central_images/, timeline pacing math | DONE | AUDIT + SIMULATION (verify_phase3.js local stubs) |
| Phase 3: Repair Queue | Orphan detection, corrupt file detection, reconciliation | DONE | AUDIT |
| Phase 3: Crash Recovery | OS-kill test, lease reaping, in-flight reconciliation | DONE | REAL (physical process kill verified) |
| Phase 4: FFmpeg Render | 1080p 30fps H.264/AAC, ASS captions, ffprobe validate | DONE | REAL (test_master_render.mp4 85,456 bytes) |
| Phase 4: Captions | Groq Whisper + local STT fallback, word-level ASS | DONE (code) | UNVERIFIED — real Groq Whisper acceptance pending |
| Phase 5: Mode 1 UI Contract | All 8 inputs wired: Title, MasterPrompt, Script, Voiceover, CharRef, Music, Pacing | DONE | AUDIT (UI + backend endpoints verified) |
| Phase 5: Story Bible / AI Engine | Groq call, Story Bible, scene decomp, sequential prompts, Fidelity QA | DONE (code) | BLOCKED — real Groq key not configured |
| Phase 5: Fidelity QA Engine | Tier 1 (deterministic) + Tier 2 (provenance) + Tier 3 (semantic judge) | DONE (code) | UNVERIFIED — real cloud output not reviewed |
| Phase 6: Real Groq 72s test | openai/gpt-oss-120b, 72s script, ~36 prompts, Story Bible | BLOCKED | Groq API key required |
| Phase 6: Real Groq 150-prompt test | Long script, 150 prompts, fidelity review | BLOCKED | Groq API key required |
| Phase 6: Real Meta E2E | One real Meta generation cycle | BLOCKED | Meta.ai login in Worker-W02 profile |
| Phase 6: Physical Side-Panel | Close → reopen → re-register → resume bridge | UNVERIFIED | Must be physically observed |
| Phase 6: 15-20 prompt smoke test | Real Flow/Meta generation with real assets | NOT RUN | Requires real browser workers |
| Phase 6: 200-prompt acceptance | Full batch real generation | NOT RUN | Post smoke-test gate |

---

## SECTION 10 — ACTIVE BLOCKERS (HUMAN ACTION REQUIRED)

### BLOCKER 1: Groq API Key
- Model: openai/gpt-oss-120b
- Last key: HTTP 401 → securely purged
- Action: Studio Settings UI → http://127.0.0.1:45450 → Settings → Groq API Key → Save
- Or: set GROQ_API_KEY in E:\stickman-video-automation\studio\.env
- Once configured: run 72s test → 150-prompt test → semantic fidelity review

### BLOCKER 2: Meta Worker W02 Login
- State: LOGIN_REQUIRED (confirmed in SQLite)
- Action: Open Chrome with Workers/Worker-W02 profile → https://www.meta.ai/ → login manually

### BLOCKER 3: Physical Side-Panel Lifecycle
- State: UNVERIFIED
- Action: Load extension in Chrome → open side panel → minimize/close → reopen → verify bridge auto-reconnects

---

## SECTION 11 — WHAT MUST NEVER HAPPEN

- DO NOT build a third Chrome extension
- DO NOT rewrite the Flow/Meta generation engines
- DO NOT use synthetic/mock output in production
- DO NOT claim REAL where only AUDIT or SIMULATION occurred
- DO NOT auto-launch all 10 workers
- DO NOT silently reduce worker count
- DO NOT change prompt chronology to fit image generation
- DO NOT invent script content not in narration
- DO NOT put API keys in source code / logs / markdown / git
- DO NOT spend time on extra docs instead of implementing missing features
- DO NOT build a mostly empty dashboard with 4 fake stat cards
- DO NOT mark cloud acceptance complete without real evidence

---

## SECTION 12 — DASHBOARD REQUIREMENTS

Dashboard = production command center (NOT an analytics page).
User must immediately see:
1. What project am I on?
2. How much is complete?
3. How many images are done/missing?
4. What are workers doing RIGHT NOW?
5. Are there failures / repairs / blockers?
6. What should I do NEXT?
7. What is the timeline/voiceover status?
8. Is the project ready to render?

Sections required: Project Summary | Pipeline Progress | Image Generation Status |
Active Workers | Prompt/Image Counts | Repair Queue | Asset Health |
Master Timeline Summary | Voiceover Status | Next Action | Alerts | Recent Activity

---

## SECTION 13 — PENDING ENHANCEMENTS (NOT YET STARTED)

- Multi-key Groq rotation / failover
- Live Groq Whisper production captioning (real acceptance)
- Cross-provider visual drift testing
- Expanded reusable SFX/music library
- Final desktop packaging (installer)

---

*Checkpoint 11 — 2026-09-27. Next: unblock Groq API key or Meta login to proceed with real acceptance gates.*
