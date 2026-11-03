const { DataTypes } = require('sequelize');
const db = require('../db/conn');
const Product = require('./Product');

const ProductImage = db.define('ProductImage', {
  url: {
    type: DataTypes.STRING, // ex.: /uploads/123-abc.jpg
    allowNull: false,
  },
  color: {
    type: DataTypes.STRING, // nome da cor (igual ao da variação). null = foto geral
    allowNull: true,
  },
  position: {
    type: DataTypes.INTEGER, // ordem na galeria (a primeira é a capa)
    allowNull: false,
    defaultValue: 0,
  },
});

// Uma foto pertence a um produto; apagar o produto apaga as fotos
ProductImage.belongsTo(Product, { onDelete: 'CASCADE' });
Product.hasMany(ProductImage);

module.exports = ProductImage;