const User = require('../models/Users');
const OrderItem = require('../models/OrderItem');
const Variant = require('../models/Variant');
const Product = require('../models/Product');

// Campos do cliente que vão para o painel admin.
const USER_ATTRIBUTES = ['id', 'name', 'email'];

// Pedido + cliente + itens (com variação e produto)
const ORDER_INCLUDE = [
    { model: User, attributes: USER_ATTRIBUTES },
    {
        model: OrderItem,
        include: [
            {
                model: Variant,
                include: [{ model: Product, attributes: ['id', 'name'] }]
            }
        ]
    }
];

const orderCode = (id) => `ORD-${String(id).padStart(3, '0')}`;

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function formatOrder(order) {
    const customer = order.User;

    return {
        id: order.id,
        code: orderCode(order.id),
        customer: customer
            ? {
                  id: customer.id,
                  name: customer.name,
                  email: customer.email,
              }
            : null,
        items: (order.OrderItems || []).map((item) => ({
            name: item.Variant && item.Variant.Product ? item.Variant.Product.name : 'Produto removido',
            sku: item.Variant ? item.Variant.sku : null,
            color: item.Variant ? item.Variant.color : null,
            size: item.Variant ? item.Variant.size : null,
            quantity: item.quantity,
            price: money(item.price)
        })),
        total: money(order.total),
        status: order.status,
        date: order.createdAt,
        paidAt: order.paidAt || null
    };
}

module.exports = { ORDER_INCLUDE, USER_ATTRIBUTES, formatOrder, orderCode, money };