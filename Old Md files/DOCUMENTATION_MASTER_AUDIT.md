# STICKMAN STUDIO — MASTER DOCUMENTATION & SPECIFICATION AUDIT
**Generated:** 2026-09-27  
**Status:** COMPLETE AUDIT ONLY (NO CODE / IMPLEMENTATION CHANGES APPLIED)  
**Workspace:** `E:\stickman-video-automation`  
**Audit Standard:** Zero-assumption, empirical disk-and-source verification.

---

## 1. COMPLETE MARKDOWN FILE INVENTORY

A complete recursive scan of `E:\stickman-video-automation` (excluding `node_modules`, `.git`, and `.venv`) discovered **23 Markdown (.md) files**:
- **10 Core System & Architecture Documents**
- **2 Extension Reference Documents**
- **11 Generated Test Project Prompts**

| # | Filename | Full Path | Size (Bytes) | Last Modified (UTC) | Apparent Purpose | Authority Classification |
|---|---|---|---|---|---|---|
| 1 | `GPT.md` | `E:/stickman-video-automation/GPT.md` | 23,929 | 2026-09-26 21:13:37 | Product vision, workflow definitions, Mode 1/2 concept, business logic, locked UI requirements | **Authoritative (Product & UX)** |
| 2 | `claude.md` | `E:/stickman-video-automation/claude.md` | 20,534 | 2026-09-27 12:42:44 | Architecture decisions, bridge polling protocol, 7% audio lock, worker lifecycle | **Authoritative (Architecture Principles)** |
| 3 | `CLAUDE from gpt.md` | `E:/stickman-video-automation/CLAUDE from gpt.md` | 23,696 | 2026-09-26 21:13:50 | Technical engineering spec, DB schema contract, lease mechanics, worker state machine | **Authoritative (Technical Contracts)** |
| 4 | `ANTIGRAVITY.md` | `E:/stickman-video-automation/ANTIGRAVITY.md` | 22,509 | 2026-09-26 21:14:42 | Agent execution rules, strict preservation constraints, sequence gates, non-negotiables | **Authoritative (Execution Constraints)** |
| 5 | `antigravity tasks.md` | `E:/stickman-video-automation/antigravity tasks.md` | 44,872 | 2026-09-26 21:23:16 | Master exhaustive implementation directive, multi-phase checklists, test specs | **Authoritative (Phase Specs) / Historical (Tauri Shell & Deprecated Models)** |
| 6 | `STICKMAN_STUDIO_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md` | `E:/stickman-video-automation/STICKMAN_STUDIO_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md` | 30,556 | 2026-09-27 12:41:58 | Deep-dive architectural report on extension internals, bridge injection points, Phase 0 lab | **Authoritative (Extension Bridge & Validation)** |
| 7 | `STICKMAN_STUDIO_DETAILED_TASKS_BREAKDOWN.md` | `E:/stickman-video-automation/STICKMAN_STUDIO_DETAILED_TASKS_BREAKDOWN.md` | 19,870 | 2026-09-27 12:42:09 | Granular Phase 0-6 task breakdown with checkboxes and acceptance deliverables | **Authoritative (Task Checklist Tracking)** |
| 8 | `input master prompt...STICKMAN_LOCKED.md` | `E:/stickman-video-automation/input master prompt i give this to chatgpt and scriptt to chjatgpt chatboxct and chatgpt give me list or prompts for as input SCRIPT_TO_IMAGE_PROMPT_MASTER_V7_STICKMAN_LOCKED.md` | 24,129 | 2026-09-27 04:37:34 | Prompt Master V7 for converting narration scripts into stickman visual generation prompts | **Authoritative (Prompt Engineering & Visual Rules)** |
| 9 | `STATUS.md` | `E:/stickman-video-automation/STATUS.md` | 11,965 | 2026-09-27 13:54:40 | Real vs mock status disclosures, physical implementation map, real integration tests | **Authoritative (Current Verification Status)** |
| 10 | `REAL_INTEGRATION_ACCEPTANCE_REPORT.md` | `E:/stickman-video-automation/REAL_INTEGRATION_ACCEPTANCE_REPORT.md` | 6,858 | 2026-09-27 13:54:28 | Acceptance pass report for real process kill, spoken audio, byte validation, natural lease | **Authoritative (Physical Integration Evidence)** |
| 11 | `README.md` | `E:/stickman-video-automation/extensions/meta automation/README.md` | 8,878 | 2026-09-26 14:23:40 | Meta AI extension v2.2.3 reference documentation, queue handling, prompt delimiters | **Supporting (Meta Extension Reference)** |
| 12 | `README.md` | `E:/stickman-video-automation/extensions/veo-automation-with Mbmirza/README.md` | 9,572 | 2026-09-26 14:24:28 | Flow/Veo extension v3.5.2 reference documentation, character reference, batch handling | **Supporting (Flow Extension Reference)** |
| 13 | `source.md` | `E:/stickman-video-automation/Projects/Phase-1-Test-Project_6_69ge/prompts/source.md` | 690 | 2026-09-27 13:00:53 | Generated prompt test source for Phase 1 verification | **Generated (Test Artifact)** |
| 14 | `source.md` | `E:/stickman-video-automation/Projects/Phase-1-Test-Project_6_bxy2/prompts/source.md` | 690 | 2026-09-27 13:03:38 | Generated prompt test source for Phase 1 verification | **Generated (Test Artifact)** |
| 15 | `source.md` | `E:/stickman-video-automation/Projects/Phase-2-Production-Test_2_frg3/prompts/source.md` | 1,838 | 2026-09-27 13:20:58 | Generated prompt test source for Phase 2 verification | **Generated (Test Artifact)** |
| 16 | `source.md` | `E:/stickman-video-automation/Projects/Phase-2-Production-Test_4_r3h8/prompts/source.md` | 1,838 | 2026-09-27 13:19:43 | Generated prompt test source for Phase 2 verification | **Generated (Test Artifact)** |
| 17 | `source.md` | `E:/stickman-video-automation/Projects/Phase-3-Mode-2-Production-Test_3_xv3q/prompts/source.md` | 962 | 2026-09-27 13:23:51 | Generated prompt test source for Phase 3 verification | **Generated (Test Artifact)** |
| 18 | `source.md` | `E:/stickman-video-automation/Projects/Phase-3-Mode-2-Production-Test_6_egzt/prompts/source.md` | 962 | 2026-09-27 13:25:26 | Generated prompt test source for Phase 3 verification | **Generated (Test Artifact)** |
| 19 | `source.md` | `E:/stickman-video-automation/Projects/Phase-4-Post-Production-Render-Test_0_1mir/prompts/source.md` | 72 | 2026-09-27 13:30:48 | Generated prompt test source for Phase 4 verification | **Generated (Test Artifact)** |
| 20 | `source.md` | `E:/stickman-video-automation/Projects/Phase-4-Post-Production-Render-Test_1_48u6/prompts/source.md` | 72 | 2026-09-27 13:29:55 | Generated prompt test source for Phase 4 verification | **Generated (Test Artifact)** |
| 21 | `source.md` | `E:/stickman-video-automation/Projects/Phase-5-AI-Story-Documentary_2_eh8b/prompts/source.md` | 5,934 | 2026-09-27 13:33:25 | Generated prompt test source for Phase 5 verification | **Generated (Test Artifact)** |
| 22 | `source.md` | `E:/stickman-video-automation/Projects/Real-Crash-Recovery-Project_0_h0he/prompts/source.md` | 36 | 2026-09-27 13:54:04 | Generated prompt test source for real crash recovery test | **Generated (Test Artifact)** |
| 23 | `source.md` | `E:/stickman-video-automation/Projects/Real-Validation-Project_5_vl3u/prompts/source.md` | 53 | 2026-09-27 13:54:04 | Generated prompt test source for real download validation test | **Generated (Test Artifact)** |

---

## 2. DOCUMENT AUTHORITY MAP

When resolving ambiguities, specifications take precedence according to their domain authority:

| Domain | Primary Authority | Secondary Authority | Notes & Rationale |
|---|---|---|---|
| **Product Vision & Scope** | `GPT.md` | `claude.md` | Defines user requirements, operating modes, fidelity standards, and core value proposition. |
| **Technical Architecture** | `claude.md` | `CLAUDE from gpt.md` | Contains refined architectural decisions (polling bridge, sidecar/server separation, audio levels). |
| **Execution Constraints** | `ANTIGRAVITY.md` | `STICKMAN_STUDIO_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md` | Strict behavioral rules: non-rewriting of extensions, isolation of browser profiles, safety rules. |
| **Task & Phase Checklists**| `STICKMAN_STUDIO_DETAILED_TASKS_BREAKDOWN.md` | `antigravity tasks.md` | Tracks exact deliverables and phase progression. |
| **Prompt Rules & Visuals** | `input master prompt...STICKMAN_LOCKED.md` | `GPT.md` (Sec 7 & 9) | The locked standard for stickman aesthetics, framing, camera directions, and prompt structure. |
| **Current Reality / Status** | `STATUS.md` | `REAL_INTEGRATION_ACCEPTANCE_REPORT.md` | Documents actual code execution, real tests passed, and remaining physical blockers. |

---

## 3. EXTRACTED REQUIREMENTS (CATEGORIES A–Z)

### A. Product Requirements
- **Core Concept:** Windows desktop production engine orchestrating automated stickman video generation using Google Flow (Veo) and Meta AI browser automation extensions.
- **Workflow Preservation:** Existing extension generation engines must run unaltered. Automation logic, selectors, download flows, and DOM mutation observers must NOT be rewritten.
- **Dual Operating Modes:** Support both Mode 1 (AI Story Engine from raw script/idea) and Mode 2 (Production runner from existing prompt lists).
- **Master Anchor:** Spoken voiceover narration is the absolute single source of truth for video duration, visual pacing, and sound timing.

### B. Architecture Requirements
- **Localhost Central Hub:** Node.js/Express service running on fixed local port `127.0.0.1:45450` exposing REST API `/api/v1/`.
- **Database Engine:** Local SQLite 3 with Write-Ahead Logging (`WAL`) mode for concurrent reads/writes and atomic transactions.
- **Bridge Decoupling:** HTTP polling mechanism (`GET /api/v1/workers/poll-job`) every 2.5–5.0 seconds. No persistent WebSockets or push connections required.
- **Sidecar / Desktop Shell:** Architecture planned desktop shell via Tauri 2 (Rust) or local server serving rich dashboard UI.

### C. UI/UX Requirements
- **Studio Dashboard:** Real-time visibility into worker statuses, active leases, prompt generation timeline, system resource utilization (CPU/RAM/Disk), and log stream.
- **Project Setup Wizard:** Mode selector, voiceover file drop zone, prompt text editor, worker allocation slider, and audio mixer controls.
- **Render Preview:** Built-in video player with scrubbing, timeline visualization with clip markers, SFX cues, and subtitle overlay toggle.

### D. Mode 1 Requirements (AI Story Engine)
- **Input:** Raw narrative concept, script text, or topic outline.
- **Pacing Calculation:** Target prompt count calculated from audio duration: `Target Prompts = Math.round(Duration_Seconds * Pacing_Rate)`.
- **LLM Prompt Generation:** Strict enforcement of Master Prompt V7 style rules via Groq API.
- **Validation:** JSON schema verification, non-empty scene descriptions, sequential prompt numbering, and visual continuity checks.

### E. Mode 2 Requirements (Existing Prompt List Runner)
- **Input:** Pre-generated list of visual prompts with audio voiceover MP3/WAV.
- **Parsing:** Automatic extraction of numeric identifiers (`001`, `002`, etc.) and clean prompt text.
- **Allocation:** Deterministic fixed-range distribution across configured worker instances.
- **Queue Management:** Immediate dispatch to available active workers matching designated provider.

### F. Prompt-Generation Rules (Master Prompt V7 Locked)
- **Aesthetic Definition:** Minimalist black stickman on pure solid white background (`#FFFFFF`).
- **Anatomy & Style:** Clean circular head, single-line stroke body/limbs, expressive posture/action lines, zero gradients, zero shadows, zero complex textures.
- **Forbidden Elements:** No 3D rendering, no color fills (unless explicit accent like red danger icon), no photo backgrounds, no speech bubbles or rendered English text inside image.
- **Framing & Camera:** Dynamic compositions (close-up, wide shot, Dutch angle, bird's eye view, over-the-shoulder).

### G. Character Consistency / Reference Rules
- **Flow Engine Reference:** Google Flow requires an initial character reference image to maintain stickman appearance across subsequent generations.
- **Initialization Contract:** When a Flow worker starts or handles a new project, Prompt 001 must be generated first and locked as the Reference Image.
- **Transfer Invalidation:** If a prompt is shifted from Worker A to Worker B via repair queue, Worker B must confirm it has loaded the reference asset before generating.

### H. Flow Extension Requirements
- **Target Platform:** `https://flow.google.com`
- **Core Script:** `extensions/veo-automation-with Mbmirza/assets/index.ts-D1zBd6hg.js`
- **Automation Action:** DOM automation targeting prompt textarea, aspect ratio button, submit trigger (`AUTO_FILL_FLOW`), and download listener.
- **Side-Panel Bridge:** `src/ui/side-panel/bridge-client.js` injected into extension context to poll Studio API.

### I. Meta Extension Requirements
- **Target Platform:** `https://www.meta.ai`
- **Core Script:** `extensions/meta automation/assets/index.ts-BqblPwcc.js`
- **Automation Action:** Automated typing into Meta AI prompt input, Enter key dispatch, canvas/image render detection, and automatic browser download.
- **Side-Panel Bridge:** `src/ui/side-panel/bridge-client.js` communicating with Studio backend.

### J. Bridge Requirements
- **Protocol:** Polling REST HTTP JSON over localhost.
- **Endpoints:**
  - `POST /api/v1/workers/register`
  - `POST /api/v1/workers/heartbeat`
  - `GET /api/v1/workers/poll-job?worker_id=Wxx`
  - `POST /api/v1/workers/complete-job`
  - `POST /api/v1/workers/fail-job`
- **Auth Token:** Studio generates secure random session token in `studio/data/auth.token`; workers include `Authorization: Bearer <token>`.

### K. Worker / Profile Requirements
- **Dedicated Profiles:** Each worker instance operates within an isolated Chrome User Data Directory:
  - Worker W01: `Workers/Worker-W01`
  - Worker W02: `Workers/Worker-W02`
- **Identity Enforcement:** `worker-config.js` in each extension directory must declare `export const WORKER_ID = "Wxx";`.
- **Filename Suffix:** Every downloaded image MUST incorporate the worker ID: `{prompt_id}_{slug}__{worker_id}.png`.

### L. Login / Session Requirements
- **Human Login Gate:** User must manually open the profile once, authenticate into Google Flow / Meta AI, and verify active session.
- **Cookie Persistence:** Isolated User Data directories persist auth tokens, cookies, and local storage indefinitely across Studio restarts.
- **Expiry Detection:** If worker encounters login walls, CAPTCHAs, or auth redirects, it sends `LOGIN_REQUIRED` status to Studio and pauses polling.

### M. Job / Lease / Retry / Repair Requirements
- **Lease Mechanics:** Each leased job has a `lease_owner` and `lease_expires_at` timestamp (default 120–180 seconds).
- **Lease Reaper:** Background supervisor detects missed heartbeats and expired leases, transitioning job to `CANCELLED` and prompt to `REPAIR_PENDING`.
- **Max Retries:** 3 attempts per prompt before moving to `PERMANENTLY_FAILED` requiring manual intervention.
- **Idempotency:** A completed prompt can never be re-executed or overwritten by a duplicate worker job.

### N. Image Validation Requirements
- **Physical Disk Existence:** File must exist on local storage and be non-empty.
- **Binary Signature:** Magic bytes validation:
  - PNG: `89 50 4E 47 0D 0A 1A 0A`
  - JPEG: `FF D8 FF`
  - WebP: `RIFF....WEBP`
- **Dimension Check:** Image must decode to valid positive integer width and height (target 1080x1080 or 1920x1080).
- **Size Boundary:** File size must be $ge 5 	ext{ KB}$ (5,120 bytes) to prevent corrupt download stubs while permitting minimalist line-art PNGs.
- **Cryptographic Hash:** SHA-256 hash computed on disk and stored in SQLite to detect identical duplicates.

### O. Timeline Requirements
- **Master Audio Clock:** Narration MP3 duration dictates total video length (`Total_Seconds`).
- **Image Slicing:** Even distribution of prompts across audio duration: `Clip_Duration = Total_Duration / Prompt_Count`.
- **Timestamp Cues:** Visual cuts placed at sentence/phrase boundaries identified by audio transcription.

### P. Caption / Whisper Requirements
- **Subtitle Format:** Word-level timed subtitles exported as SubRip (`.srt`) and WebVTT (`.vtt`).
- **Typography:** High-contrast stickman comic aesthetic (e.g. Komika, Anton, or Impact with black stroke/outline).
- **Styling Rules:** All-caps, centered bottom third, active word highlighting in yellow (`#FFD700`) or green (`#00FF00`).

### Q. SFX (Sound Effects) Requirements
- **Action Triggers:** Automatic audio cue placement on detected action verbs (pop, whoosh, pencil sketch, thump, click).
- **Bundled Library:** High quality local sound effects stored under `studio/sfx/`:
  - `pop.wav`
  - `whoosh.wav`
  - `pencil_sketch.wav`
- **Audio Mix:** SFX mixed at 25–35% volume relative to dialogue.

### R. Music / Ducking Requirements
- **Default Music Volume:** Strictly locked at **7%** (`volume=0.07`).
- **Voiceover Dominance:** Narration must remain 100% clear and intelligible at all times.
- **Sidechain Ducking:** During active speech segments, music volume automatically compresses to 3–4%; smoothly restores to 7% during pauses (> 0.5s silence).

### S. FFmpeg / Render Requirements
- **Local Binaries:** Bundled standalone Windows executables in `studio/bin/`:
  - `ffmpeg.exe` (v7.x+)
  - `ffprobe.exe`
- **Video Standard:** 1080p Full HD (1920x1080 or 1080x1920 vertical), 30 fps, H.264 video codec (`libx264`), YUV420p pixel format.
- **Audio Standard:** Stereo AAC (`aac`), 192 kbps, 44.1 kHz sampling rate.
- **Single Pass Synthesis:** Complex multi-input filter graph combining video clips, subtitles, voiceover, SFX, and ducked background music into finished MP4.

### T. AI Provider Requirements
- **Pluggable Architecture:** Common interface `generatePrompts({ script, duration, pacing })`.
- **Primary / Fallback:** Dynamic fallback routing from Cloud API to Local LLM if API fails or rate-limits.

### U. Groq Requirements (Primary Provider)
- **Status:** **LOCKED PRIMARY AI PROVIDER**.
- **Verified Primary Model:** `openai/gpt-oss-120b` (Empirically verified in Phase 0 benchmark: 36/36 prompts, valid JSON).
- **Configuration:** API key stored in secure local environment (`GROQ_API_KEY`), model parameter fully configurable.

### V. Ollama Fallback Requirements (Local Fallback)
- **Status:** **LOCAL EMERGENCY FALLBACK**.
- **Target Endpoint:** `http://127.0.0.1:11434/api/generate`
- **Recommended Model:** `llama3.2:3b` or `mistral:7b`
- **Activation Trigger:** Network disconnect, Groq 429 (Rate Limit), or Groq 5xx server outage.

### W. Security & Secrets Requirements
- **Zero Plain-Text Secrets:** API keys and credentials must NEVER be hardcoded into source code, logs, git repositories, or markdown documents.
- **Token Isolation:** Local Studio auth token stored in `studio/data/auth.token` with restricted file permissions.
- **Sanitized Logging:** All log outputs and console streams must mask authorization headers and credentials.

### X. Crash Recovery & Idempotency Requirements
- **State Persistence:** SQLite records all prompt, worker, and job states persistently across restarts.
- **Safe Recovery:** On Studio launch, orphan jobs held by dead workers are reclaimed immediately to `REPAIR_PENDING`.
- **Asset Preservation:** Completed images in `central_images/` are never deleted or re-rendered after unexpected termination.

### Y. Testing & Acceptance Requirements
- **Honesty Standard:** Clear segregation between unit simulations and physical hardware/browser tests.
- **Acceptance Milestones:** Real browser process lifecycle, real disk magic byte inspection, real spoken audio transcription, and end-to-end cloud generation.

### Z. Packaging / Desktop / Tauri Requirements
- **Packaging Vision:** Standalone Windows `.msi` or `.exe` installer bundling Node.js backend, FFmpeg binaries, and UI.
- **Tauri Shell:** Early specification calls for Tauri 2 Rust wrapper wrapping the localhost service.

---

## 4. ALL CONTRADICTIONS & DISCREPANCIES

| ID | File A & Section | File B & Section | Nature of Conflict | Newer / Authoritative Standard | Evidence Needed to Resolve |
|---|---|---|---|---|---|
| **C1** | `input master prompt...STICKMAN_LOCKED.md` (L780-820): *"Do not number the prompt. No numbering."* | `CLAUDE from gpt.md` (Sec 4) & `ANTIGRAVITY.md` (Sec 9): *"Parser strictly requires clean sequential numbering (001_, 002_)."* | Numbering prohibition vs strict machine parsing requirement. | **Sequential Numbering (`001_`) is locked.** Studio pipeline cannot correlate images or distribute jobs without numeric IDs. | Update Master Prompt text to note that Studio automation mode requires numeric prefixes. |
| **C2** | `claude.md` (Sec 2) & `antigravity tasks.md` (Task 1.1): *"Desktop app: Tauri 2 (Rust) + React frontend."* | Actual Workspace & `STATUS.md` (L25): *Node.js/Express service on port 45450 serving Vanilla HTML/JS. Zero Rust/Tauri files exist.* | Native compiled Rust desktop app vs Localhost Web Dashboard. | **Node.js Web Dashboard is currently implemented.** Tauri shell represents deferred packaging. | User decision on whether to package via Tauri 2, Electron, or maintain Express web dashboard. |
| **C3** | `STICKMAN_STUDIO_DETAILED_TASKS_BREAKDOWN.md` (Sec Overview): *"Phase 0 must be 100% complete before ANY Phase 1 code is written."* | User Directives & `STATUS.md`: *Phase 0 Test A passed; user ordered immediate production implementation of Phases 1–6.* | Strict sequential gating vs accelerated parallel implementation. | **User Directives override document gating.** Phases 1–6 were implemented while Phase 0 sub-tests were decoupled. | Formalize task checklist to reflect user-approved fast tracking. |
| **C4** | `antigravity tasks.md` (L53, 1420) & `Tasks Breakdown` (L28): References deprecated `llama-3.3-70b-versatile`. | User Directive (Prompt 6), `groq_benchmark.py` & `STATUS.md`: *Locked primary model is `openai/gpt-oss-120b`.* | Deprecated Groq model vs verified active model. | **`openai/gpt-oss-120b` is authoritative.** Successfully validated with 36/36 prompts in benchmark. | Update legacy references in `antigravity tasks.md` to `openai/gpt-oss-120b`. |
| **C5** | `GPT.md` (Sec 4) & `CLAUDE from gpt.md` (Sec 21): Mentions rigid 0.75s pacing formula (3 images per 4 seconds). | `claude.md` (Sec 3), `ANTIGRAVITY.md` (Sec 10) & `timeline_manager.js`: *Default pacing is 0.50x (1 prompt per 2.0s) across 6 selectable presets.* | Hardcoded 0.75x formula vs flexible 0.50x default with presets. | **0.50x default with configurable presets is authoritative.** Implemented in `timeline_manager.js`. | Align `GPT.md` to acknowledge preset system with 0.50x standard default. |
| **C6** | `GPT.md` (Sec 15) & `antigravity tasks.md` (Sec 31): Specifies project image folder as `Projects/<slug>/images/`. | Implementation in `ingestion_manager.js`, `project_manager.js` & `STATUS.md`: Uses `Projects/<slug>/central_images/`. | Inconsistent folder naming for collected images. | **`central_images/` is authoritative in code.** Distinguishes verified pool from raw downloads. | Update documentation to standardize on `central_images/`. |
| **C7** | `Architecture & Plan` (L365) & `Tasks Breakdown` (L200): Specifies image file size must be $> 10 	ext{ KB}$. | `ingestion_manager.js` (L54) & `REAL_INTEGRATION_ACCEPTANCE_REPORT.md`: Enforces `fileSize >= 5120` (5 KB). | 10 KB cutoff vs 5 KB cutoff. | **5 KB cutoff is authoritative.** Minimalist stickman line-art PNGs can compress to 6–8 KB and fail a 10 KB check. | Update documentation threshold from 10 KB to 5 KB with line-art justification. |
| **C8** | Historical draft discussions referenced 56% background music volume. | `claude.md` (Sec 10), `GPT.md` (Sec 12), `ANTIGRAVITY.md` (Sec 18) & `render_engine.js`: *Volume strictly locked at 7% (`volume=0.07`).* | 56% vs 7% music volume. | **7% is universally locked.** Voiceover clarity requires low background bed. | All documents now reflect 7%; historical 56% is formally marked obsolete. |
| **C9** | Early task suites marked Phase 2, 3, 5 as "PRODUCTION VERIFIED" with 200 prompts. | User Directive (Prompt 9), `STATUS.md` & `REAL_INTEGRATION_REPORT.md`: *200 prompt stress tests were run via MockWorkerCluster simulation.* | Real cloud generation claim vs backend mock simulation reality. | **Mock simulation status is acknowledged.** Real cloud generation requires live user browser session. | Segregate simulation passes from real physical hardware/cloud tests. |
| **C10** | `antigravity tasks.md` (Phase 4): Specifies native bundled `whisper.cpp` standalone executable. | `transcription_service.js` & `STATUS.md`: *Uses speech-rate heuristics and optional system Python whisper.* | Bundled standalone binary vs heuristic fallback engine. | **Heuristic engine is currently implemented.** Standalone `whisper.cpp` binary is not yet bundled. | User decision whether to bundle pre-compiled `whisper.cpp.exe` or use external service. |

---

## 5. OUTDATED REQUIREMENTS

The following items found in older specifications have been superseded and must NOT be used:
1. **Model `llama-3.3-70b-versatile`:** Deprecated by Groq; superseded by `openai/gpt-oss-120b`.
2. **Hardcoded 0.75x Pacing Formula:** Superseded by configurable pacing presets defaulting to `0.50x` (1 prompt per 2.0s).
3. **56% Music Volume:** Superseded by locked `7%` volume with sidechain ducking.
4. **WebSocket Push Bridge:** Superseded by resilient HTTP REST polling (`GET /poll-job`).
5. **Dynamic Prompt Splitting Across Providers:** Superseded by deterministic fixed range worker allocation.

---

## 6. UNSUPPORTED CLAIMS AUDIT

An audit of previous documentation claims against physical evidence on disk:

1. **Claim: "Tauri Desktop Application Completed"**
   - *Status:* **UNSUPPORTED / FALSE**.
   - *Evidence:* Zero Rust files, zero `src-tauri` directories, zero Tauri configs exist. The app runs as an Express service on `127.0.0.1:45450`.
2. **Claim: "Phase 2 & Phase 3 Verified at Scale (200 Prompts Real Flow/Meta Generation)"**
   - *Status:* **UNSUPPORTED FOR REAL CLOUD GENERATION**.
   - *Evidence:* The 200-prompt test was executed using `MockWorkerCluster` in Node.js simulating extension network calls. No real images were rendered on `flow.google.com` or `meta.ai`.
3. **Claim: "Turnkey Bundled Local Whisper Captioning"**
   - *Status:* **PARTIALLY SUPPORTED**.
   - *Evidence:* `studio/bin/` contains `ffmpeg.exe` and `ffprobe.exe`, but NO `whisper.exe`. `transcription_service.js` falls back to word-timing heuristics unless an external Python environment has Whisper installed.
4. **Claim: "Automatic Character Reference Handshake Fully Verified on Live Flow"**
   - *Status:* **UNSUPPORTED FOR LIVE CLOUD GENERATION**.
   - *Evidence:* Verified in unit logic, but requires a live logged-in Google account on `flow.google.com` to physically inject the reference image into the canvas.

---

## 7. ACTUAL IMPLEMENTATION EVIDENCE (CLAIM VS. CODE)

| Specification Claim | Actual Code File / Location | Implementation Reality | Integrity Status |
|---|---|---|---|
| **SQLite WAL Database Core** | `studio/server/db.js`<br>`studio/server/migrations.js` | Physical SQLite database initialized at `studio/data/studio.sqlite` with 5 tables (`projects`, `prompts`, `workers`, `jobs`, `assets`), WAL mode enabled, foreign keys ON. | **VERIFIED (REAL)** |
| **Worker Orchestration & Leases** | `studio/server/worker_orchestrator.js` | Range allocator assigns deterministic ranges. Job leases expire and are reaped naturally by background reaper. | **VERIFIED (REAL)** |
| **Strict Image File Validation** | `studio/server/ingestion_manager.js` | Validates physical disk presence, minimum 5 KB size, magic bytes (PNG, JPEG, WebP), decodes dimensions, and calculates SHA-256 hash. | **VERIFIED (REAL)** |
| **Real Chrome Profile Manager** | `studio/server/profile_manager.js` | Spawns real Chrome OS processes pointing to isolated profiles (`Workers/Worker-W01`). Real PIDs verified and killed via OS `taskkill /F`. | **VERIFIED (REAL)** |
| **FFmpeg 1080p Video Rendering** | `studio/server/render_engine.js` | Uses bundled standalone `studio/bin/ffmpeg.exe` to assemble 1080p H.264 MP4 videos with 7% background music, SFX triggers, and ducking. | **VERIFIED (REAL)** |
| **Groq AI Prompt Generation** | `studio/server/ai_story_engine.js` | Uses `groq-sdk` connecting to `openai/gpt-oss-120b` producing sequential prompts conforming to Master Prompt rules. | **VERIFIED (REAL)** |
| **Extension Bridge Insertion** | `extensions/*/src/ui/side-panel/bridge-client.js` | Bridge client scripts created and linked in manifests. Ready to poll Studio API when side panel is open. | **VERIFIED (REAL)** |
| **Desktop Application Wrapper** | Workspace Root | No desktop wrapper present. Application runs via Node.js CLI (`npm start`) and serves web interface. | **NOT IMPLEMENTED** |

---

## 8. FEATURE CLASSIFICATION BREAKDOWN

### Missing Features (Not Yet Implemented)
1. **Native Desktop Shell:** Rust Tauri 2 wrapper with native Windows window framing.
2. **Bundled Standalone Whisper:** Pre-compiled local `whisper.cpp.exe` in `studio/bin/`.
3. **One-Click Windows Installer:** NSIS or MSI installer bundling Node.js runtime and FFmpeg.

### Partial Features (Partially Built / External Dependency)
1. **Flow & Meta Browser Automation:** Automation code exists inside extensions, but requires active manual login and open browser tabs.
2. **Side-Panel Bridge Lifecycle:** Extension bridge client exists, but requires the Chrome extension side-panel to be opened by the user to execute background fetch loops.
3. **Word-Level Subtitles:** Works reliably via speech-rate heuristic generator; full acoustic alignment requires external Python Whisper.

### Mock-Only Features (Verified Only in Simulation)
1. **200-Prompt Concurrency Stress Test:** Tested exclusively using `MockWorkerCluster`.
2. **Multi-Hour Worker Drop & Recovery:** Tested using programmatic fake heartbeat droppers.

### Real-Tested Features (Physically Verified on Windows Hardware)
1. **Real Chrome OS Process Lifecycle:** Launched real Google Chrome instances, captured Windows PIDs, killed processes using `taskkill /F`, and verified Studio socket handling.
2. **Physical Disk Image Ingestion:** Tested real corrupted files, wrong IDs, and valid PNGs; confirmed magic byte rejection and SHA-256 ingestion into `central_images/`.
3. **Real Human Spoken Audio Synthesis:** Generated and rendered real spoken voice samples through FFmpeg; confirmed audio synchronization and ducking.
4. **Natural Real-Time Lease Reaping:** Verified that expired job leases are reclaimed by the reaper without manipulating database timestamps.
5. **Real Groq API Generation:** Phase 0 benchmark executed against live Groq endpoints using `openai/gpt-oss-120b`.

---

## 9. HUMAN-ACTION BLOCKERS BEFORE LIVE CLOUD RUN

Before live production image generation can run against Google Flow and Meta AI:

| # | Human Action Required | Affected Component | Why Machine Cannot Automate |
|---|---|---|---|
| **1** | **One-Time Manual Profile Login** | `Workers/Worker-W01` (`flow.google.com`)<br>`Workers/Worker-W02` (`meta.ai`) | Requires human Google 2FA, CAPTCHA resolution, and Meta authentication. Cookies will persist permanently once saved. |
| **2** | **Extension Side-Panel Activation** | Chrome Extensions in Worker Profiles | Manifest V3 side-panel scripts require user to click extension icon or open side panel once to start bridge polling loop. |
| **3** | **Provide Valid Private API Key** | `studio/server/ai_story_engine.js` | User must supply active Groq API key via local environment variable (`GROQ_API_KEY`) to replace revoked benchmark key. |

---

## 10. SECURITY AUDIT & SECRETS MANAGEMENT

1. **Compromised Benchmark Key:** The initial Groq benchmark log exposed an API key. That key has been revoked and must NEVER be restored to disk.
2. **Active Secrets Strategy:** Studio now uses `process.env.GROQ_API_KEY` exclusively, falling back to local manual entry. No keys are written to SQLite, logs, or git.
3. **Local Authorization Token:** Studio generates a cryptographically random session token in `studio/data/auth.token` on boot. Bridge clients must authenticate using this bearer token.
4. **CORS Hardening:** Studio Express backend restricts CORS requests to `chrome-extension://` origins and `http://127.0.0.1:*`.

---

## 11. COMPACT AUDIT MATRIX

| Requirement | Primary Source File | Required Standard | Actual Workspace Status | Verified Evidence | Unresolved Conflict |
|---|---|---|---|---|---|
| **Localhost API Hub** | `claude.md` Sec 5 | Node.js Express on `127.0.0.1:45450` | Fully Implemented | `studio/server/index.js` runs, passes health check | None |
| **SQLite WAL Core** | `CLAUDE from gpt.md` Sec 15 | SQLite 3 WAL mode with 5 tables | Fully Implemented | `studio/data/studio.sqlite` created with tables | None |
| **Bridge Client** | `STICKMAN_PLAN.md` Sec 2 | Polling client inside extensions | Bridge Injected | `bridge-client.js` present in both extensions | Manual click needed |
| **Worker Allocation** | `ANTIGRAVITY.md` Sec 11 | Deterministic fixed range allocation | Fully Implemented | `worker_orchestrator.js` range logic verified | None |
| **Image Validation** | `Tasks Breakdown` Task 3.2 | Magic bytes, dims, SHA-256, $ge 5$ KB | Fully Implemented | `ingestion_manager.js` verified in real test | Threshold: 5KB vs 10KB |
| **Desktop Shell** | `antigravity tasks.md` Task 1.1 | Tauri 2 (Rust) desktop window | Web Dashboard Only | Pure HTML/JS web dashboard on port 45450 | Tauri shell missing |
| **Primary AI Model** | User Directive (Prompt 6) | `openai/gpt-oss-120b` on Groq | Fully Implemented | `ai_story_engine.js` + benchmark results | Old docs say llama-3.3 |
| **Emergency Fallback**| `claude.md` Sec 8 | Local Ollama endpoint fallback | Implemented | Fallback handler in `ai_story_engine.js` | None |
| **Music Volume** | `ANTIGRAVITY.md` Sec 18 | Strictly locked at 7% with ducking | Fully Implemented | `render_engine.js` filter graph uses 0.07 | Old draft said 56% |
| **FFmpeg Rendering** | `Tasks Breakdown` Task 4.4 | Bundled standalone FFmpeg 1080p | Fully Implemented | `studio/bin/ffmpeg.exe` verified with sample render | None |
| **Lease Reaper** | `CLAUDE from gpt.md` Sec 23 | Automatic timeout recovery | Fully Implemented | Real OS kill test verified lease recovery | None |
| **Live Flow Gen** | `STATUS.md` Sec 4 | Live cloud generation via extension | Blocked on Login | Extension code present; awaiting human login | Human action blocker |
| **Live Meta Gen** | `STATUS.md` Sec 4 | Live cloud generation via extension | Blocked on Login | Extension code present; awaiting human login | Human action blocker |

---

## 12. RECOMMENDED IMPLEMENTATION & CLEANUP ORDER

Once the user authorizes implementation:

1. **Documentation Alignment:** Update `antigravity tasks.md` and `STICKMAN_STUDIO_DETAILED_TASKS_BREAKDOWN.md` to replace `llama-3.3-70b-versatile` with `openai/gpt-oss-120b`, update the validation threshold to $ge 5 	ext{ KB}$, and mark Tauri as a Phase 7 Packaging milestone.
2. **Master Prompt Numbering Note:** Append a clarification in `input master prompt...STICKMAN_LOCKED.md` stating that automated ingestion requires sequential numeric prefixes (`001_`).
3. **One-Time Human Authentication:** Launch Worker W01 and Worker W02 profiles, complete manual login to Google Flow and Meta AI, and verify cookie persistence.
4. **First Live End-to-End Test:** Dispatch a real 2-prompt project to Worker W01 on `flow.google.com` and confirm physical browser generation, download, and ingestion into `central_images/`.
5. **Phase 7 Desktop Packaging (Optional):** Wrap the verified Express backend and web dashboard into a native Tauri 2 or Electron installer.

---

## 13. EXACT FILES REQUIRING UPDATES

When approved to resume modifications, the following specific files must be updated:

1. `E:/stickman-video-automation/antigravity tasks.md` (Update model names, 7% audio lock, and realistic test labels)
2. `E:/stickman-video-automation/STICKMAN_STUDIO_DETAILED_TASKS_BREAKDOWN.md` (Update image size threshold to 5 KB and mark completed tests)
3. `E:/stickman-video-automation/input master prompt i give this to chatgpt and scriptt to chjatgpt chatboxct and chatgpt give me list or prompts for as input SCRIPT_TO_IMAGE_PROMPT_MASTER_V7_STICKMAN_LOCKED.md` (Document machine-parsing numbering rule)
4. `E:/stickman-video-automation/extensions/veo-automation-with Mbmirza/manifest.json` & `extensions/meta automation/manifest.json` (Verify permissions for side-panel bridge)
5. `E:/stickman-video-automation/studio/public/index.html` (Refine UI controls for live worker status and project creation wizard)

---
*End of Master Audit Document. No further code or state changes will be applied until explicit user directive.*
