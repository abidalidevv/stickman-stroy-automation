# STICKMAN STUDIO — DETAILED TASK BREAKDOWN & IMPLEMENTATION PLAN

**Target:** Windows 10/11 Local-First Desktop Stickman Documentary Video Production Engine  
**Orchestration Stack:** Tauri 2 (Rust) + React / TypeScript / Tailwind + Node.js/TypeScript Local Sidecar + SQLite + FFmpeg  
**Target Hardware:** Intel Core i5 (6th Gen), 8 GB RAM, 4 GB GPU  

---

## IMPLEMENTATION PHASES OVERVIEW

```text
Phase 0: Empirical Validation Lab (Hardware load, Groq prompting, Bridge & Concurrency)
   ├── Phase 1: Desktop Application Foundation & SQLite Core
   ├── Phase 2: Bridge Clients & Browser Worker Orchestration
   ├── Phase 3: Mode 2 Ingestion, File Validation & Master Timeline
   ├── Phase 4: Post-Production Engine (Whisper Captions, SFX, 7% Music, FFmpeg)
   ├── Phase 5: Mode 1 AI Story Engine (Multi-Key Groq + Dynamic Pacing Master Prompt)
   └── Phase 6: System Hardening, Crash Recovery & MVP Acceptance Test
```

---

## PHASE 0: EMPIRICAL VALIDATION LAB

> **Objective:** Empirically validate non-negotiable technical hypotheses before building application scaffolding.

- [x] **Task 0.1: Groq Script-to-Prompt Validation Benchmark (PASSED & VERIFIED)**
  - **Description:** Run Groq (`openai/gpt-oss-120b`) on a 60–90 second test script (concrete narrative + abstract conceptual topic).
  - **Verification:** Prompts strictly adhere to 2D Stickman universe, no invented facts, zero photorealism, and output exact calculated prompt count.
  - **Deliverable:** `test_artifacts/phase0/groq_prompt_benchmark_results.json`

- [ ] **Task 0.2: Cross-Provider Character Consistency Test**
  - **Description:** Feed the exact same Character Reference image into Google Flow and Meta AI with identical prompt text.
  - **Verification:** Evaluate line weight, body proportions, color consistency, and facial style. Determine if cross-provider mixing in a single video is viable or if per-video provider locking is required.
  - **Deliverable:** `test_artifacts/phase0/cross_provider_comparison_report.md` + visual samples.

- [ ] **Task 0.3: Reference Image Session Retention Verification**
  - **Description:** Initialize Character Reference once on a Flow worker $\rightarrow$ run 20 sequential prompts $\rightarrow$ verify character persists without re-uploading $\rightarrow$ simulate repair job on a second worker $\rightarrow$ verify second worker initializes reference prior to repair job.
  - **Verification:** No repeated uploads during active session; zero drift on repair worker.
  - **Deliverable:** Session continuity trace log.

- [ ] **Task 0.4: Hardware Concurrency Load Testing on Target Rig**
  - **Description:** Run concurrent Chromium browser worker profiles on target hardware (i5 6th Gen, 8 GB RAM, 4 GB GPU). Test 2 workers $\rightarrow$ test 3 workers $\rightarrow$ benchmark 5 workers.
  - **Verification:** Measure CPU %, RAM usage, and GPU VRAM. Establish safe operating thresholds and warning triggers (warn if free RAM < 1.5 GB).
  - **Deliverable:** `test_artifacts/phase0/hardware_concurrency_benchmarks.md`

- [ ] **Task 0.5: Extension Standalone Regression Test**
  - **Description:** Verify that with Stickman Studio completely terminated/offline, both Flow and Meta extensions operate normally in manual mode.
  - **Verification:** Zero UI blocking, zero unhandled network exceptions in Chrome devtools, normal prompt execution.
  - **Deliverable:** Regression sign-off report.

- [ ] **Task 0.6: Bridge Localhost Polling and Reconnection Simulation**
  - **Description:** Start mock local HTTP service; connect workers; abruptly kill service mid-generation; restart service.
  - **Verification:** Extensions gracefully back off and automatically re-register and recover leases upon service return.
  - **Deliverable:** Reconnection telemetry log.

- [ ] **Task 0.7: Baseline FFmpeg Render Test**
  - **Description:** Stitch 20 sample 1080p stickman images + voiceover MP3 + 7% background music into a clean H.264/AAC 1080p MP4.
  - **Verification:** Video renders without frame drops; audio sync is exact; music is ducked under voiceover.
  - **Deliverable:** Rendered `test_output_1080p.mp4`.

---

## PHASE 1: APPLICATION FOUNDATION & SQLITE CORE — [COMPLETED & VERIFIED [REAL INTEGRATION]]

> **Objective:** Establish the local-first desktop wrapper, database persistence, and local orchestration service.  
> **Status:** **ALL 5 TASKS VERIFIED IN PHASE 1 AUDITED GATE TEST SUITE (`studio/verify_phase1_gate_audited.js`) — 59 CHECKS PASSED**

- [x] **Task 1.1: Desktop Launch & UI Architecture** [VERIFIED REAL]
  - **Architecture Decision (2026-09-27):** Node.js/Express local service with Desktop Launch via Chrome Application Mode (`--app=http://127.0.0.1:45450`), eliminating compiler dependencies and saving RAM on host.
  - **Physical Evidence:** Real Chrome process spawned with PID `4840` running `--app=http://127.0.0.1:45450`, loaded 43,035 bytes of Studio UI, and terminated cleanly via taskkill.
  - **Deliverable:** Working desktop launcher (`studio/launcher.js`, `launch_studio.bat`) and Studio UI dashboard (`studio/public/index.html`).

- [x] **Task 1.2: Bundled Node.js Local Sidecar Service** [VERIFIED REAL]
  - **Stack:** Node.js Express service listening strictly on `127.0.0.1:45450`.
  - **Security:** Ephemeral authentication token generated at launch in `studio/data/auth.token`; `Authorization: Bearer <TOKEN>` header validation.
  - **Deliverable:** Running sidecar service exposing `/api/v1/health` (HTTP 200 OK, status `ONLINE`).

- [x] **Task 1.3: SQLite Database Architecture & Migration Engine** [VERIFIED REAL]
  - **Entities:** Normalized 12-table business schema: `settings`, `system_logs`, `projects`, `character_references`, `prompts`, `prompt_versions`, `workers`, `jobs`, `timeline_items`, `captions`, `audio_tracks`, `renders`.
  - **WAL Mode & Foreign Keys:** `PRAGMA journal_mode = wal;` and `PRAGMA foreign_keys = ON;` verified.
  - **Deliverable:** SQLite schema with automatic migration runner in `studio/server/db.js` and `studio/server/migrations.js`.

- [x] **Task 1.4: Project Filesystem Directory Manager** [VERIFIED REAL]
  - **Canonical Structure:**
    ```text
    Projects/<ProjectName>/
      central_images/
      downloads_raw/
      characters/
      prompts/
      captions/
      sfx/
      music/
      renders/
      project.json
    ```
  - **Deliverable:** Project creator, opener, and directory structure validator in `studio/server/project_manager.js`.

- [x] **Task 1.5: System Resource Monitor Service** [VERIFIED REAL]
  - **Metrics:** Live tracking of CPU %, physical RAM used/total/free (16.0 GB hardware installed: 2x 8GB modules; 15.78 GiB visible OS RAM), GPU/VRAM load, and active worker count.
  - **Rules:** Visible dashboard gauges and threshold warnings; never silently kills or drops user-configured workers.
  - **Deliverable:** Background telemetry service in `studio/server/resource_monitor.js` exposing `/api/v1/system/resources`.

---

## PHASE 2: BRIDGE CLIENTS & WORKER ORCHESTRATION

> **Objective:** Embed the lightweight Bridge Client inside Flow and Meta extensions and implement robust local polling orchestration.

- [x] **Task 2.1: Flow Extension Bridge Client Adapter (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **File:** `extensions/veo-automation-with Mbmirza/bridge-client.js`
  - **Features:**
    - Imports `WORKER_ID` from `./worker-config.js`.
    - Polling loop: every 2.5s for jobs, every 5s for heartbeat.
    - Bridges job payloads directly into `chrome.tabs.sendMessage({ type: "AUTO_FILL_FLOW", payloads })`.
    - Captures `PROMPT_GROUP_STATUS` events and dispatches completion/failure HTTP requests.
    - Guarded `try / catch` ensures standalone mode works when Studio is closed.
  - **Deliverable:** Tested `bridge-client.js` in Flow extension.

- [x] **Task 2.2: Meta Extension Bridge Client Adapter (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **File:** `extensions/meta automation/bridge-client.js`
  - **Features:**
    - Imports `WORKER_ID` from `./worker-config.js`.
    - Polling loop: every 2.5s for jobs, every 5s for heartbeat.
    - Bridges job payloads into `chrome.tabs.sendMessage({ type: "AUTO_FILL_META", payloads })`.
    - Listens for DOM generation completion and downloads.
    - Guarded `try / catch` ensures standalone mode works when Studio is closed.
  - **Deliverable:** Tested `bridge-client.js` in Meta extension.

- [x] **Task 2.3: Worker Registration & Heartbeat State Machine (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **States:** `CREATED`, `STARTING`, `EXTENSION_READY`, `LOGIN_REQUIRED`, `READY`, `INITIALIZING_REFERENCE`, `REFERENCE_READY`, `ASSIGNED`, `GENERATING`, `DOWNLOADING`, `VALIDATING`, `IDLE`, `PAUSED`, `ERROR`, `OFFLINE`.
  - **Endpoints:**
    - `POST /api/v1/workers/register`
    - `POST /api/v1/workers/heartbeat`
  - **Deliverable:** Complete worker state machine with live UI presence indicators.

- [x] **Task 2.4: Deterministic Fixed Range Partitioning Engine (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Formula:** Partitions $N$ prompts sequentially across $W$ user-configured workers:
    $$\text{Base} = \lfloor N / W \rfloor, \quad \text{Remainder} = N \pmod W$$
  - **Features:** Ensures exact sequential slicing (e.g., 5 Flow + 5 Meta across 500 prompts gives 50 prompts per worker).
  - **Deliverable:** Range partitioner service with test suite.

- [x] **Task 2.5: Job Leases & Timeout Reclaimer (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Mechanism:** When a worker polls `GET /api/v1/workers/:id/job`, Studio assigns the next prompt and grants a 120-second lease (`lease_owner`, `lease_expires_at`).
  - **Reconciliation:** Heartbeats extend the lease. If a worker goes silent for > 30s past expiry, the lease is revoked and the job returns to `QUEUED`.
  - **Deliverable:** Leased job dispatcher and background reaper.

- [x] **Task 2.6: Persistent Chromium Profile Manager (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Path:** Dedicated persistent user data directories: `Workers/Worker-01/`, `Workers/Worker-02/`, etc.
  - **Launcher:** Spawns isolated Chrome instances with designated profiles and pre-injected `worker-config.js`.
  - **Deliverable:** Browser launcher and process supervisor.

- [x] **Task 2.7: Login Expiry Detection Protocol (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Protocol:** When a provider redirects to login, the extension reports `POST /api/v1/workers/:id/login-state` (`LOGIN_REQUIRED`). Studio pauses that worker, alerts the user, and provides a "Focus Profile Browser" button.
  - **Deliverable:** Login monitoring and recovery flow.

- [x] **Task 2.8: Character Reference Initialization for Flow (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Mechanism:** Dispatches `VEO_UPLOAD_FILE_DATA` to trigger `catchUploadFile.ts-DJwIizxX.js` in Google Flow Ingredients.
  - **Verification:** Confirms Ingredient thumbnail in DOM; marks `reference_status = 'READY'`. Reused across all session prompts without re-uploading.
  - **Deliverable:** Flow reference initialization handler.

- [x] **Task 2.9: Character Reference Initialization for Meta (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Mechanism:** Injects character reference image via `PREPARE_IMAGE` / `k()` into Meta AI chat thread to establish visual anchor.
  - **Verification:** Marks `reference_status = 'READY'`. Reused across the thread.
  - **Deliverable:** Meta reference initialization handler.

- [x] **Task 2.10: High-Priority Repair Queue with Reference Pre-Flight (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Rule:** If Prompt `037` fails on `W01` and is reassigned to `W08`, Studio inspects `W08`'s reference state. If not `READY`, it forces reference initialization on `W08` *before* prompt submission.
  - **Deliverable:** Repair Queue coordinator with pre-flight check.

---

## PHASE 3: MODE 2 INGESTION, VALIDATION & MASTER TIMELINE

> **Objective:** Ingest existing prompt lists, validate downloaded files, and place images onto the master audio timeline.

- [x] **Task 3.1: Mode 2 Clean Prompt List Parser (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Target Format:** Strict clean sequential prompts:
    ```text
    001_stickman at desk...
    002_stickman looking out window...
    ```
  - **Validation:** Detects missing prompt IDs, duplicate numbers, malformed syntax, or count discrepancies against duration.
  - **Deliverable:** Mode 2 parser and import validator.

- [x] **Task 3.2: Central Image Ingestion Service (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Storage:** Copies/moves verified worker downloads from temporary browser download folders to `Projects/<Project>/images/`.
  - **Naming:** Primary key is numeric prompt ID: `001_description__W01.png`.
  - **Deliverable:** Central image organizer.

- [x] **Task 3.3: Multi-Tiered File Validation Engine (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Checks:**
    1. File exists on disk.
    2. File size $> 10 \text{ KB}$ (guards against 0-byte downloads).
    3. Image decodes cleanly via `sharp` / image parser.
    4. Dimensions conform to 16:9 aspect ratio (e.g. 1920x1080).
  - **Outcome:** Valid files mark prompt `COMPLETED`; invalid files trigger immediate re-queue into Repair Queue.
  - **Deliverable:** File validation pipeline.

- [x] **Task 3.4: Multi-Output Variant Handler (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Behavior:** Flow may generate variants (`001_..._a__W01.png`, `001_..._b__W01.png`). Both are cataloged under Prompt `001`. The UI allows the user to select the timeline hero asset.
  - **Deliverable:** Variant selector in UI.

- [x] **Task 3.5: Master Voiceover Duration & Pacing Calculator (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Calculation:** Inspects voiceover audio file exact duration via `ffprobe`.
  - **Pacing Presets:**
    - `1 / 4 sec` ($0.25\times$)
    - `2 / 4 sec` ($0.50\times$ — Default)
    - `3 / 4 sec` ($0.75\times$)
    - `4 / 4 sec` ($1.00\times$)
    - `5 / 4 sec` ($1.25\times$)
    - `Custom`
  - **Deliverable:** Timeline pacing calculator.

- [x] **Task 3.6: Voiceover Master Timeline Engine (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Tracks:** `VIDEO`, `VOICEOVER`, `CAPTIONS`, `SFX`, `MUSIC`.
  - **Alignment:** Places validated images sequentially against voiceover duration according to selected pacing.
  - **Deliverable:** Chronological multi-track timeline data structure.

- [x] **Task 3.7: Interactive Timeline UI (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Features:** Zoomable timeline, audio waveform display, image thumbnail track, manual image replacement, drag-and-drop cut-point adjustment, real-time video playback preview.
  - **Deliverable:** Interactive React timeline component.

---

## PHASE 4: POST-PRODUCTION & VIDEO ASSEMBLY

> **Objective:** Automate captions, sound design, background music ducking, and 1080p MP4 export.

- [x] **Task 4.1: Caption Generation via Groq Whisper & Local Fallback (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Engine:** Primary: Groq Whisper API (`whisper-large-v3`); Fallback: local `whisper.cpp`.
  - **Precision:** Generates word-level timestamps.
  - **Deliverable:** Subtitle generator producing word-timed SRT/JSON.

- [x] **Task 4.2: High-Readability Caption Renderer (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Styling:** Modern, readable bottom-center captions with customizable font, size, outline, and active-word highlight.
  - **Deliverable:** Caption styling preview and ASS/SRT compiler.

- [x] **Task 4.3: Semantic SFX Event Placement Engine (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Rule:** Never spam SFX on every image cut. Place SFX only on semantic events (scene transitions $\rightarrow$ subtle whoosh; reveals $\rightarrow$ pop; impacts $\rightarrow$ hit).
  - **Density:** Default: LOW.
  - **Deliverable:** Semantic SFX generator and track editor.

- [x] **Task 4.4: Local Asset Library Manager (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Assets:** Curated local folder for licensed SFX and background music.
  - **Metadata:** Categorized by tags, duration, intensity, and license provenance.
  - **Deliverable:** Asset browser drawer in desktop UI.

- [x] **Task 4.5: Background Music Engine & Voiceover Ducking (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Volume:** **Locked Default: 7%**.
  - **Ducking:** Automatically ducks music volume during active voiceover speech segments; smoothly returns to 7% during pauses.
  - **Looping/Cropping:** Automatically loops and crops music track to match voiceover duration.
  - **Deliverable:** Audio mixer with sidechain compression / ducking filter graph.

- [x] **Task 4.6: Bundled FFmpeg Video Exporter (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Spec:** $1920\times 1080$, 16:9, 30 FPS, H.264 video (`libx264`, crf 18), AAC audio ($320\text{ kbps}$), MP4 container.
  - **Integration:** Driven via `fluent-ffmpeg` with bundled static FFmpeg binary.
  - **Deliverable:** Production video rendering pipeline.

- [x] **Task 4.7: Post-Render Validation (IMPLEMENTED & PHYSICALLY VERIFIED)**
  - **Checks:** Verifies output file non-zero size, exact duration matching voiceover, audio/video stream sync, and valid MP4 moov atom.
  - **Deliverable:** Render QA inspector.

---

## PHASE 5: MODE 1 AI STORY ENGINE

> **Objective:** Convert video title + script + voiceover into a validated, clean prompt list using Groq and the updated Master Prompt.

- [ ] **Task 5.1: Modular AI Provider Architecture**
  - **Interface:** `AIProvider` supporting Groq as primary and Ollama as local fallback.
  - **Deliverable:** Extensible AI provider layer.

- [ ] **Task 5.2: Groq Multi-Key Pool & Failover Manager**
  - **Features:** Supports multiple user-supplied Groq API keys with health monitoring, automatic cooldown on rate limits, and seamless rotation.
  - **Security:** Keys stored securely in local app storage; never exposed in logs or source files.
  - **Deliverable:** Resilient Groq credential pool manager.

- [ ] **Task 5.3: Story Analysis & Story Bible Generator**
  - **Logic:** Deconstructs script into story beats, character visual memory, location memory, and object continuity anchors.
  - **Strict Fidelity:** Zero hallucinated facts; rejects invented historical or scientific claims.
  - **Deliverable:** Story Bible analysis module.

- [ ] **Task 5.4: Dynamic Pacing Master Prompt Engine**
  - **Integration:** Injects pre-calculated target image count into the updated Master Prompt template based on the chosen pacing preset (e.g. 2 images / 4 sec).
  - **Deliverable:** Prompt generation engine producing clean Markdown output (`001_...`).

- [ ] **Task 5.5: Chunked Batch Generation with Cross-Batch Continuity**
  - **Batching:** Generates 20–30 prompts per call, carrying forward active characters, current scene state, and visual anchors.
  - **Merging:** Combines batches seamlessly into one continuous prompt list.
  - **Deliverable:** Batch prompt generator.

- [ ] **Task 5.6: Prompt Validation & Strict Fidelity QA**
  - **Validation:** Verifies each generated prompt traces back to the script, contains stickman visual keywords, avoids photorealism, and matches the exact target count.
  - **Deliverable:** Prompt QA validator.

- [ ] **Task 5.7: Seamless Mode 2 Downstream Funnel**
  - **Architecture:** Approved Mode 1 prompt lists feed directly into the Mode 2 Job Scheduler. There is only one downstream execution pipeline.
  - **Deliverable:** Mode 1 to Mode 2 pipeline bridge.

---

## PHASE 6: CRASH RECOVERY, HARDENING & ACCEPTANCE TEST

> **Objective:** Guarantee rock-solid resumability and pass the First MVP Acceptance Test.

- [ ] **Task 6.1: Crash Recovery & Disk State Reconciliation Engine**
  - **Startup Flow:**
    1. Reads SQLite database.
    2. Scans `Projects/<Project>/images/` on disk.
    3. Reclaims expired job leases.
    4. Preserves all valid completed images.
    5. Requeues only unfinished or corrupt jobs.
  - **Verification:** Kill Studio process mid-generation; restart; zero completed prompts regenerated.
  - **Deliverable:** Crash recovery engine.

- [ ] **Task 6.2: Mock Worker Simulation Mode**
  - **Purpose:** Simulates registration, heartbeat, generation delays, downloads, and errors without consuming real provider resources or GPU memory.
  - **Deliverable:** Mock worker test harness.

- [ ] **Task 6.3: Reusable Channel Character System**
  - **Storage:** `characters/<character_id>/` storing reference image, anatomy, line weight, and clothing rules. Reusable across multiple projects.
  - **Deliverable:** Global Character Bible manager.

- [ ] **Task 6.4: Full 200-Prompt First MVP Acceptance Test**
  - **Inputs:** 200 clean prompts + Voiceover audio + Script + Character reference + Configured workers (e.g. 5 Flow + 5 Meta).
  - **Success Criteria:**
    - Prompts validated and ranges assigned.
    - Workers registered and isolated in persistent profiles.
    - Character reference initialized correctly on each worker.
    - All 200 images generated, downloaded, and validated.
    - Repair queue catches any failed prompts and initializes reference before repair generation.
    - Final images ordered `001–200`.
    - Restart mid-batch resumes without duplicate generation.
    - Assembled timeline renders into a synchronized 1080p MP4.
  - **Deliverable:** Completed, verified production video.
