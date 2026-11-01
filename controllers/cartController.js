const { Op } = require('sequelize');
const Variant = require('../models/Variant');
const Product = require('../models/Product');
const { money } = require('../helpers/orderHelper');
const { normalizeItems } = require('../helpers/cartHelper');

module.exports = class CartController {

    static async quote(req, res) {
        const { wanted, error } = normalizeItems((req.body || {}).items);

        if (error) {
            return res.status(422).json({ message: error });
        }

        try {
            const variants = await Variant.findAll({
                where: { id: { [Op.in]: [...wanted.keys()] } },
                include: [{ model: Product, attributes: ['id', 'name', 'price', 'image_url'] }]
            });

            const byId = new Map(variants.map((v) => [v.id, v]));

            let subtotal = 0;
            const items = [];

            for (const [variantId, requested] of wanted) {
                const variant = byId.get(variantId);

                if (!variant || !variant.Product) {
                    items.push({ variantId, status: 'not_found', requestedQuantity: requested, quantity: 0 });
                    continue;
                }

                // Nunca passa do estoque disponível
                const quantity = Math.min(requested, variant.stock);
                const status =
                    variant.stock === 0 ? 'out_of_stock' :
                    quantity < requested ? 'quantity_adjusted' : 'ok';

                const price = money(variant.Product.price);
                const lineTotal = money(price * quantity);
                subtotal += lineTotal;

                items.push({
                    variantId,
                    productId: variant.Product.id,
                    name: variant.Product.name,
                    imageUrl: variant.Product.image_url,
                    sku: variant.sku,
                    color: variant.color,
                    size: variant.size,
                    price,
                    requestedQuantity: requested,
                    quantity,
                    available: variant.stock,
                    lineTotal,
                    status
                });
            }

            res.status(200).json({
                items,
                subtotal: money(subtotal),
                canCheckout: items.every((item) => item.status === 'ok')
            });
        } catch (err) {
            console.error('CartController.quote:', err.message);
            res.status(500).json({ message: 'Erro ao calcular o carrinho.' });
        }
    }
};