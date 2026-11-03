const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'images');
const MAX_SIZE = 3 * 1024 * 1024; // 3 MB

// Extensão escolhida pela API a partir do tipo (nunca pelo nome que o usuário enviou)
const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    // Nome aleatório: evita sobrescrever outra imagem e nomes com espaço ou acento
    filename: (req, file, cb) =>
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${EXTENSIONS[file.mimetype]}`),
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_SIZE, files: 1 },
    fileFilter: (req, file, cb) => (EXTENSIONS[file.mimetype] ? cb(null, true) : cb(new Error('INVALID_TYPE'))),
}).single('image');

// O tipo enviado pelo navegador pode ser falsificado: confere os primeiros bytes do arquivo
async function hasImageSignature(filePath) {
    const handle = await fs.promises.open(filePath, 'r');
    try {
        const { buffer } = await handle.read(Buffer.alloc(12), 0, 12, 0);
        const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        const isWebp = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
        return isJpeg || isPng || isWebp;
    } finally {
        await handle.close();
    }
}

module.exports = class UploadController {

    // POST /admin/upload-image
    static uploadImage(req, res) {
        upload(req, res, async (error) => {
            if (error) {
                if (error.code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({ message: 'A imagem deve ter no máximo 3 MB.' });
                }
                if (error.message === 'INVALID_TYPE') {
                    return res.status(422).json({ message: 'Formato inválido. Envie uma imagem JPG, PNG ou WebP.' });
                }
                if (error.code === 'LIMIT_UNEXPECTED_FILE') {
                    return res.status(422).json({ message: 'Envie um único arquivo, no campo "image".' });
                }
                console.error('uploadImage:', error.message);
                return res.status(500).json({ message: 'Erro ao enviar a imagem.' });
            }

            if (!req.file) {
                return res.status(422).json({ message: 'Envie uma imagem no campo "image".' });
            }

            try {
                if (!(await hasImageSignature(req.file.path))) {
                    await fs.promises.unlink(req.file.path); // não guarda arquivo que não é imagem de verdade
                    return res.status(422).json({ message: 'O arquivo enviado não é uma imagem válida.' });
                }

                return res.status(201).json({ imageUrl: `/images/${req.file.filename}` });
            } catch (err) {
                console.error('uploadImage:', err.message);
                return res.status(500).json({ message: 'Erro ao enviar a imagem.' });
            }
        });
    }
};
