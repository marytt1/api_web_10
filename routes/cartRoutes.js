const express = require('express');
const router = express.Router();
const CartController = require('../controllers/cartcontroller');

// Público: visitantes também montam carrinho
router.post('/quote', CartController.quote);

module.exports = router;