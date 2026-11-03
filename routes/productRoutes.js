const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');
const verifyAdmin = require('../helpers/verifyAdmin');
const { uploadMultiple } = require('../helpers/uploadHelper');

// CREATE
router.post('/', verifyAdmin, ProductController.createProduct);
router.post('/:id/images', verifyAdmin, uploadMultiple('images', 10), ProductController.uploadImages);

// READ (Listar todos e buscar um específico)
router.get('/', ProductController.getAllProducts);
router.get('/:id', ProductController.getProductById); // O :id vira uma variável

// UPDATE
router.put('/:id', verifyAdmin, ProductController.updateProduct);

// DELETE
router.delete('/:id', verifyAdmin, ProductController.deleteProduct);
router.delete('/:id/images/:imageId', verifyAdmin, ProductController.deleteImage);

// Rota de Importação
router.post('/import', verifyAdmin, ProductController.importCSV);

module.exports = router;