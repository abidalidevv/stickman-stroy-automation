You are the lead software architect and implementation agent for a new Windows desktop application called:

STICKMAN STUDIO

You are working inside a workspace that contains the complete project documentation and two existing Chrome extensions.

Before writing or changing ANY code, first inspect the entire workspace and understand what already exists.

The workspace contains:

1. GPT.md
   → Product vision, complete feature plan, architecture decisions, workflows, and locked product requirements.

2. CLAUDE.md
   → Detailed engineering/architecture specification and corrections discovered during previous design discussions.

3. ANTIGRAVITY.md
   → Implementation rules, development sequence, constraints, testing requirements, and agent instructions.

4. MASTER PROMPT
   → The actual Stickman Script-to-Image prompt-generation specification used to convert a completed script + voiceover into sequential Stickman image-generation prompts.

5. Existing Flow/Veo Chrome Extension
   → Existing working image-generation automation.
   → It already handles prompt input, generation, monitoring, downloading, queue behavior, naming, suffixes, delays, and concurrency.
   → It already contains a WORKER_ID system.

6. Existing Meta AI Chrome Extension
   → Existing working Meta image-generation automation.
   → It already handles the equivalent prompt input, generation, monitoring, downloading, queue behavior, naming, suffixes, delays, and concurrency.
   → It also contains WORKER_ID support.

These two extensions are NOT disposable code.

They are the image-generation engines that Stickman Studio must orchestrate.

CRITICAL ARCHITECTURE DECISION:

There must NOT be a third standalone Bridge extension.

Instead:

Flow Extension
    ├── existing automation
    ├── worker-config.js
    └── bridge-client.js

Meta Extension
    ├── existing automation
    ├── worker-config.js
    └── bridge-client.js

Both communicate directly with the local Stickman Studio service through localhost.

The extensions remain responsible for their existing provider-specific browser automation.

Stickman Studio becomes the orchestrator, project manager, scheduler, validator, timeline engine, post-production engine, and AI layer.

The existing generation workflow MUST NOT be broken.

However, there is one explicit exception:

Character Reference initialization/upload is allowed and required because Character Reference is part of the new consistency workflow.

For Flow, inspect the existing real Flow UI and implement the correct Ingredients/reference initialization mechanism.

For Meta, inspect the actual Meta workflow and implement its provider-specific reference/photo initialization mechanism where supported.

Do NOT upload the reference image again for every prompt when the provider/session can retain the reference context.

Do NOT invent undocumented APIs.

Do NOT assume Flow and Meta use the same reference mechanism.

The system must know whether a worker already has the correct character reference initialized for the current project/session.

If a repair job is moved from W01 to W08 and W08 does not have the correct reference context, initialize it BEFORE sending the repair prompt.

The first development objective is NOT the complete finished application.

The first objective is to understand the existing system and prepare a safe implementation plan.

Read every relevant file.

Inspect:

- both manifests
- worker-config.js
- current WORKER_ID implementation
- popup code
- service worker/background code
- content scripts
- prompt queue
- prompt submission
- generation detection
- download detection
- filename generation
- suffix logic
- delays
- concurrency
- current provider UI automation
- extension lifecycle

Then produce an architecture/implementation report before making major changes.

The report should explicitly explain:

1. What each existing extension currently does.
2. Where Bridge Client can be safely inserted.
3. What files would need modification.
4. How Worker ID will be preserved.
5. How localhost communication will work.
6. How worker registration/heartbeat/job polling will work.
7. How character reference initialization will work for Flow.
8. How character reference initialization will work for Meta.
9. How repair jobs will handle reference context.
10. How existing standalone functionality will remain intact.
11. How browser profiles will be managed.
12. How fixed prompt ranges will be assigned.
13. How missing/failed prompts will be repaired.
14. How crash recovery will work.
15. How completed jobs will never be accidentally regenerated.
16. What Phase 0 tests must be performed before large implementation.
17. Any real conflict or ambiguity found in the workspace.

Do not rewrite the existing extensions simply because you can.

Do not replace working automation with a new implementation.

Prefer small Bridge adapters and minimal integration hooks.

The user will eventually run configurable numbers of Flow and Meta workers, for example:

5 Flow + 5 Meta

or

2 Flow + 3 Meta

or any other configured combination.

Do not hard-code 10 workers.

Initial real hardware testing will start with 2 workers, then 3, then increase only if stable.

Current development hardware is:

i5 6th generation
8 GB RAM
4 GB GPU

The architecture may support higher worker counts, but runtime load warnings are acceptable.

The application should not silently change the user's configured worker counts.

The final product is:

A Windows 10/11 local-first desktop Stickman video production engine.

Target stack:

Tauri 2
React
TypeScript
Tailwind
Node/TypeScript local sidecar/service
SQLite
FFmpeg

Core production flow:

SCRIPT / EXISTING PROMPT LIST
        ↓
PROMPT VALIDATION
        ↓
WORKER DISTRIBUTION
        ↓
FLOW / META GENERATION
        ↓
IMAGE DOWNLOAD
        ↓
FILE VALIDATION
        ↓
MISSING / FAILED REPAIR
        ↓
VOICEOVER MASTER TIMELINE
        ↓
CAPTIONS
        ↓
SFX
        ↓
TRANSITIONS / EFFECTS
        ↓
BACKGROUND MUSIC
        ↓
FFMPEG
        ↓
FINAL 1920×1080 MP4

There are TWO operating modes.

MODE 1:
Generate Everything

Input:
- Video Title
- Master Prompt
- Script
- Voiceover
- Character Reference
- optional music

AI creates the prompt list and then sends it into the same downstream generation pipeline as Mode 2.

MODE 2:
Existing Prompt List

Input:
- existing clean prompt list
- script
- voiceover
- character reference
- optional music

No AI prompt generation is needed in Mode 2.

MODE 2 is the first MVP priority.

Prompt IDs are the primary image identity.

Worker IDs are metadata.

Example:

001_description__W01.png

Prompt order is always numerical:

001
002
003
...

Completion order does not matter.

The application must detect:

- missing IDs
- duplicates
- corrupted files
- zero-byte files
- invalid dimensions
- failed jobs
- stale jobs
- worker disconnects

The application must be crash-resumable.

Do not regenerate completed work after restart.

Use localhost polling rather than relying on a permanently persistent MV3 background connection.

Approximate:
job polling = 2–3 seconds
heartbeat = 5–10 seconds

Persist state both in the extension where necessary and in the Studio backend.

Character consistency is a major feature.

The system should support:

Channel Character
    → Character Reference Image
    → Character Bible
    → reusable across projects

Project-level character reference overrides are allowed.

Reference context must be tracked per worker/project/session.

Groq is the primary AI provider.

Ollama is the local fallback.

Provider architecture must remain modular so additional providers can be added later.

Groq should be used for:
- story analysis
- visual segmentation
- prompt generation
- prompt validation
- Whisper transcription

whisper.cpp is the local transcription fallback.

Optional asset providers:
- Pexels
- Pixabay

These are supplementary and must not replace the core Flow/Meta generation workflow.

SFX should primarily come from a local reusable library such as Kenney/licensed assets.

Background music default volume is:

7%

Voiceover remains dominant, with optional/expected ducking.

Render target:

1920×1080
16:9
30 FPS
H.264
AAC
MP4

The actual Master Prompt in the workspace is the authoritative specification for Stickman visual generation rules.

It defines:
- Stickman visual universe
- strict story fidelity
- character identity lock
- object continuity
- location continuity
- no photorealism
- no invented story information
- one image = one prompt
- clean final Markdown prompt output

The application should use the Master Prompt as the AI visual-rule source, while deterministic application code remains responsible for:
- image-count calculation
- prompt IDs
- validation
- worker assignment
- file management
- timeline
- rendering

IMPORTANT:
The current Master Prompt may contain a hard-coded historical image-count formula. The final Studio architecture uses configurable pacing presets, so do not blindly hard-code the old formula into Studio. Inspect the current Master Prompt and documentation, identify any mismatch, and resolve it explicitly before implementing Mode 1.

Do not silently edit architecture decisions.

Do not start Phase 2 or full AI generation merely because the UI compiles.

First inspect.
Then report.
Then propose the smallest safe implementation sequence.
Then wait for/execute the relevant phase according to the project instructions.

Treat GPT.md, CLAUDE.md, ANTIGRAVITY.md, MASTER PROMPT, and the actual extension source code as the working project context.



# STICKMAN STUDIO — MASTER IMPLEMENTATION DIRECTIVE

You are now implementing STICKMAN STUDIO.

This is a real personal production application, not a prototype demo.

The application must eventually automate the user's complete Stickman documentary production workflow:

Script / Prompt List
→ Prompt Planning
→ Worker Distribution
→ Flow / Meta Image Generation
→ Download
→ Validation
→ Repair
→ Timeline
→ Captions
→ SFX
→ Transitions
→ Music
→ FFmpeg
→ Final MP4

==================================================
1. SOURCE DOCUMENTS
==================================================

The workspace contains:

GPT.md
CLAUDE.md
ANTIGRAVITY.md
MASTER PROMPT
Flow Chrome Extension
Meta Chrome Extension

Read all of them.

The actual extension source code is equally important.

Never implement assumptions about the extensions without inspecting their actual code.

==================================================
2. PRODUCT
==================================================

Name:

STICKMAN STUDIO

Platform:

Windows 10/11

Purpose:

A local-first desktop application for producing Stickman documentary videos.

This is a personal production tool, not a SaaS application.

==================================================
3. FINAL ARCHITECTURE
==================================================

Desktop:

Tauri 2
React
TypeScript
Tailwind

Local orchestration:

Node/TypeScript sidecar or equivalent local service.

Database:

SQLite

Rendering:

FFmpeg

Browser workers:

Chrome/Chromium persistent profiles

Generation engines:

Existing Flow Extension
Existing Meta Extension

Communication:

localhost HTTP API + polling

==================================================
4. ABSOLUTE BRIDGE DECISION
==================================================

DO NOT CREATE A THIRD BRIDGE EXTENSION.

There are exactly two generation extensions:

Flow Extension
Meta Extension

and both receive a small Bridge Client internally.

Flow:

flow-extension/
    existing files
    worker-config.js
    bridge-client.js

Meta:

meta-extension/
    existing files
    worker-config.js
    bridge-client.js

Bridge communication:

Flow Extension
    ↓
bridge-client.js
    ↓
localhost
    ↓
Stickman Studio

Meta Extension
    ↓
bridge-client.js
    ↓
localhost
    ↓
Stickman Studio

Do NOT use externally_connectable cross-extension messaging.

Do NOT make the architecture depend on hard-coded extension IDs.

==================================================
5. EXISTING EXTENSIONS ARE PRODUCTION-CRITICAL
==================================================

The existing Flow and Meta extensions already work.

Preserve their current workflow.

Do NOT unnecessarily rewrite:

- prompt queue
- generation logic
- prompt submission
- generation monitoring
- download monitoring
- filename logic
- prompt numbering
- sanitization
- suffix handling
- delays
- concurrency
- existing retry behavior
- standalone functionality

The Bridge must integrate with the existing automation.

Prefer:

small adapter
+
small state/reporting hooks

instead of:

complete rewrite.

==================================================
6. EXPLICIT CHARACTER-REFERENCE EXCEPTION
==================================================

Character Reference initialization is a required new generation-adjacent capability.

Therefore:

Adding the provider-specific reference initialization/upload sequence IS ALLOWED.

This is the only intentional expansion of the "do not rewrite generation engine" rule.

Flow:

Inspect actual Flow UI.

If the real workflow supports Ingredients/reference image:

initialize the reference once in the appropriate session/project context.

Do NOT automatically upload the same image again for every prompt.

Meta:

Inspect the actual Meta workflow.

Implement its actual supported reference/photo establishment mechanism.

Do not invent an undocumented API.

Flow and Meta may use different mechanisms.

==================================================
7. CHARACTER REFERENCE STATE
==================================================

Character reference belongs to project/session context.

Example:

W01
Project A
Character Main Stickman
Reference v3
READY

Track:

worker_id
project_id
character_id
reference_version
reference_status
last_initialized

Statuses:

NOT_READY
INITIALIZING
READY
INVALID
RESET_REQUIRED
ERROR

Before every job:

Check whether this worker has the correct reference context.

If not:

initialize reference
→ verify READY
→ then submit prompt.

==================================================
8. REPAIR QUEUE + CHARACTER REFERENCE
==================================================

Critical.

Example:

Prompt 037 originally belongs to W01.

W01 fails.

Repair queue assigns Prompt 037 to W08.

W08 must NOT immediately execute it.

First:

check W08 reference state
↓
if not READY
↓
initialize current project reference
↓
verify
↓
execute Prompt 037

A repair job must never skip character-reference preparation.

==================================================
9. WORKER IDS
==================================================

The existing extensions already support:

worker-config.js

Example:

export const WORKER_ID = "W01";

Preserve this mechanism.

Worker IDs:

W01
W02
W03
...

Use worker IDs for:

- registration
- logs
- job ownership
- filename provenance
- debugging
- worker status

Example output:

001_description__W01.png

Flow multi-output:

001_description_a__W01.png
001_description_b__W01.png

Prompt ID remains the primary image identity.

==================================================
10. WORKER COUNTS
==================================================

The user controls worker counts.

UI:

Flow Workers: X
Meta Workers: Y

Examples:

5 Flow + 5 Meta

2 Flow + 3 Meta

8 Flow + 2 Meta

etc.

Do NOT hard-code:

10 workers.

Do NOT silently cap or reduce the user's configured worker counts.

Architecture must support the configured number.

Current hardware:

i5 6th generation
8 GB RAM
4 GB GPU

Initial real-world test:

2 workers
→ 3 workers
→ 5 workers if stable

Show resource warnings for heavy configurations.

Do not automatically alter the user's setting.

==================================================
11. BROWSER PROFILE MODEL
==================================================

Every worker gets its own persistent Chromium profile.

Example:

Workers/
    Worker-01/
    Worker-02/
    Worker-03/

Each profile must remain isolated.

Never run two workers against the same writable browser profile simultaneously.

User manually logs into each provider account once.

If login expires:

worker = LOGIN_REQUIRED

Pause only that worker.

Show UI action:

Login Required
Resume after login

After login:

re-check reference state
then resume.

==================================================
12. WORKER RANGE ALLOCATION
==================================================

V1 primary strategy:

FIXED RANGE ALLOCATION.

Example:

500 prompts
5 Flow
5 Meta

W01 Flow = 001–050
W02 Flow = 051–100
W03 Flow = 101–150
W04 Flow = 151–200
W05 Flow = 201–250

W06 Meta = 251–300
W07 Meta = 301–350
W08 Meta = 351–400
W09 Meta = 401–450
W10 Meta = 451–500

For uneven divisions, use deterministic allocation.

Do not build dynamic allocation as the V1 primary strategy.

Future dynamic scheduling can be added later.

==================================================
13. TWO OPERATING MODES
==================================================

MODE 1 — GENERATE EVERYTHING

Inputs:

- title
- master prompt
- script
- voiceover
- character reference
- optional music

Flow:

script
→ timing
→ image count
→ story beats
→ Story Bible
→ character/location/object memory
→ visual plan
→ prompt generation
→ validation
→ clean prompt list
→ job scheduler
→ workers

MODE 2 — EXISTING PROMPT LIST

Inputs:

- clean prompt list
- script
- voiceover
- character reference
- optional music

No AI prompt generation.

Mode 2 feeds directly into the job scheduler.

MODE 2 IS THE FIRST MVP PRIORITY.

==================================================
14. CLEAN PROMPT FORMAT
==================================================

The user's final Master Prompt will produce clean sequential prompts.

Example:

001_prompt text...

002_prompt text...

003_prompt text...

No:

IMAGE 001
Timestamp:
Source:
Visual Purpose:
Prompt:

No headings.

No numbering-as-labels.

No metadata.

No commentary.

The parser must not silently renumber malformed imports.

==================================================
15. MASTER PROMPT ROLE
==================================================

MASTER PROMPT is the source of the Stickman visual-generation rules.

It defines:

2D hand-drawn Stickman universe
strict story fidelity
character consistency
environment consistency
object consistency
no photorealism
no invented story events
one image = one prompt
clean prompt-only Markdown output

However:

The Studio application's deterministic code controls the actual image-count formula and pacing selection.

Do NOT hard-code an old Master Prompt formula into the Studio if the application UI uses configurable pacing.

The system supports:

1 / 4 sec
2 / 4 sec
3 / 4 sec
4 / 4 sec
5 / 4 sec
Custom

Current default:

2 / 4 sec

The Master Prompt should receive the final required image count from Studio.

==================================================
16. VOICEOVER MASTER TIMELINE
==================================================

Voiceover controls timing.

If voiceover is:

6:36

then:

396 seconds.

If pacing:

2 images / 4 seconds

then:

198 images.

Images are placed against the voiceover.

Semantic timing may shift cuts slightly to:

- sentence boundaries
- action boundaries
- visual beats

but chronology must never be broken.

==================================================
17. SCRIPT IS SOURCE OF TRUTH
==================================================

Never invent:

characters
actions
objects
locations
events
facts
dates
measurements
outcomes
causes
historical details
scientific details

unless supported by the supplied script.

If script is incomplete:

flag it.

Do not invent a continuation.

==================================================
18. CHARACTER SYSTEM
==================================================

Support reusable channel-level characters:

characters/
    main-stickman/
        reference.png
        character.json

Character Bible may store:

- anatomy
- head shape
- face
- body
- limbs
- colors
- clothing
- accessories
- silhouette
- line style
- recurring details

Project-level character overrides are allowed.

==================================================
19. CHARACTER CONSISTENCY
==================================================

For recurring characters:

preserve identity.

Keep consistent:

- head
- face
- body
- limbs
- proportions
- line style
- clothing
- colors
- accessories
- silhouette

Character can change only in:

- pose
- action
- expression
- position
- camera
- supported environment
- lighting

Do not redesign the character.

==================================================
20. CROSS-PROVIDER CHARACTER TEST
==================================================

Before locking mixed-provider strategy:

run:

same reference
+
same or equivalent prompts

Flow
vs
Meta

Evaluate:

head
face
body proportions
line style
colors
recurring traits

Do not assume the outcome.

Do not claim 100% pixel-identical consistency.

Reference images reduce drift but do not guarantee perfect identity.

==================================================
21. REFERENCE SESSION TEST
==================================================

Test:

Reference initialization
→ many prompts
→ repair on same worker
→ repair on different worker

Verify:

- same worker reuses reference correctly
- different worker initializes it first
- changing project resets context
- changing reference version resets context

==================================================
22. BRIDGE PROTOCOL
==================================================

Use localhost.

Use polling.

Approximate:

Job polling:
2–3 seconds

Heartbeat:
5–10 seconds

Do not rely on an MV3 background service worker being permanently alive.

When extension context returns:

re-register/reconnect
→ recover state
→ continue polling.

==================================================
23. BRIDGE EVENTS
==================================================

Implement these logical events:

REGISTER
HEARTBEAT
GET_JOB
JOB_ACKNOWLEDGED
JOB_STARTED
PROMPT_SUBMITTED
REFERENCE_INITIALIZATION_STARTED
REFERENCE_READY
GENERATION_STARTED
GENERATION_COMPLETE
DOWNLOAD_COMPLETE
JOB_COMPLETE
JOB_FAILED
LOGIN_REQUIRED
WORKER_PAUSED
WORKER_RESUMED
WORKER_IDLE
WORKER_ERROR

The HTTP naming may differ, but all state transitions must exist.

==================================================
24. LOCAL API
==================================================

Use versioned API:

/api/v1/

Conceptual operations:

POST /workers/register
POST /workers/heartbeat
POST /workers/state
GET /workers/:id/job
POST /jobs/:id/ack
POST /jobs/:id/events
POST /jobs/:id/complete
POST /jobs/:id/fail
POST /workers/:id/reference-state
POST /workers/:id/login-state

Keep the interface small.

==================================================
25. LOCAL API SECURITY
==================================================

Bind to localhost.

Use an installation/local authentication mechanism.

Do not hard-code secrets.

Do not print secrets in logs.

Extensions must authenticate to the local service.

==================================================
26. WORKER STATES
==================================================

Use an explicit state machine:

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

Do not allow contradictory states.

==================================================
27. JOB STATES
==================================================

Use:

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

Persist everything.

==================================================
28. JOB LEASES
==================================================

Prevent duplicate work.

Use:

lease_owner
lease_expires_at

or an equivalent robust mechanism.

Do not reassign immediately after one missed heartbeat.

Reconcile:

heartbeat
+
job activity
+
file existence
+
worker state

before abandoning a job.

==================================================
29. RETRIES
==================================================

Track:

attempt_count
last_error
worker
provider
timestamps

Default retry count may be 3.

Do not retry forever.

==================================================
30. IMAGE INGESTION
==================================================

Generation completion does not mean image success.

Validate:

file exists
non-zero size
image decodes
dimensions valid
filename parseable
prompt ID valid
worker ID valid where expected
no conflicting duplicate

Only then mark job complete.

==================================================
31. CENTRAL IMAGE STORAGE
==================================================

Final project images go into:

Projects/
    ProjectName/
        images/

Not separate final folders per worker.

Workers may use temporary download directories.

Studio owns final project organization.

==================================================
32. IMAGE ORDERING
==================================================

Sort by numeric prompt ID.

Example:

001
002
003
...
200

Worker completion order is irrelevant.

==================================================
33. REPAIR QUEUE
==================================================

Example:

Expected:
001–200

Received:
001–072
074–151
153–200

Missing:

073
152

Create repair jobs.

Do not restart the whole generation process.

==================================================
34. DUPLICATES
==================================================

Detect:

duplicate prompt IDs
duplicate variants
conflicting outputs

Never silently overwrite a valid completed output.

==================================================
35. MULTIPLE OUTPUTS
==================================================

Support:

001_description_a__W01.png
001_description_b__W01.png

Associate both with Prompt 001.

Allow user/system to select which output becomes the timeline asset.

==================================================
36. CRASH RECOVERY
==================================================

When application restarts:

load DB
scan files
reconcile
mark dead workers offline
detect missing jobs
requeue safe incomplete jobs
reattach/restart workers
resume

Never regenerate valid completed prompts automatically.

==================================================
37. IDEMPOTENCY
==================================================

If an image is valid and Prompt X is complete:

DO NOT generate it again.

Only regenerate if the user explicitly requests regeneration.

==================================================
38. LOGGING
==================================================

Maintain:

global logs
project logs
worker logs
job logs
error logs

Example:

W03
Job 121
Prompt submitted
Generation started
Download detected
Validation passed
Completed

Error:

W04
Prompt 157
Download timeout
Attempt 2/3

==================================================
39. DATABASE
==================================================

Use SQLite.

Minimum logical entities:

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

Use migrations.

==================================================
40. PROJECT FOLDER
==================================================

Recommended:

Projects/
    Wild-Potato/
        project.sqlite
        project.json
        script.txt
        subtitles.srt
        voiceover.mp3

        characters/
            main-stickman/
                reference.png
                character.json

        prompts/
            source.md
            generated.md

        images/
            001_....png
            002_....png

        captions/
        sfx/
        music/
        timeline/
        renders/

==================================================
41. PROJECT AUTO-SAVE
==================================================

Important project state must save automatically.

Do not depend on manually clicking Save.

==================================================
42. PROJECT BACKUP
==================================================

Support project backup/restore eventually.

Do not include API secrets in normal project exports.

==================================================
43. PROMPT VERSIONING
==================================================

Support:

Prompt 157
v1
v2
v3

Regenerated prompt versions should remain recoverable.

==================================================
44. MANUAL OVERRIDES
==================================================

Automation must never trap the user.

Allow:

assign job manually
pause worker
resume worker
retry job
cancel job
replace image
import image
edit prompt
regenerate prompt
adjust timeline item

==================================================
45. TIMELINE ENGINE
==================================================

Voiceover is master.

Tracks:

VIDEO
VOICEOVER
CAPTIONS
SFX
MUSIC

Images are placed using selected pacing.

Timeline can use semantic cut adjustments while preserving chronology.

==================================================
46. CAPTIONS
==================================================

Primary:

Groq Whisper

Fallback:

whisper.cpp

Preferred:

word-level timestamps

Caption placement:

bottom-center

High readability.

SRT/VTT can be used as a secondary timing/reference input.

Actual audio timing remains authoritative when available.

==================================================
47. BACKGROUND MUSIC
==================================================

Optional.

LOCKED DEFAULT:

7%

Voiceover ducking:

ON by default where practical.

Music is looped/cropped to voiceover duration.

==================================================
48. SFX
==================================================

Do NOT place one SFX after every image.

Use semantic events.

Examples:

scene change → whoosh
reveal → pop
impact → hit
click → click

Default density:

LOW

Use local licensed assets.

==================================================
49. ASSET LIBRARY
==================================================

Local assets:

assets/
    sfx/
    music/

Possible metadata:

tags
intensity
duration
category
source
license

==================================================
50. OPTIONAL STOCK MEDIA
==================================================

Optional providers:

Pexels
Pixabay

Use for supplementary stock content only.

Do not replace the core Stickman generation workflow.

Do not assume website assets are automatically available through an API.

Keep asset providers modular.

==================================================
51. EXTERNAL ASSET PROVENANCE
==================================================

Track:

provider
provider asset ID
source URL
creator if available
license/source information
downloaded at
project
scene

==================================================
52. AI PROVIDER LAYER
==================================================

Do not hard-code the application to one AI provider.

Interface:

AIProvider

Candidates:

Groq
Ollama
OpenRouter
Gemini
Claude
OpenAI

V1 priority:

Groq
Ollama fallback

==================================================
53. GROQ
==================================================

Groq is PRIMARY.

Use for:

story analysis
visual segmentation
prompt generation
prompt validation
transcription

The model must be configurable.

Do not hard-code an obsolete/deprecated model name.

Verify currently supported models before finalizing the default.

==================================================
54. GROQ CREDENTIALS
==================================================

Support multiple user-supplied credentials.

Example:

Key 01
Key 02
Key 03
Key 04
Key 05

Manage:

enabled
last success
last error
cooldown

Do NOT assume multiple keys multiply organization-level limits.

Use them for resilience/failover.

Never put keys in source code.

Never expose them in logs.

==================================================
55. OLLAMA
==================================================

Ollama is the local fallback.

It must be implemented enough to be a real fallback, not a dead placeholder.

Keep model selection configurable.

Do not assume it is equal to Groq on the current machine.

==================================================
56. WHISPER.CPP
==================================================

Use as local transcription fallback.

Do not make it the default if Groq is available.

==================================================
57. AI BATCHING
==================================================

Large prompt generation must be batched internally.

Example:

20–30 prompts per call.

But the application combines all batches automatically.

The user should never request:

"next 100 prompts"

manually.

==================================================
58. AI CONTINUITY
==================================================

Carry between batches:

characters
locations
objects
style
current story state
visual context

Do not invent content simply because another batch needs more prompts.

==================================================
59. STRICT STORY FIDELITY
==================================================

Every visual prompt must be traceable to supplied source text.

Internal provenance:

prompt_id
timestamp
source_text
scene_id
characters
objects
prompt
worker_id
provider
reference_id

Reject or regenerate obvious unsupported visual inventions where the validator can reliably detect them.

==================================================
60. MODE 1 OUTPUT
==================================================

Mode 1 must produce the same clean prompt-list shape that Mode 2 accepts.

Architecture:

Mode 1
→ Prompt Records
→ same Job Scheduler
→ same Workers

Do not create a separate worker pipeline for Mode 1.

==================================================
61. MODE 2 INPUT
==================================================

Mode 2 parser accepts:

001_prompt
002_prompt
003_prompt

Validate:

missing
duplicate
malformed
count mismatch

Never silently renumber.

==================================================
62. IMAGE COUNT
==================================================

Studio supports:

1 / 4 sec
2 / 4 sec
3 / 4 sec
4 / 4 sec
5 / 4 sec
Custom

Default:

2 / 4 sec

Formula must be deterministic from:

voiceover duration
+
selected pacing

Do not hard-code the old 0.75 formula as the only possible setting.

==================================================
63. RESOURCE MONITOR
==================================================

Show:

CPU
RAM
GPU
VRAM
worker count
FFmpeg load
AI processing load where available

Warn on high load.

Do not silently reduce user worker configuration.

==================================================
64. EXTENSION STANDALONE REGRESSION
==================================================

This is mandatory.

When Stickman Studio is OFF:

Flow extension must still work as it did before.

Meta extension must still work as it did before.

If localhost is unavailable:

extensions must degrade gracefully.

Do not break standalone generation.

==================================================
65. MOCK MODE
==================================================

Build mock worker/provider mode for development.

Simulate:

registration
heartbeat
job
generation
download
failure
timeout
repair
disconnect

Use mock mode to test the scheduler without consuming external generation resources.

==================================================
66. TEST PROJECT
==================================================

Create a small test project:

20 prompts
short audio
one character
one reference image

Test:

success
failure
missing
duplicate
corrupt file
worker disconnect
login required
reference initialization
repair on another worker
restart

Then:

50 prompts

Then:

100

Then:

200+

==================================================
67. PHASES
==================================================

PHASE 0
Validation Lab

Test:

A:
Groq quality on 60–90 second concrete + abstract script.

B:
Flow vs Meta with same character reference.

C:
reference initialize once
→ many prompts
→ repair same worker
→ repair different worker.

D:
2 workers
→ 3
→ 5

E:
Flow and Meta standalone regression.

F:
Bridge polling/reconnect.

G:
FFmpeg basic render.

PHASE 1
Foundation

Tauri
React
TypeScript
SQLite
project system
local service
logging
filesystem
settings

PHASE 2
Bridge + Worker System

Flow Bridge
Meta Bridge
registration
heartbeat
polling
range allocation
job state
profile management
login detection
reference state
repair queue
retry
crash recovery

PHASE 3
Image + Timeline

image ingestion
validation
central storage
voiceover duration
pacing
timeline
manual replacement
preview

PHASE 4
Post Production

Whisper
captions
SFX
transitions
effects
music 7%
ducking
FFmpeg
render validation

PHASE 5
Mode 1 AI Story Engine

Groq
Ollama fallback
story analysis
Story Bible
visual planning
prompt generation
validation
batching
continuity

PHASE 6
Quality Layer

character consistency QA
visual anomaly detection
better semantic timing
advanced repair
provider-aware optimization

==================================================
68. DEVELOPMENT ORDER
==================================================

DO NOT build everything simultaneously.

Use this order:

1. inspect workspace
2. inspect extensions
3. architecture report
4. establish app skeleton
5. SQLite/migrations
6. project system
7. worker registry
8. Flow Bridge
9. Meta Bridge
10. polling/heartbeat
11. Mode 2 parser
12. range scheduler
13. image ingestion
14. validation
15. retry/repair
16. crash recovery
17. two-worker real test
18. three-worker test
19. timeline
20. captions
21. SFX
22. effects/transitions
23. music
24. FFmpeg
25. Groq
26. Ollama fallback
27. Mode 1
28. quality layer

==================================================
69. FIRST MVP ACCEPTANCE TEST
==================================================

Give the system:

200 clean prompts

Voiceover

Script

Character reference

User-configured workers:

example:
5 Flow
5 Meta

The expected result:

- prompts validated
- ranges assigned
- workers registered
- browser profiles isolated
- reference initialized correctly
- generation executed
- images downloaded
- files validated
- missing IDs detected
- failed jobs repaired
- repair workers initialize reference first
- final images ordered 001–200
- crash/restart does not regenerate completed work
- user can manually intervene
- no manual prompt splitting
- no manual worker distribution
- no manual image merging

This is the FIRST REAL SUCCESS CRITERION.

A polished UI is secondary to reliable orchestration.

==================================================
70. IMPORTANT NON-GOALS
==================================================

Do NOT initially build:

- third Bridge extension
- SaaS/cloud backend
- online accounts
- remote worker farm
- dynamic scene scheduling
- pixel-perfect cross-provider identity guarantee
- autonomous login bypass
- anti-bot bypass
- unnecessary Flow rewrite
- unnecessary Meta rewrite

==================================================
71. CODING QUALITY
==================================================

Use:

TypeScript
strict typing
clear modules
central configuration
validation
error handling
database migrations
small APIs
minimal duplication

Avoid:

giant monolithic files
magic values everywhere
duplicated provider logic
unnecessary abstraction
rewriting working automation

==================================================
72. DOCUMENTATION
==================================================

Whenever you implement a non-obvious integration, document:

- what it does
- why it exists
- what existing code it hooks into
- failure behavior
- recovery behavior

Especially document:

Bridge
worker lifecycle
reference initialization
job leases
repair queue
provider adapters

==================================================
73. FINAL PRODUCT PIPELINE
==================================================

MODE 1:

Title
+
Master Prompt
+
Script
+
Voiceover
+
Character Reference

↓
AI Story Engine

↓
Validated Clean Prompt List

↓

MODE 2 DOWNSTREAM PIPELINE

↓

Job Scheduler

↓

Flow / Meta Workers

↓

Existing Extension Automation

↓

Download

↓

Validation

↓

Repair

↓

Central Images

↓

Voiceover Timeline

↓

Captions

↓

SFX

↓

Effects / Transitions

↓

Music 7%

↓

FFmpeg

↓

FINAL 1920×1080 MP4

==================================================
74. ABSOLUTE RULES
==================================================

Never create a third Bridge extension.

Never unnecessarily rewrite Flow.

Never unnecessarily rewrite Meta.

Never break standalone extension behavior.

Never assign a repair job without checking character reference context.

Never upload the character reference on every prompt when session/project context can retain it.

Never assume undocumented provider behavior.

Never silently renumber prompts.

Never silently overwrite valid images.

Never regenerate completed work after restart.

Never invent missing story content.

Never put API credentials in source code.

Never hard-code the old image-count formula when Studio pacing is configurable.

Never silently reduce user-configured worker counts.

Never treat provider completion as image completion without file validation.

Never build the entire product before proving the worker/image pipeline.

==================================================
75. FINAL GOAL
==================================================

The final application must allow the user to go from:

existing prompt list or approved script

to:

fully organized Stickman image set

to:

synchronized, captioned, sound-designed, music-backed, rendered YouTube video

with the minimum possible manual work.

The existing Flow and Meta extensions are the actual browser generation engines.

Stickman Studio is the brain/orchestrator around them.

Build for reliability first.

Build for resumability.

Build for observability.

Build for real repeated production use.