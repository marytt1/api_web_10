const express = require('express');
const cors = require('cors');
const conn = require('./db/conn');
require('dotenv').config();
const api = express();
const path = require('path');

//  MIDDLEWARES 
api.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
api.use(express.json());

// UPLOAD DAS FOTOS DOS PRODUTOS PELO ADMIN
api.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// IMPORTAÇÃO DOS MODELS sincronizar com banco
require('./models/Users');
require('./models/Product');
require('./models/Variant');
require('./models/Favorite');
require('./models/Order');
require('./models/OrderItem');
require('./models/ProductImage');

//   IMPORTAÇÃO DAS ROTAS
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const adminRoutes = require('./routes/adminRoutes');
const variantRoutes = require('./routes/variantRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');

// ROTAS 
api.use('/users', userRoutes);
api.use('/products', productRoutes);
api.use('/favorites', favoriteRoutes);
api.use('/admin', adminRoutes);
api.use('/variants', variantRoutes);
api.use('/orders', orderRoutes);
api.use('/cart', cartRoutes);

api.get('/', (req, res) => {
    res.json({ message: 'API da Loja está no ar!' });
});

//    INICIALIZAÇÃO 
const PORT = process.env.PORT || 3000;

conn.sync()
    .then(() => {
        api.listen(PORT, () => {
            console.log(`Servidor rodando perfeitamente na porta ${PORT}`);
        });
    })
    .catch((err) => console.log('Erro ao sincronizar o banco:', err));