// Importa o módulo DataTypes do Sequelize
const { DataTypes } = require('sequelize');
// Importa a conexão com o banco de dados
const db = require('../db/conn');

// Criação da tabela 'Users'
const User = db.define('User', {
    name: {
        type: DataTypes.STRING,
        required: true,
        allowNull: false, // Não permite que o nome fique vazio
    },
    email: {
        type: DataTypes.STRING,
        required: true,
        allowNull: false,
        unique: true, // Não permite dois usuários com o mesmo e-mail
    },
    password: {
        type: DataTypes.STRING,
        required: true,
        allowNull: false,
    },
});

module.exports = User;