const { Op } = require('sequelize');
const Variant = require('../models/Variant');
const Product = require('../models/Product');
const { money } = require('../helpers/orderHelper');

const LOW_STOCK_LIMIT = 3;

module.exports = class StockController {

    // GET /admin/stock?search=
    static async list(req, res) {
        const { search } = req.query;

        try {
            const where = {};

            if (search && search.trim()) {
                const term = `%${search.trim()}%`;
                where[Op.or] = [
                    { sku: { [Op.like]: term } },
                    { color: { [Op.like]: term } },
                    { '$Product.name$': { [Op.like]: term } },
                    { '$Product.category$': { [Op.like]: term } }
                ];
            }

            const variants = await Variant.findAll({
                where,
                include: [{ model: Product, attributes: ['id', 'name', 'category', 'price'] }],
                order: [['sku', 'ASC']]
            });

            const items = variants.map((v) => ({
                id: v.id,
                sku: v.sku,
                productId: v.Product ? v.Product.id : null,
                product: v.Product ? v.Product.name : null,
                variation: `${v.color} / ${v.size}`,
                category: v.Product ? v.Product.category : null,
                price: v.Product ? money(v.Product.price) : null,
                stock: v.stock,
                soldOut: v.stock === 0,
                lowStock: v.stock > 0 && v.stock <= LOW_STOCK_LIMIT
            }));

            res.status(200).json({ items });
        } catch (error) {
            console.error('StockController.list:', error.message);
            res.status(500).json({ message: 'Erro ao buscar o estoque.' });
        }
    }

    // PATCH /admin/variants/:id/stock
    static async updateStock(req, res) {
        const { id } = req.params;
        const stock = Number(req.body.stock);

        if (!Number.isInteger(stock) || stock < 0) {
            return res.status(422).json({ message: 'O estoque deve ser um número inteiro maior ou igual a zero.' });
        }

        try {
            const variant = await Variant.findByPk(id);
            if (!variant) {
                return res.status(404).json({ message: 'Variação não encontrada!' });
            }

            await variant.update({ stock });
            res.status(200).json({ message: 'Estoque atualizado!', id: variant.id, stock: variant.stock });
        } catch (error) {
            console.error('StockController.updateStock:', error.message);
            res.status(500).json({ message: 'Erro ao atualizar o estoque.' });
        }
    }
};