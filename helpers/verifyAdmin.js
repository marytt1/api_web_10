const jwt = require('jsonwebtoken');

const verifyAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token) {
        return res.status(401).json({ message: 'Acesso negado! Faça login para continuar.' });
    }

    try {
        // Abre o token e verifica se é válido
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verifica se tem o selo de Admin
        if (!decoded.isAdmin) {
            return res.status(403).json({ message: 'Acesso restrito! Apenas administradores podem realizar esta ação.' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        res.status(400).json({ message: 'Token inválido!' });
    }
};

module.exports = verifyAdmin;