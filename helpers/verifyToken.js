const jwt = require('jsonwebtoken');

// Exige apenas que o usuário esteja logado (cliente ou admin)
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Acesso negado! Faça login para continuar.' });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido ou expirado!' });
    }
};

module.exports = verifyToken;