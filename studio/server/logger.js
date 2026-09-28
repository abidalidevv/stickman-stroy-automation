const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'data', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function getTimestamp() {
  return new Date().toISOString();
}

let dbInstance = null;

function setDatabase(db) {
  dbInstance = db;
}

function sanitize(data) {
  if (!data) return data;
  if (typeof data === 'string') {
    return data.replace(/gsk_[A-Za-z0-9_-]+/g, '[REDACTED_API_KEY]');
  }
  if (typeof data === 'object') {
    try {
      const copy = JSON.parse(JSON.stringify(data));
      for (const k of Object.keys(copy)) {
        if (/key|secret|token|password/i.test(k) && typeof copy[k] === 'string') {
          copy[k] = '[REDACTED_SECRET]';
        } else if (typeof copy[k] === 'object') {
          copy[k] = sanitize(copy[k]);
        }
      }
      return copy;
    } catch {
      return data;
    }
  }
  return data;
}

function writeLog(level, source, message, context = null) {
  const sanitizedContext = sanitize(context);
  const sanitizedMsg = sanitize(message);
  const ts = getTimestamp();
  
  const consolePrefix = `[${ts}] [${level.toUpperCase()}] [${source}]`;
  if (level === 'error') {
    console.error(`${consolePrefix} ${sanitizedMsg}`, sanitizedContext || '');
  } else if (level === 'warn') {
    console.warn(`${consolePrefix} ${sanitizedMsg}`, sanitizedContext || '');
  } else {
    console.log(`${consolePrefix} ${sanitizedMsg}`, sanitizedContext || '');
  }

  const logFile = path.join(LOG_DIR, `studio-${getLogDate()}.log`);
  const line = JSON.stringify({
    timestamp: ts,
    level,
    source,
    message: sanitizedMsg,
    context: sanitizedContext
  }) + '\n';

  fs.appendFile(logFile, line, () => {});

  if (dbInstance) {
    try {
      dbInstance.run(
        `INSERT INTO system_logs (level, source, message, context_json, timestamp) VALUES (?, ?, ?, ?, ?)`,
        [level, source, String(sanitizedMsg), sanitizedContext ? JSON.stringify(sanitizedContext) : null, ts],
        () => {}
      );
    } catch {}
  }
}

module.exports = {
  setDatabase,
  info: (source, message, context) => writeLog('info', source, message, context),
  warn: (source, message, context) => writeLog('warn', source, message, context),
  error: (source, message, context) => writeLog('error', source, message, context),
  debug: (source, message, context) => writeLog('debug', source, message, context),
  telemetry: (source, message, context) => writeLog('telemetry', source, message, context)
};
