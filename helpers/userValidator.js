const { check, validationResult } = require('express-validator');

const userValidate = (req, res, next) => {
    const { name, email, password, phone } = req.body;

    // Validações básicas usando express-validator
    if (!name) {
        return res.status(422).json({ message: 'O nome é obrigatório!' });
    }
    if (!email || !email.includes('@')) {
        return res.status(422).json({ message: 'O e-mail é obrigatório e deve ser válido!' });
    }
    if (!password || password.length < 6) {
        return res.status(422).json({ message: 'A senha deve ter pelo menos 6 caracteres!' });
    }

    // Se passou por todas as validações, continua para o controller
    next();
};

module.exports = {
    userValidate,
};