const { DataTypes } = require('sequelize');
const db = require('../db/conn');
const User = require('./Users');
const Product = require('./Product');

const Favorite = db.define('Favorite', {});

// Relacionamentos: Um favorito pertence a um Usuário e a um Produto
Favorite.belongsTo(User, { onDelete: 'CASCADE' });
User.hasMany(Favorite);

Favorite.belongsTo(Product, { onDelete: 'CASCADE' });
Product.hasMany(Favorite);

module.exports = Favorite;