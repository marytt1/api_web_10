const User = require('../models/Users');
const bcrypt = require('bcrypt');

module.exports = class UserController {
    
    // Método para registrar usuário
    static async register(req, res) {
        const { name, email, password} = req.body;

        // Validação de campos obrigatórios
        if (!name || !email || !password) {
            return res.status(422).json({ message: 'Todos os campos (nome, e-mail e senha) são obrigatórios!' });
        }

        // Validação de formato de e-mail
        // Garante que o texto tenha algo antes do @, o @, algo depois, o ponto e a terminação.
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(422).json({ message: 'Por favor, insira um formato de e-mail válido (ex: seuemail@dominio.com).' });
        }

        // Validação de segurança da senha (Tamanho mínimo)
        if (password.length < 6) {
            return res.status(422).json({ message: 'A senha deve ter no mínimo 6 caracteres!' });
        }

        // Verifica se o e-mail já existe
        const userExists = await User.findOne({ where: { email: email } });
        if (userExists) {
        return res.status(409).json({ message: 'Este e-mail já está registado no sistema!' });
        }
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

    // CALCULADORA DE TAMANHOS
    static async calculateSize(req, res) {
        // Recebe os dados do formulário do front-end
        const { userId, busto, cintura, quadril } = req.body;

        if (!busto || !cintura || !quadril) {
            return res.status(422).json({ message: 'Envie todas as medidas (busto, cintura e quadril) para o cálculo.' });
        }

        let tamanhoSugerido = "Tamanho não identificado";

        // Lógica de cálculo baseada na Tabela de Referência
        // Usa o limite máximo de cada tamanho para garantir que a peça sirva
        if (busto <= 84 && cintura <= 64 && quadril <= 91) {
            tamanhoSugerido = "P";
        } else if (busto <= 90 && cintura <= 70 && quadril <= 97) {
            tamanhoSugerido = "M";
        } else if (busto <= 96 && cintura <= 76 && quadril <= 103) {
            tamanhoSugerido = "G";
        } else if (busto <= 104 && cintura <= 84 && quadril <= 111) {
            tamanhoSugerido = "GG";
        } else {
            tamanhoSugerido = "Sob Medida (Consulte no WhatsApp)";
        }

        try {
            // Se o usuário estiver logado , atualiza o perfil dele com essas medidas
            if (userId) {
                await User.update(
                    { busto, cintura, quadril },
                    { where: { id: userId } }
                );
            }

            res.status(200).json({ 
                message: 'Cálculo realizado com sucesso!', 
                tamanhoSugerido: tamanhoSugerido 
            });

        } catch (error) {
            res.status(500).json({ message: 'Erro ao processar medidas', error: error.message });
        }
    }
};