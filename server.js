// requere o módulo express
const express = require('express');
// requere o módulo cors
const cors = require('cors');
// requere a conexão com o banco de dados
const conn = require('./db/conn'); 
// instancia o express
const api = express();

// --- Configurações (Middlewares) ---
// Permite receber informações em formato JSON
api.use(express.json());

// Permite que o site front-end se comunique com a API
api.use(cors());

// --- Rotas ---
// Rota de teste para ver se o servidor está no ar
api.get('/', (req, res) => {
    res.json({ message: 'API da Loja de Moda Fitness está no ar!' });
});

// --- Inicialização ---
const PORT = 3000;

// O 'sync' sincroniza os modelos com o banco de dados antes de ligar o servidor
conn.sync()
    .then(() => {
        api.listen(PORT, () => {
            console.log(`Servidor rodando perfeitamente na porta ${PORT}`);
        });
    })
    .catch((err) => console.log('Erro ao sincronizar o banco:', err));