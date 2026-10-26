const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');
const verifyAdmin = require('../helpers/verifyAdmin');

// CREATE
router.post('/', verifyAdmin, ProductController.createProduct);

// READ (Listar todos e buscar um específico)
router.get('/', ProductController.getAllProducts);
router.get('/:id', ProductController.getProductById); // O :id vira uma variável

// UPDATE
router.put('/:id', verifyAdmin, ProductController.updateProduct);

// DELETE
router.delete('/:id', verifyAdmin, ProductController.deleteProduct);

// Rota de Importação
router.post('/import', ProductController.importCSV);

module.exports = router;