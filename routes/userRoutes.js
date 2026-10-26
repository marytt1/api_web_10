const express = require('express');
// Importando o model do usuário
const router = express.Router();
// Importando o controller do usuário
const UserController = require('../controllers/userController');

// Rota POST para cadastrar (enviar dados)
router.post('/register',  UserController.register);

// Rota POST para realizar o LOGIN
router.post('/login', UserController.login);

// Rota GET para listar (buscar dados)
router.get('/', UserController.listAll);

// Rota POST para a Calculadora de Medidas
router.post('/size-guide', UserController.calculateSize);

// Rota POST para solicitar redefinição de senha
router.post('/forgot-password', UserController.forgotPassword);

// Rota POST para redefinir a senha usando o token
router.post('/reset-password/:token', UserController.resetPassword);

module.exports = router;