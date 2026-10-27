const { Op } = require('sequelize');
const db = require('../db/conn');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Variant = require('../models/Variant');
const { ORDER_INCLUDE, formatOrder } = require('../helpers/orderHelper');

// Fluxo permitido pelo botão de status: Confirmado -> Enviado -> Entregue
const STATUS_FLOW = { Confirmado: 'Enviado', Enviado: 'Entregue' };

class BusinessError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

module.exports = class OrderController {

    // GET /admin/orders?search=&status=
    static async list(req, res) {
        const { search, status } = req.query;

        try {
            const where = {};

            if (status) {
                where.status = status;
            }

            if (search && search.trim()) {
                const term = search.trim();
                const digits = term.replace(/\D/g, '');

                const conditions = [{ '$User.name$': { [Op.like]: `%${term}%` } }];
                if (digits) {
                    conditions.push({ id: Number(digits) });
                }
                where[Op.or] = conditions;
            }

            const orders = await Order.findAll({
                where,
                include: ORDER_INCLUDE,
                order: [['createdAt', 'DESC']]
            });

            res.status(200).json({ orders: orders.map(formatOrder) });
        } catch (error) {
            console.error('OrderController.list:', error.message);
            res.status(500).json({ message: 'Erro ao buscar pedidos.' });
        }
    }

    // PATCH /admin/orders/:id/confirm-payment
    static async confirmPayment(req, res) {
        const { id } = req.params;

        try {
            await db.transaction(async (t) => {
                // Trava o pedido: dois cliques simultâneos não baixam o estoque duas vezes
                const order = await Order.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });

                if (!order) {
                    throw new BusinessError(404, 'Pedido não encontrado!');
                }
                if (order.status !== 'Aguardando') {
                    throw new BusinessError(409, `Este pedido está "${order.status}" e não pode ter o pagamento confirmado.`);
                }

                const items = await OrderItem.findAll({ where: { OrderId: order.id }, transaction: t });

                if (items.length === 0) {
                    throw new BusinessError(409, 'Este pedido não tem itens.');
                }

                for (const item of items) {
                    const variant = await Variant.findByPk(item.VariantId, { transaction: t, lock: t.LOCK.UPDATE });

                    if (!variant) {
                        throw new BusinessError(409, 'Um dos itens do pedido não existe mais no estoque.');
                    }
                    if (variant.stock < item.quantity) {
                        throw new BusinessError(
                            409,
                            `Estoque insuficiente para ${variant.sku} (disponível: ${variant.stock}, no pedido: ${item.quantity}).`
                        );
                    }

                    await variant.update({ stock: variant.stock - item.quantity }, { transaction: t });
                }

                await order.update({ status: 'Confirmado', paidAt: new Date() }, { transaction: t });
            });

            res.status(200).json({ message: 'Pagamento confirmado e estoque atualizado!' });
        } catch (error) {
            if (error instanceof BusinessError) {
                return res.status(error.code).json({ message: error.message });
            }
            console.error('OrderController.confirmPayment:', error.message);
            res.status(500).json({ message: 'Erro ao confirmar pagamento.' });
        }
    }

    // PATCH /admin/orders/:id/status
    static async updateStatus(req, res) {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(422).json({ message: 'Informe o novo status.' });
        }

        try {
            const order = await Order.findByPk(id);
            if (!order) {
                return res.status(404).json({ message: 'Pedido não encontrado!' });
            }

            if (STATUS_FLOW[order.status] !== status) {
                return res.status(409).json({
                    message: `Não é possível mudar o pedido de "${order.status}" para "${status}".`
                });
            }

            await order.update({ status });
            res.status(200).json({ message: `Pedido atualizado para "${status}".` });
        } catch (error) {
            console.error('OrderController.updateStatus:', error.message);
            res.status(500).json({ message: 'Erro ao atualizar o status.' });
        }
    }
};