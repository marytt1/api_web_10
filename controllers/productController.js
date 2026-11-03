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

// A loja precisa das variações (cor, tamanho e estoque) e das fotos da galeria
const PRODUCT_INCLUDE = [
  { model: Variant, attributes: ['id', 'sku', 'size', 'color', 'stock'] },
  { model: ProductImage, attributes: ['id', 'url', 'color', 'position'] },
];
// Produtos mais novos primeiro; variações e fotos sempre em ordem fixa
const PRODUCT_ORDER = [['createdAt', 'DESC'], [Variant, 'id', 'ASC'], [ProductImage, 'position', 'ASC']];

// image_url guarda o CAMINHO da imagem na API
const IMAGE_PATTERN = /^(\/(images|uploads)\/|https?:\/\/)/;

// Valida os campos recebidos e devolve { data } com os valores já tratados, ou { error } com a mensagem.
function parseProductBody(body, partial) {
    const data = {};
    const has = (field) => body[field] !== undefined;

    if (!partial || has('name')) {
        if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 150) {
            return { error: 'O nome do produto deve ter entre 2 e 150 caracteres!' };
        }
        data.name = body.name.trim();
    }

    if (!partial || has('price')) {
        const price = Number(body.price);
        if (body.price === undefined || body.price === null || body.price === '' || !Number.isFinite(price) || price <= 0) {
            return { error: 'O preço do produto deve ser um número maior que zero!' };
        }
        data.price = Math.round(price * 100) / 100;
    }

    // Preço antigo (promoção): null remove a promoção
    if (has('oldPrice')) {
        if (body.oldPrice === null || body.oldPrice === '') {
            data.oldPrice = null;
        } else {
            const oldPrice = Number(body.oldPrice);
            if (!Number.isFinite(oldPrice) || oldPrice <= 0) {
                return { error: 'O preço antigo deve ser um número maior que zero (ou vazio, para remover a promoção).' };
            }
            data.oldPrice = Math.round(oldPrice * 100) / 100;
        }
    }

    // A categoria é tratada por normalizeCategory (junta "cropped" e "Cropped"): aqui só confere se veio
    if (!partial || has('category')) {
        if (typeof body.category !== 'string' || !body.category.trim()) {
            return { error: 'Os campos nome, preço e categoria são obrigatórios!' };
        }
        data.category = body.category;
    }

    if (has('description')) {
        if (body.description !== null && (typeof body.description !== 'string' || body.description.length > 1000)) {
            return { error: 'A descrição deve ter no máximo 1000 caracteres!' };
        }
        data.description = body.description === null ? null : body.description.trim();
    }

    if (has('stock')) {
        const stock = Number(body.stock);
        if (!Number.isInteger(stock) || stock < 0) {
            return { error: 'O estoque não pode ser negativo e deve ser um número inteiro!' };
        }
        data.stock = stock;
    }

    if (has('image_url')) {
        const url = body.image_url;
        if (url !== null && url !== '' && (typeof url !== 'string' || url.length > 255 || !IMAGE_PATTERN.test(url))) {
            return { error: 'A imagem deve ser um caminho da API (/images/... ou /uploads/...) ou um endereço http(s).' };
        }
        data.image_url = url ? url : null;
    }

    return { data };
}

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
        const { data, error } = parseProductBody(req.body || {}, false);
        if (error) {
            return res.status(422).json({ message: error });
        }

        if (data.oldPrice !== undefined && data.oldPrice !== null && data.oldPrice <= data.price) {
            return res.status(422).json({ message: 'O preço antigo deve ser maior que o preço atual.' });
        }

        try {
            const finalCategory = await normalizeCategory(data.category);
            if (!finalCategory) {
                return res.status(422).json({ message: 'Informe uma categoria (até 40 caracteres).' });
            }

            const product = await Product.create({ ...data, category: finalCategory, oldPrice: data.oldPrice ?? null });
            res.status(201).json({ message: 'Produto criado com sucesso!', product });
        } catch (err) {
            console.error('createProduct:', err.message);
            res.status(500).json({ message: 'Erro ao criar produto' });
        }
    }

    //READ ALL (Listar TODOS os produtos, com variações e fotos) - Método GET
    static async getAllProducts(req, res) {
        try {
            const products = await Product.findAll({
                include: PRODUCT_INCLUDE,
                order: PRODUCT_ORDER,
            });
            res.status(200).json({ products });
        } catch (err) {
            console.error('getAllProducts:', err.message);
            res.status(500).json({ message: 'Erro ao buscar produtos' });
        }
    }

    //READ ONE (Buscar apenas 1 produto pelo ID) - Método GET
    static async getProductById(req, res) {
        // req.params.id pega o número que vem na URL
        const { id } = req.params;

        try {
            const product = await Product.findByPk(id, {
                include: PRODUCT_INCLUDE,
                order: [[Variant, 'id', 'ASC'], [ProductImage, 'position', 'ASC']],
            });
            if (!product) {
                return res.status(404).json({ message: 'Produto não encontrado!' });
            }
            res.status(200).json({ product });
        } catch (err) {
            console.error('getProductById:', err.message);
            res.status(500).json({ message: 'Erro ao buscar produto' });
        }
    }

    //UPDATE (Atualizar um produto pelo ID) - Método PUT. Só muda os campos enviados
    static async updateProduct(req, res) {
        const { id } = req.params;

        const { data, error } = parseProductBody(req.body || {}, true);
        if (error) {
            return res.status(422).json({ message: error });
        }
        if (Object.keys(data).length === 0) {
            return res.status(422).json({ message: 'Envie ao menos um campo para atualizar.' });
        }

        try {
            // Verifica se o produto existe antes de tentar atualizar
            const product = await Product.findByPk(id);
            if (!product) {
                return res.status(404).json({ message: 'Produto não encontrado!' });
            }

            if (data.category !== undefined) {
                const finalCategory = await normalizeCategory(data.category);
                if (!finalCategory) {
                    return res.status(422).json({ message: 'Informe uma categoria (até 40 caracteres).' });
                }
                data.category = finalCategory;
            }

            const finalPrice = data.price !== undefined ? data.price : product.price;

            if (data.oldPrice !== undefined && data.oldPrice !== null && data.oldPrice <= finalPrice) {
                return res.status(422).json({ message: 'O preço antigo deve ser maior que o preço atual.' });
            }

            // Se o preço subiu até o valor "antigo" (ou além), a promoção acabou: remove o preço antigo
            if (data.price !== undefined && data.oldPrice === undefined && product.oldPrice !== null && product.oldPrice <= finalPrice) {
                data.oldPrice = null;
            }

            await product.update(data);

            res.status(200).json({ message: 'Produto atualizado com sucesso!' });
        } catch (err) {
            console.error('updateProduct:', err.message);
            res.status(500).json({ message: 'Erro ao atualizar produto' });
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
        } catch (err) {
            console.error('deleteProduct:', err.message);
            res.status(500).json({ message: 'Erro ao deletar produto' });
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
        } catch (err) {
            console.error('importCSV:', err.message);
            res.status(500).json({ message: 'Erro ao importar CSV' });
        }
    }

    // POST /products/:id/images 
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
        } catch (err) {
            urls.forEach(removeLocalImage);
            console.error('uploadImages:', err.message);
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
        } catch (err) {
            console.error('deleteImage:', err.message);
            res.status(500).json({ message: 'Erro ao remover a foto.' });
        }
    }
};