const express = require('express');
const router = express.Router();
const VariantController = require('../controllers/variantController');
const verifyAdmin = require('../helpers/verifyAdmin');

// READ (público: a loja precisa mostrar tamanhos, cores e estoque)
router.get('/', VariantController.getAllVariants);
router.get('/:id', VariantController.getVariantById);

// CREATE / UPDATE / DELETE (somente admin)
router.post('/', verifyAdmin, VariantController.createVariant);
router.put('/:id', verifyAdmin, VariantController.updateVariant);
router.delete('/:id', verifyAdmin, VariantController.deleteVariant);

module.exports = router;