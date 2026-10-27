const { DataTypes } = require('sequelize');
const db = require('../db/conn');
const User = require('./Users');

const Order = db.define('Order', {
    total: {
        type: DataTypes.FLOAT, // Valor total do pedido
        allowNull: false,
    },
    status: {
    type: DataTypes.ENUM('Aguardando', 'Confirmado', 'Enviado', 'Entregue', 'Cancelado'),
    defaultValue: 'Aguardando',
    },
    paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
});

// Relacionamento: Um Pedido pertence a um Usuário
Order.belongsTo(User);
User.hasMany(Order);

module.exports = Order;