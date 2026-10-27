const express = require('express');
const router = express.Router();
const CheckoutController = require('../controllers/checkoutController');
const verifyToken = require('../helpers/verifyToken');

// Cliente logado cria um pedido
router.post('/', verifyToken, CheckoutController.createOrder);

module.exports = router;