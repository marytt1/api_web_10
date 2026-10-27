const { Op } = require('sequelize');
const db = require('../db/conn');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Variant = require('../models/Variant');
const Product = require('../models/Product');
const { orderCode, money } = require('../helpers/orderHelper');

class BusinessError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

module.exports = class CheckoutController {

    static async createOrder(req, res) {
        const { items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(422).json({ message: 'O pedido precisa ter pelo menos um item.' });
        }

        // Valida cada item e junta variações repetidas
        const wanted = new Map(); 
        for (const item of items) {
            const variantId = Number(item.variantId);
            const quantity = Number(item.quantity);

            if (!Number.isInteger(variantId) || variantId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
                return res.status(422).json({
                    message: 'Cada item precisa de variantId e quantity (número inteiro maior que zero).'
                });
            }
            wanted.set(variantId, (wanted.get(variantId) || 0) + quantity);
        }

        try {
            const order = await db.transaction(async (t) => {
                const variants = await Variant.findAll({
                    where: { id: { [Op.in]: [...wanted.keys()] } },
                    include: [{ model: Product }],
                    transaction: t
                });

                if (variants.length !== wanted.size) {
                    throw new BusinessError(404, 'Um ou mais itens não existem.');
                }

                let total = 0;
                const rows = [];

                for (const variant of variants) {
                    const quantity = wanted.get(variant.id);

                    // Checagem preliminar. O estoque só é baixado quando o admin confirma o pagamento
                    if (variant.stock < quantity) {
                        throw new BusinessError(
                            409,
                            `Estoque insuficiente para ${variant.Product.name} (${variant.color} / ${variant.size}). Disponível: ${variant.stock}.`
                        );
                    }

                    // O preço vem do banco, nunca do cliente
                    const price = variant.Product.price;
                    total += price * quantity;
                    rows.push({ VariantId: variant.id, quantity, price });
                }

                const newOrder = await Order.create(
                    { total: money(total), status: 'Aguardando', UserId: req.user.id },
                    { transaction: t }
                );

                await OrderItem.bulkCreate(
                    rows.map((row) => ({ ...row, OrderId: newOrder.id })),
                    { transaction: t }
                );

                return newOrder;
            });

            res.status(201).json({
                message: 'Pedido criado com sucesso!',
                order: { id: order.id, code: orderCode(order.id), total: money(order.total), status: order.status }
            });
        } catch (error) {
            if (error instanceof BusinessError) {
                return res.status(error.code).json({ message: error.message });
            }
            console.error('CheckoutController.createOrder:', error.message);
            res.status(500).json({ message: 'Erro ao criar o pedido.' });
        }
    }
};