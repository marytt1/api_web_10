const fs = require('fs');
const path = require('path');
const db = require('./db/conn');
const Product = require('./models/Product');
const Variant = require('./models/Variant');
const ProductImage = require('./models/ProductImage');

// Lê um CSV (aceita vírgula ou ponto e vírgula, aspas e BOM do Excel)
function lerCsv(arquivo) {
  const texto = fs.readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, '');
  const primeira = texto.split(/\r?\n/)[0] || '';
  const sep = primeira.includes(';') && !primeira.includes(',') ? ';' : ',';

  const linhas = [];
  let campo = '';
  let linha = [];
  let aspas = false;
  const fechaLinha = () => {
    linha.push(campo);
    campo = '';
    if (linha.some((x) => x.trim() !== '')) linhas.push(linha);
    linha = [];
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; fechaLinha(); }
    else campo += c;
  }
  if (campo !== '' || linha.length) fechaLinha();

  const [cab, ...resto] = linhas;
  const cols = cab.map((h) => h.trim());
  return resto.map((l) => Object.fromEntries(cols.map((h, i) => [h, (l[i] || '').trim()])));
}

async function seedProdutos() {
  try {
    if (process.env.SEED_PRODUTOS === 'false') return;

    const arq = (n) => path.join(__dirname, n);
    const faltando = ['produtos.csv', 'variacoes.csv', 'fotos.csv'].filter((n) => !fs.existsSync(arq(n)));
    if (faltando.length) {
      if (faltando.length < 3) console.log('[catalogo] Importação pulada: faltam na raiz do backend:', faltando.join(', '));
      return;
    }

    const produtosCsv = lerCsv(arq('produtos.csv'));
    const variacoesCsv = lerCsv(arq('variacoes.csv'));
    const fotosCsv = lerCsv(arq('fotos.csv'));

    // agrupa variações e fotos por nome de produto
    const variacoesPor = new Map();
    for (const v of variacoesCsv) {
      if (!variacoesPor.has(v.produto)) variacoesPor.set(v.produto, []);
      variacoesPor.get(v.produto).push(v);
    }
    const fotosPor = new Map();
    for (const f of fotosCsv) {
      if (!fotosPor.has(f.produto)) fotosPor.set(f.produto, []);
      fotosPor.get(f.produto).push(f);
    }

    const noBanco = await Product.findAll({ raw: true });
    const porNome = new Map(noBanco.map((p) => [p.name, p]));
    const skusNoBanco = new Set((await Variant.findAll({ raw: true, attributes: ['sku'] })).map((v) => v.sku));
    const comGaleria = new Set((await ProductImage.findAll({ raw: true, attributes: ['ProductId'] })).map((i) => i.ProductId));

    const r = { criados: 0, atualizados: 0, variacoes: 0, galerias: 0, fotos: 0, fotosFaltando: 0 };

    await db.transaction(async (t) => {
      for (const p of produtosCsv) {
        const variacoes = variacoesPor.get(p.name) || [];
        const fotos = (fotosPor.get(p.name) || []).sort((a, b) => Number(a.posicao) - Number(b.posicao));
        const capa = fotos.length ? fotos[0].url : p.image_url || '';

        let produto = porNome.get(p.name);
        if (!produto) {
          const estoque = variacoes.reduce((s, v) => s + (parseInt(v.estoque, 10) || 0), 0);
          produto = await Product.create(
            {
              name: p.name,
              description: p.description,
              price: parseFloat(p.price),
              category: p.category,
              stock: variacoes.length ? estoque : parseInt(p.stock, 10) || 0,
              image_url: capa,
            },
            { transaction: t }
          );
          produto = produto.get ? produto.get({ plain: true }) : produto;
          r.criados++;
        } else {
          const novos = {};
          if (produto.category !== p.category) novos.category = p.category;
          if (p.description && produto.description !== p.description) novos.description = p.description;
          if (capa && produto.image_url !== capa) novos.image_url = capa;
          if (Object.keys(novos).length) {
            await Product.update(novos, { where: { id: produto.id }, transaction: t });
            r.atualizados++;
          }
        }

        // variações que ainda não existem (pelo SKU)
        const novas = variacoes
          .filter((v) => v.sku && !skusNoBanco.has(v.sku))
          .map((v) => ({
            sku: v.sku,
            size: v.tamanho,
            color: v.cor,
            stock: parseInt(v.estoque, 10) || 0,
            ProductId: produto.id,
          }));
        if (novas.length) {
          await Variant.bulkCreate(novas, { transaction: t });
          novas.forEach((v) => skusNoBanco.add(v.sku));
          r.variacoes += novas.length;
        }

        // galeria: só se o produto ainda não tem nenhuma foto
        if (fotos.length && !comGaleria.has(produto.id)) {
          await ProductImage.bulkCreate(
            fotos.map((f) => ({
              url: f.url,
              color: f.cor || null,
              position: parseInt(f.posicao, 10) || 0,
              ProductId: produto.id,
            })),
            { transaction: t }
          );
          comGaleria.add(produto.id);
          r.galerias++;
          r.fotos += fotos.length;
          for (const f of fotos) if (!fs.existsSync(path.join(__dirname, f.url))) r.fotosFaltando++;
        }
      }
    });

    const nomesCsv = new Set(produtosCsv.map((p) => p.name));
    const sobrando = noBanco.filter((p) => !nomesCsv.has(p.name)).map((p) => p.name);

    if (r.criados || r.atualizados || r.variacoes || r.galerias) {
      console.log(
        `[catalogo] Pronto! Produtos: ${r.criados} criados, ${r.atualizados} ajustados | ` +
          `Variações novas: ${r.variacoes} | Galerias novas: ${r.galerias} (${r.fotos} fotos)`
      );
    } else {
      console.log(`[catalogo] Catálogo já está completo (${produtosCsv.length} produtos, ${variacoesCsv.length} variações).`);
    }
    if (r.fotosFaltando) console.log(`[catalogo] ATENÇÃO: ${r.fotosFaltando} foto(s) não foram achadas na pasta uploads/.`);
    if (sobrando.length) {
      console.log(
        `[catalogo] ATENÇÃO: ${sobrando.length} produto(s) do banco não estão no produtos.csv e ficam sem variações ` +
          `(aparecem como esgotados). Ex.: ${sobrando.slice(0, 5).join(' | ')}. ` +
          'Se forem restos de teste, rode "node resetar-produtos.js" e depois "npm start".'
      );
    }
  } catch (err) {
    // não derruba o servidor se a importação falhar (a transação é desfeita)
    console.log('[catalogo] Erro na importação (o servidor vai ligar mesmo assim):', err.message);
  }
}

module.exports = seedProdutos;