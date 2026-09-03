const { DataTypes } = require('sequelize');
const db = require('../db/conn');
const Product = require('./Product');

const Variant = db.define('Variant', {
    sku: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // Código único do produto por variação
    },
    size: {
        type: DataTypes.STRING, // tamanho da peça, ex: P, M, G, GG
        allowNull: false,
    },
    color: {
        type: DataTypes.STRING, // cor da peça, ex: Azul, Preto, Branco
        allowNull: false,
    },
    stock: {
        type: DataTypes.INTEGER, // quantidade em estoque para essa variação específica
        allowNull: false,
        defaultValue: 0,
    },
});

// Relacionamento: Uma Variação pertence a um Produto
Variant.belongsTo(Product, { onDelete: 'CASCADE' });
Product.hasMany(Variant);

module.exports = Variant;