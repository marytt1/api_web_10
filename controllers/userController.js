const User = require('../models/Users');
const bcrypt = require('bcrypt');

module.exports = class UserController {
    
    // Método para registrar usuário
    static async register(req, res) {
        const { name, email, password} = req.body;

        // Criptografar a senha
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        // Criar o novo usuário no banco
        try {
            await User.create({
                name: name,
                email: email,
                password: passwordHash,
            });
            res.status(200).json({ message: 'Usuário cadastrado com sucesso' });
        } catch (error) {
            res.status(422).json({ message: error.message });
        }    
    }

    // Método para listar todos os usuários
    static async listAll(req, res) {
        try {
            const users = await User.findAll();
            res.status(200).json({ users });    
        } catch (error) {
            res.status(422).json({ error: error.message });
        }
    }
};