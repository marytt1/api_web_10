const express = require('express');
const router = express.Router();
const CartController = require('../controllers/cartcontroller');

router.post('/quote', CartController.quote);

module.exports = router;