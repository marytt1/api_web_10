const { DataTypes } = require('sequelize');
const db = require('../db/conn');
const Order = require('./Order');
const Variant = require('./Variant');

const OrderItem = db.define('OrderItem', {
    quantity: {
        type: DataTypes.INTEGER, // quantidade de itens do mesmo produto no pedido
        allowNull: false,
        defaultValue: 1,
    },
    price: {
        type: DataTypes.FLOAT, // Preço unitário no momento da compra
        allowNull: false,
    },
});

// Relacionamentos
OrderItem.belongsTo(Order, { onDelete: 'CASCADE' });
Order.hasMany(OrderItem);

OrderItem.belongsTo(Variant);
Variant.hasMany(OrderItem);

module.exports = OrderItem;