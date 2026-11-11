'use strict';

const express = require('express');
const { createUpload } = require('../config/multer');

function createUploadRouter({ roomManager, roomService, sessions, assetService }) {
  if (!roomManager || !roomService || !sessions || !assetService) throw new Error('Services requis');
  const router = express.Router();
  const upload = createUpload(assetService.maxBytes).single('file');
  const headers = (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  };
  function authenticate(req, res, next) {
    const identityId = sessions.fromRequest(req);
    if (!identityId) return res.status(401).json({ success: false, error: 'Authentification requise' });
    const roomId = req.query.roomId;
    if (typeof roomId !== 'string' || !roomId || !roomManager.rooms.has(roomId) || !roomService.membership(roomId, identityId)) return res.status(403).json({ success: false, error: 'Accès refusé' });
    req.assetIdentityId = identityId;
    req.assetRoomId = roomId;
    next();
  }
  function respondError(res, error) {
    const status = error.status || (error.code === 'LIMIT_FILE_SIZE' ? 413 : error.code?.startsWith('LIMIT_') ? 400 : 500);
    res.status(status).json({ success: false, error: status === 500 ? 'Erreur serveur' : error.message });
  }
  router.post('/upload', headers, authenticate, (req, res) => {
    upload(req, res, async error => {
      if (error) return respondError(res, error);
      if (!req.file) return res.status(400).json({ success: false, error: 'Fichier manquant' });
      try { res.status(201).json({ success: true, ...await assetService.upload(req.assetRoomId, req.assetIdentityId, req.file) }); }
      catch (err) { respondError(res, err); }
    });
  });
  router.get('/assets/:id', headers, authenticate, async (req, res) => {
    try {
      const data = await assetService.get(req.assetRoomId, req.assetIdentityId, req.params.id);
      res.type('image/webp').send(data);
    } catch (err) { respondError(res, err); }
  });
  return router;
}
module.exports = { createUploadRouter };
