const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');

// CREATE
router.post('/', ProductController.createProduct);

// READ (Listar todos e buscar um específico)
router.get('/', ProductController.getAllProducts);
router.get('/:id', ProductController.getProductById); // O :id vira uma variável (req.params.id)

// UPDATE
router.put('/:id', ProductController.updateProduct);

// DELETE
router.delete('/:id', ProductController.deleteProduct);

// Rota de Importação
router.post('/import', ProductController.importCSV);

module.exports = router;