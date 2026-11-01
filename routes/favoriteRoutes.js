const express = require('express');
const router = express.Router();
const FavoriteController = require('../controllers/favoriteController');
const verifyToken = require('../helpers/verifyToken');

// Tudo exige login: o usuário é identificado pelo token
router.post('/', verifyToken, FavoriteController.toggleFavorite);
router.get('/', verifyToken, FavoriteController.getMyFavorites);

module.exports = router;