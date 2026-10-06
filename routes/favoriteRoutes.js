const express = require('express');
const router = express.Router();
const FavoriteController = require('../controllers/favoriteController');

router.post('/', FavoriteController.addFavorite);
router.get('/:userId', FavoriteController.getUserFavorites);

module.exports = router;