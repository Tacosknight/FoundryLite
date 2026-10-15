const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Chemin absolu vers le dossier d'uploads statique
const uploadDir = path.join(__dirname, '../../public/uploads');

// Assure la création du dossier d'upload s'il n'existe pas
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuration du stockage disque
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const detectedExt = path.extname(file.originalname).toLowerCase();
    const ext = detectedExt || (file.mimetype === 'image/webp' ? '.webp' : '.png');
    cb(null, `asset-${uniqueSuffix}${ext}`);
  }
});

// Filtre pour n'accepter que les images
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format de fichier non supporté. Seules les images (JPEG, PNG, WEBP, GIF, SVG) sont autorisées.'), false);
  }
};

// Instance Multer configurée (limite à 10 Mo par fichier)
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 Mo
  }
});

module.exports = upload;
