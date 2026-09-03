const { Sequelize } = require('sequelize');
require('dotenv').config();

// Cria a conexão puxando os dados do .env de forma segura
const conn = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        port: process.env.DB_PORT,
    }
);

// Teste para verificar se a conexão deu certo
try {
    conn.authenticate();
    console.log('Conectado ao MySQL com sucesso!');
} catch (error) {
    console.error('Não foi possível conectar ao banco:', error);
}

module.exports = conn;