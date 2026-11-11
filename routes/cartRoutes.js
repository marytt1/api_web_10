const express = require('express');
const router = express.Router();
const CartController = require('../controllers/cartController');

router.post('/quote', CartController.quote);

module.exports = router;