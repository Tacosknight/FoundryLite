const express = require('express');
const upload = require('../config/multer');

const router = express.Router();

/**
 * Route POST /api/upload
 * Permet l'upload d'un fichier image (maps, avatars, tokens)
 */
router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      // Gestion des erreurs spécifiques à Multer (taille, filtre)
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucun fichier transmis dans le champ "file".'
      });
    }

    // URL accessible publiquement via le dossier statique /uploads
    const fileUrl = `/uploads/${req.file.filename}`;

    return res.status(201).json({
      success: true,
      message: 'Fichier uploadé avec succès.',
      url: fileUrl,
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        url: fileUrl
      }
    });
  });
});

module.exports = router;
