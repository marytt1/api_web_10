const express = require('express');
// Importando o model do usuário
const router = express.Router();
// Importando o controller do usuário
const UserController = require('../controllers/userController');
// Importando helper para verificar admin e o token
const verifyAdmin = require('../helpers/verifyAdmin');
const verifyToken = require('../helpers/verifyToken');
// Importando helper caso seja visitante
const optionalAuth = require('../helpers/optionalAuth');

// Rota POST para cadastrar (enviar dados)
router.post('/register',  UserController.register);

// Rota POST para realizar o LOGIN
router.post('/login', UserController.login);

// Rota GET para listar (buscar dados somente admin)
router.get('/', verifyAdmin, UserController.listAll);

// Rota POST para a Calculadora de Medidas
router.post('/size-guide', UserController.calculateSize);

// Rota POST para o guia de tamanhos (Provador) do visitante
router.post('/size-guide', optionalAuth, UserController.calculateSize);

// Rota POST para solicitar redefinição de senha
router.post('/forgot-password', UserController.forgotPassword);

// Rota POST para redefinir a senha usando o token
router.post('/reset-password/:token', UserController.resetPassword);

// Rota PATCH para alterar a senha do usuário logado
router.patch('/change-password', verifyToken, UserController.changePassword);

module.exports = router;