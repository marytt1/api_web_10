const MAX_ITEMS = 50;      // linhas diferentes no carrinho
const MAX_QUANTITY = 99;   // por item

function normalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { error: 'O carrinho está vazio.' };
    }
    if (items.length > MAX_ITEMS) {
        return { error: `O carrinho aceita no máximo ${MAX_ITEMS} itens diferentes.` };
    }

    const wanted = new Map();

    for (const item of items) {
        const variantId = Number(item && item.variantId);
        const quantity = Number(item && item.quantity);

        if (
            !Number.isInteger(variantId) || variantId <= 0 ||
            !Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY
        ) {
            return {
                error: `Cada item precisa de variantId e quantity (número inteiro de 1 a ${MAX_QUANTITY}).`
            };
        }

        wanted.set(variantId, (wanted.get(variantId) || 0) + quantity);
    }

    return { wanted };
}

module.exports = { normalizeItems, MAX_ITEMS, MAX_QUANTITY };