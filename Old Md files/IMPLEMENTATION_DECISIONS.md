# STICKMAN STUDIO — IMPLEMENTATION DECISIONS & RESOLUTION MATRIX
**Document Version:** 2.0.0  
**Generated:** 2026-09-27  
**Status:** MANDATORY PRE-IMPLEMENTATION GOVERNANCE BASELINE  
**Workspace:** `E:\stickman-video-automation`  
**Reference Document:** `E:\stickman-video-automation\DOCUMENTATION_MASTER_AUDIT.md`

---

## 1. PURPOSE & ARCHITECTURAL FOUNDATION

This document formally records all architectural decisions, conflict resolutions, and engineering contracts prior to code implementation. Per the master specification directives:
1. Zero silent assumptions are permitted.
2. Every contradiction identified in `DOCUMENTATION_MASTER_AUDIT.md` must have an explicit resolution, rationale, affected files, migration steps, and verification tests.
3. Real physical tests are strictly segregated from mock simulations.
4. Existing Chrome extensions (`meta automation` and `veo-automation-with Mbmirza`) must remain intact without rewriting their internal generation, queuing, and download logic.

---

## 2. UNRESOLVED CONFLICTS & SELECTED RESOLUTIONS

### Conflict 1: Desktop Shell Architecture (Tauri 2 vs. Node/Express Chrome App Mode) [LOCKED & AUTHORIZED]
- **Document Contradiction:**
  - `claude.md` (Sec 2) and `antigravity tasks.md` (Task 1.1) specify: *Tauri 2 (Rust) + React frontend + local Node.js sidecar*.
  - Current Workspace: Pure Node.js Express server on `127.0.0.1:45450` serving Vanilla HTML/JS dashboard (`studio/public/index.html`). Zero Rust (`.rs`) or Tauri files exist.
- **Physical Environment Audit:**
  - `rustc` and `cargo` are **NOT installed** on the host Windows machine.
  - Microsoft C++ Build Tools (`cl.exe`, MSVC) are **NOT installed**.
  - Host RAM is limited to 8GB, running simultaneous Chrome worker automation.
- **Authoritative Resolution (Explicit User Decision 2026-09-27):**
  - **LOCKED ARCHITECTURE:** **Node.js/Express local web app with Desktop-Style launch via Chrome Application Mode (`--app=http://127.0.0.1:45450`).**
  - **Rationale:**
    1. Running multiple real Chrome automation workers (Flow + Meta) simultaneously on an 8GB RAM Windows PC already creates memory load; adding Electron would introduce another Chromium instance and unnecessary memory pressure.
    2. Tauri 2 compilation requires Rust + Microsoft C++ Build Tools, which are not installed on this machine, creating setup overhead and blocking progress.
    3. The existing Node/Express architecture has already been physically validated with real Chrome worker launch, SQLite WAL persistence, bridge polling, image ingestion, and crash recovery.
  - **Desktop Launch Mechanics:**
    - A dedicated Windows launcher script (`launch_studio.bat` and `studio/launcher.js`) executes the following:
      1. Starts the Node.js/Express service on `127.0.0.1:45450`.
      2. Polls `http://127.0.0.1:45450/api/v1/health` until responsive.
      3. Launches Chrome in standalone application mode: `chrome.exe --app=http://127.0.0.1:45450`.
      4. This strips the browser address bar, tabs, and bookmarks, delivering a distraction-free, professional native desktop studio window.
  - **Preservation Directive:**
    - Historical documents, previous audit reports, and acceptance reports are preserved without falsification.
    - Active authoritative documentation (`STATUS.md`, `STICKMAN_STUDIO_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md`) is updated to record this decision.

### Conflict 2: Prompt Numbering (No Numbering vs. Sequential IDs)
- **Document Contradiction:**
  - `input master prompt...STICKMAN_LOCKED.md` (L780-820): Explicitly instructs: *"Do not number the prompt. No numbering. Output only the prompt text separated by newlines."*
  - `CLAUDE from gpt.md` (Sec 4) & `ANTIGRAVITY.md` (Sec 9): Explicitly dictates: *Mode 2 parser requires sequential numbering (`001_`, `002_`) for prompt identity, ordering, and worker range allocation.*
- **Selected Resolution:**
  - **Sequential Numbering (`001_`) is Authoritative and Mandatory.**
  - **Mechanism:** The internal prompt generation engine (Mode 1 / `ai_story_engine.js`) will strictly format every generated prompt with a 3-digit zero-padded sequential prefix: `{index_3digit}_{clean_prompt_text}` (e.g. `001_A minimalist black stickman...`).
  - **Rationale:** Without deterministic sequential numbers, Studio cannot correlate downloaded image files (`001_stickman__W01.png`), cannot verify timeline order against audio narration, and cannot execute fixed-range worker slicing.
  - **Mode 1 → Mode 2 Compatibility:** The prompt parser in `timeline_manager.js` and `project_manager.js` strictly parses `/^(\d{3})[_-](.+)$/` as primary, with a fallback parser that auto-indexes unnumbered lines if a user pastes raw unnumbered text from ChatGPT.
- **Affected Files:**
  - `studio/server/ai_story_engine.js`
  - `studio/server/project_manager.js`
  - `input master prompt...STICKMAN_LOCKED.md`
- **Migration Required:** Add documentation note to Master Prompt V7 explaining that automated studio ingestion requires numeric IDs.
- **Test Required:** Unit test feeding Mode 1 LLM output directly into Mode 2 ingestion parser; assert 100% ID correlation.

---

### Conflict 3: Canonical Image Storage Directory (`images/` vs. `central_images/`)
- **Document Contradiction:**
  - `GPT.md` and `antigravity tasks.md` reference `Projects/<slug>/images/`.
  - Implementation code and `STATUS.md` use `Projects/<slug>/central_images/`.
- **Selected Resolution:**
  - **`central_images/` is locked as the CANONICAL production directory.**
  - **Directory Topology:**
    - `Projects/<slug>/downloads_raw/`: Temporary landing directory for raw worker browser downloads.
    - `Projects/<slug>/central_images/`: Authoritative, validated, cryptographically verified image pool.
    - `Projects/<slug>/renders/`: Assembled MP4 video outputs.
    - `Projects/<slug>/audio/`: Voiceover MP3/WAV files.
    - `Projects/<slug>/subtitles/`: Timed `.srt` and `.vtt` subtitle tracks.
- **Affected Files:**
  - `studio/server/project_manager.js`
  - `studio/server/ingestion_manager.js`
  - `studio/server/routes.js`
- **Migration Required:** Ensure all documentation and scripts reference `central_images/` consistently.
- **Test Required:** Image validation and ingestion script verifies physical existence in `central_images/`.

---

### Conflict 4: Strict Image File Size Threshold (> 10 KB vs. 5 KB Minimum)
- **Document Contradiction:**
  - `STICKMAN_STUDIO_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md` (L365) states: *File size $> 10 \text{ KB}$*.
  - `studio/server/ingestion_manager.js` (L54) enforces: *File size $\ge 5120$ bytes (5 KB)*.
- **Physical Evidence from Workspace:**
  - Valid stickman line-art PNGs generated in workspace test projects:
    - `Projects/Phase-6-Reconciliation-Test_2_nsy2/central_images/001_stickman__W01.png`: **6,067 bytes** (5.92 KB).
    - `Projects/Real-Validation-Project_5_vl3u/central_images/001_stickman__W01.png`: **8,067 bytes** (7.87 KB).
  - Minimalist black stick figures on pure white background compress with high efficiency under PNG DEFLATE. A 10 KB cutoff causes false-positive rejections of valid stickman artwork.
- **Selected Resolution:**
  - **Strict Threshold: $\ge 5,120$ bytes (5.0 KB).**
  - Combined with **Magic Bytes Inspection** (PNG: `89 50 4E 47 0D 0A 1A 0A`), **Dimension Decoding** ($w > 0, h > 0$), and **SHA-256 Checksumming**.
- **Affected Files:**
  - `studio/server/ingestion_manager.js`
  - `STICKMAN_STUDIO_DETAILED_TASKS_BREAKDOWN.md`
- **Migration Required:** Align all documentation to specify 5 KB (5,120 bytes) with line-art compression justification.
- **Test Required:** Real test rejecting a 100-byte truncated file while accepting a 6,067-byte valid stickman PNG.

---

### Conflict 5: Speech-to-Text & Subtitle Engine (Whisper Primary & Genuine Fallback)
- **Document Contradiction:**
  - Specification requires genuine offline speech-to-text; explicitly forbids heuristic speech-rate timing as the transcription engine.
  - Previous implementation relied on word-per-minute heuristic simulation when local Whisper was missing.
- **Selected Resolution:**
  - **Primary Engine:** **Groq Whisper Cloud API** (`whisper-large-v3`). Delivers word-level timestamps with sub-second latency directly from the user's voiceover audio file.
  - **Local Fallback Engine:** **Genuine Local Speech-to-Text via Python/uv Whisper** (`openai-whisper` or `faster-whisper`).
  - **Rule:** Speech-rate heuristics may ONLY be used as a visual fallback preview when offline with zero STT packages installed, clearly tagged with `[HEURISTIC PREVIEW — NOT ACCURATELY TIMED]`.
- **Affected Files:**
  - `studio/server/transcription_service.js`
- **Migration Required:** Implement Groq Whisper API client in `transcription_service.js` and local execution wrapper.
- **Test Required:** Run real spoken WAV file (`studio/sfx/real_spoken_sample.wav`) through transcription; assert actual word alignment.

---

### Conflict 6: Primary AI Model for Story & Prompt Generation
- **Document Contradiction:**
  - Older task lists cite deprecated `llama-3.3-70b-versatile`.
  - User Directive 6 and Phase 0 benchmark lock primary model to `openai/gpt-oss-120b`.
- **Selected Resolution:**
  - **Primary Model:** `openai/gpt-oss-120b` on Groq.
  - **Fallback Model:** Local Ollama (`llama3.2:3b` or `mistral:7b`).
  - **Configurability:** Model identifier stored in configuration, easily overridden via environment variable `GROQ_MODEL`.
- **Affected Files:**
  - `studio/server/ai_story_engine.js`
  - `antigravity tasks.md`
  - `STICKMAN_STUDIO_DETAILED_TASKS_BREAKDOWN.md`
- **Migration Required:** Replace all legacy references to `llama-3.3-70b-versatile` with `openai/gpt-oss-120b`.
- **Test Required:** Phase 0 benchmark results verified with 36/36 prompts in `groq_phase0_benchmark_results.json`.

---

### Conflict 7: Background Music Volume & Voiceover Ducking
- **Document Contradiction:**
  - Early draft discussion mentioned 56% volume.
  - Architecture specs and `render_engine.js` enforce locked **7%** (`volume=0.07`).
- **Selected Resolution:**
  - **Default Background Music Volume is strictly locked at 7% (`volume=0.07`).**
  - **Sidechain Ducking:** During active voiceover speech, music automatically compresses to 3%; smoothly returns to 7% during pauses.
  - Historical 56% value is formally marked obsolete.
- **Affected Files:**
  - `studio/server/render_engine.js`
  - `claude.md`
- **Test Required:** FFprobe analysis of mixed audio tracks verifying RMS volume delta between speech and background music.

---

### Conflict 8: Extension Side-Panel Lifecycle & Background Suspension
- **Document Contradiction / Gap:**
  - Chrome Manifest V3 side-panel execution can be suspended when the side panel is closed or Chrome minimizes.
- **Selected Resolution:**
  - **Resilient Bridge Protocol:**
    1. Polling interval: 2.5s for jobs, 5.0s for heartbeat.
    2. Lease timeout: 120 seconds. If side panel is temporarily minimized, active lease is NOT revoked immediately.
    3. Reconnect Handshake: On side-panel wakeup or reopening, `bridge-client.js` immediately triggers `POST /api/v1/workers/register` with its persistent `WORKER_ID` and auth token.
    4. State Synchronization: Studio checks SQLite for any currently leased prompt belonging to that worker; if found, Studio returns the active job so generation resumes without duplicate re-runs.
- **Affected Files:**
  - `extensions/meta automation/src/ui/side-panel/bridge-client.js`
  - `extensions/veo-automation-with Mbmirza/src/ui/side-panel/bridge-client.js`
  - `studio/server/worker_orchestrator.js`
- **Test Required:** Terminate and restart bridge client while job is leased; verify lease continuity.

---

### Conflict 9: Verification Classification & Honesty Standard
- **Document Contradiction:**
  - Previous task runs labeled 200-prompt mock simulations as "production verified".
- **Selected Resolution:**
  - **Strict Mandatory Verification Tags:**
    - `[REAL INTEGRATION]`: Real Windows Chrome process, physical disk file, live Groq API, live FFmpeg binary.
    - `[MOCK / SIMULATION]`: Simulated in-memory worker cluster, simulated network delay.
    - `[REAL AUDIT]`: Disk and file inspection.
    - `[BLOCKED — HUMAN ACTION]`: Stopped waiting for real user login or 2FA.
- **Rule:** Never convert a mock test to real by relabeling.

---

## 3. MASTER DECISION MATRIX SUMMARY

| # | Domain | Unresolved Issue | Selected Canonical Standard | Physical Justification |
|---|---|---|---|---|
| 1 | **Desktop Shell** | Tauri 2 vs Express Web UI | Express Sidecar API + Dashboard (Report Rust/MSVC absence) | Host machine lacks `cargo`, `rustc`, and Visual Studio C++ compiler. |
| 2 | **Prompt Numbering** | No Numbering vs Sequential IDs | Sequential Numeric IDs (`001_`) Mandatory | Mode 2 ingestion, file naming, and worker ranges require deterministic IDs. |
| 3 | **Image Directory** | `images/` vs `central_images/` | Canonical: `central_images/` | Clearly distinguishes verified pool from raw worker download landing zones. |
| 4 | **Size Threshold** | $> 10 \text{ KB}$ vs $\ge 5 \text{ KB}$ | Locked: $\ge 5,120$ bytes (5.0 KB) | Valid minimalist stickman line-art PNGs compress to 6.0–8.1 KB. |
| 5 | **Transcription** | Whisper vs Speech-rate Heuristics | Primary: Groq Whisper; Fallback: Local STT | Heuristics prohibited as true transcription; true word-alignment required. |
| 6 | **AI Provider** | Llama 3.3 70B vs GPT-OSS-120B | Locked: `openai/gpt-oss-120b` | Deprecated Llama 3.3 70b shutdown on Groq; 120b passed Phase 0 benchmark. |
| 7 | **Music Volume** | 56% Draft vs 7% Architecture Lock | Locked: 7% (`volume=0.07`) with ducking | Dialogue clarity dictates voiceover dominance at all times. |
| 8 | **Bridge Lifecycle**| Side-Panel MV3 Suspension | Auto-reconnect & Lease resume on wakeup | Prevents worker abandonment when Chrome backgrounds or suspends tabs. |
| 9 | **Test Honesty** | Ambiguous "PASSED" claims | Mandatory 4-category classification | Enforces zero false claims of cloud generation before real login. |

---
*Signed and Approved for Implementation.*
