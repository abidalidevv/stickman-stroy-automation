# Stickman Studio — Master Product Plan

> SOURCE OF TRUTH — product vision, requirements, decisions, constraints, and phased roadmap.

## 1. Product

Stickman Studio is a Windows 10/11 local-first desktop application for producing Stickman documentary videos from script/prompt list to final MP4.

It is **not** only a prompt generator. It is a production engine that coordinates prompts, browser workers, image collection, timeline, captions, SFX, music, effects, and rendering.

Core pipeline:

```text
Script / Existing Prompt List
        ↓
Timing + Image Count
        ↓
Prompt Generation or Import
        ↓
Prompt Validation
        ↓
Worker Assignment
        ↓
Flow / Meta Browser Workers
        ↓
Image Generation + Download
        ↓
Validation / Retry / Repair
        ↓
Central Project Image Set
        ↓
Voiceover Master Timeline
        ↓
Captions + SFX + Effects + Music
        ↓
FFmpeg Render
        ↓
Final 1080p MP4
```

---

## 2. What the current manual workflow does

The user currently:

1. Researches and writes a script.
2. Uses a Master Prompt.
3. Supplies title, Master Prompt, script, and voiceover duration.
4. Calculates image count.
5. Generates a long sequential prompt list.
6. Manually requests additional batches when a response stops.
7. Splits prompt lists into chunks.
8. Gives chunks to existing Flow/Meta Chrome extensions.
9. Runs multiple browser workers/accounts.
10. Waits for generation/download.
11. Manually gathers and sorts images.
12. Manually syncs images to voiceover.
13. Manually creates captions.
14. Manually adds SFX.
15. Manually adds effects/transitions.
16. Manually adds background music.
17. Manually renders the final video.

Stickman Studio should automate this workflow while preserving the parts that already work.

---

## 3. Two operating modes

### Mode 1 — Generate Everything

Inputs:

- Video title
- Master Prompt
- Script: TXT, pasted text, SRT, or VTT
- Voiceover audio and/or duration
- Character Reference Image, optional but strongly supported
- Background Music, optional
- Additional assets, optional

Pipeline:

```text
Title + Master Prompt + Script + Voiceover + Character Reference
        ↓
Script parsing
        ↓
Duration
        ↓
Image count
        ↓
Story beats
        ↓
Story Bible
        ↓
Character / location / object memory
        ↓
Visual planning
        ↓
Prompt generation
        ↓
Strict story-fidelity validation
        ↓
Review / approve
        ↓
Same worker pipeline as Mode 2
```

### Mode 2 — Existing Prompt List

This is the **MVP priority**.

Inputs:

- Clean prompt list `.md` or `.txt`
- Script TXT/SRT/VTT
- Voiceover audio and/or duration
- Character reference, optional
- Background music, optional

Pipeline:

```text
Prompt List
 ↓
Parse
 ↓
Validate IDs/count
 ↓
Create jobs
 ↓
Assign fixed ranges
 ↓
Flow/Meta workers
 ↓
Download + validate
 ↓
Missing / failed repair
 ↓
Central image folder
 ↓
Timeline
 ↓
Post-production
 ↓
Render
```

Mode 2 **must not invoke AI prompt generation**.

Mode 1 ultimately produces prompt records and then uses exactly the same downstream worker/job pipeline.

---

## 4. Voiceover is the master timeline

The voiceover is the timing authority.

Example:

```text
6:36 = 396 seconds
```

With `2 images / 4 seconds`:

```text
396 × 0.5 = 198 images
```

Formula:

```text
images_per_second = images_per_4_seconds / 4
image_count = duration_seconds × images_per_second
```

Presets:

```text
1 image / 4 sec
2 images / 4 sec   ← current practical default
3 images / 4 sec
4 images / 4 sec
5 images / 4 sec
Custom
```

Image durations may move slightly around the mathematical target when sentence/action boundaries make the cut more natural, but the voiceover remains the master timeline.

---

## 5. Script formats

Support:

- TXT
- pasted text
- SRT
- VTT

For SRT/VTT, parse timestamps.

For TXT/pasted text, use uploaded voiceover duration when available or allow manual duration.

If the source script ends abruptly or is incomplete, do **not** invent missing narration/events. Flag the incomplete source and generate only what the supplied source supports.

---

## 6. Strict story fidelity — hard product rule

The script/story is the source of truth.

Every visual prompt must depict only what is explicitly present or directly supported by the story at that point.

Do not invent:

- extra characters
- extra locations
- unsupported props
- unsupported objects
- unsupported actions
- unsupported events
- future narration
- unrelated historical/factual details

Creativity is allowed inside the boundaries of the narration, not outside them.

Example:

Source: `A man digs up a small tuber.`

Valid visual concepts include the same man digging and the small tuber in supported surroundings.

Do not invent a family cooking potatoes around a fire unless the script actually supports it.

---

## 7. Prompt output format

The user's Master Prompt will be modified so the final exported prompt list is clean and sequential.

Desired form:

```text
001_prompt...
002_prompt...
003_prompt...
...
```

No:

- headings
- `IMAGE 001`
- timestamps
- source narration labels
- visual-purpose labels
- explanations
- metadata
- analysis

Internal Stickman Studio records can and should preserve rich metadata such as source excerpt, timestamp, scene, character, and validation state.

Therefore:

```text
EXPORT FORMAT = CLEAN
INTERNAL MODEL = RICH
```

Do not silently renumber imported prompts.

---

## 8. Prompt provenance

Internally track at least:

```text
project_id
prompt_id
prompt_text
source_text
source_start
source_end
scene_id
character_ids
location_id
object_ids
timestamp
validation_status
provider
worker_id
reference_version
created_at
updated_at
```

This is required for debugging, regeneration, story-fidelity checks, and timeline reconstruction.

---

## 9. Character consistency

Character consistency is a first-class feature.

Hierarchy:

```text
Channel
  ↓
Character
  ↓
Reference Image + Character Bible
  ↓
Project
  ↓
Scene
  ↓
Image
```

Example storage:

```text
characters/
    main-stickman/
        reference.png
        character.json
```

Character Bible may contain:

- anatomy
- head/body proportions
- face
- eyes/mouth
- limbs
- colors
- recurring traits
- line/style rules
- continuity constraints

A channel-level character can be reused. A project-level character/reference can override it.

---

## 10. Character Reference behavior

The reference image is intended to be initialized in a provider/session/project context when the provider supports such a mechanism.

**Do not blindly upload the same image on every prompt.**

For Flow, use its supported reference/Ingredients workflow. The reference should normally be initialized once for the relevant worker/project session and then reused across prompts in that session.

For Meta, use the provider-specific equivalent exposed by the real UI/workflow.

The implementation must inspect the actual extensions and provider behavior instead of inventing undocumented APIs.

### Explicit extension-preservation exception

Existing generation and download logic must be preserved.

However, adding provider-specific Character Reference initialization/upload/context steps is explicitly allowed and required when implementing character consistency.

That means:

```text
KEEP:
existing generation queue, monitoring, downloads, naming, etc.

ADD:
reference initialization
bridge hooks
small provider adapter hooks
```

---

## 11. Reference session state + repair queue

Reference state belongs to a worker/project session.

Example:

```text
W08
Project: Wild-Potato
Character: Main Stickman
Reference: v3
Status: READY
```

States:

```text
NOT_READY
INITIALIZING
READY
INVALID
RESET_REQUIRED
ERROR
```

If a failed Prompt 037 originally belongs to W01 but repair is assigned to W08:

```text
W08
 ↓
check current project/reference context
 ↓
initialize if needed
 ↓
verify READY
 ↓
execute Prompt 037
```

A repair worker may **never** skip this check.

A worker must not silently reuse another project's reference context.

---

## 12. Cross-provider consistency test

Before deciding how aggressively to mix Flow and Meta in one video, run an empirical test:

- same reference image
- same prompt or equivalent prompts
- Flow
- Meta

Observe:

- head
- face
- body proportions
- limb proportions
- line style
- colors
- recurring traits

Do not assume 100% pixel-identical consistency across providers. Use test results to tune provider strategy later.

---

## 13. Existing Chrome extensions

Existing production assets:

```text
Flow/Veo:
Test-to-image-Chrome-extention

Meta:
Meta-Automation-Auto-Meta-on-Meta.ai
```

They already handle provider automation, queues, monitoring, downloads, naming, and related behavior.

They must be reused, not replaced.

---

## 14. Final Bridge decision

There is **NO third standalone Bridge extension**.

Bridge communication lives inside the two existing extensions:

```text
flow-extension/
    worker-config.js
    bridge-client.js
    existing automation...

meta-extension/
    worker-config.js
    bridge-client.js
    existing automation...
```

Communication:

```text
Flow Extension → localhost → Stickman Studio
Meta Extension → localhost → Stickman Studio
```

Avoid a three-extension `externally_connectable` architecture.

---

## 15. Worker IDs

The existing `worker-config.js` mechanism remains the source of worker identity.

Example:

```js
export const WORKER_ID = "W01";
```

Filenames may look like:

```text
001_2D-hand-drawn-stickman__W01.png
```

Prompt ID is the primary image identity.
Worker ID is operational/provenance metadata.

Final ordering is always numeric prompt order, never completion order.

---

## 16. Worker counts

Worker counts are user-configured.

UI:

```text
Flow Workers: [ X ]
Meta Workers: [ Y ]
```

Do not hard-code 10 workers.

The architecture can support higher counts, but actual runtime count is the user's choice.

Initial hardware testing should start around 2 workers, then 3, then higher if stable.

Current development hardware:

```text
i5 6th generation
8 GB RAM
4 GB GPU
```

The app may show resource warnings but must not silently reduce configured counts.

---

## 17. Worker allocation

V1 strategy: fixed contiguous ranges.

Example for 500 prompts and 10 workers:

```text
W01 Flow → 001–050
W02 Flow → 051–100
W03 Flow → 101–150
W04 Flow → 151–200
W05 Flow → 201–250

W06 Meta → 251–300
W07 Meta → 301–350
W08 Meta → 351–400
W09 Meta → 401–450
W10 Meta → 451–500
```

If division is uneven, allocate remainders deterministically.

Dynamic allocation can be added later. It is not the V1 primary strategy.

---

## 18. Repair / missing queue

Example expected:

```text
001–500
```

Received:

```text
001–236
238–420
422–500
```

Missing:

```text
237
421
```

Those IDs enter the repair queue.

Preserve original worker, repair worker, attempt count, errors, and timestamps.

---

## 19. Browser workers and profiles

Each worker must use a separate persistent Chrome/Chromium profile.

```text
Workers/
    W01/
        profile/
    W02/
        profile/
```

Profiles must not be simultaneously shared by two worker processes.

The user manually logs into each account/profile as required.

If login expires:

```text
LOGIN_REQUIRED
```

Worker pauses, user logs in, then worker resumes.

---

## 20. Bridge polling

Use localhost polling rather than depending on a permanently alive MV3 background connection.

Approximate intervals:

```text
Job polling: 2–3 sec
Heartbeat: 5–10 sec
```

Manifest V3 worker suspension must be handled gracefully.

When the extension context resumes:

```text
reconnect/register
reconcile state
resume polling
```

Persist important state outside the ephemeral extension context.

---

## 21. Worker states

Recommended states:

```text
CREATED
STARTING
EXTENSION_READY
LOGIN_REQUIRED
READY
INITIALIZING_REFERENCE
REFERENCE_READY
ASSIGNED
GENERATING
DOWNLOADING
VALIDATING
IDLE
PAUSED
ERROR
OFFLINE
```

A worker state machine is preferred over scattered booleans.

---

## 22. Job states

```text
QUEUED
ASSIGNED
ACKNOWLEDGED
GENERATING
DOWNLOAD_PENDING
DOWNLOADING
VALIDATING
COMPLETED
FAILED
RETRYING
BLOCKED
CANCELLED
```

One active lease/owner per job.

Completed jobs are not regenerated after restart unless the user explicitly requests regeneration.

---

## 23. Crash recovery

On startup:

```text
load DB
 ↓
scan project assets
 ↓
reconcile filesystem vs DB
 ↓
mark dead workers offline
 ↓
find incomplete jobs
 ↓
find missing prompt IDs
 ↓
requeue safe jobs
 ↓
restart/reattach workers
 ↓
resume
```

If 001–327 are complete and the app crashes, 328 onward continue. Completed assets remain completed.

---

## 24. Stuck job detection

Do not reassign a job immediately because one heartbeat is missed.

Use:

```text
heartbeat
+
job activity
+
file existence
+
provider state when available
```

Then classify as possibly stuck.

Possible actions:

- wait
- pause
- retry
- reassign

Avoid duplicate generation.

---

## 25. Image integrity

A provider saying generation is complete is not enough.

Before marking complete, verify:

- file exists
- file size is non-zero
- image decodes
- dimensions are valid
- filename maps to a known prompt
- no unsafe overwrite/conflict occurred

Corrupt or zero-byte files are not completed assets.

---

## 26. Multiple output variants

Support providers that produce multiple files for one prompt:

```text
001_description_a__W01.png
001_description_b__W01.png
```

Both map to Prompt 001 with distinct output variants.

The project/timeline can select the desired variant.

---

## 27. Manual override

Automation must remain editable.

Allow, at minimum:

- pause worker
- resume worker
- retry job
- cancel job
- reassign repair job
- import replacement image
- edit prompt
- regenerate selected prompt
- replace timeline image
- inspect logs

---

## 28. Timeline

Voiceover remains the master timeline.

Timeline tracks:

```text
VIDEO
VOICEOVER
CAPTIONS
SFX
MUSIC
```

Images should be automatically placed according to the selected pacing and then optionally adjusted to sentence/action boundaries.

Final canvas:

```text
1920 × 1080
16:9
30 FPS
```

Images must be normalized without unwanted stretching.

---

## 29. Captions

Preferred:

```text
Voiceover
 ↓
Word-level transcription
 ↓
Bottom-center captions
```

Style target is clean, highly readable, documentary/CapCut-like.

SRT/VTT can also provide timing.

Primary transcription candidate:

```text
Groq Whisper
```

Local fallback:

```text
whisper.cpp
```

---

## 30. SFX

Do not add SFX after every image.

Use semantic events.

Examples:

```text
Scene change → whoosh
Reveal/appearance → pop
Impact → hit
Click → click
```

Only add a sound when supported by the actual event/action.

Use a reusable local library first.

---

## 31. Background music

Optional.

Default volume is **7%**.

Support:

- user-uploaded music
- local music library
- automatic loop/crop to voiceover duration
- optional voiceover ducking
- manual volume override

Do not silently change the default 7%.

---

## 32. Optional stock/media providers

Candidate optional providers:

```text
Pexels
Pixabay
```

Use these as supplemental stock photo/video sources, not as replacements for the core Stickman generation flow.

The implementation must verify current API capabilities and licensing/attribution requirements at build time.

Do not assume a website's sound-effect/music catalog is automatically exposed through its API.

For SFX/music, prefer local licensed/manual assets unless a documented API is actually available.

---

## 33. Asset source tracking

For external assets store:

```text
asset_id
provider
provider_asset_id
source_url
download_url if applicable
creator/author if available
license/source metadata
downloaded_at
project_id
scene_id
```

This supports reproducibility and attribution.

---

## 34. AI provider layer

The app must not hard-code a single AI provider.

Conceptual:

```text
AIProvider
├── GroqProvider       ← primary
├── OllamaProvider     ← fallback
├── ClaudeProvider
├── OpenAIProvider
├── GeminiProvider
└── future providers
```

Only configured providers need to be enabled.

---

## 35. Groq strategy

Groq is the primary AI candidate because the production goal values speed and quality.

Use it for:

- story analysis
- visual segmentation
- prompt generation
- prompt validation
- transcription via supported Whisper models

Do not hard-code an obsolete model name. The chosen model should be configurable and verified against current provider documentation when implemented.

A 60–90 second benchmark using a concrete + abstract script should be run before treating the provider as production-validated.

---

## 36. Multiple Groq credentials

Support multiple user-supplied credentials for resilience/failover.

Example:

```text
Groq Credentials
├── Key 01
├── Key 02
├── Key 03
├── Key 04
└── Key 05
```

Track:

- enabled/disabled
- last success
- last error
- cooldown state
- provider/model association

Do not assume multiple keys automatically multiply organization-level quota.

Never place API keys in source code or extension bundles.

---

## 37. Ollama fallback

Ollama stays in the architecture as a local emergency fallback.

Purpose:

- cloud/provider unavailable
- emergency operation
- local processing option

The current PC is limited, so do not make local quality a blocker for the primary production workflow.

Keep Ollama integration modular.

---

## 38. Video rendering

Use FFmpeg.

Target:

```text
1920×1080
30 FPS
H.264
AAC
MP4
```

Render output must be validated before being marked complete.

---

## 39. Project structure

```text
StickmanStudio/
├── GPT.md
├── CLAUDE.md
├── ANTIGRAVITY.md
├── app/
├── server/
├── extensions/
│   ├── flow-extension/
│   │   ├── worker-config.js
│   │   ├── bridge-client.js
│   │   └── existing files...
│   └── meta-extension/
│       ├── worker-config.js
│       ├── bridge-client.js
│       └── existing files...
├── Workers/
├── Projects/
├── assets/
│   ├── sfx/
│   ├── music/
│   └── stock-cache/
└── docs/
```

Project example:

```text
Projects/Wild-Potato/
├── project.sqlite
├── project.json
├── script.txt
├── subtitles.srt
├── voiceover.mp3
├── characters/
├── prompts/
│   ├── source.md
│   └── generated.md
├── images/
├── captions/
├── sfx/
├── music/
├── timeline/
└── renders/
```

---

## 40. Database entities

Minimum:

```text
projects
prompts
prompt_versions
scenes
characters
character_references
workers
worker_sessions
jobs
job_attempts
images
assets
timeline_items
captions
sfx_events
music_tracks
renders
provider_credentials
settings
logs
```

The exact schema is in `CLAUDE.md`.

---

## 41. Logging

Track important operations.

Example:

```text
13:41:02 W03 registered
13:41:05 Job 121 assigned
13:41:07 Prompt submitted
13:41:42 Generation detected
13:42:01 Download complete
13:42:03 Image validated
13:42:04 Job completed
```

Errors should identify:

```text
project
worker
prompt/job
error
attempt
```

---

## 42. Storage and backup

Project state must auto-save.

Support later:

- backup project
- restore project
- import project
- export project
- temporary-file cleanup
- project-size reporting

Never automatically delete final user assets.

---

## 43. Resource management

Monitor:

- CPU
- RAM
- GPU
- VRAM where available
- browser process count
- render load
- AI process load

Suggested profiles:

```text
Safe
Balanced
Aggressive
Custom
```

These profiles do not replace the user's explicit Flow/Meta worker count.

---

## 44. UI areas

Main:

```text
Dashboard
Projects
Workers
Prompt Studio
Timeline
Characters
Assets
Settings
Logs
```

The UI should feel like a production studio, not a generic CRUD/admin panel.

---

## 45. Phase roadmap

### Phase 0 — Validation Lab

Test:

- Groq 60–90 sec benchmark
- structured output
- Flow reference initialization
- Meta reference initialization
- cross-provider consistency
- repair-worker reference initialization
- existing extension regression
- Bridge polling
- 2-worker hardware test
- 3-worker hardware test
- FFmpeg render test
- optional stock-provider feasibility

### Phase 1 — Foundation

Build:

- Tauri 2
- React/TypeScript/Tailwind
- local service
- SQLite
- project system
- settings
- logging
- filesystem manager

### Phase 2 — Worker/MVP

Mode 2 first:

- prompt import
- parser
- validation
- range allocation
- Worker IDs
- browser profiles
- Flow bridge
- Meta bridge
- polling
- heartbeat
- job assignment
- generation status
- download detection
- integrity validation
- retry
- repair
- crash recovery

### Phase 3 — Timeline

- voiceover duration
- pacing
- image placement
- 16:9 normalization
- editable timeline
- preview

### Phase 4 — Post-production

- transcription
- word-level captions
- SFX
- transitions/effects
- music 7% default
- ducking
- FFmpeg render

### Phase 5 — Mode 1 AI

- Groq primary
- Ollama fallback
- story analysis
- Story Bible
- visual plan
- prompt generation
- batching
- clean prompt output
- strict validation
- review/approve

### Phase 6 — Intelligence

- consistency QA
- anomaly detection
- better continuity
- provider-aware prompt improvements
- smarter repair

---

## 46. MVP definition of done

The MVP is successful when:

1. The user creates a project.
2. Imports 20/50/100/200+ existing prompts.
3. The parser validates IDs/count.
4. User sets Flow and Meta worker counts.
5. Workers launch with persistent profiles.
6. Existing extensions still work.
7. Bridge clients register.
8. Ranges are assigned.
9. Prompts are generated.
10. Downloads are detected.
11. Files are validated.
12. Missing IDs are detected.
13. Failures enter retry/repair.
14. Repair checks reference context.
15. Completed work survives restart.
16. Final images are centrally stored and numerically ordered.
17. User can manually intervene.

The MVP should remove manual prompt distribution and manual image merging as the primary win.

---

## 47. Product principles

1. Voiceover is the master timeline.
2. Script is the source of truth.
3. Prompt ID is the primary image identity.
4. Worker ID is operational/provenance metadata.
5. Existing Flow/Meta automation is preserved.
6. Bridge lives inside the existing extensions.
7. Character reference is initialized once per relevant session/context when supported, not re-uploaded blindly per prompt.
8. Repair jobs must establish the correct reference context.
9. Completed work is never silently repeated.
10. Worker counts are user-controlled.
11. Groq is primary AI candidate; Ollama is fallback.
12. AI providers are modular.
13. External stock assets are optional.
14. Background music defaults to 7%.
15. Automation must allow manual intervention.
16. The project must be crash-resumable.
17. Provider behavior must be based on the real implementation/docs, not assumptions.
18. Working extensions must not be unnecessarily rewritten.

---

## 48. One-sentence definition

**Stickman Studio is a Windows-local production engine that takes an existing or AI-generated Stickman prompt sequence, distributes it across user-configured Flow/Meta browser workers through in-extension Bridge clients, reliably collects and repairs generated images, synchronizes them to the voiceover, adds captions/SFX/music/effects, and renders a final YouTube-ready 1080p video.**
