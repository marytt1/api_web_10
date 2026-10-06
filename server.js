const express = require('express');
const cors = require('cors');
const conn = require('./db/conn');

// IMPORTAÇÃO DOS MODELS sincronizar com banco
require('./models/Users');
require('./models/Product');
require('./models/Variant');
require('./models/Order');
require('./models/OrderItem');
require('./models/Favorite');

//   IMPORTAÇÃO DAS ROTAS
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');

const api = express();

//  MIDDLEWARES 
api.use(express.json());
api.use(cors());


// ROTAS 
api.use('/users', userRoutes);
api.use('/products', productRoutes);
api.use('/favorites', favoriteRoutes);

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