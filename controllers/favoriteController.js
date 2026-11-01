const Favorite = require('../models/Favorite');
const Product = require('../models/Product');
const Variant = require('../models/Variant');

module.exports = class FavoriteController {

    static async toggleFavorite(req, res) {
        const UserId = req.user.id;
        const ProductId = Number((req.body || {}).ProductId);

        if (!Number.isInteger(ProductId) || ProductId <= 0) {
            return res.status(422).json({ message: 'Informe o ProductId do produto.' });
        }

        try {
            const product = await Product.findByPk(ProductId, { attributes: ['id'] });
            if (!product) {
                return res.status(404).json({ message: 'Produto não encontrado!' });
            }

            const existing = await Favorite.findOne({ where: { UserId, ProductId } });

            if (existing) {
                await existing.destroy();
                return res.status(200).json({ message: 'Produto removido dos favoritos.', favorited: false });
            }

            await Favorite.create({ UserId, ProductId });
            return res.status(201).json({ message: 'Produto adicionado aos favoritos!', favorited: true });
        } catch (error) {
            // Dois cliques ao mesmo tempo: o índice único barra o segundo e o produto já está favoritado
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(200).json({ message: 'Produto já está nos favoritos.', favorited: true });
            }
            console.error('FavoriteController.toggleFavorite:', error.message);
            res.status(500).json({ message: 'Erro ao favoritar.' });
        }
    }

    // GET /favorites   (usuário logado): lista os favoritos de quem está logado
    static async getMyFavorites(req, res) {
        try {
            const favorites = await Favorite.findAll({
                where: { UserId: req.user.id },
                include: [{ model: Product, include: [{ model: Variant, attributes: ['color'] }] }],
                order: [['createdAt', 'DESC']]
            });

            res.status(200).json({
                favorites: favorites
                    .filter((fav) => fav.Product)
                    .map((fav) => ({
                        favoriteId: fav.id,
                        product: {
                            id: fav.Product.id,
                            name: fav.Product.name,
                            price: Math.round(Number(fav.Product.price) * 100) / 100,
                            imageUrl: fav.Product.image_url,
                            category: fav.Product.category,
                            // Cores disponíveis (a tela de favoritos mostra a cor)
                            colors: [...new Set((fav.Product.Variants || []).map((v) => v.color))]
                        }
                    }))
            });
        } catch (error) {
            console.error('FavoriteController.getMyFavorites:', error.message);
            res.status(500).json({ message: 'Erro ao buscar favoritos.' });
        }
    }
};