const { Op } = require('sequelize');
const db = require('../db/conn');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Variant = require('../models/Variant');
const Product = require('../models/Product');
const User = require('../models/Users');
const { orderCode, money } = require('../helpers/orderHelper');
const { normalizeItems } = require('../helpers/cartHelper');

class BusinessError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const brl = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// Link do WhatsApp da LOJA com o resumo do pedido
function buildWhatsapp(order, lines, customerName) {
    const storeNumber = String(process.env.STORE_WHATSAPP || '').replace(/\D/g, '');
    if (!storeNumber) return null;

    const message = [
        `Olá! Gostaria de finalizar o pedido ${orderCode(order.id)}:`,
        '',
        ...lines,
        '',
        `Total: ${brl(order.total)}`,
        `Nome: ${customerName}`
    ].join('\n');

    return { url: `https://wa.me/${storeNumber}?text=${encodeURIComponent(message)}`, message };
}

module.exports = class CheckoutController {

    // Nome e e-mail do cliente vêm da conta dele, nada é digitado de novo.
    static async createOrder(req, res) {
        const { wanted, error } = normalizeItems((req.body || {}).items);

        if (error) {
            return res.status(422).json({ message: error });
        }

        try {
            const user = await User.findByPk(req.user.id, { attributes: ['id', 'name'] });
            if (!user) {
                return res.status(401).json({ message: 'Usuário não encontrado. Faça login novamente.' });
            }

            const { order, lines } = await db.transaction(async (t) => {
                const variants = await Variant.findAll({
                    where: { id: { [Op.in]: [...wanted.keys()] } },
                    include: [{ model: Product }],
                    transaction: t
                });

                if (variants.length !== wanted.size) {
                    throw new BusinessError(404, 'Um ou mais itens não existem mais. Atualize o carrinho.');
                }

                let total = 0;
                const rows = [];
                const lines = [];

                for (const variant of variants) {
                    const quantity = wanted.get(variant.id);

                    // O estoque só é baixado quando o admin confirma o pagamento,
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
                    lines.push(`${quantity}x ${variant.Product.name} (${variant.color} / ${variant.size}) - ${brl(price * quantity)}`);
                }

                const newOrder = await Order.create(
                    { total: money(total), status: 'Aguardando', UserId: user.id },
                    { transaction: t }
                );

                await OrderItem.bulkCreate(
                    rows.map((row) => ({ ...row, OrderId: newOrder.id })),
                    { transaction: t }
                );

                return { order: newOrder, lines };
            });

            res.status(201).json({
                message: 'Pedido criado com sucesso!',
                order: { id: order.id, code: orderCode(order.id), total: money(order.total), status: order.status },
                whatsapp: buildWhatsapp(order, lines, user.name)
            });
        } catch (err) {
            if (err instanceof BusinessError) {
                return res.status(err.code).json({ message: err.message });
            }
            console.error('CheckoutController.createOrder:', err.message);
            res.status(500).json({ message: 'Erro ao criar o pedido.' });
        }
    }
};