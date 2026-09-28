# Stickman Studio — Antigravity Master Execution Prompt

> EXECUTION BRIEF — hand this workspace to Antigravity after placing the two existing extension folders beside these documents.

## 0. Mission

Build **Stickman Studio**, a reliable Windows-local Stickman documentary production engine.

The workspace already contains two existing production browser extensions:

```text
extensions/
├── flow-extension/
└── meta-extension/
```

They perform the actual provider automation.

Your task is to build the desktop/local orchestration application around them and add small Bridge Clients **inside those same extensions**.

The objective is a working production system, not a decorative demo.

---

# 1. Read these documents first

Read, in order:

```text
GPT.md
CLAUDE.md
ANTIGRAVITY.md
```

Then inspect:

```text
extensions/flow-extension/
extensions/meta-extension/
```

Do not start coding until you understand the existing extensions.

---

# 2. Critical architecture decision — do not change

There is **NO third standalone Bridge extension**.

Do not create one.

Final communication:

```text
Stickman Studio
       ↓
localhost API
       ↑
Flow extension Bridge Client

Stickman Studio
       ↓
localhost API
       ↑
Meta extension Bridge Client
```

Do not build around `externally_connectable` or cross-extension IDs.

The Bridge is a small communication module embedded in each existing extension.

---

# 3. Existing extension preservation — critical

The existing Flow and Meta extensions are working production components.

Preserve their current behavior.

Do not unnecessarily rewrite:

- prompt queue logic
- prompt submission logic
- generation monitoring
- download handling
- filename logic
- prompt numbering
- sanitization
- suffix/variant behavior
- delays
- concurrency
- existing retry behavior
- standalone operation

Prefer:

```text
small module
+
small adapter hook
+
existing functions
```

over:

```text
large rewrite
```

---

# 4. Explicit exception — Character Reference is allowed

The preservation rule does **NOT** forbid the Character Reference feature.

You ARE explicitly allowed to add the provider-specific reference initialization/upload/context step required for character consistency.

This is a deliberate exception.

For Flow:

- inspect the actual Ingredients/reference mechanism
- initialize reference once per relevant project/session
- verify it is ready
- reuse it across prompts

Do not upload the same reference on every prompt unless the real provider workflow requires it.

For Meta:

- inspect the existing UI/automation
- implement the supported reference/photo context flow if available

Do not invent undocumented APIs.

---

# 5. Before editing: inspect everything

Perform a code audit first.

For each extension identify:

```text
manifest
worker-config
popup
content scripts
background/service worker
prompt queue
prompt submit
generation detection
download detection
filename generation
settings
storage
errors
```

Also identify the safest point where a Studio job can enter the already-working automation.

Write a short internal implementation note before modifying files.

---

# 6. Worker ID must remain intact

The current mechanism uses a root-level worker configuration such as:

```js
export const WORKER_ID = "W01";
```

Do not replace this mechanism unless inspection proves that the existing implementation cannot support the required integration.

The desktop worker manager must map browser/profile → worker ID → provider.

Filename examples:

```text
001_2D-hand-drawn-stickman__W01.png
```

The numeric prompt ID is primary.

---

# 7. Worker counts are user-controlled

UI must expose independent configuration:

```text
Flow Workers: [ X ]
Meta Workers: [ Y ]
```

Do not hard-code 10 workers.

The system must be architecturally able to handle multiple workers, but the user decides actual runtime counts.

Current development PC:

```text
i5 6th gen
8 GB RAM
4 GB GPU
```

Test from:

```text
2 workers
→ 3 workers
→ higher if stable
```

The app can warn about resource load but must not silently change the configured worker counts.

---

# 8. MVP priority — Mode 2 first

Do NOT begin with the full AI prompt-generator.

First make this work:

```text
Existing clean prompt list
        ↓
Validate
        ↓
Create jobs
        ↓
Assign worker ranges
        ↓
Flow/Meta workers
        ↓
Generate
        ↓
Download
        ↓
Validate
        ↓
Missing/repair
        ↓
Central images
```

The first major success is removing manual prompt splitting/distribution and manual image merging.

---

# 9. Prompt format

The user will modify the Master Prompt so the exported list is clean:

```text
001_prompt...
002_prompt...
003_prompt...
```

No headings or metadata.

The parser must:

- normalize line endings
- identify IDs
- preserve text
- detect malformed IDs
- detect duplicates
- detect missing IDs
- compare count

Never silently renumber.

Do not build around the previous structured `IMAGE / Timestamp / Source narration / Visual purpose / Prompt` format. The user explicitly intends to change the Master Prompt to a clean prompt-only export.

---

# 10. Voiceover timing

Voiceover is the master timeline.

Supported image pacing presets:

```text
1 / 4 sec
2 / 4 sec  ← default
3 / 4 sec
4 / 4 sec
5 / 4 sec
Custom
```

Formula:

```text
image_count = duration_seconds × (images_per_4_seconds / 4)
```

Support SRT/VTT timing and voiceover duration.

Do not invent missing script content.

---

# 11. Fixed range worker allocation — V1

Use deterministic contiguous ranges.

Example:

```text
500 prompts
5 Flow + 5 Meta

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

If ranges are uneven, distribute the remainder deterministically.

Do not implement dynamic queue/work-stealing as the primary scheduler yet.

---

# 12. Browser profiles

Every worker needs an independent persistent profile.

Do not share one writable browser profile between simultaneous workers.

Support normal manual login.

If the provider session expires:

```text
LOGIN_REQUIRED
```

pause that worker, notify UI, and resume after the user logs in.

---

# 13. Bridge client inside each extension

Add a small Bridge Client module to each extension.

Responsibilities:

```text
register
heartbeat
poll job
ACK job
report state
report reference state
report login state
report generation state
report download
report completion
report failure
reconnect
```

Do NOT make this module responsible for image-generation internals.

---

# 14. Polling requirement

Use localhost polling.

Target:

```text
Job poll: approximately 2–3 sec
Heartbeat: approximately 5–10 sec
```

Do not depend on a permanently alive Manifest V3 background service worker.

Handle suspension/reload by:

```text
reconnect
re-register
reconcile state
continue
```

Persist durable state in the local application/database.

---

# 15. Local API

Create a versioned localhost API such as:

```text
/api/v1/
```

It must support semantics equivalent to:

```text
register worker
heartbeat
read job
ack job
post job events
complete job
fail job
update reference state
update login state
```

Use JSON.

Protect the API with a local installation token/secret or equivalent mechanism.

Do not expose secrets in logs.

---

# 16. Character Reference state machine

For each active worker/project/character context track:

```text
NOT_READY
INITIALIZING
READY
INVALID
RESET_REQUIRED
ERROR
```

Before a job:

```text
check current reference
 ↓
initialize if needed
 ↓
verify READY
 ↓
submit prompt
```

Reference does not get blindly re-uploaded per prompt.

---

# 17. Repair queue + reference context

This is mandatory.

Example:

```text
Prompt 037 failed on W01
repair scheduler assigns W08
```

W08 must first:

```text
check project/reference context
→ initialize current reference if missing/outdated
→ verify ready
→ generate 037
```

A repair is not exempt from character-consistency setup.

---

# 18. Worker state machine

Implement persistent worker states:

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

The UI must show worker state clearly.

---

# 19. Job state machine

Implement:

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

Track attempts, timestamps, worker, provider and errors.

Use ownership/lease logic so two workers cannot process the same job simultaneously.

---

# 20. Idempotency

If Prompt 157 is already valid and completed:

```text
DO NOT GENERATE AGAIN
```

unless the user explicitly chooses Regenerate.

On restart, completed work remains complete.

---

# 21. Download validation

A provider completion event does not automatically mean the file is successfully usable.

Verify:

```text
exists
non-zero size
readable image
valid dimensions
valid prompt ID
valid worker ID where applicable
no silent conflict
```

Only then mark completed.

---

# 22. Central image folder

Final assets must go into:

```text
Projects/<project>/images/
```

Use prompt ID for final sort.

Do not organize the final project around worker folders.

Worker downloads can originate elsewhere but must be ingested into the project.

---

# 23. Missing/duplicate detection

Given expected IDs:

```text
001..N
```

find:

```text
missing
duplicates
corrupt
unknown IDs
```

Show exact IDs in the UI.

Never create fake placeholders and call them completed.

---

# 24. Retry/repair policy

Implement a bounded retry policy.

Suggested default:

```text
3 attempts
```

Make configurable.

When retries fail:

```text
FAILED
Manual Attention Required
```

unless user explicitly retries.

---

# 25. Stuck jobs

Do not immediately reassign from one missed heartbeat.

Use:

```text
heartbeat
job activity
provider state
file existence
lease timeout
```

Only requeue after reasonable reconciliation.

---

# 26. Crash recovery

On startup:

```text
load DB
scan image files
reconcile DB/filesystem
mark stale workers offline
recalculate missing
requeue safe jobs
start browser workers
wait for Bridge registration
resume
```

A crash must not force regeneration of all completed prompts.

---

# 27. Manual controls

Include:

```text
Pause worker
Resume worker
Retry job
Cancel job
Assign repair job
Replace image
Import image
Edit prompt
Regenerate selected prompt
```

Automation must never trap the user.

---

# 28. Selected prompt regeneration

User flow:

```text
Prompt 157
 ↓
Edit prompt
 ↓
Create version
 ↓
Regenerate
 ↓
Reference check
 ↓
Worker
 ↓
New output
 ↓
User selects output
```

Do not regenerate the full project.

---

# 29. Multiple image outputs

Support:

```text
001_description_a__W01.png
001_description_b__W01.png
```

Store variant separately under one prompt ID.

The timeline selects one active output.

---

# 30. Logging

Create detailed project/worker/job logs.

Example:

```text
W03 registered
Job 121 assigned
Prompt submitted
Generation started
Download detected
Validation passed
Job completed
```

For errors:

```text
W04
Prompt 157
DOWNLOAD_TIMEOUT
Attempt 2/3
```

Never log API secrets.

---

# 31. UI

Core navigation:

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

Worker dashboard example:

```text
W01  FLOW  READY          001–050
W02  FLOW  GENERATING     #037
W06  META  LOGIN_REQUIRED
W07  META  REFERENCE_READY
```

Project dashboard should show:

```text
Expected
Completed
Failed
Missing
Workers
Current phase
```

---

# 32. Project structure

```text
Projects/<slug>/
├── project.sqlite
├── project.json
├── script.txt
├── subtitles.srt
├── voiceover.mp3
├── characters/
├── prompts/
├── images/
├── captions/
├── sfx/
├── music/
├── timeline/
├── working/
└── renders/
```

---

# 33. Timeline

Tracks:

```text
VIDEO
VOICEOVER
CAPTIONS
SFX
MUSIC
```

Voiceover = master timing.

Support automatic image placement, timing adjustments, replacement, reordering and preview.

Target render:

```text
1920×1080
16:9
30 FPS
H.264/AAC MP4
```

---

# 34. Captions

Preferred:

```text
Voiceover
→ word-level transcription
→ bottom-center captions
```

Primary candidate:

```text
Groq Whisper
```

Local fallback:

```text
whisper.cpp
```

Use SRT/VTT when supplied.

---

# 35. SFX

Use a local library and semantic events.

Do not add an SFX after every image.

Examples:

```text
scene change → whoosh
reveal → pop
impact → hit
click → click
```

Only when the story/action supports it.

---

# 36. Background music

Optional.

**Default music volume = 7%.**

Support:

- uploaded track
- local music library
- loop/crop to voiceover
- optional voiceover ducking
- manual volume override

Do not silently change the default.

---

# 37. Optional stock media

Build provider interfaces for optional:

```text
Pexels
Pixabay
```

Use supplementary photos/videos, not the core Stickman generation path.

Preserve source/asset metadata.

At implementation time, verify current API capabilities, authentication, rate limits, terms and attribution requirements from official provider documentation.

Do not assume audio/SFX API support merely because a website offers sound assets.

---

# 38. AI provider architecture

Do not hard-code the project to one AI provider.

Implement an abstraction similar to:

```text
AIProvider
├── GroqProvider
├── OllamaProvider
├── ClaudeProvider
├── OpenAIProvider
└── GeminiProvider
```

Primary:

```text
Groq
```

Fallback:

```text
Ollama
```

---

# 39. Groq strategy

Use Groq as the primary AI candidate for:

- story analysis
- visual planning
- prompt generation
- prompt validation
- transcription

The exact model must be configurable and verified against current official documentation at build time.

Do not hard-code a historical model.

Before full Mode 1 production, run the 60–90 second benchmark using concrete + abstract narration.

---

# 40. Multiple Groq credentials

Support multiple user-supplied Groq credentials for resilience/failover.

Example:

```text
Key 01
Key 02
Key 03
Key 04
Key 05
```

Track health/cooldown/error state.

Do not assume multiple keys automatically multiply organization-level limits.

Never put keys in source code or extension bundles.

---

# 41. Ollama fallback

Implement Ollama as a local fallback.

Keep model configurable.

Do not spend the first development cycle optimizing a particular local 7B/8B model.

The current machine is limited; local AI is a backup path, not the primary quality target.

---

# 42. Mode 1 architecture

Only after Mode 2 is reliable:

```text
Title
+ Master Prompt
+ Script
+ Voiceover
+ Character Reference
        ↓
Story analysis
        ↓
Story Bible
        ↓
Visual plan
        ↓
Prompt generation
        ↓
Strict validation
        ↓
Clean prompt list
        ↓
Prompt records
        ↓
Same job scheduler as Mode 2
```

---

# 43. AI batching

For large prompt sets, use internal batches.

Example:

```text
001–050
051–100
101–150
...
```

Carry continuity state between batches.

Automatically merge to one final clean prompt sequence.

The user should never need to manually ask for the next batch.

---

# 44. Strict story-fidelity validator

The source narration is authoritative.

Prompt validation should detect obvious unsupported:

```text
characters
objects
locations
actions
events
```

If the source is incomplete:

```text
flag incomplete
stop unsupported continuation
```

Do not invent content merely to fill image slots.

---

# 45. Resource monitoring

Show:

```text
CPU
RAM
GPU
VRAM when available
Chrome processes
FFmpeg
AI load
```

Profiles can be:

```text
Safe
Balanced
Aggressive
Custom
```

But the explicit worker counts remain user-controlled.

---

# 46. Mock mode

Create mock workers/providers for development.

Simulate:

- generation
- download
- failure
- timeout
- worker disconnect
- repair
- login-required
- reference-not-ready

This allows the orchestration system to be tested without live provider generation.

---

# 47. Development test project

Use a small fixture:

```text
20 prompts
~30 sec audio
one character reference
```

Test:

```text
normal generation
one failed job
one missing download
one corrupt image
worker disconnect
login-required state
repair on another worker
restart/resume
```

Then scale to 50 → 100 → 200+.

---

# 48. Phase gates

Do not move forward if the current core phase is unstable.

### Gate 1
Existing Flow/Meta extensions still work standalone.

### Gate 2
Bridge registration works.

### Gate 3
Polling/job assignment works.

### Gate 4
A test prompt reaches the existing provider automation.

### Gate 5
Generated file is detected and validated.

### Gate 6
SQLite/project state persists.

### Gate 7
Crash recovery works.

### Gate 8
Repair on another worker initializes reference correctly.

### Gate 9
Multiple real workers work independently.

### Gate 10
Timeline/render succeeds.

---

# 49. Build order

Follow this order unless an explicit blocker requires a small change:

```text
1. Inspect extensions
2. Document integration points
3. Create Tauri/React app skeleton
4. Create local orchestration service
5. Create SQLite + migrations
6. Create project system
7. Create worker registry
8. Add Flow Bridge Client
9. Add Meta Bridge Client
10. Implement register/heartbeat/polling
11. Implement Mode 2 prompt import
12. Implement parser/count/missing/duplicate validation
13. Implement fixed worker ranges
14. Implement job leases/state
15. Implement image ingestion/validation
16. Implement retry/repair
17. Implement crash recovery
18. Run 2-worker real test
19. Run 3-worker real test
20. Build timeline
21. Build captions
22. Build SFX
23. Build music at default 7%
24. Build effects/transitions
25. Build FFmpeg render
26. Implement Groq provider
27. Implement Whisper integration
28. Implement Ollama fallback
29. Implement Mode 1 story/visual pipeline
30. Add advanced consistency/quality layer
```

---

# 50. What NOT to do

Do NOT:

```text
create a third Bridge extension
replace either existing extension
rewrite the working generation/download engines
hard-code 10 workers
hard-code an obsolete AI model
upload the reference every prompt without need
skip reference initialization for repair jobs
silently renumber prompts
trust provider completion without file validation
re-generate completed jobs after crash
invent missing story content
put API keys in source
assume Flow and Meta work identically
assume external website assets equal API capabilities
```

---

# 51. Code quality

Use:

- TypeScript strictness where practical
- typed data models
- validation
- clear modules
- small functions
- central configuration
- proper errors
- database migrations
- no magic constants scattered across files
- no duplicated scheduler logic

Avoid giant monolithic components and giant service files.

---

# 52. Current-tech verification rule

For anything time-sensitive or provider-specific—such as:

- model names
- API endpoints
- free-tier/rate limits
- authentication
- Chrome behavior
- provider UI changes
- library versions
- pricing
- terms/attribution requirements

verify current official documentation before hard-coding behavior.

If current documentation contradicts a stale assumption in these files, keep the product architecture but adapt the technical implementation to the current documented behavior.

---

# 53. Required implementation notes

After inspecting the extensions, create a short technical note in `docs/` describing:

```text
Flow integration point
Meta integration point
Reference initialization point
Download detection point
Bridge insertion points
Any unavoidable extension changes
```

Do this before large modifications.

---

# 54. Required Phase-0 test report

Before building the full AI pipeline, record actual results for:

```text
Groq 60–90 sec benchmark
Flow reference test
Meta reference test
Cross-provider reference consistency
Repair-worker reference setup
2-worker hardware test
existing extension regression
Bridge polling/reconnect test
FFmpeg test
```

Do not merely mark a test "passed" without evidence.

---

# 55. Final expected user experience

The eventual user workflow should look like:

```text
New Project
 ↓
Choose Mode 1 or Mode 2
 ↓
Add voiceover/script/prompt list
 ↓
Select character reference
 ↓
Set Flow worker count
 ↓
Set Meta worker count
 ↓
Start Production
```

Then the system:

```text
validates
assigns
runs workers
generates
downloads
checks files
repairs failures
builds timeline
creates captions
adds semantic SFX
adds music at 7%
adds effects
renders
validates final MP4
```

The user should have visibility and manual control at every important stage.

---

# 56. Final acceptance target

The first major milestone is:

> Given 200 existing clean prompts, a voiceover/script, and a character reference, the user can configure any practical Flow/Meta worker counts, start the project, have the existing extensions generate the assigned ranges, automatically collect/validate the resulting images, detect and repair missing/failed prompts with proper reference initialization, survive an application restart, and produce an ordered central image set without manually splitting prompts or merging downloads.

After this works reliably, build timeline/post-production and then Mode 1 AI.

---

# 57. Final instruction

Build incrementally.

Inspect first.

Preserve existing automation.

Add Bridge inside the existing extensions.

Use localhost polling.

Use fixed ranges first.

Track every job and file.

Initialize Character Reference correctly per provider/session/project.

Repair safely.

Never lose completed work.

Keep worker counts user-controlled.

Keep Groq primary and Ollama fallback through an abstraction.

Keep external stock media optional.

Keep music default at 7%.

Do not invent provider capabilities.

Do not silently change locked architecture decisions.

The goal is a reliable production tool for real Stickman YouTube videos.
