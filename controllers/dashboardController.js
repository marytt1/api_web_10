const { Op } = require('sequelize');
const Order = require('../models/Order');
const Variant = require('../models/Variant');
const { ORDER_INCLUDE, formatOrder, money } = require('../helpers/orderHelper');

// "Alertas de Estoque": variações com este número de unidades ou menos
const LOW_STOCK_LIMIT = 3;

module.exports = class DashboardController {

    // GET /admin/dashboard
    static async overview(req, res) {
        try {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);

            const soldToday = { paidAt: { [Op.between]: [start, end] } };

            const [salesTotal, salesCount, pendingOrders, stockAlerts, latestOrders] = await Promise.all([
                Order.sum('total', { where: soldToday }),
                Order.count({ where: soldToday }),
                Order.count({ where: { status: 'Aguardando' } }),
                Variant.count({ where: { stock: { [Op.lte]: LOW_STOCK_LIMIT } } }),
                Order.findAll({
                    include: ORDER_INCLUDE,
                    order: [['createdAt', 'DESC']],
                    limit: 5
                })
            ]);

            res.status(200).json({
                salesToday: { total: money(salesTotal), orders: salesCount },
                pendingOrders,
                stockAlerts: { count: stockAlerts, limit: LOW_STOCK_LIMIT },
                latestOrders: latestOrders.map(formatOrder)
            });
        } catch (error) {
            console.error('DashboardController.overview:', error.message);
            res.status(500).json({ message: 'Erro ao carregar o dashboard.' });
        }
    }
};