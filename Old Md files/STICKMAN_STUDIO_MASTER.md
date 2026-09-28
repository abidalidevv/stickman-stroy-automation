++++++++++++;'lo 8i/***-# STICKMAN STUDIO — MASTER SPEC & LIVE STATUS
**The single source of truth. Replaces every other .md file in this workspace.**

Consolidated: 2026-09-27 · Workspace: `E:\stickman-video-automation`
Built from: GPT.md, claude.md, CLAUDE_from_gpt.md, ANTIGRAVITY.md, antigravity_tasks.md, ARCHITECTURE_AND_IMPLEMENTATION_PLAN, DETAILED_TASKS_BREAKDOWN, DOCUMENTATION_MASTER_AUDIT, IMPLEMENTATION_DECISIONS, PHASE_1 report, REAL_INTEGRATION report, STATUS.md, verify_phase5.js, groq_phase0_benchmark_results.json, Master Prompt V7 (both copies).

---

## 0. RULES FOR THE IMPLEMENTING AGENT (READ FIRST, EVERY SESSION)

1. **This is the only document you need.** Move all other `.md` files (except the two extension `README.md` files, which stay inside their extension folders) into `docs/archive/`. Do not edit, delete, or "refresh" archived files. They are history.
2. **You may edit only §2 (Live Status) and §3 (Work Queue) of this file** while working. Do not generate a new report file per phase. Put raw evidence (logs, JSON, screenshots) in `evidence/<task-id>/` and reference the path in §2.
3. **Never write completion markers** (`GOAL_COMPLETE`, "ALL PASSED", "PRODUCTION READY"). Only the user declares completion, after §14.
4. **Status vocabulary (mandatory):**
   - `REAL` — a real Chrome process / real provider API / real file on disk was exercised and observed.
   - `MOCK` — simulated worker, synthetic data, in-process API calls, or a fallback engine.
   - `AUDIT` — source/file inspection only.
   - `BLOCKED` — needs a human action; stop and report.
   - `UNVERIFIED` — code exists, no real evidence yt.
5. **Checkbox meaning:** `[x]` = REAL verified with evidence path. `[~]` = implemented, not really verified. `[ ]` = not done. `[!]` = blocked on human.
6. **A MOCK result can never satisfy a REAL requirement.** A test that silently degrades (e.g. falls back to a synthetic generator when the API key is missing) must **FAIL**, not pass.
7. **Do not weaken a test to make it pass. Do not inflate counts.** If you say "N checks", list N.
8. **Preserve the Flow and Meta extension generation engines** (§6). Only the bridge/reference adapters may be added.
9. **Stop at the checkpoints in §3** and wait for the user. Do not continue automatically past them.
10. **If a CAPTCHA / "verify you're human" / unusual-activity page appears:** pause that worker, report `BLOCKED — CHALLENGE`, do not retry, do not try to bypass. Same rule as login-required.
11. **Never put secrets in source, logs, reports, Git, or extension bundles** (§12).
12. **The user's latest instruction overrides this file.** If they conflict, say so and ask.

---

## 1. PRODUCT

A local Windows tool for one YouTube channel (personal, not SaaS): **script or prompt list → images from Google Flow + Meta AI → voiceover-synced timeline → captions, SFX, music → 1080p MP4.**

```
Script / Prompt List → (Mode 1: AI story engine) → Prompt List
   → Worker distribution (Flow + Meta, real Chrome profiles)
   → Image collection + physical validation → central_images/
   → Voiceover master timeline → Captions → SFX → Transitions → Music (7%)
   → FFmpeg → final MP4
```

**Two modes, one pipeline:**
- **Mode 2 — existing prompt list** (built first; the user already produces prompt lists with ChatGPT + the Master Prompt).
- **Mode 1 — generate everything** (title + master prompt + script + voiceover duration → prompts). Its output feeds the *same* Mode 2 execution pipeline. Never build a second pipeline.

**Core principles:** voiceover is the master clock · the script is the only source of visual truth (no invention) · one prompt = one image · prompt ID is the primary ordering key (worker ID is metadata) · never regenerate completed work · never fake a state.

---

## 2. LIVE STATUS (honest; update as you verify)

Legend per §0. Evidence paths are relative to `evidence/`.

### 2.1 Environment facts (measured)
- Installed RAM **16 GB** (2×8 GB; 15.78 GiB visible). At idle during the Phase 1 gate **~12.1 GB was already in use (~3.7 GB free)**. Earlier docs that say "8 GB" are superseded by this measurement. Real headroom for Chrome workers is small → plan **2–3 workers**, test upward. Never silently cap the user's configured count.
- No Rust/MSVC installed. Shell = Node/Express + Chrome `--app` mode (locked, §4).
- Groq API key: **not configured in the last session** (the earlier key was exposed → treat as compromised, decommissioned).

### 2.2 Status matrix

| Area | Status | What is actually true |
|---|---|---|
| **P0.1 Groq benchmark** | REAL, but weak | 2 runs, `openai/gpt-oss-120b`, 36/36 prompts, 383–436 tok/s, valid JSON. **Scored count/JSON only — not fidelity.** The saved output shows problems: text labels inside images ("Knowledge", "Ignorance", "Awareness" — violates *no text in images*), invented symbolic props for abstract lines (cube of knowledge, dotted cage, handshake icons, question-mark bricks), ~20-word prompts with no repeated locked-character description and no 16:9. It did not prove Master-Prompt compliance. |
| P0.2–P0.7 (cross-provider, reference retention, load, extension regression, bridge reconnect, baseline render) | `[ ]` NOT DONE | Unchecked in the task list. See §3 Q4. |
| **P1 Foundation** | REAL | 59 enumerated checks (53 real integration, 5 audit, 1 dry-run). Real Chrome `--app` launch (PID evidence), 12 SQLite tables + 2 internal, WAL, FKs, project folders, REST. Minor gap: "close/reopen" was a fresh DB query, **not a real Studio restart** — do one real restart. |
| P2 bridge clients (Flow + Meta) | `[~]` implemented | `bridge-client.js` lives in `src/ui/side-panel/` of each extension (not extension root as the old task text says). Standalone-mode preservation **never regression-tested** (P0.5). |
| **P2 Flow W01 real generation** | REAL (1 prompt) | Per STATUS.md: real Flow session, 1376×768 WebP ~122 KB, physical validation, Studio-computed SHA-256, central ingest. The detailed Phase 2 report was **not in the bundle reviewed** — re-confirm evidence exists under `evidence/`. Only one prompt, not a batch. |
| **P2 Meta W02** | `[!]` BLOCKED | `LOGIN_REQUIRED`. **No real Meta generation has ever run.** Any doc saying W02 "completed with physical file validation" is wrong. |
| P2 reference init Flow / Meta (2.8/2.9) | `[~]` UNVERIFIED | Marked "physically verified" in the old checklist, but no evidence of real Ingredients/thread state being observed; Meta is blocked. |
| P2 reaper / crash recovery | REAL (earlier session) | Real Chrome killed with `taskkill`, lease expired naturally, prompt → `REPAIR_PENDING`. |
| P2 range allocation, repair failover, reference pre-flight | MOCK | Tested by `verify_phase2/6` (in-process API calls + `MockWorkerCluster`). Real cross-worker failover with a real reference: **not done**. |
| P3 parser, ingestion, timeline (3.1–3.6) | MOCK/synthetic + 1 real image | Legacy `verify_phase3` uses synthetic tiny PNGs. One real Flow image was ingested. |
| P3 Interactive timeline UI (3.7) | `[~]` RE-VERIFY | Checklist says "React component, verified", but the UI is vanilla `index.html` (no React) and an earlier audit found the timeline is a read-only preview. |
| P4 transcription | REAL on TTS only | Groq Whisper + local `faster-whisper` tested on a **Windows TTS sample**, not a human voice. Fallback engine is genuine (no heuristic). |
| P4 captions / render / ducking | `[~]` | ASS/SRT produced; FFmpeg 1080p30 H.264/AAC works; **the only render shown is a 4-second, 85 KB test clip.** No full-length render from a real voiceover yet. |
| P4 SFX / music library | `[~]` partial | Only 3 generated tone files (`whoosh/pop/pencil_sketch.wav`). Kenney/Pixabay packs not downloaded. |
| **P5 Mode 1 engine + UI tab** | `[~]` implemented | Engine (`ai_story_engine.js`) + "AI Story Engine" tab exist. |
| **P5 real Groq run through the engine** | `[ ]` NOT DONE | The last "live E2E" (12 prompts) ran on the **synthetic fallback** (no API key). STATUS.md row "Phase 5 PASSED (LIVE E2E)" is **inaccurate — correct it.** |
| P5 fidelity QA (5.6) | `[ ]` NOT DONE | `verify_phase5.js` only checks: model name, pacing math, IDs `001..N`, `NNN_` prefix, status QUEUED. It passes on synthetic output. It does **not** detect invented characters/objects/text. |
| P5 chunking, multi-key pool, review/edit UI | `[ ]` not evidenced | Unchecked in task list. |
| P6 (crash recovery of Studio itself, character system, 200-prompt acceptance) | `[ ]` NOT DONE | Only `MockWorkerCluster` (MOCK) exists. |
| Tauri | DEFERRED | Decision §4. Not required. |

### 2.3 Known documentation errors to fix (Q0)
- STATUS.md: Phase 5 row (see above); "Phase 2 PASSED (HUMAN BLOCKER PAUSED)" wording for Meta → should be `BLOCKED`; file tree shows `index.css`/`index.js` and `master_prompt.md` that may not exist.
- Task checklist: 2.8, 2.9, 3.7, 4.4 marked verified without real evidence → `[~]`.
- IMPLEMENTATION_DECISIONS.md Conflict 1 still says "Host RAM is limited to 8GB" → replace with §2.1.
- Two Master Prompt copies exist (see §8). Keep one.

---

## 3. WORK QUEUE (do in order)

### Q0 — Housekeeping (no new features)
- Archive old .md files (§0.1). Fix §2.3 items. Add `.gitignore` (auth token, sqlite, logs, `.env`, keys). Confirm no key exists anywhere in the repo (grep).
- Rename the canonical master prompt to `master_prompt.md` at workspace root; archive the obsolete copy; make `ai_story_engine.js` **load it at runtime from that path**.
- Verify the text actually sent to Flow/Meta does **not** contain the `NNN_` prefix (it would pollute the image prompt and double the number in the filename). ID must come from `promptIndex`, not from prompt text.

### Q1 — Phase 5 with REAL Groq  ▶ **CHECKPOINT: stop and report to user**
1. **Human:** user supplies Groq key(s) via env `GROQ_API_KEY` or Settings UI.
2. **Remove silent degradation.** Production generation must use Groq → (on failure) Ollama → otherwise return an error. The synthetic generator is allowed **only** behind an explicit `SYNTHETIC_TEST_MODE`, every output labelled `SYNTHETIC — NOT AI`, and **never** counted toward any gate.
3. **System prompt = the real Master Prompt** (§8) + pacing preset + exact target count. Prompts must carry the locked character description, 16:9, illustrated-world style, no text-in-image, no invented symbols.
4. **Implement real Fidelity QA (5.6)** — three layers:
   a. *Deterministic:* exact count, IDs sequential, no empties/duplicates, forbidden words (photo, photograph, realistic, cinematic, live-action, 3D…), text/label/quote patterns ("labeled", quoted words, signs, captions), missing style/16:9/character tokens.
   b. *Source trace:* every prompt stores `source_span` (script text it depicts) + `scene/characters/objects/location`.
   c. *LLM judge:* a **separate** Groq call (different prompt, temperature low) checks each prompt against its source span and returns `{supported: bool, invented: [..], reason}`. Rejected prompts are regenerated (max 2 retries) then flagged for manual review — never silently accepted. Abstract narration must be shown via pose/expression/objects already in the script, not new symbolic scenes.
5. **Acceptance runs (REAL, saved to `evidence/Q1/`):**
   - Re-run the Phase 0 script (72 s, concrete + abstract) **twice** with the real Master Prompt. The QA layer must flag the abstract-segment problems seen in the old benchmark (labels, cube/cage/handshake metaphors) — if it flags nothing, the QA is not working.
   - One long/chunked script (≥ 5 min ≈ 150 prompts at 2/4 s) proving continuity across batches, no duplicate/missing IDs at chunk boundaries.
   - Mode 1 → Mode 2 round trip: generated list imported by the Mode 2 parser, 100 % ID match.
6. Rewrite `verify_phase5.js`: **fail if provider ≠ groq/ollama**, assert QA verdict fields exist, assert flagged items are not queued.
7. Provider/keys: see §12 (multi-key pool is user-requested; implement health/cooldown failover, do not design it to evade rate limits).

### Q2 — Meta real E2E
- **Human:** log into `Workers/Worker-W02` (Meta) once. Then one real prompt: assign → bridge → `AUTO_FILL_META` → real generation → real download → validation → SHA-256 → `central_images/` → `COMPLETED`. Evidence in `evidence/Q2/`.

### Q3 — Real character reference + repair  ▶ **CHECKPOINT: stop and report**
- Flow: initialize the real reference (observe Ingredients state, screenshot), run 3–4 real prompts **without re-uploading**, inspect continuity.
- Meta: equivalent anchor in the thread, multiple real prompts.
- Kill W01 mid-job → repair prompt goes to a worker that never had the reference → confirm it initializes the reference **before** generating. Real browser state must be observed; a DB `READY` flag is not evidence.

### Q4 — Phase 0 leftovers (real)
- 0.2 Cross-provider consistency: same reference + same prompts, 5 images each on Flow and Meta, side-by-side. Decide: mixed-provider video OK, or scene-level split, or one provider per video.
- 0.3 Session retention: 20–30 prompts in one session with reference sent once — does consistency decay?
- 0.4 Load: 2 → 3 → 5 workers on this machine; record RAM/CPU; baseline is ~12 GB used at idle.
- 0.5 Standalone regression: both extensions work 100 % with Studio closed.
- 0.6 Bridge reconnect: close/minimize side panel, suspend, reopen → worker re-registers and resumes lease, no silent disappearance.

### Q5 — First real production smoke test
- 2 real workers, 15–20 real prompts, **real human voiceover recorded by the user**, real Flow/Meta images → ingest → timeline → captions → SFX → music 7 % → FFmpeg → playable MP4 → ffprobe. Full-length audio, not a 4 s clip. Real Studio kill/restart in the middle (P1 gap + P6.1).

### Q6 — Remaining Phase 6
- Real Studio crash recovery + disk reconciliation, reusable channel Character System (reference + bible, channel default, project override), keep `MockWorkerCluster` labelled MOCK.

### Q7 — Final acceptance (§14). Scale only after Q5 is clean.

**Human tasks:** Meta login (W02) · Groq key(s) + fallback provider keys · record a real voiceover · provide the character reference image · download SFX/music packs (§11) · say yes/no to each checkpoint.

---

## 4. LOCKED DECISIONS

| # | Decision | Why |
|---|---|---|
| 1 | **Shell = Node/Express local service + Chrome `--app=http://127.0.0.1:45450`** (`launch_studio.bat` → `studio/launcher.js`). Tauri/Electron deferred; revisit only for an installer. Node SEA (`--build-sea`) is the light path to a real `.exe` later. | No Rust/MSVC on host; Electron adds a 2nd Chromium competing with workers for RAM. |
| 2 | **No third bridge extension.** `bridge-client.js` + `worker-config.js` live *inside* each existing extension. | `externally_connectable` cross-extension messaging is fragile. |
| 3 | **Bridge = HTTP polling**, jobs ~2.5 s, heartbeat ~5 s, 120 s lease. Not WebSocket. Do not rely on `setInterval` in an MV3 service worker. | MV3 suspends idle workers. |
| 4 | **Reference image is initialized once per worker session, not per prompt** (Flow: Ingredients; Meta: thread anchor). Repair to another worker → pre-flight init first. | Matches provider behavior; tested single-session consistency. |
| 5 | **Prompt IDs are sequential 3-digit** `001…NNN`; primary ordering key. Master Prompt outputs unnumbered blocks → Studio auto-indexes. | Ordering, filenames, ranges. |
| 6 | **Canonical image dir = `Projects/<slug>/central_images/`**; raw downloads land in `downloads_raw/`. | Separates verified from raw. |
| 7 | **Min image size 5,120 bytes** + magic bytes + decodable dimensions + Studio-side SHA-256. | Real stickman PNGs are 6–8 KB. |
| 8 | **Primary AI = Groq `openai/gpt-oss-120b`** (configurable). Ollama = emergency fallback. Old `llama-3.3-70b-versatile` is dead. | Phase 0 result; deprecation. |
| 9 | **Transcription: Groq Whisper primary; genuine local STT fallback (`faster-whisper`).** Heuristic timing is never a substitute. | Real word timestamps. |
| 10 | **Music default = exactly 7 %** (`volume=0.07`), ducks under speech (~3 %), returns to 7 %. The old 56 % is obsolete. | Voiceover dominance. |
| 11 | **Pacing default = 2 images / 4 s (×0.50).** Presets 1/4 (0.25), 2/4, 3/4 (0.75, historical), 4/4 (1.00), 5/4 (1.25), Custom; or exact user count. `target = round(seconds × multiplier)`. Never hard-code 0.75. | User's current workflow. |
| 12 | **Worker counts are user-set** (Flow X, Meta Y). No default of 10, no silent cap; warn only. Start real tests at 2. | Hardware ≠ architecture capacity. |
| 13 | **Fixed contiguous range allocation** (`base=⌊N/W⌋`, remainder spread) + repair queue for missing/failed. | Predictable, simple. |
| 14 | **Output 1920×1080, 16:9, 30 fps, H.264, AAC, MP4**, bundled FFmpeg/FFprobe. | — |
| 15 | **Personal tool.** Multi-account automation of consumer sites is a known ToS/detection risk the user has explicitly accepted. Do not add bypass/evasion behavior; challenge pages are hard stops (§0.10). | User decision. |
| 16 | **Automated visual consistency QA is V2.** V1 = manual thumbnail review. | Needs paid vision API or weak local model. |

---

## 5. ARCHITECTURE

**Stack:** Node.js/Express service (`127.0.0.1:45450` only, bearer token in `studio/data/auth.token`) · SQLite WAL + FKs · vanilla HTML/JS UI (`studio/public/`) · Chrome `--app` window · bundled `ffmpeg.exe`/`ffprobe.exe` (`studio/bin/`) · Groq/Ollama providers · `faster-whisper` via `local_whisper.py`.

**Workspace:**
```
E:\stickman-video-automation\
├── STICKMAN_STUDIO_MASTER.md      ← this file
├── master_prompt.md               ← canonical Master Prompt (runtime asset, §8)
├── launch_studio.bat
├── docs\archive\                  ← all old .md files
├── evidence\<task-id>\            ← raw proof
├── studio\  (launcher.js, package.json, verify_*.js, real_integration_test.js,
│             bin\, data\, public\, server\, sfx\)
│   server\: index, db, migrations, routes, logger, resource_monitor,
│            project_manager, profile_manager, worker_orchestrator,
│            ingestion_manager, timeline_manager, transcription_service,
│            local_whisper.py, render_engine, ai_story_engine, mock_workers
├── extensions\
│   ├── veo-automation-with Mbmirza\  (Flow)  + worker-config.js + src\ui\side-panel\bridge-client.js
│   └── meta automation\              (Meta)  + worker-config.js + src\ui\side-panel\bridge-client.js
├── Workers\Worker-W01 (Flow), Worker-W02 (Meta), …   ← persistent Chrome profiles
└── Projects\<slug>\ project.json, prompts\source.md, central_images\, downloads_raw\,
                     characters\, captions\, sfx\, music\, audio\, renders\
```

**SQLite (12 business tables):** `settings, system_logs, projects, character_references, prompts, prompt_versions, workers, jobs, timeline_items, captions, audio_tracks, renders` (+ `_migrations`, `sqlite_sequence`). Add per-prompt provenance columns (`source_span, scene, characters, objects, location, provider, model, qa_verdict`) — metadata stays in DB, never in the exported prompt text.

**REST (`/api/v1/`):** `GET /health` · `GET /system/resources` · projects CRUD · `POST /projects/:id/assign-workers` · `POST /projects/:id/ai/generate-prompts` · `GET /ai/models` · `POST /ai/model-config` · workers: `POST /workers/register`, `POST /workers/heartbeat`, `GET /workers/:id/job`, `POST /workers/:id/reference-state`, `POST /workers/:id/login-state` · jobs: `POST /jobs/:id/ack|events|complete|fail`.

**Worker states:** CREATED · STARTING · EXTENSION_READY · LOGIN_REQUIRED · READY · INITIALIZING_REFERENCE · REFERENCE_READY · ASSIGNED · GENERATING · DOWNLOADING · VALIDATING · IDLE · PAUSED · ERROR · OFFLINE. **Job states:** QUEUED · ASSIGNED · ACKNOWLEDGED · GENERATING · DOWNLOADING · VALIDATING · COMPLETED · FAILED · RETRYING · CANCELLED (+ prompt `REPAIR_PENDING`). Default 3 retries → permanent `FAILED`.

---

## 6. EXTENSION RULES

Existing MV3 extensions (Flow v3.5.2 uses Chrome Debugger API input; Meta v2.2.3 uses DOM/clipboard events) already do prompt queue, generation monitoring, downloads, filenames (`NNN_<prompt≤50 chars>[_a|_b]__W01.ext`), delays, concurrency.

**Allowed:** `bridge-client.js` (register, heartbeat, poll job, ack, events, complete/fail, login-state, reference-state) · reading `WORKER_ID` from `worker-config.js` · reference-initialization steps (Flow `VEO_UPLOAD_FILE_DATA` → Ingredients; Meta `PREPARE_IMAGE` → thread) · small adapter hooks · service-worker side-panel auto-open.

**Forbidden without explicit approval:** rewriting the prompt queue, generation detection, download/filename/numbering logic, retry/delay/concurrency behavior, or removing standalone mode. Job dispatch uses the extensions' existing messages (`AUTO_FILL_FLOW`, `AUTO_FILL_META`).

**Requirements:** if `localhost:45450` is unreachable the extension must behave exactly as standalone. On side-panel suspend/reopen/browser wake: re-register immediately with persistent `WORKER_ID`; Studio returns any active lease so generation resumes without duplication. Login expired → report `LOGIN_REQUIRED`; challenge page → `BLOCKED — CHALLENGE`.

**Completion gate (never trust worker JSON):** file must physically exist · filename prefix maps to the prompt ID · magic bytes (PNG `89504E47`, JPEG `FFD8FF`, WebP `RIFF…WEBP`) · ≥ 5,120 bytes · decodable, width/height > 0 · (16:9 check for production images) · Studio computes SHA-256 from disk · copy to `central_images/` · only then `COMPLETED`. Invalid file → repair flow. Flow variants `_a/_b` link to the same prompt with a hero-asset choice.

---

## 7. WORKERS

- One persistent Chrome profile per worker (`Workers/Worker-Wnn`), extension auto-loaded (`--load-extension`), logged in manually once; sessions persist. Login expiry pauses only that worker.
- Allocation: contiguous ranges over user-set worker counts; repair queue reassigns missing/failed prompts to any healthy worker after reference pre-flight; completed prompts are never regenerated automatically.
- Lease 120 s, renewed by heartbeat; reaper returns stale jobs to the queue; startup reconciliation compares DB against files on disk.
- Live resource monitor (CPU, RAM, GPU/VRAM, workers); warnings only.
- Chrome launch: `--user-data-dir`, `--load-extension`, `--no-first-run`. Flow profile = Google account (Flow, images only — not Flow video); Meta profile = Meta AI account.

---

## 8. PROMPT RULES (Master Prompt = the contract for prompt content)

**Canonical file:** `master_prompt.md` (the newer copy with pacing presets; the older "V7 … ×0.75 LOCKED" copy is obsolete). Mode 1 loads it at runtime. The user also pastes it into ChatGPT for Mode 2 lists. Key rules Studio must enforce (full text lives in the file):

- **Style is absolute:** one coherent **2D hand-drawn stickman / illustrated world**. No photorealism, live-action, stock/cinematic photography, realistic 3D, or hyper-real anatomy. *Everything* (bread, fire, mountains, buildings, animals) is drawn in the same illustrated world.
- **Character identity lock:** same head shape, proportions, limbs, face marks, clothing; repeat the locked description in every prompt where the character appears. Only pose/action/expression/position/camera/environment may change.
- **Script fidelity:** depict only what the script states or directly supports — no invented characters, objects, locations, actions, facts, dates, dialogue, outcomes; preserve uncertainty words ("possibly", "believed"); period/scientific accuracy; if the script ends abruptly, do not invent an ending.
- **No text inside images** (titles, captions, labels, logos, signs, invented statistics) unless the script supplies exact wording for a real written object.
- **One image per prompt**, real visual description (not "illustrate the idea"), 16:9, safe central composition, no filler, no duplicates, no contradictions, abstract lines shown through posture/expression/existing objects.
- **Count:** `round(voiceover_seconds × multiplier)` or the user's exact count — never more, never fewer.
- **Output format (ChatGPT/Master Prompt):** raw prompts only, separated by one blank line — no labels, numbers, timestamps, headings, bullets. **Studio Mode 2 parser must accept both** (a) that raw blank-line-separated form (auto-index `001…`) and (b) numbered `NNN_text`. Detect malformed lines, missing/duplicate IDs, and count mismatch **before** starting workers. Mode 1 stores `prompt_id` separately from clean `prompt_text`.

---

## 9. MODE 1 (AI STORY ENGINE) REQUIREMENTS

Input: title, Master Prompt, script (paste/TXT/MD/SRT/VTT), voiceover duration (from audio or manual), pacing, optional character reference/hints. Pipeline: **Story Bible** (characters, appearance, locations, objects, chronology, recurring props, uncertainty) → visual plan (per target image: ID, source span, timeline position, scene, character state, action, location, objects, framing) → chunked generation (~20–30 prompts/call, Story Bible + previous state carried forward, deterministic IDs, no duplicates at boundaries, merged into one ordered list) → **Fidelity QA (§3-Q1.4)** → user review UI (inspect, edit one prompt, regenerate one/range without regenerating everything, approve) → handoff to Mode 2.

Provider behavior: timeout, retry, JSON-schema output validation, rate-limit handling, provider health; Groq → Ollama → error (never silent synthetic). Chunked calls must respect the provider's per-minute limits.

---

## 10. MODE 2

Import prompt list + script/SRT + voiceover + character reference (+ optional music) → validate (count, IDs, gaps, duplicates) → allocate → workers → ingest/validate → repair → timeline. AI generation does not run in this mode. Mode 2 is the primary MVP and must work with real workers before anything else is expanded.

---

## 11. TIMELINE & POST-PRODUCTION

- **Timeline:** voiceover = master clock. Tracks VIDEO · VOICEOVER · CAPTIONS · SFX · MUSIC. No unexplained gaps/overlaps. Cuts target the pacing spacing but may shift slightly to sentence/action boundaries (chronology never altered). Manual image replace with version history; drag cut points; ripple edits. UI: zoom, waveform, thumbnails, preview (currently `[~]`, §2).
- **Captions:** Groq Whisper on the real voiceover → word-level timestamps → styled ASS + SRT, bottom-center, CapCut-style readability, active-word highlight where supported. SRT/VTT input is a reference only; audio wins. Fallback = real local STT.
- **SFX:** event-driven, **not after every image**; default density LOW; scene change→whoosh, reveal→pop, impact→hit. Library in `assets/sfx/` with metadata JSON (`tags`, `intensity`, source/license). Download once, no runtime API: **Kenney audio** (CC0) and **Pixabay SFX** (no attribution). Not yet done (§2).
- **Transitions:** preset library only (crossfade, zoom in/out, pan, slow push, subtle shake); never arbitrary FFmpeg effects.
- **Music:** optional upload, loop/crop to voiceover length, **7 %**, ducking on. Sources: Pixabay Music (no attribution); Incompetech needs attribution — avoid unless tracked.
- **Render + QA:** ffprobe checks non-zero size, exact duration, one video + audio stream, 1920×1080, 30 fps, h264/aac, no black frames.

---

## 12. PROVIDERS, KEYS, SECURITY

- **Roles:** Groq = prompts (`openai/gpt-oss-120b`, model configurable via `GROQ_MODEL`/Settings) **and** Whisper (`whisper-large-v3`). Ollama = local emergency fallback (must be smoke-tested, not placeholder). Optional cloud fallbacks: OpenRouter free models, Google Gemini Flash free tier (also usable for future vision QA). Pexels/Pixabay only for optional stock assets, not audio.
- **Free-tier reality (verify before relying):** Groq `llama-3.1-8b-instant` ~30 RPM / 14,400 per day; `gpt-oss`/70B-class ~30 RPM / ~1,000 per day; Whisper ~2,000 requests/day; OpenRouter `:free` ~1 M tokens/day; Gemini Pro no longer free. Limits change; keep them configurable, never hard-coded.
- **Multi-key:** the user plans several Groq keys plus 3 fallback providers. Implement a key pool with health tracking, cooldown, and failover across keys/providers. Groq rate limits are, per its docs, applied at the *organization* level (verify) — extra keys from the same org add resilience, not capacity; different providers add real capacity. Do not build behavior meant to circumvent a provider's limits.
- **Secrets:** env vars or Settings DB only; never in source/`.md`/logs/tests/Git/extension bundles; redact in logs; the previously exposed key stays decommissioned. Local API bound to `127.0.0.1` with token auth.

---

## 13. VERIFICATION HONESTY

- Every test line carries a label: `[REAL]`, `[MOCK]`, `[AUDIT]`, `[BLOCKED]`, `[DRY-RUN]`.
- Reports say what was **observed**, with PID/timestamp/path. "Executed launcher.main" ≠ "saw a window".
- A real generation claim needs: real Chrome PID, real provider page state, real downloaded file, Studio-computed SHA-256, DB row.
- TTS or sine-wave audio is a smoke test only; caption quality must be judged on a real human voice.
- When a test fails: root-cause → smallest fix → regression test → re-run → confirm neighbors. Ask the user only for human-only blockers (logins, keys, challenges, ambiguous requirements).
- Mock suites (`verify_phase2/3/4/6`, `MockWorkerCluster`) stay as regression tools, labeled MOCK forever.

---

## 14. FINAL ACCEPTANCE (user declares, not the agent)

After Q5 passes clean, then: **200 real prompts**, configured real workers, real reference initialization, repair queue + repair pre-flight, real crash/restart recovery, no duplicate completed generation, exact `001–200` ordering, timeline, captions, SFX, music at 7 %, synchronized playable 1080p30 MP4 — plus the workflow: open Studio → create project → Mode 1/2 → script/prompts → voiceover → reference → pacing → review → set workers → launch → log in when asked → generate → monitor → auto-repair → timeline → captions → SFX → music → preview → render → QA → export.

---

## 15. KNOWN RISKS

1. **Bot/challenge detection** on Flow/Meta (accepted; hard-stop on challenge, no retries).
2. **RAM:** ~3.7 GB free at idle; each Chrome worker ~0.6–1 GB.
3. **MV3 side-panel lifecycle** — closing the panel can stop the bridge (Q4-0.6).
4. **Cross-provider style drift** — measured ~90 % different with text-only prompts; reference-image effect still untested (Q4-0.2).
5. **Provider UI changes** can break the extensions (they drive real DOMs).
6. **Prompt-ID prefix pollution** of image prompts/filenames (Q0).
7. **Free-tier limits change** without notice.
8. **Voiceover reality gap:** all speech tests so far used TTS.
9. The developer's stated weak spots are TypeScript/Node backends — keep server internals commented and the API surface small and stable.

---

## 16. ARCHIVE MAP (moved to `docs/archive/`)

`GPT.md` product vision · `claude.md` / `CLAUDE from gpt.md` architecture drafts · `ANTIGRAVITY.md`, `antigravity tasks.md` old execution prompts · `STICKMAN_STUDIO_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md`, `…DETAILED_TASKS_BREAKDOWN.md` old plan/checklist (checkbox state folded into §2) · `DOCUMENTATION_MASTER_AUDIT.md`, `IMPLEMENTATION_DECISIONS.md` (decisions folded into §4) · `PHASE_1_IMPLEMENTATION_REPORT.md`, `REAL_INTEGRATION_ACCEPTANCE_REPORT.md`, old `STATUS.md` (evidence history) · obsolete Master Prompt copy. Historical documents are never rewritten.
