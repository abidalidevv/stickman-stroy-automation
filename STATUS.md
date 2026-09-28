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

### Stickman Studio — Complete Workflow

Hamara tool **local-first video production studio** hai jo script/prompt list se le kar final rendered video tak poora workflow automate karta hai. User ko manually prompts split karne, workers ko prompts distribute karne, generated images collect/sort karne, missing images identify karne, images ko voiceover ke sath timeline par lagane, captions/SFX/music add karne aur final video render karne ki zarurat nahi honi chahiye. **Voiceover master timeline hota hai**; uski duration aur selected pacing ke basis par system automatically required images/prompts ki quantity calculate karta hai.

### Mode 1 — Generate Everything

Mode 1 mein user **Project Name, Video Title, Master Prompt, complete Script, Voiceover Audio ya duration, Character Reference Image aur optional Background Music** provide karta hai. Pacing bhi select hoti hai, jaise 1/4, 2/4, 3/4, 4/4, 5/4 ya Custom. Master Prompt normally `master_prompt.md` se aata hai, lekin user custom master prompt bhi de sakta hai. System voiceover duration ko read karke required image count calculate karta hai, phir script ko analyze karta hai aur story beats, characters, locations, objects aur visual continuity ko internally understand karta hai. Script **source of truth** hoti hai, is liye system apni taraf se character, event, location ya story detail invent nahi karta.

Character consistency ke liye **ek hi Character Reference Image kaafi hai**. User ko har worker ke liye alag reference image dene ki zarurat nahi. Project mein jo reference image select hoti hai woh central project reference hoti hai. Jab koi worker generation ke liye start/initialize hota hai, Studio us worker ko wahi reference image aur required Character Bible/character information provide karta hai, aur agar provider reference initialization support karta hai to worker ke generation session mein reference initialize karta hai. Iske baad us worker ke prompts usi established character identity, visual description, style aur continuity rules ke sath generate hote hain. Yani reference image **project-level source** hai, worker-level duplicate input nahi. Cross-provider generation mein 100% pixel-identical character guarantee nahi hoti, lekin reference image + Character Bible + session continuity + prompt consistency + QA mil kar character consistency maintain karte hain.

Mode 1 mein Studio script aur Master Prompt ko use karke **final sequential image prompts** generate karta hai. Har prompt internally prompt ID, script source span/timestamp, scene, character, location aur relevant visual information ke sath track hota hai. AI prompt generation semantic kaam karti hai, jabke image count, numbering, parsing, validation, batching aur worker allocation deterministic system handle karta hai. Final prompts sequentially queue mein chale jate hain aur user ko manually 500 ya 1000 prompts split karne ki zarurat nahi hoti.

### Mode 2 — Existing Prompt List

Mode 2 ka purpose bilkul different hai. Is mode mein **AI prompt generation nahi hoti**. User already-prepared sequential Prompt List deta hai, sath mein **Voiceover Audio/duration, optional/recommended Script, Character Reference Image, Pacing aur optional Background Music**. Yahan Script agar di jaye to mainly source/provenance aur later fidelity/timeline verification ke liye hoti hai; Studio user ke prompts ko rewrite karke naye prompts nahi banata. Prompt List hi generation ka direct source hoti hai.

Mode 2 mein jo cheezen dono modes mein common hain, woh common pipeline mein chali jati hain: **Voiceover → duration/timeline, pacing → image count validation, Character Reference → character/session initialization, optional music → post-production, captions/SFX/effects → final render**. Lekin prompt creation ka difference clear rehta hai: **Mode 1 mein Script + Master Prompt se prompts generate hote hain; Mode 2 mein user ke existing prompts directly use hote hain.** Isliye Mode 2 mein AI prompt-generation stage completely skip hota hai.

### Prompt List ka Worker System

Jab final prompt list ready ho jati hai, Studio har prompt ko unique **Prompt ID** deta hai aur queue mein rakhta hai. User Settings/project ke andar decide kar sakta hai ke kitne **Flow workers aur kitne Meta workers** use karne hain. System required workers ko dynamically provision karta hai, maximum supported active workers ke andar. Ye fixed “50 images per worker” ya mandatory 50/50 Flow/Meta system nahi hai. Agar 300 prompts hain aur 6 workers active hain to orchestration engine workload ko workers mein dynamically distribute karega. Worker ko jo job milti hai uske sath prompt ID, prompt aur required generation/reference context diya jata hai.

### Worker + Character Reference Session

Worker browser profile ke sath isolated environment mein run karta hai. Worker jab first time generation ke liye ready hota hai to Studio uski state check karta hai aur agar character reference required hai to **central project reference ko us worker ke generation session mein initialize karta hai**. Worker ko har prompt ke liye reference image dobara manually dene ki zarurat nahi; reference session-level context ke taur par initialize hoti hai jab provider/workflow isko support karta hai. Uske baad worker assigned prompts generate karta hai. Agar worker crash ho jaye ya replacement/repair worker aaye, to repair worker ko generation continue karne se pehle required reference initialization dobara karni hoti hai.

### Flow aur Meta Workers ka Actual Kaam

Studio khud Flow ya Meta ke UI ko replace nahi karta. Existing **Flow aur Meta automation extensions** actual browser-side generation handle karti hain. Studio orchestration layer hai: woh worker ko job deta hai, extension prompt receive karti hai, provider UI mein generation chalati hai, generation complete hone ka wait karti hai, image download karti hai aur result Studio ko report karti hai. Is tarah existing working automation engines preserve rehte hain aur Studio unke upar production-management layer banata hai.

### Image Collection aur Validation

Generated image ko sirf “download ho gaya” keh kar complete nahi maana jata. Studio image ko Prompt ID ke sath associate karta hai, filename/metadata validate karta hai aur ensure karta hai ke correct prompt ki image mili hai. Completed valid image ko dobara automatically regenerate nahi kiya jata. Agar image missing, invalid, corrupt ya failed ho to woh **repair queue** mein jati hai. Agar worker fail ho jaye to uske unfinished jobs stale hone ke baad doosre available worker ko reclaim kiye ja sakte hain. Character reference required ho to repair worker generation se pehle reference initialization karega.

### Voiceover se Timeline

Jab images available hoti hain, Voiceover **master timeline** rehta hai. Studio voiceover ki exact duration use karke images ko sequential timeline par place karta hai. Pacing ke mutabiq har image ka initial duration calculate hota hai. User baad mein timeline mein image replace, reorder ya duration manually adjust kar sakta hai. Yani automatic timeline banne ke baad bhi editor ke paas manual control rehta hai.

### Post-Production

Timeline ke baad Studio captions, SFX, transitions/effects aur optional background music ko production pipeline mein add karta hai. Captions actual voiceover/transcription se generate hote hain aur selected caption style/template ke mutabiq place hote hain. SFX low-density semantic rules ke according use hote hain taa-ke video unnecessarily noisy na ho. Background music optional hai aur default music level **7%** ho sakta hai, with ducking/loop/crop according to voiceover duration.

### Final Render

Last stage mein Studio FFmpeg ke through complete timeline ko final video mein render karta hai. Default output **1920×1080, 16:9, 30 FPS, H.264 video + AAC audio, MP4** hota hai. Render se pehle system missing images, timeline gaps, audio duration, asset availability aur other production checks perform karta hai. Final output sirf tab render hona chahiye jab required assets aur timeline valid hon.

### Dono Modes ka Simple Difference

**Mode 1:**
`Title + Master Prompt + Script + Voiceover + Character Reference → AI Story/Visual Analysis → Prompt Generation → QA → Prompt Queue → Workers → Images → Timeline → Post Production → Final Video`

**Mode 2:**
`Existing Prompt List + Voiceover + optional Script + Character Reference → Prompt Validation → Prompt Queue → Workers → Images → Timeline → Post Production → Final Video`

Is architecture mein **Mode 1 ka final Prompt List naturally Mode 2 ka input ban sakta hai**. Yani agar Mode 1 ne prompts generate kar diye, user un prompts ko save karke future mein same project ko Mode 2 se rerun/repair bhi kar sakta hai bina dobara AI se prompts generate karwaye.


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
