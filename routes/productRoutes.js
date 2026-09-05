const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');

// Rota POST para disparar a importação do arquivo
router.post('/import', ProductController.importCSV);

module.exports = router;