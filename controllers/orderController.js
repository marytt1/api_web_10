const { Op } = require('sequelize');
const db = require('../db/conn');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Variant = require('../models/Variant');
const User = require('../models/Users');
const nodemailer = require('nodemailer');
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

    static async confirmPayment(req, res) {
        const rawId = req.params.id;
        const id = Number(rawId.replace(/\D/g, '')) || rawId;

        try {
            let confirmedOrder;

            await db.transaction(async (t) => {
                // Trava o pedido e inclui o User para sabermos quem é o cliente
                const order = await Order.findByPk(id, { 
                    include: [{ model: User }],
                    transaction: t, 
                    lock: t.LOCK.UPDATE 
                });

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
                confirmedOrder = order; 
            });

            // disparo de e-mail de confirmação para o cliente
            if (confirmedOrder && confirmedOrder.User && confirmedOrder.User.email) {
                try {
                    const transporter = nodemailer.createTransport({
                        host: process.env.EMAIL_HOST,
                        port: process.env.EMAIL_PORT,
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS
                        }
                    });

                    const mailOptions = {
                        to: confirmedOrder.User.email,
                        from: 'suporte@larose.com',
                        subject: `Pedido Confirmado! - La Rose #${confirmedOrder.id}`,
                        text: `Olá ${confirmedOrder.User.name},\n\nO pagamento do seu pedido foi confirmado com sucesso! 💖\n\nValor Total: R$ ${confirmedOrder.total}\n\nObrigada por escolher a La Rose!`
                    };

                    await transporter.sendMail(mailOptions);
                } catch (emailError) {
                    console.error('Erro ao enviar e-mail de confirmação:', emailError.message);
                }
            }

            res.status(200).json({ message: 'Pagamento confirmado, estoque atualizado e e-mail enviado!' });
        } catch (error) {
            if (error instanceof BusinessError) {
                return res.status(error.code).json({ message: error.message });
            }
            console.error('OrderController.confirmPayment:', error.message);
            res.status(500).json({ message: 'Erro ao confirmar pagamento.' });
        }
    }

    static async updateStatus(req, res) {
        // Limpa o ID também aqui
        const rawId = req.params.id;
        const id = Number(rawId.replace(/\D/g, '')) || rawId;
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
    static async deleteOrder(req, res) {
        const rawId = req.params.id;
        const id = Number(rawId.replace(/\D/g, '')) || rawId;

        try {
            await db.transaction(async (t) => {
                const order = await Order.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
                if (!order) {
                    throw new BusinessError(404, 'Pedido não encontrado!');
                }

                // Apaga primeiro os itens associados para respeitar as chaves estrangeiras
                await OrderItem.destroy({ where: { OrderId: order.id }, transaction: t });

                // Depois apaga o pedido
                await order.destroy({ transaction: t });
            });

            res.status(200).json({ message: 'Pedido excluído com sucesso!' });
        } catch (error) {
            if (error instanceof BusinessError) {
                return res.status(error.code).json({ message: error.message });
            }
            console.error('OrderController.deleteOrder:', error.message);
            res.status(500).json({ message: 'Erro ao excluir o pedido.' });
        }
    }
};