'use strict';

const multer = require('multer');

// No disk access occurs until the asset service has validated the image.
function createUpload(maxBytes = 10 * 1024 * 1024) {
  return multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1, fields: 0, parts: 1 } });
}

module.exports = { createUpload };
