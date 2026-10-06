const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');

module.exports = class ProductController {
    
    //CREATE (Criar 1 produto) - Método POST
    static async createProduct(req, res) {
        // req.body pega os dados no Insomnia
        const { name, description, price, category, stock, image_url } = req.body;

        // Campos obrigatórios e regra de preço
        if (!name || !price || !category) {
            return res.status(422).json({ message: 'Os campos nome, preço e categoria são obrigatórios!' });
        }
        if (price <= 0) {
            return res.status(422).json({ message: 'O preço do produto deve ser maior que zero!' });
        }

        try {
            const product = await Product.create({ name, description, price, category, stock, image_url });
            res.status(201).json({ message: 'Produto criado com sucesso!', product });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao criar produto', error: error.message });
        }
    }

    //READ ALL (Listar TODOS os produtos) - Método GET
    static async getAllProducts(req, res) {
        try {
            const products = await Product.findAll(); // Busca todos no banco
            res.status(200).json({ products });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao buscar produtos', error: error.message });
        }
    }

    //READ ONE (Buscar apenas 1 produto pelo ID) - Método GET
    static async getProductById(req, res) {
        // req.params.id pega o número que vem na URL
        const { id } = req.params;

        try {
            const product = await Product.findByPk(id); //Procura pela Primary Key (ID)
            
            if (!product) {
                return res.status(404).json({ message: 'Produto não encontrado!' });
            }
            
            res.status(200).json({ product });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao buscar produto', error: error.message });
        }
    }

    //UPDATE (Atualizar um produto pelo ID) - Método PUT
    static async updateProduct(req, res) {
        const { id } = req.params;
        const { name, description, price, category, stock, image_url } = req.body;

        // Validação de estoque negativo e preço maior que zero
        if (price !== undefined && price <= 0) {
            return res.status(422).json({ message: 'O preço atualizado deve ser maior que zero!' });
        }
        
        if (stock !== undefined && stock < 0) {
            return res.status(422).json({ message: 'O estoque não pode ser negativo!' });
        }

        try {
            // Verifica se o produto existe antes de tentar atualizar
            const product = await Product.findByPk(id);
            if (!product) {
                return res.status(404).json({ message: 'Produto não encontrado!' });
            }

            // Atualiza os dados
            await Product.update(
                { name, description, price, category, stock, image_url },
                { where: { id: id } } // Onde o ID do banco for igual ao ID da URL
            );

            res.status(200).json({ message: 'Produto atualizado com sucesso!' });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao atualizar produto', error: error.message });
        }
    }

    //DELETE (Apagar um produto pelo ID) - Método DELETE
    static async deleteProduct(req, res) {
        const { id } = req.params;

        try {
            const product = await Product.findByPk(id);
            if (!product) {
                return res.status(404).json({ message: 'Produto não encontrado!' });
            }

            await Product.destroy({ where: { id: id } }); // Destrói/apaga do banco
            res.status(200).json({ message: 'Produto deletado com sucesso!' });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao deletar produto', error: error.message });
        }
    }

    // Função para importar dados de um arquivo CSV externo
    static async importCSV(req, res) {
        try {
            // Caminho exato do arquivo CSV
            const filePath = path.join(__dirname, '../produtos.csv');
            // Lê o conteúdo do arquivo
            const fileData = fs.readFileSync(filePath, 'utf8');
            // Quebra o texto em um array de linhas
            const lines = fileData.split('\n');
            // Começa no index 1 para pular o cabeçalho do CSV
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim() === '') continue; // Ignora linhas em branco
                // Quebra a linha nas vírgulas para pegar cada coluna
                const [name, description, price, category, stock, image_url] = lines[i].split(',');
                // Salva o produto no banco de dados
                await Product.create({
                    name: name.trim(),
                    description: description.trim(),
                    price: parseFloat(price),
                    category: category.trim(),
                    stock: parseInt(stock),
                    image_url: image_url.trim()
                });
            }
            res.status(200).json({ message: 'Produtos importados do CSV com sucesso!' });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao importar CSV', error: error.message });
        }
    }
};