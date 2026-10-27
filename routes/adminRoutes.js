const express = require('express');
const router = express.Router();

const verifyAdmin = require('../helpers/verifyAdmin');
const DashboardController = require('../controllers/dashboardController');
const OrderController = require('../controllers/orderController');
const StockController = require('../controllers/stockController');

// Só é acessível por administradores
router.use(verifyAdmin);

// Dashboard (Visão Geral)
router.get('/dashboard', DashboardController.overview);

// Vendas e Pedidos
router.get('/orders', OrderController.list);
router.patch('/orders/:id/confirm-payment', OrderController.confirmPayment);
router.patch('/orders/:id/status', OrderController.updateStatus);

// Estoque
router.get('/stock', StockController.list);
router.patch('/variants/:id/stock', StockController.updateStock);


module.exports = router;