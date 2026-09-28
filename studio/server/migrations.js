const logger = require('./logger');

const MIGRATIONS = [
  {
    version: 1,
    name: 'initial_schema',
    up: async (db) => {
      await db.exec(`
        -- Settings Key-Value Store
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        -- System Event Logs
        CREATE TABLE IF NOT EXISTS system_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          level TEXT NOT NULL,
          source TEXT NOT NULL,
          message TEXT NOT NULL,
          context_json TEXT,
          timestamp TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp);

        -- Projects
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          directory_path TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED, DELETED
          mode TEXT NOT NULL DEFAULT 'MODE_2',   -- MODE_1, MODE_2
          voiceover_path TEXT,
          voiceover_duration REAL DEFAULT 0,
          pacing_preset TEXT DEFAULT '2/4s',      -- 1/4s, 2/4s, 3/4s, 4/4s, 5/4s, Custom
          pacing_multiplier REAL DEFAULT 0.50,
          target_image_count INTEGER DEFAULT 0,
          script_text TEXT,
          character_id TEXT,
          music_path TEXT,
          music_volume REAL DEFAULT 0.07,
          master_prompt TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        -- Character References (Global & Project-Level)
        CREATE TABLE IF NOT EXISTS character_references (
          id TEXT PRIMARY KEY,
          project_id TEXT, -- NULL for channel-wide reusable character
          character_name TEXT NOT NULL,
          image_path TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'READY', -- READY, INITIALIZING, INVALID
          description TEXT,
          bible_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        -- Prompts Table
        CREATE TABLE IF NOT EXISTS prompts (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          prompt_index INTEGER NOT NULL,          -- Numeric order: 1, 2, 3 ...
          prompt_id_str TEXT NOT NULL,           -- Formatted: 001, 002 ...
          prompt_text TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, ASSIGNED, GENERATING, DOWNLOAD_PENDING, COMPLETED, FAILED, REPAIR_PENDING
          assigned_worker_id TEXT,
          file_path TEXT,
          file_name TEXT,
          file_size INTEGER DEFAULT 0,
          sha256 TEXT,
          variant TEXT,                          -- For multi-output Flow variants: a, b ...
          source_segment_id INTEGER,
          timestamp_in_vo TEXT,
          source_span TEXT,
          scene_desc TEXT,
          characters TEXT,
          objects TEXT,
          location TEXT,
          qa_verdict TEXT DEFAULT 'PENDING',
          qa_details TEXT,
          provider TEXT,
          model TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_project_unique_idx ON prompts(project_id, prompt_index);
        CREATE INDEX IF NOT EXISTS idx_prompts_status ON prompts(status);

        -- Prompt Versions (for manual prompt edits & regeneration history)
        CREATE TABLE IF NOT EXISTS prompt_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          prompt_id TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          prompt_text TEXT NOT NULL,
          file_path TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
        );

        -- Workers State Table
        CREATE TABLE IF NOT EXISTS workers (
          id TEXT PRIMARY KEY,                    -- W01, W02, ...
          provider TEXT NOT NULL,                -- 'flow' | 'meta'
          status TEXT NOT NULL DEFAULT 'IDLE',   -- CREATED, STARTING, EXTENSION_READY, LOGIN_REQUIRED, READY, INITIALIZING_REFERENCE, REFERENCE_READY, ASSIGNED, GENERATING, DOWNLOADING, VALIDATING, IDLE, PAUSED, ERROR, OFFLINE
          profile_name TEXT NOT NULL,            -- Worker-01, Worker-02 ...
          profile_path TEXT NOT NULL,
          active_job_id TEXT,
          active_project_id TEXT,
          reference_status TEXT DEFAULT 'NOT_READY', -- NOT_READY, INITIALIZING, READY, INVALID
          active_character_version INTEGER DEFAULT 0,
          last_heartbeat TEXT,
          last_seen_url TEXT,
          last_error TEXT,
          error_count INTEGER DEFAULT 0,
          registered_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        -- Leased Jobs Table
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          prompt_id TEXT NOT NULL,
          worker_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ASSIGNED', -- ASSIGNED, ACKNOWLEDGED, GENERATING, DOWNLOADING, COMPLETED, FAILED, RETRYING, CANCELLED
          lease_owner TEXT NOT NULL,
          lease_expires_at TEXT NOT NULL,
          attempt_count INTEGER DEFAULT 1,
          last_event TEXT,
          last_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
          FOREIGN KEY (worker_id) REFERENCES workers(id)
        );
        CREATE INDEX IF NOT EXISTS idx_jobs_status_lease ON jobs(status, lease_expires_at);

        -- Master Voiceover Timeline Items
        CREATE TABLE IF NOT EXISTS timeline_items (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          prompt_id TEXT,
          image_path TEXT NOT NULL,
          start_time REAL NOT NULL,              -- Start in seconds (e.g. 0.0)
          duration REAL NOT NULL,                -- Duration in seconds (e.g. 2.0)
          end_time REAL NOT NULL,
          order_index INTEGER NOT NULL,
          sfx_cue TEXT,                          -- Optional attached sound effect
          sfx_path TEXT,
          transition TEXT DEFAULT 'cut',         -- cut, subtle_crossfade, whoosh
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_timeline_project ON timeline_items(project_id, order_index);

        -- Captions Table
        CREATE TABLE IF NOT EXISTS captions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          start_time REAL NOT NULL,
          end_time REAL NOT NULL,
          text TEXT NOT NULL,
          words_json TEXT,                       -- Word-level timestamps from Whisper
          created_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        -- SFX & Music Track Metadata
        CREATE TABLE IF NOT EXISTS audio_tracks (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          track_type TEXT NOT NULL,              -- 'VOICEOVER', 'MUSIC', 'SFX'
          file_path TEXT NOT NULL,
          start_time REAL DEFAULT 0,
          duration REAL NOT NULL,
          volume REAL DEFAULT 1.0,
          ducking_enabled INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        -- Render Jobs & Output History
        CREATE TABLE IF NOT EXISTS renders (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          output_path TEXT NOT NULL,
          resolution TEXT DEFAULT '1920x1080',
          fps INTEGER DEFAULT 30,
          status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, RENDERING, COMPLETED, FAILED
          progress REAL DEFAULT 0.0,
          file_size INTEGER DEFAULT 0,
          render_duration_sec REAL DEFAULT 0,
          error_message TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
      `);
      logger.info('MIGRATIONS', 'Migration 1 (initial_schema) applied successfully');
    }
  }
];

async function runMigrations(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = await db.all('SELECT version FROM _migrations ORDER BY version ASC');
  const appliedSet = new Set(appliedRows.map(r => r.version));

  for (const m of MIGRATIONS) {
    if (!appliedSet.has(m.version)) {
      logger.info('MIGRATIONS', `Applying migration ${m.version}: ${m.name}...`);
      await m.up(db);
      await db.run(
        'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [m.version, m.name, new Date().toISOString()]
      );
    }
  }
  logger.info('MIGRATIONS', 'All migrations verified and up to date');
}

module.exports = { runMigrations };
