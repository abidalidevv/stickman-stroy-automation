const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db');
const logger = require('./logger');
const routes = require('./routes');
const resourceMonitor = require('./resource_monitor');
const reconciliation = require('./reconciliation');

const PORT = process.env.PORT || 45450;
const HOST = '127.0.0.1';

const app = express();

// Security Token Generation
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const TOKEN_FILE = path.join(DATA_DIR, 'auth.token');
let localAuthToken = '';
if (fs.existsSync(TOKEN_FILE)) {
  localAuthToken = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
}
if (!localAuthToken) {
  localAuthToken = crypto.randomBytes(24).toString('hex');
  fs.writeFileSync(TOKEN_FILE, localAuthToken, 'utf8');
}

// CORS for Chrome Extensions and Local UI
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Worker-ID']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file hosting for images and assets
const PROJECTS_ROOT = path.resolve('E:/stickman-video-automation/Projects');
app.use('/projects-media', express.static(PROJECTS_ROOT));
const DEMO_ROOT = path.resolve('E:/stickman-video-automation/Demo');
app.use('/demo-media', express.static(DEMO_ROOT));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Request logging (sanitized)
app.use((req, res, next) => {
  if (!req.path.includes('/system/resources') && !req.path.includes('/heartbeat')) {
    logger.debug('HTTP', `${req.method} ${req.path}`);
  }
  next();
});

// API Routes
app.use('/api/v1', routes);

// Fallback for SPA navigation
app.use((req, res, next) => {
  const indexHtml = path.join(__dirname, '..', 'public', 'index.html');
  if (req.method === 'GET' && fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  next();
});

async function startServer() {
  try {
    await db.init();
    await reconciliation.reconcileStartup();
    resourceMonitor.updateMetrics();

    return new Promise((resolve) => {
      const server = app.listen(PORT, HOST, () => {
        logger.info('SERVER', `Stickman Studio Local Service running at http://${HOST}:${PORT}`);
        logger.info('SERVER', `REST API available at http://${HOST}:${PORT}/api/v1/`);
        resolve(server);
      });
    });
  } catch (err) {
    logger.error('SERVER', 'Fatal error starting server', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
