const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const logger = require('./logger');
const { runMigrations } = require('./migrations');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'studio.sqlite');
let rawDb = null;

const db = {
  raw: () => rawDb,

  init: async () => {
    return new Promise((resolve, reject) => {
      rawDb = new sqlite3.Database(DB_PATH, async (err) => {
        if (err) {
          logger.error('DATABASE', `Failed to open database at ${DB_PATH}`, err);
          return reject(err);
        }
        logger.info('DATABASE', `Connected to SQLite database at ${DB_PATH}`);
        logger.setDatabase(rawDb);

        try {
          // Enable WAL mode and performance optimizations
          await db.exec('PRAGMA journal_mode = WAL;');
          await db.exec('PRAGMA synchronous = NORMAL;');
          await db.exec('PRAGMA foreign_keys = ON;');
          
          // Run migrations
          await runMigrations(db);
          resolve();
        } catch (mErr) {
          logger.error('DATABASE', 'Database initialization/migration error', mErr);
          reject(mErr);
        }
      });
    });
  },

  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      rawDb.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },

  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      rawDb.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },

  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      rawDb.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  },

  exec: (sql) => {
    return new Promise((resolve, reject) => {
      rawDb.exec(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  },

  close: () => {
    return new Promise((resolve, reject) => {
      if (!rawDb) return resolve();
      rawDb.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
};

module.exports = db;
