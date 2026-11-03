const db = require('../db/conn');
const Variant = require('../models/Variant');
const Product = require('../models/Product');

module.exports = class VariantController {
    
    // Criar nova variação de produto
    static async createVariant(req, res) {
        const { sku, size, color, stock, ProductId } = req.body;

        // validação de campos obrigatórios e regras de negócio
        if (!sku || !size || !color || stock === undefined || !ProductId) {
            return res.status(422).json({ message: 'SKU, tamanho, cor, estoque e ID do Produto são obrigatórios!' });
        }

        if (stock < 0) {
            return res.status(422).json({ message: 'O estoque da variação não pode ser negativo!' });
        }

        try {
            // Verifica se o produto principal existe antes de criar a variação
            const product = await Product.findByPk(ProductId);
            if (!product) {
                return res.status(404).json({ message: 'Produto principal não encontrado!' });
            }

            const variant = await Variant.create({ sku, size, color, stock, ProductId });
            res.status(201).json({ message: 'Variação cadastrada com sucesso!', variant });
        } catch (error) {
            // SKU é único: o banco recusa repetido
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({ message: 'Já existe uma variação com esse SKU.' });
            }
            res.status(500).json({ message: 'Erro ao criar variação', error: error.message });
        }
    }

    // Listar todas as variações
    static async getAllVariants(req, res) {
        try {
            const variants = await Variant.findAll({ include: Product });
            res.status(200).json({ variants });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao buscar variações', error: error.message });
        }
    }

    // Buscar variação específica
    static async getVariantById(req, res) {
        const { id } = req.params;
        try {
            const variant = await Variant.findByPk(id, { include: Product });
            if (!variant) {
                return res.status(404).json({ message: 'Variação não encontrada!' });
            }
            res.status(200).json({ variant });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao buscar variação', error: error.message });
        }
    }

    // Atualizar estoque ou detalhes da variação
    static async updateVariant(req, res) {
        const { id } = req.params;
        const { sku, size, color, stock } = req.body;

        if (stock !== undefined && stock < 0) {
            return res.status(422).json({ message: 'O estoque não pode ser negativo!' });
        }

        try {
            const variant = await Variant.findByPk(id);
            if (!variant) {
                return res.status(404).json({ message: 'Variação não encontrada!' });
            }

            await Variant.update(
                { sku, size, color, stock },
                { where: { id: id } }
            );

            res.status(200).json({ message: 'Variação atualizada com sucesso!' });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao atualizar variação', error: error.message });
        }
    }

    // Apagar uma variação.
    // Se ela era a ÚLTIMA do produto, o produto também é apagado (tudo na mesma transação:
    // ou apaga os dois, ou não apaga nenhum).
    static async deleteVariant(req, res) {
        const { id } = req.params;
        try {
            const variant = await Variant.findByPk(id);
            if (!variant) {
                return res.status(404).json({ message: 'Variação não encontrada!' });
            }

            const productId = variant.ProductId;
            let productDeleted = false;

            await db.transaction(async (t) => {
                await variant.destroy({ transaction: t });

                const remaining = await Variant.count({ where: { ProductId: productId }, transaction: t });
                if (remaining === 0) {
                    await Product.destroy({ where: { id: productId }, transaction: t });
                    productDeleted = true;
                }
            });

            res.status(200).json({
                message: productDeleted
                    ? 'Variação apagada. Era a última do produto, então o produto também foi removido.'
                    : 'Variação apagada com sucesso!',
                productDeleted
            });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao deletar variação', error: error.message });
        }
    }
};