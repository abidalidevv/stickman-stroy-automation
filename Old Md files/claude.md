# Stickman Studio — Architecture Specification (Claude)

This document is a companion to `gpt.md` in this same folder. Where the two
disagree, **this file's explicit corrections win** — they were reached after
stress-testing the plan turn by turn across the full conversation. Antigravity
should treat both files as one combined spec, resolving conflicts in favor of
the "Locked Corrections" callouts below.

---

## 1. What this is

Not an "AI image prompt generator." A **local Stickman Video Production
Engine**: script/prompt-list in → fully assembled, rendered MP4 out. Personal
production tool for one YouTube channel, not a SaaS product.

```
Script / Prompt List
        ↓
Story + Visual Planning (Mode 1 only)
        ↓
Prompt Generation / Existing Prompt List (Mode 2)
        ↓
Worker Distribution (Flow + Meta)
        ↓
Image Collection + Validation
        ↓
Voiceover Timeline
        ↓
Captions → SFX → Transitions → Music
        ↓
FFmpeg
        ↓
FINAL 1080p MP4
```

## 2. Platform & stack

- Windows 10/11 desktop app, local-first, single user.
- UI: Tauri 2 + React + TypeScript + Tailwind.
- Orchestration: Node/TypeScript sidecar (bundled, user does not install Node
  separately).
- Storage: SQLite + per-project folders.
- Rendering: FFmpeg (bundled via `ffmpeg-static`, driven via
  `fluent-ffmpeg`).

**Known risk, explicitly accepted, not to be "fixed" by Antigravity:**
TypeScript and Node backend work are a stated weak spot for the developer.
Debugging the orchestrator/bridge layer will likely need to go back through
Antigravity/Claude rather than be done independently. Keep the sidecar's
internals well-commented and its API surface (section 8) as small and stable
as possible for this reason.

## 3. Voiceover is the master timeline

```
Voiceover 06:36  →  396 sec
Preset: Images / 4 sec = 2 (configurable: 1 / 2 / 3 / 4 / 5 / Custom)
396 × 0.5 = 198 images
```

Images are placed against the voiceover, not the other way around. Cut points
target the preset spacing but may shift slightly to land on sentence/action
boundaries (semantic timing), never destroying chronological order.

## 4. Two operating modes

**Mode 1 — Generate Everything.** Input: title, master prompt, script,
voiceover, character reference (optional), background music (optional).
Studio runs its own AI Story Engine (duration → image count → story
beats → character/location/object memory → prompt generation → strict
validation) and produces a prompt list identical in shape to Mode 2's input.
**Mode 1's output funnels directly into the Mode 2 pipeline** — there is
only one downstream pipeline, not two.

**Mode 2 — Existing Prompt List (build this first).** Input: a prompt-list
file, script, voiceover, character reference, background music (optional).
No AI prompt generation runs in this mode.

**Locked correction — Master Prompt output format:** the `.md` prompt list is
**clean sequential prompts only** — no headings, numbers-as-text, timestamps,
or explanations mixed into the prompt body:

```
001 prompt text...
002 prompt text...
003 prompt text...
```

The Mode 2 parser targets exactly this shape. All metadata (source text,
timestamp, scene id, character id) lives in the internal SQLite/JSON layer,
never in the exported prompt file. If the developer's actual production
Master Prompt template still emits the older structured-block format
(`IMAGE 001 / Timestamp / Source narration / Visual purpose / Prompt`),
**that must be reconciled before Phase 1** — confirm with the developer which
literal format the parser should target; don't assume.

**Mode 2 validation before generation starts:**
- Expected count (from duration × pacing) vs. received count — block start on
  mismatch, report exactly which IDs are missing.
- Duplicate ID detection — block start, report duplicates.

## 5. Existing extensions — do not rewrite

Two existing, working Manifest V3 extensions are reused as-is:
- Flow/Veo automation (`Test-to-image-Chrome-extention`)
- Meta automation (`Meta-Automation-Auto-Meta-on-Meta.ai`)

Both already handle: prompt input, generation monitoring, downloads, queueing,
filename/suffix handling, delays, concurrency. **Studio does not replace
them.** A `WORKER_ID` system is already implemented in both (`worker-config.js`,
default `"W01"`), appending `__W01` etc. to every downloaded filename.

### 5a. Bridge — final decision

**No third extension.** A `bridge-client.js` module is added *inside* each of
the two existing extensions (same pattern as `worker-config.js`):

```
Flow Extension                    Meta Extension
 ├── existing automation           ├── existing automation
 ├── worker-config.js              ├── worker-config.js
 └── bridge-client.js  ← new       └── bridge-client.js  ← new
        ↓                                 ↓
              localhost API (Node sidecar)
```

Rejected alternative: a separate, standalone third "Bridge" extension
coordinating the other two via `externally_connectable` messaging. Rejected
because cross-extension messaging requires hard-coding each extension's ID
into the others' manifests, and those IDs are fragile across
repackaging — three moving parts instead of two, for no benefit given the
`worker-config.js` pattern already works.

### 5b. What the bridge-client is allowed to touch

```
Allowed:
  - Bridge client itself (register / heartbeat / job fetch / status / error)
  - Worker registration & status reporting
  - Character-reference initialization steps (explicit exception — see 7)
  - Reading existing worker-config.js for WORKER_ID
  - Small adapter hooks needed to trigger the above

Not allowed without explicit, separately-flagged need:
  - Rewriting the prompt queue
  - Rewriting generation-detection / download-detection logic
  - Changing filename or numbering logic
  - Changing existing retry/concurrency/delay behavior
  - Removing any existing standalone functionality
```

**Locked correction:** character-reference upload/initialization *is* a
generation-adjacent step (uploading to Flow's "Ingredients", or Meta's
photo-first flow) — call this out to Antigravity as an explicit exception to
"don't touch generation logic," or it will likely be skipped as
out-of-scope, silently dropping the whole consistency feature.

### 5c. Bridge protocol — polling, not push

MV3 service workers are ephemeral; Chrome suspends them when idle, so a
persistent WebSocket loop is not a safe assumption. Protocol:

```
Job polling:   every 2–3 sec
Heartbeat:     every 5–10 sec
State:         persisted both locally (extension) and server-side (Studio)
```

If a worker's context is suspended and reconnects later, it recovers state
from the server rather than assuming continuity.

Events the bridge-client implements: `REGISTER`, `HEARTBEAT`, `GET_JOB`,
`JOB_STARTED`, `PROMPT_SUBMITTED`, `GENERATION_STARTED`,
`GENERATION_COMPLETE`, `DOWNLOAD_COMPLETE`, `JOB_FAILED`, `LOGIN_REQUIRED`,
`WORKER_PAUSED`, `WORKER_RESUMED`, `WORKER_IDLE`.

**Graceful degradation is mandatory:** if `localhost` is unreachable, both
extensions must continue working exactly as they do standalone today. Verify
this explicitly as a test (Phase 0, Test E below), not just as an assumption.

## 6. Worker system

- **No default worker count.** UI has independent `Flow Workers` and
  `Meta Workers` counters the user sets directly (e.g. 5+5, 2+8, 10+10).
  Architecture supports any configured number; it never silently caps it.
- **Hardware reality is separate from architecture capacity.** Developer's
  actual machine: i5 6th gen, 8GB RAM, 4GB GPU. Load-test starting at 2
  workers, then 3, then 5 — do not assume a configured 10 will actually run
  well on this hardware. Show a live resource monitor (CPU/RAM/GPU/VRAM) and
  a non-blocking warning at high configured counts; never force-reduce the
  user's setting.
- **Fixed-range allocation is primary** (`W01 → 001–050`, `W02 → 051–100`,
  ...). A missing/failed prompt goes into a **Repair Queue** and can be
  reassigned to any available worker — it does not restart the whole batch.
- **Worker profiles:** each worker = one persistent Chromium profile
  (`Workers/Worker-01/`, etc.) with its own extension + login/session,
  logged in manually once by the user, reused thereafter. Login expiry pauses
  that worker only (`LOGIN_REQUIRED`) and shows a resume action once the user
  re-authenticates in that profile's browser.
- **Filenames:** `001_description__W01.png` (Flow multi-output suffix
  preserved: `001_description_a__W01.png`). **Prompt ID is the primary
  ordering key; Worker ID is metadata only** — final sequencing is always by
  numeric prompt ID, worker completion order is irrelevant.
- **Automation posture:** design for normal service usage, not for defeating
  anti-bot/rate-limit systems. (The developer has explicitly accepted the
  underlying ToS/automation-detection exposure of running multiple
  self-owned accounts on a personal project — this is a business-risk
  decision already made, not an open item for Antigravity to solve or flag
  further.)

### Worker lifecycle

```
CREATED → BROWSER_STARTED → EXTENSION_READY → LOGIN_CHECK → READY
 → REFERENCE_CHECK → REFERENCE_READY → JOB_ASSIGNED → GENERATING
 → DOWNLOADING → VALIDATING → COMPLETED → NEXT_JOB

Errors: LOGIN_REQUIRED, REFERENCE_ERROR, GENERATION_ERROR, DOWNLOAD_ERROR,
        TIMEOUT, WORKER_DISCONNECTED
```

## 7. Character consistency

Three real, tested facts this design rests on:
1. Same provider + same continuous session, with well-written repeated
   character description → strong consistency (confirmed by developer's own
   50-image single-session Flow batch).
2. Same prompt text, no reference image, split across Meta vs. Flow → **~90%
   visual difference** between the two providers (confirmed by developer's
   own test). Pure text-only prompting does not survive a cross-provider
   split.
3. Reference-image-based cross-provider consistency — **not yet tested as of
   this document.** Run before finalizing Section 7's implementation:

   **Phase 0 – Test B:** same reference image + same prompts → generate on
   both Flow and Meta → compare head/body proportions, line style, color,
   recurring traits. Outcome determines whether "single video mixes both
   providers" stays viable, or whether per-video single-provider becomes the
   practical fallback. Do not hand-wave this — get the actual result before
   locking the mixed-provider UI flow.

**Design (assuming Test B passes acceptably):**

- **Channel-level character:** `characters/main-stickman/{reference.png,
  character.json}` — created once, reusable across every project. Project-
  level override is allowed for a one-off different character.
- **Reference sent once per worker session, not per prompt.** Flow: uploaded
  once to that project's "Ingredients," then every subsequent prompt in that
  session inherits it automatically. Meta: analogous one-time
  photo-establish step, provider-specific mechanism to be implemented by
  Antigravity by inspecting the existing extension's actual UI flow — **do
  not assume an API contract that doesn't exist; implement against the real
  DOM/flow.**
- **Reference/session state is tracked in the DB**, not assumed:
  `worker_id, project_id, character_id, reference_status
  (NOT_READY|INITIALIZING|READY|INVALID|RESET_REQUIRED), last_initialized`.
- **Repair-queue interaction (previously a gap, now closed):** when a failed
  prompt is reassigned to a *different* worker than originally owned that
  range, the bridge must check that worker's `reference_status` first. If not
  `READY`, initialize the reference on that worker before sending the
  prompt — never assume a worker already has context it was never given.
- **Realistic ceiling:** reference image reduces drift, it does not
  guarantee pixel-identical output across providers/accounts. Where
  practical, keep contiguous scenes on the same worker/provider rather than
  round-robin, so any residual drift lands at a scene cut instead of
  mid-action.
- **Automated visual QA (Layer 4) is a V2 nice-to-have, not V1.** Reliable
  automation of "does image 087 match the character" needs either a paid
  vision API (conflicts with the $0-recurring-cost goal) or a weak local
  model doing an unreliable job. V1 ships with **manual visual review**
  (thumbnail grid) instead.

## 8. AI provider layer

Provider abstraction (do not hard-code to one vendor):

```
AIProvider
├── GroqProvider     (primary — LLM text + Whisper, same key)
├── OllamaProvider   (offline fallback, not the default path)
├── OpenRouterProvider (secondary cloud fallback)
├── GeminiProvider     (tertiary cloud fallback, also usable for optional
│                       vision-based QA later — see §7)
└── ClaudeProvider / OpenAIProvider (future, optional)
```

**Decision:** Groq is primary. Reasoning already tested/discussed: Groq runs
full-size, non-quantized models on fast hardware; the developer's own PC
would only run a small quantized model locally, likely weaker on this
task's demanding structured-segmentation + strict-fidelity requirements.
Ollama stays in the codebase as a genuine, working offline fallback (build
and smoke-test it — don't leave it as untested placeholder code), for the
day Groq's free tier changes or is unreachable.

**Phase 0 – Test A (still pending, run before Phase 5):** same 60–90 sec
script (with both a concrete/literal passage and an abstract/non-visual
passage — the second is where segmentation actually breaks), same master
prompt, run twice for consistency, against Groq. Confirm story fidelity,
scene segmentation quality, JSON reliability, and speed are acceptable
before building Mode 1's Story Engine around it.

**Free-tier reference (verified at time of writing — recheck before
building, these change):**
- Groq `openai/gpt-oss-120b`: 30 RPM, 1,000 req/day, 12K TPM.
- Groq `openai/gpt-oss-20b`: 30 RPM, 14,400 req/day.
- Groq Whisper (`whisper-large-v3` / `-turbo`): rate-limited free tier,
  word-level timestamps supported (used for captions).
- OpenRouter free models (`:free` suffix): ~1M tokens/day, no card.
- Google Gemini API free tier: Flash / Flash-Lite only (Pro tier moved to
  paid); multimodal, usable for future vision-based QA.

**Batching:** for a 150–300 prompt video, generate in internal batches
(e.g. 20–30 prompts per call) to stay inside per-minute limits — never one
call per image. Studio combines batches into one final list automatically;
the user should never have to ask for "next 100."

## 9. External assets — bundled locally, not live API calls

SFX and music are downloaded once and stored in the project, not
fetched at runtime:

- **Kenney audio** (kenney.nl) — CC0, no attribution, game/UI-style SFX
  (whoosh, click, pop, impact).
- **Pixabay SFX + Music** (pixabay.com) — Pixabay Content License, no
  attribution required for commercial use.
- **Pexels** — optional, if supplementary stock photo/video reference is
  ever needed outside the Flow/Meta-generated pipeline (Pexels' own
  library is primarily photo/video, not SFX — use Kenney/Pixabay for audio).

Store under `assets/sfx/` and `assets/music/` with a small metadata JSON per
file (`tags`, `intensity`) so the SFX engine can do semantic selection
(scene change → whoosh, impact → hit, appearance → pop) without an event
happening after every single image — density default: **Low**.

## 10. Post-production pipeline

- **Captions:** Groq Whisper on the actual voiceover audio → word-level
  timestamps → caption template engine (bottom-center, CapCut-style
  readability). SRT/VTT, if supplied, used as a secondary reference, not the
  primary timing source — actual audio always wins.
- **Background music: locked at 7% default volume**, with voiceover ducking
  ON so narration stays dominant. (This number moved around earlier in
  discussion — 7% is the final, confirmed value; treat "56%" as superseded.)
- **Transitions/effects:** controlled preset library only (crossfade, zoom
  in/out, pan, slow push, subtle shake) — never arbitrary/destructive FFmpeg
  effects, and never AI-invented effect types outside the preset set.
- **Render target:** 1920×1080, 16:9, 30 FPS, H.264, AAC, MP4, via bundled
  FFmpeg.

## 11. Strict Story Fidelity (hard rule, applies to Mode 1's Story Engine)

Script/source text is the only source of visual truth. No invented
characters, objects, locations, events, or dramatic filler to pad the count.
Every generated prompt carries provenance: `prompt_id, timestamp, source_text,
scene_id, characters, objects, prompt, worker_id, provider, reference_id`.

## 12. Data model (representative, not exhaustive)

```
projects(id, title, mode, duration_sec, image_rate, image_count, status)
prompts(prompt_id, project_id, text, source_text, timestamp, scene_id, status)
characters(character_id, name, reference_path, bible_json)
workers(worker_id, provider, browser_profile, status, reference_status,
        last_initialized)
jobs(job_id, prompt_id, worker_id, status, attempts)
images(prompt_id, path, worker_id, provider, status)
timeline(image_id, start, duration, effect, transition)
sfx_events(id, image_id_or_time, sfx_file, trigger_reason)
```

## 13. Folder structure

```
StickmanStudio/
├── app/                      # Tauri + React UI
├── server/                   # Node/TS orchestrator + local API
├── extensions/
│   ├── flow-extension/       # existing repo + worker-config.js + bridge-client.js
│   └── meta-extension/       # existing repo + worker-config.js + bridge-client.js
├── assets/
│   ├── sfx/
│   └── music/
├── Workers/
│   ├── Worker-01/ ...        # persistent Chromium profiles
├── characters/
│   └── main-stickman/{reference.png, character.json}
└── Projects/
    └── <project-name>/
        ├── project.sqlite / project.json
        ├── script.txt, subtitles.srt, voiceover.mp3
        ├── prompts/{source.md, generated.md}
        ├── images/001_....webp ... NNN_....webp   (central, not per-worker)
        ├── captions/, sfx/, music/, renders/
```

## 14. Phase 0 — Validation Lab (run before writing Phase 1 code)

- **Test A — AI quality:** Groq on a 60–90s script containing one concrete
  and one abstract passage, run twice. Confirm fidelity/segmentation/JSON
  reliability before committing to it as the Mode 1 engine.
- **Test B — Character cross-provider:** same reference image + prompts on
  Flow vs. Meta; measure actual drift; this decides whether mixed-provider
  single-video stays the plan.
- **Test C — Reference/session behavior:** initialize once → many prompts
  in-session → repair prompt on same worker → repair prompt on a *different*
  worker (confirms the reference re-init check in §7 actually fires).
- **Test D — Hardware load:** 2 workers → 3 → 5 on the actual dev machine;
  record what's actually sustainable before defaulting the UI to anything
  higher.
- **Test E — Extension regression:** confirm both extensions still work
  100% standalone (no Studio running) after bridge-client is added.

## 15. Build phases (after Phase 0 results are in hand)

```
Phase 1 — Foundation: repo structure, Tauri/React shell, SQLite, project model
Phase 2 — Bridge + Workers: bridge-client in both extensions, range
           allocation, repair queue, worker lifecycle, login detection
Phase 3 — Image validation, timeline engine, crash recovery
Phase 4 — Captions (Whisper), SFX, transitions, music, FFmpeg render
Phase 5 — Mode 1: AI Story Engine (Groq primary), prompt generation, validation
Phase 6 — Quality layer: consistency QA, anomaly detection, better cut timing
```

**Give Antigravity one phase at a time, not "build the whole thing."**
First success criterion is *not* a polished UI — it's: hand Studio 200
existing prompts, it assigns ranges to N workers, both extensions generate
independently, images land correctly numbered in one project folder,
missing/failed prompts are detected and repairable, a mid-run crash resumes
without regenerating completed work, and no manual
splitting/distributing/merging is required. Everything else (timeline,
captions, SFX, music, Mode 1) builds on top of that core once it's solid.
