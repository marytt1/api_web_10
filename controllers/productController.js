const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');

module.exports = class ProductController {
    
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
                const [name, description, price, category, stock] = lines[i].split(',');
                
                // Salva o produto no banco de dados
                await Product.create({
                    name: name.trim(),
                    description: description.trim(),
                    price: parseFloat(price),
                    category: category.trim(),
                    stock: parseInt(stock)
                });
            }
            
            res.status(200).json({ message: 'Produtos importados do CSV com sucesso!' });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao importar CSV', error: error.message });
        }
    }
};