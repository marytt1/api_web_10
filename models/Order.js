const { DataTypes } = require('sequelize');
const db = require('../db/conn');
const User = require('./Users');

const Order = db.define('Order', {
    total: {
        type: DataTypes.FLOAT, // Valor total do pedido
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING, // Status do pedido 
        defaultValue: 'Pendente',
    },
});

// Relacionamento: Um Pedido pertence a um Usuário
Order.belongsTo(User);
User.hasMany(Order);

module.exports = Order;