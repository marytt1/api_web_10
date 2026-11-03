const fs = require('fs');
const path = require('path');
const { fn, col, where } = require('sequelize');
const Product = require('../models/Product');
const { removeLocalImage } = require('../helpers/uploadHelper');
const Variant = require('../models/Variant');
const ProductImage = require('../models/ProductImage');

const MAX_IMAGES_PER_PRODUCT = 10;

// A capa (image_url) é sempre a primeira foto da galeria
async function syncCover(product) {
  const first = await ProductImage.findOne({
    where: { ProductId: product.id },
    order: [['position', 'ASC'], ['id', 'ASC']],
  });
  await product.update({ image_url: first ? first.url : null });
}

// Fotos sempre vêm na ordem da galeria
const PRODUCT_INCLUDE = [{ model: Variant }, { model: ProductImage }];
const PRODUCT_ORDER = [['createdAt', 'DESC'], [ProductImage, 'position', 'ASC']];

// Função auxiliar para limpar espaços e ignorar maiúsculas/minúsculas de uma categoria existente
async function normalizeCategory(raw) {
    const clean = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!clean || clean.length > 40) return null;

    const existing = await Product.findOne({
        where: where(fn('lower', col('category')), clean.toLowerCase()),
    });

    return existing ? existing.category : clean;
}

module.exports = class ProductController {
    
    //CREATE (Criar 1 produto) - Método POST
    static async createProduct(req, res) {
        // req.body pega os dados no Insomnia
        const { name, description, price, oldPrice, category, stock, image_url } = req.body;

        // Campos obrigatórios e regra de preço
        if (!name || !price || !category) {
            return res.status(422).json({ message: 'Os campos nome, preço e categoria são obrigatórios!' });
        }
        if (price <= 0) {
            return res.status(422).json({ message: 'O preço do produto deve ser maior que zero!' });
        }

        if (oldPrice !== undefined && oldPrice !== null && oldPrice <= price) {
            return res.status(422).json({ message: 'O preço antigo deve ser maior que o preço atual.' });
        }

        try {
            const finalCategory = await normalizeCategory(category);
            if (!finalCategory) {
                return res.status(422).json({ message: 'Informe uma categoria (até 40 caracteres).' });
            }

            const product = await Product.create({
                name, description, price, oldPrice: oldPrice ?? null,
                category: finalCategory, stock, image_url,
            });
            res.status(201).json({ message: 'Produto criado com sucesso!', product });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao criar produto', error: error.message });
        }
    }

    //READ ALL (Listar TODOS os produtos) - Método GET
    static async getAllProducts(req, res) {
        // Busca todos no banco
        try {
            const products = await Product.findAll({
                include: PRODUCT_INCLUDE,
                order: PRODUCT_ORDER,
            });
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
            const product = await Product.findByPk(id, {
                include: PRODUCT_INCLUDE,
                order: [[ProductImage, 'position', 'ASC']],
            });
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
        const { name, description, price, oldPrice, category, stock, image_url } = req.body;

        // Validação de estoque negativo e preço maior que zero
        if (price !== undefined && price <= 0) {
            return res.status(422).json({ message: 'O preço atualizado deve ser maior que zero!' });
        }
        
        if (stock !== undefined && stock < 0) {
            return res.status(422).json({ message: 'O estoque não pode ser negativo!' });
        }

        try {
            const finalCategory = category !== undefined ? await normalizeCategory(category) : undefined;
            if (category !== undefined && !finalCategory) {
                return res.status(422).json({ message: 'Informe uma categoria (até 40 caracteres).' });
            }
            // Verifica se o produto existe antes de tentar atualizar
            const product = await Product.findByPk(id);
            if (!product) {
                return res.status(404).json({ message: 'Produto não encontrado!' });
            }

            const finalPrice = price !== undefined ? price : product.price;
            if (oldPrice !== undefined && oldPrice !== null && oldPrice <= finalPrice) {
                return res.status(422).json({ message: 'O preço antigo deve ser maior que o preço atual.' });
            }

            // Só atualiza o que veio na requisição
            const fields = Object.fromEntries(
                Object.entries({ name, description, price, oldPrice, category: finalCategory, stock, image_url })
                    .filter(([, value]) => value !== undefined)
            );
            await product.update(fields);

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

            // Guarda as URLs antes de apagar (as linhas saem junto, por CASCADE)
            const images = await ProductImage.findAll({ where: { ProductId: product.id } });
            const urls = images.map((i) => i.url);

            await product.destroy();

            urls.forEach(removeLocalImage);
            removeLocalImage(product.image_url);

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

    // POST /products/:id/images  (multipart: campo "images" com 1 a 10 arquivos, campo opcional "color")
    static async uploadImages(req, res) {
        const { id } = req.params;
        const files = req.files || [];

        if (files.length === 0) {
            return res.status(422).json({ message: 'Envie pelo menos uma foto no campo "images".' });
        }

        const urls = files.map((f) => `/uploads/${f.filename}`);
        const color = String((req.body || {}).color || '').trim().slice(0, 40) || null;

        try {
            const product = await Product.findByPk(id);
            if (!product) {
                urls.forEach(removeLocalImage); // não deixa arquivo órfão
                return res.status(404).json({ message: 'Produto não encontrado!' });
            }

            const count = await ProductImage.count({ where: { ProductId: product.id } });
            if (count + files.length > MAX_IMAGES_PER_PRODUCT) {
                urls.forEach(removeLocalImage);
                return res.status(422).json({
                message: `Cada produto aceita no máximo ${MAX_IMAGES_PER_PRODUCT} fotos (já tem ${count}).`,
                });
            }

            const last = await ProductImage.findOne({
                where: { ProductId: product.id },
                order: [['position', 'DESC']],
            });
            const start = last ? last.position + 1 : 0;

            const created = await ProductImage.bulkCreate(
                urls.map((url, i) => ({ url, color, position: start + i, ProductId: product.id }))
            );

            await syncCover(product);

            res.status(201).json({
                message: 'Fotos enviadas!',
                images: created.map((i) => ({ id: i.id, url: i.url, color: i.color, position: i.position })),
            });
        } catch (error) {
            urls.forEach(removeLocalImage);
            console.error('uploadImages:', error.message);
            res.status(500).json({ message: 'Erro ao salvar as fotos.' });
        }
    }

    // DELETE /products/:id/images/:imageId
    static async deleteImage(req, res) {
        const { id, imageId } = req.params;
        try {
            const image = await ProductImage.findOne({ where: { id: imageId, ProductId: id } });
            if (!image) {
                return res.status(404).json({ message: 'Foto não encontrada!' });
            }

            const url = image.url;
            await image.destroy();
            removeLocalImage(url);

            const product = await Product.findByPk(id);
            if (product) await syncCover(product);

            res.status(200).json({ message: 'Foto removida.' });
        } catch (error) {
            console.error('deleteImage:', error.message);
            res.status(500).json({ message: 'Erro ao remover a foto.' });
        }
    }
};