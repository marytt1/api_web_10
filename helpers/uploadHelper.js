const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${EXTENSIONS[file.mimetype]}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB por foto
  fileFilter: (req, file, cb) => {
    if (!EXTENSIONS[file.mimetype]) return cb(new Error('INVALID_TYPE'));
    cb(null, true);
  },
});

function handle(middleware, maxFiles) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(422).json({ message: 'Cada imagem deve ter no máximo 3 MB.' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(422).json({ message: `Envie no máximo ${maxFiles} fotos por vez.` });
      }
      if (err.message === 'INVALID_TYPE') {
        return res.status(422).json({ message: 'Envie imagens JPG, PNG ou WEBP.' });
      }
      console.error('upload:', err.message);
      return res.status(500).json({ message: 'Erro ao enviar a imagem.' });
    });
  };
}

const uploadSingle = (field) => handle(upload.single(field), 1);
const uploadMultiple = (field, max = 10) => handle(upload.array(field, max), max);

// Apaga do disco uma imagem enviada por upload
function removeLocalImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
  fs.unlink(path.join(UPLOAD_DIR, path.basename(imageUrl)), () => {});
}

module.exports = { uploadSingle, uploadMultiple, removeLocalImage };