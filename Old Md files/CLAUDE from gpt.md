# Stickman Studio — Technical Architecture & Engineering Specification

> ENGINEERING SOURCE OF TRUTH
> Use together with GPT.md. This file defines the concrete system contracts and data/state model.

## 1. Target architecture

Recommended stack:

```text
Desktop:
Tauri 2
React
TypeScript
Tailwind CSS

Local orchestration:
Node.js / TypeScript sidecar or equivalent local process

Database:
SQLite

Image/video:
FFmpeg

Browser automation:
Real Chrome/Chromium processes + existing Flow/Meta extensions

Communication:
localhost HTTP API + polling
```

Keep provider-specific code modular.

---

## 2. Workspace

The user's intended workspace is:

```text
StickmanStudio/
├── GPT.md
├── CLAUDE.md
├── ANTIGRAVITY.md
├── extensions/
│   ├── flow-extension/
│   └── meta-extension/
├── app/
├── server/
├── Workers/
├── Projects/
├── assets/
└── docs/
```

The implementation agent must inspect the two existing extension folders before editing.

---

## 3. Existing extension inspection checklist

Before changing either extension:

1. Read `manifest.json`.
2. Identify Manifest V3 architecture.
3. Read `worker-config.js`.
4. Identify prompt queue code.
5. Identify prompt submission code.
6. Identify generation monitoring.
7. Identify download logic.
8. Identify filename creation.
9. Identify suffix/variant handling.
10. Identify popup/options communication.
11. Identify content scripts.
12. Identify service-worker/background logic.
13. Identify safe insertion points for Bridge hooks.
14. Identify the real reference/Ingredients flow.
15. Identify how login-required states appear.

Do not guess the internal architecture.

---

## 4. Module boundaries

The desktop/local service owns:

- projects
- SQLite
- job scheduler
- worker registry
- repair queue
- filesystem
- logs
- AI provider orchestration
- timeline state
- FFmpeg rendering

Flow/Meta extensions own:

- provider UI automation
- actual prompt submission
- provider generation monitoring
- provider download behavior

Bridge clients own:

- worker registration
- polling
- heartbeats
- receiving jobs
- reporting events
- communicating login/reference state

Bridge clients do **not** become a replacement generation engine.

---

## 5. Third extension rule

Do not create a standalone Bridge extension.

Do not build around `externally_connectable`.

The communication model is:

```text
Flow extension → localhost
Meta extension → localhost
```

---

## 6. Extension preservation rule

Do not unnecessarily rewrite:

- generation engine
- prompt queue
- generation monitor
- download engine
- filename logic
- numbering
- sanitization
- suffix behavior
- established concurrency
- delays
- existing standalone behavior

### Required exception

You may add the real provider-specific Character Reference initialization step when needed.

This means adding:

```text
reference setup
reference state hooks
bridge hooks
small adapter functions
```

is explicitly allowed.

The goal is minimal, reviewable integration rather than a rewrite.

---

## 7. Character Reference implementation contract

Conceptual extension-level operation:

```ts
ensureReferenceReady(projectId, characterId, referenceVersion)
```

Possible results:

```text
READY
INITIALIZING
FAILED
```

For Flow:

- inspect actual Ingredients/reference UI
- initialize the reference once for the relevant worker/project session
- verify context is ready
- reuse it for multiple prompts

For Meta:

- inspect actual reference/photo workflow
- implement an equivalent supported initialization flow

Do not re-upload on every prompt by default.
Do not invent undocumented provider APIs.

---

## 8. Reference invalidation

Reference context becomes invalid when:

- project changes
- character changes
- reference version changes
- worker profile changes
- provider session resets
- relevant login/session reset invalidates the context

Then:

```text
RESET_REQUIRED
```

must be established before future generation.

---

## 9. Repair reference check

Before any repair attempt:

```text
load project reference
 ↓
check worker reference context
 ↓
if not current:
    initialize
 ↓
verify READY
 ↓
execute job
```

This must be automatic.

---

## 10. Worker ID

Existing `worker-config.js` remains authoritative inside the extension.

Example:

```js
export const WORKER_ID = "W01";
```

The desktop app maps a browser process/profile to the intended worker ID.

Do not duplicate or silently override the extension's worker identity.

---

## 11. Worker configuration

UI configuration:

```text
Flow workers: X
Meta workers: Y
```

No hard-coded `10` runtime limit.

Resource warnings are allowed.
Silent reduction of the requested count is not.

Initial tests on the current machine should begin at 2 workers, then 3, then scale only when stable.

---

## 12. Browser profile architecture

Each worker must have its own persistent writable browser profile.

Conceptual:

```text
Workers/
    W01/profile/
    W02/profile/
    W03/profile/
```

Never run two simultaneous workers against the same writable profile.

Each profile retains the user's normal login/session.

---

## 13. Worker states

Use a finite state model:

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

Transitions must be validated.

---

## 14. Worker table

Recommended schema:

```text
workers
--------
id
worker_id UNIQUE
provider
browser_profile_path
extension_version
bridge_version
status
last_heartbeat
last_seen
current_project_id
current_job_id
reference_status
reference_project_id
reference_version
created_at
updated_at
```

---

## 15. Worker session table

```text
worker_sessions
---------------
id
worker_id
project_id
provider
character_id
reference_version
reference_status
started_at
last_seen
ended_at
```

This exists because reference context is session/project state rather than a global boolean.

---

## 16. Project table

Recommended:

```text
projects
--------
id
name
title
status
mode
script_path
subtitle_path
voiceover_path
character_reference_id
duration_seconds
images_per_4_seconds
expected_image_count
created_at
updated_at
```

Statuses:

```text
DRAFT
READY
GENERATING
ASSETS_READY
TIMELINE_READY
RENDERING
COMPLETE
FAILED
PAUSED
```

---

## 17. Prompt table

```text
prompts
-------
id
project_id
prompt_index
prompt_text
source_text
source_start
source_end
scene_id
status
current_version
validation_status
created_at
updated_at
```

Unique:

```text
(project_id, prompt_index)
```

Do not silently renumber imports.

---

## 18. Prompt versioning

```text
prompt_versions
---------------
id
prompt_id
version_number
prompt_text
created_at
source
```

`source` can be:

```text
AI
USER
IMPORTED
```

When the user regenerates, create a new version rather than destroying provenance.

---

## 19. Scene / character entities

Suggested scene fields:

```text
id
project_id
sequence
source_start
source_end
description
created_at
```

Suggested character fields:

```text
id
name
channel_id nullable
character_bible
reference_default_path
created_at
updated_at
```

Character reference records:

```text
character_references
--------------------
id
character_id
path
version
checksum
created_at
```

---

## 20. Job table

```text
jobs
----
id
project_id
prompt_id
provider
status
active_worker_id
attempt_count
lease_owner
lease_expires_at
last_error
assigned_at
started_at
completed_at
updated_at
```

One job may have many attempts.

---

## 21. Job attempt table

```text
job_attempts
------------
id
job_id
attempt_number
worker_id
provider
status
error
started_at
finished_at
```

This preserves history when a job moves from one worker to another.

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

A valid completed job must not be re-assigned after restart.

---

## 23. Leases and duplicate prevention

Use a job lease or equivalent ownership mechanism.

Example:

```text
lease_owner
lease_expires_at
```

Before assigning:

```text
if valid completed asset exists:
    do not assign

if active lease exists:
    do not assign to another worker
```

After worker failure, wait for reconciliation/lease expiry before repair.

---

## 24. Fixed range allocation

V1 scheduler creates contiguous ranges.

For N prompts and W configured workers, produce deterministic ranges.

Example:

```text
500 prompts / 10 workers

W01 001–050
W02 051–100
...
W10 451–500
```

If the division is uneven, use a documented deterministic remainder algorithm.

Do not implement dynamic work stealing as the primary V1 strategy.

---

## 25. Prompt parser

Target clean format:

```text
001_...
002_...
003_...
```

Parser responsibilities:

1. normalize line endings
2. identify prompt IDs
3. preserve prompt text
4. detect malformed entries
5. detect duplicates
6. detect missing IDs
7. compare with expected count

No silent auto-renumbering.

---

## 26. Filename parser

Expected patterns include:

```text
001_description__W01.png
001_description_a__W01.png
001_description_b__W01.png
```

Extract:

```text
prompt_id
worker_id
variant
extension
```

Prompt ID controls final ordering.

---

## 27. Image table

```text
images
------
id
project_id
prompt_id
worker_id
provider
path
filename
mime_type
width
height
file_size
output_variant
status
checksum
created_at
updated_at
```

Statuses can include:

```text
DOWNLOADED
VALID
INVALID
SELECTED
REPLACED
ARCHIVED
```

---

## 28. Image ingestion pipeline

```text
provider generation complete
 ↓
download detected
 ↓
file discovered
 ↓
filename parsed
 ↓
prompt ID validated
 ↓
worker ID validated
 ↓
file integrity checked
 ↓
copy/move into project/images
 ↓
DB transaction
 ↓
job complete
```

The DB update and filesystem action should be designed to survive a crash between them through reconciliation.

---

## 29. Missing detection

For expected IDs `001..N`, build a set from valid images and compute:

```text
missing = expected - valid_received
```

Show exact IDs to the user.

Do not create synthetic placeholders and call them complete.

---

## 30. Duplicate/conflict handling

Detect:

- duplicate prompt IDs
- duplicate variants
- same prompt from multiple workers
- conflicting files

Do not silently overwrite a valid asset.

Preserve provenance.

---

## 31. Local API

Use a versioned API such as:

```text
/api/v1/
```

Conceptual endpoints:

```text
POST /api/v1/workers/register
POST /api/v1/workers/heartbeat
POST /api/v1/workers/state
GET  /api/v1/workers/:id/job
POST /api/v1/jobs/:id/ack
POST /api/v1/jobs/:id/events
POST /api/v1/jobs/:id/complete
POST /api/v1/jobs/:id/fail
POST /api/v1/workers/:id/reference-state
POST /api/v1/workers/:id/login-state
```

Exact names may be improved during implementation, but all semantics must exist.

---

## 32. Local API security

Bind to localhost.

Use a per-installation local secret/token or another simple authentication mechanism.

Do not hard-code the token.
Do not expose it in logs.

Do not expose AI provider secrets to the browser extension unless necessary.

---

## 33. Polling contract

While active:

```text
GET job every ~2–3 sec
heartbeat every ~5–10 sec
```

If no job exists, return an empty/no-work response and continue polling.

Do not use aggressive sub-second polling.

The extension must be resilient to MV3 context suspension.

---

## 34. Bridge event model

Minimum events:

```text
REGISTERED
READY
REFERENCE_INITIALIZATION_STARTED
REFERENCE_READY
LOGIN_REQUIRED
JOB_ASSIGNED
JOB_STARTED
PROMPT_SUBMITTED
GENERATION_STARTED
GENERATION_COMPLETE
DOWNLOAD_DETECTED
DOWNLOAD_COMPLETE
VALIDATION_PASSED
JOB_COMPLETE
JOB_FAILED
WORKER_ERROR
PAUSED
RESUMED
```

A generic event endpoint may be used.

---

## 35. Bridge client responsibilities

Inside each extension, Bridge Client should:

- register worker
- poll for jobs
- ACK assignment
- send heartbeats
- report state changes
- report reference state
- report login-required state
- report generation/download events
- report success/failure
- recover/re-register after extension wake/reload

It must not become the generation engine.

---

## 36. Flow adapter

Flow adapter should translate a Studio job into the existing Flow automation.

Possible conceptual operations:

```text
ensureReferenceReady()
submitPrompt()
observeGeneration()
confirmDownload()
reportCompletion()
```

Implement using the existing code paths and minimal hooks.

---

## 37. Meta adapter

Same architecture but Meta-specific implementation.

Do not assume Flow and Meta UI behavior is identical.

---

## 38. Login state

Possible values:

```text
LOGGED_IN
LOGIN_REQUIRED
UNKNOWN
```

If `LOGIN_REQUIRED`:

```text
worker accepts no new jobs
current safe state persisted
UI notified
```

After manual login:

```text
LOGIN_CHECK
→ reference check
→ READY
```

---

## 39. Crash recovery algorithm

On desktop startup:

```text
1. Open database.
2. Load projects.
3. Scan known project image folders.
4. Validate files where needed.
5. Reconcile DB/filesystem mismatches.
6. Mark stale worker sessions offline.
7. Identify jobs without valid completion.
8. Respect active leases until timeout.
9. Requeue safe incomplete work.
10. Start/reattach workers.
11. Wait for Bridge registration.
12. Resume.
```

---

## 40. Worker restart recovery

If W04 disappears:

```text
W04 = OFFLINE
```

Jobs with valid completed files stay completed.

Active unfinished jobs become repair candidates only after safe lease/state reconciliation.

---

## 41. Stuck job rules

Potential stuck indicators:

- no heartbeat
- no job activity
- no file progress
- abnormal generation duration

Do not immediately duplicate a job based on one signal.

Classify and require enough evidence before reassignment.

---

## 42. Resource monitor

Collect locally:

```text
CPU usage
RAM usage
GPU usage if available
VRAM if available
Chrome processes
FFmpeg process usage
AI process usage
```

Expose current and historical snapshots where useful.

---

## 43. Project directory contract

```text
Projects/<slug>/
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

Temporary work files should live in an explicit `working/` area rather than polluting `images/` or `renders/`.

---

## 44. Timeline data model

```text
timeline_items
--------------
id
project_id
track_type
asset_id
prompt_id
start_time
duration
z_index
effect
transition_in
transition_out
metadata_json
```

Track types:

```text
VIDEO
VOICEOVER
CAPTIONS
SFX
MUSIC
```

---

## 45. Image pacing model

Store project pacing as:

```text
images_per_4_seconds
```

Calculate:

```text
images_per_second = value / 4
```

Store the actual generated image count so later edits do not cause an invisible project change.

---

## 46. Transcript model

Store:

```text
transcript
segments
words
start
end
text
confidence if provided
```

Word-level timing is preferred for captions.

---

## 47. SFX event model

```text
sfx_events
----------
id
project_id
event_type
asset_id
time
duration
volume
source
```

Possible event types:

```text
SCENE_CHANGE
REVEAL
IMPACT
CLICK
MOVEMENT
TRANSITION
```

AI may suggest events; renderer should only use validated project events.

---

## 48. Music model

```text
music_tracks
------------
id
project_id
path
start
end
volume
ducking_enabled
```

Default normalized volume:

```text
0.07
```

Document units consistently.

---

## 49. Render pipeline

```text
project state
 ↓
temporary render assets
 ↓
FFmpeg command/filter plan
 ↓
video images
 ↓
voiceover
 ↓
captions
 ↓
SFX
 ↓
music
 ↓
effects/transitions
 ↓
H.264/AAC MP4
 ↓
output validation
```

---

## 50. Render validation

Validate:

- file exists
- file size > 0
- media is readable
- audio stream exists
- video stream exists
- resolution is 1920×1080
- target frame rate
- H.264 video
- AAC audio
- MP4 container
- duration is sufficiently close to project/voiceover duration

Do not mark a render complete before validation.

---

## 51. AI provider abstraction

Conceptual interfaces:

```ts
interface AIProvider {
  generateStructured(input: AIRequest): Promise<AIResponse>;
  generateText(input: AIRequest): Promise<string>;
  isAvailable(): Promise<boolean>;
  getModels(): Promise<ModelInfo[]>;
}

interface TranscriptionProvider {
  transcribe(audioPath: string, options: TranscriptionOptions): Promise<Transcript>;
}

interface AssetProvider {
  search(request: AssetSearchRequest): Promise<AssetResult[]>;
  download(asset: AssetResult): Promise<string>;
  getMetadata(asset: AssetResult): Promise<AssetMetadata>;
}
```

Exact interfaces may be expanded.

---

## 52. Groq provider

Use Groq as primary AI candidate.

Capabilities:

```text
STORY_ANALYSIS
VISUAL_PLAN
PROMPT_GENERATION
PROMPT_VALIDATION
TRANSCRIPTION
```

Make model selectable/configurable.

At implementation time, verify current available models, supported structured output, token limits, rate limits, and pricing/free-tier behavior from official provider docs.

Do not hard-code a historical model name.

---

## 53. Multiple Groq credentials

Store credentials securely.

Do not commit them.
Do not put them into built extension files.
Do not log them.

Track credential health:

```text
enabled
last_success
last_error
cooldown_until
```

Multiple credentials are for reliability/failover; do not assume they multiply organization-level quotas.

---

## 54. Ollama

Implement an `OllamaProvider` against the local Ollama service.

Keep:

```text
base URL
model
request options
```

configurable.

Do not make a specific 7B/8B model a hard dependency.

---

## 55. Transcription

Primary candidate:

```text
Groq Whisper
```

Local fallback:

```text
whisper.cpp
```

Use a provider abstraction so the rest of the app never depends directly on Groq-specific audio code.

---

## 56. Prompt-generation pipeline

Mode 1:

```text
SCRIPT
 ↓
TIMESTAMPS
 ↓
STORY BEATS
 ↓
STORY BIBLE
 ↓
CHARACTER MEMORY
 ↓
LOCATION MEMORY
 ↓
OBJECT MEMORY
 ↓
VISUAL PLAN
 ↓
PROMPT GENERATION
 ↓
STRICT VALIDATION
 ↓
PROMPT RECORDS
```

Large prompt lists may be generated in internal batches.

The final clean prompt list is assembled automatically.

---

## 57. Internal AI schema

A conceptual structured response:

```json
{
  "story": {},
  "characters": [],
  "locations": [],
  "objects": [],
  "visual_beats": [],
  "prompts": []
}
```

Validate before accepting.

The actual schema should be defined before implementation and versioned if it changes.

---

## 58. Story validation

Every prompt should be traceable to source text.

Validator should look for obvious unsupported additions:

```text
unsupported character
unsupported location
unsupported object
unsupported action
unsupported event
```

If validation fails:

```text
reject / regenerate / flag
```

Never silently expand the story.

---

## 59. Asset providers

Pexels and Pixabay should be optional modules.

Use them for supplementary photos/videos where helpful.

Track source metadata.

At implementation time, verify current API capabilities and required attribution/usage conditions from the providers' current documentation.

Do not automatically scrape provider websites.

Do not assume their website catalog and API capabilities are identical.

---

## 60. SFX asset strategy

Primary production SFX source should be the local library.

Example:

```text
assets/sfx/
├── whoosh/
├── pop/
├── impact/
├── click/
├── movement/
├── transition/
└── ambience/
```

The user may manually populate this library with properly licensed assets.

---

## 61. Storage manager

Show:

```text
Images
Audio
SFX
Music
Renders
Other
Total
```

Provide:

- Open project folder
- Clear temporary files
- Inspect project size
- Cache management

Never delete final assets without explicit user action.

---

## 62. Backup

Later support:

```text
Backup
Restore
Import
Export
```

Do not include API secrets in normal project backups/exports.

---

## 63. Extension versioning

Track:

```text
Flow extension version
Meta extension version
Bridge protocol version
Project schema version
App version
```

Use database migrations.

---

## 64. Database migrations

Use ordered migrations:

```text
001_initial
002_worker_sessions
003_job_attempts
004_timeline
005_assets
...
```

Do not destructively rewrite user project data on startup.

---

## 65. Testing

### Unit tests

- duration conversion
- image-count formula
- parser
- missing detection
- duplicate detection
- filename parser
- range allocation
- state transitions
- migrations

### Integration tests

- worker registration
- heartbeat
- polling
- job assignment
- image ingestion
- crash recovery
- repair queue

### Provider tests

- Flow
- Meta
- Groq
- transcription
- stock providers when configured

---

## 66. Mock mode

Build mock Flow/Meta job execution for development.

Simulate:

- success
- slow generation
- failure
- timeout
- missing file
- corrupt file
- repair
- worker disconnect

This allows scheduler development without consuming provider resources.

---

## 67. Test project

Use:

```text
20 prompts
~30 seconds audio
one character reference
```

Test:

- normal success
- one failed job
- one missing download
- one corrupt image
- one worker disconnect
- login-required simulation
- reference initialization on repair worker
- restart/resume

Then scale to 50, 100, 200+.

---

## 68. Hardware tests

Run in stages:

```text
2 workers
↓
3 workers
↓
5 workers if stable
↓
user-defined higher counts
```

Record:

- RAM
- CPU
- browser stability
- download stability
- throughput
- render impact

Do not confuse architecture support with recommended load for the current machine.

---

## 69. Non-goals V1

Do not initially build:

- third Bridge extension
- SaaS backend
- remote distributed worker farm
- anti-bot/rate-limit bypass
- autonomous login bypass
- dynamic work stealing as core scheduler
- pixel-perfect cross-provider identity guarantees
- unnecessary Flow/Meta rewrite

---

## 70. Acceptance test: Mode 2

Given:

```text
200 prompts
voiceover
script
character reference
user-configured workers
```

System must:

1. import and validate prompts
2. create jobs
3. assign fixed ranges
4. launch/attach workers
5. initialize reference as needed
6. execute prompts
7. detect downloads
8. validate assets
9. persist state
10. identify missing IDs
11. retry/repair
12. initialize reference for repair worker
13. survive restart
14. produce ordered images 001–200
15. support manual intervention

---

## 71. Acceptance test: Mode 1

Given:

```text
title
Master Prompt
script
voiceover
character reference
```

System must:

1. determine duration
2. calculate image count
3. segment story
4. produce structured visual plan
5. create prompts
6. validate against story
7. output clean prompt list
8. place prompts into the same job pipeline used by Mode 2

---

## 72. Core success question

At any point the system should be able to answer:

```text
Where is Prompt 157?
Which project?
Which worker?
Which provider?
Which attempt?
Which reference context?
Which file?
Is the file valid?
Which timeline item uses it?
```

If this cannot be answered reliably, orchestration is incomplete.
