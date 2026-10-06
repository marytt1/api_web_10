const Favorite = require('../models/Favorite');
const Product = require('../models/Product');

module.exports = class FavoriteController {
    
    // Adicionar ou remover favorito 
    static async addFavorite(req, res) {
        const { UserId, ProductId } = req.body;

        try {
            // Verifica se o usuário já favoritou esse produto
            const alreadyFavorited = await Favorite.findOne({ where: { UserId, ProductId } });
            
            if (alreadyFavorited) {
                // Se já favoritou, remove o favorito
                await Favorite.destroy({ where: { id: alreadyFavorited.id } });
                return res.status(200).json({ message: 'Produto removido dos favoritos.' });
            }

            // Se não favoritou ainda, adiciona 
            await Favorite.create({ UserId, ProductId });
            res.status(201).json({ message: 'Produto adicionado aos favoritos!' });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao favoritar', error: error.message });
        }
    }

    // Listar os favoritos de um cliente específico
    static async getUserFavorites(req, res) {
        const { userId } = req.params;

        try {
            // Busca todos os favoritos do cliente e já traz os dados do produto junto
            const favorites = await Favorite.findAll({
                where: { UserId: userId },
                include: Product 
            });

            res.status(200).json({ favorites });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao buscar favoritos', error: error.message });
        }
    }
};