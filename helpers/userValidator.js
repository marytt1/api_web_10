const { check, validationResult } = require('express-validator');

const userValidate = (req, res, next) => {
    const { name, email, password, phone } = req.body;

    // Validações básicas usando express-validator
    if (!name || !email || !password || !phone) {
        return res.status(422).json({ message: 'Todas as informações são obrigatórias!' });
    }

    // Se passou por todas as validações, continua para o controller
    next();
};

module.exports = {
    userValidate,
};