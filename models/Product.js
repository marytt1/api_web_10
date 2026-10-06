const { DataTypes } = require('sequelize');
const db = require('../db/conn');

const Product = db.define('Product', {
    name: {
        type: DataTypes.STRING, // Nome do produto
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT, // Descrição detalhada do produto
        allowNull: true,
    },
    price: {
        type: DataTypes.FLOAT, // Preço do produto
        allowNull: false,
    },
    category: {
        type: DataTypes.STRING, // Categoria do produto, ex: Camisetas, Calças, Acessórios
        allowNull: false,
    },
    stock: {
        type: DataTypes.INTEGER, // Quantidade total em estoque do produto
        allowNull: false,
        defaultValue: 0,
    },
    image_url: {
        type: DataTypes.STRING,
        allowNull: true, // true para permitir produtos sem foto no início
    },
});

module.exports = Product;