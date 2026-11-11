'use strict';
const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { RoomManager } = require('./state/RoomManager');
const { RoomService } = require('./services/roomService');
const { SessionService } = require('./services/sessionService');
const { AssetService } = require('./services/assetService');
const { createUploadRouter } = require('./routes/uploadRoutes');
const { createCampaignTools } = require('./services/campaignTools');
const { drainCommands } = require('./security/authorization');
const initSocketServer = require('./sockets');

async function createServer({ dataDirectory, allowedOrigins = ['http://localhost:3000'], secureCookies = false, debounceDelay = 1000 } = {}) {
  if (!dataDirectory) throw new Error('An explicit dataDirectory is required');
  const directory = path.resolve(dataDirectory);
  const roomManager = new RoomManager(path.join(directory, 'rooms.json'), debounceDelay);
  const roomService = new RoomService(roomManager);
  const sessions = new SessionService(path.join(directory, 'identities.json'), { secure: secureCookies });
  await Promise.all([roomManager.init(), sessions.init()]);
  const assetService = new AssetService({ directory: path.join(directory, 'assets'), roomManager, roomService });
  await assetService.init();
  const tools = createCampaignTools(roomManager);
  const services = { roomManager, roomService, sessions, assetService, tools };
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) return res.status(403).json({ success: false, error: 'Origine refusée.' });
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ success: false, error: 'Requête intersite refusée.' });
    next();
  });
  app.use(express.json({ limit: '6mb' }));
  const attempts = new Map();
  app.use('/api/session', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method === 'GET') return next();
    const key = req.socket.remoteAddress;
    const now = Date.now();
    const bucket = attempts.get(key);
    if (!bucket || now - bucket.time > 60000) attempts.set(key, { time: now, count: 1 });
    else if (++bucket.count > 20) return res.status(429).json({ success: false, error: 'Trop de tentatives. Réessayez dans une minute.' });
    next();
  });
  app.get('/api/session', (req, res) => res.json({ success: true, authenticated: Boolean(sessions.fromRequest(req)) }));
  app.post('/api/session', async (req, res, next) => {
    try {
      if (sessions.fromRequest(req)) return res.json({ success: true });
      const identity = await sessions.create();
      res.set('Set-Cookie', sessions.cookie(identity.token));
      res.json({ success: true, recoveryCode: identity.recoveryCode });
    } catch (error) { next(error); }
  });
  app.post('/api/session/recover', async (req, res, next) => {
    try {
      const identity = await sessions.recover(req.body?.code);
      res.set('Set-Cookie', sessions.cookie(identity.token));
      res.json({ success: true, recoveryCode: identity.recoveryCode });
    } catch (error) { error.status = 400; next(error); }
  });
  app.post('/api/session/logout', async (req, res, next) => {
    try {
      await sessions.revoke(sessions.tokenFromRequest(req));
      res.set('Set-Cookie', 'vtt_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
      res.json({ success: true });
    } catch (error) { next(error); }
  });
  app.use('/api', createUploadRouter(services));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/uploads', (_req, res) => res.status(404).end());
  app.use(express.static(path.join(__dirname, '../public')));
  app.use((error, _req, res, _next) => {
    console.error('[HTTP]', error.message);
    res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Erreur interne du serveur.' });
  });
  const server = http.createServer(app);
  const io = initSocketServer(server, services, { allowedOrigins });
  let closing;
  function close() {
    if (!closing) closing = (async () => {
      services.closing = true;
      for (const socket of io.sockets.sockets.values()) socket.disconnect(true);
      await new Promise(resolve => io.close(resolve));
      await drainCommands(services);
      clearTimeout(roomManager.debounceTimer);
      await assetService.queue.catch(() => {});
      await roomManager.flush();
      await sessions.flush();
    })();
    return closing;
  }
  return { app, server, io, services, close };
}
module.exports = { createServer };
