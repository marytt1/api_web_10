const express = require('express');
// Importando o model do usuário
const router = express.Router();
// Importando o controller do usuário
const UserController = require('../controllers/userController');
// Importando a função de validação do usuário
const { userValidate } = require('../helpers/userValidator');

// Rota POST para cadastrar (enviar dados)
router.post('/register', userValidate, UserController.register);

// Rota GET para listar (buscar dados)
router.get('/', UserController.listAll);

// Rota POST para a Calculadora de Medidas
router.post('/size-guide', UserController.calculateSize);

module.exports = router;