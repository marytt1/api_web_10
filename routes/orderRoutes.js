const express = require('express');
const router = express.Router();
const CheckoutController = require('../controllers/checkoutController');
const verifyToken = require('../helpers/verifyToken');

// Somente cliente logado cria pedido (pedido + itens na mesma transação)
router.post('/', verifyToken, CheckoutController.createOrder);

module.exports = router;