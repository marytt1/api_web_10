const readline = require('readline');
const db = require('./db/conn');
const Product = require('./models/Product');
require('./models/Variant');
require('./models/ProductImage');

function perguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(texto, (r) => { rl.close(); resolve(r); }));
}

(async () => {
  try {
    const total = await Product.count();
    console.log(`Existem ${total} produto(s) no banco.`);
    if (total === 0) { console.log('Nada para apagar.'); return; }

    const r = await perguntar('Isso apaga TODOS os produtos, variações e fotos. Digite SIM para continuar: ');
    if (r.trim().toUpperCase() !== 'SIM') { console.log('Cancelado. Nada foi apagado.'); return; }

    await Product.destroy({ where: {} });
    console.log('Pronto! Produtos apagados. Agora rode:  npm start');
  } catch (err) {
    console.log('Não foi possível apagar:', err.message);
    console.log('(Se a mensagem fala de "foreign key", existem pedidos ligados a esses produtos.)');
  } finally {
    await db.close();
  }
})();