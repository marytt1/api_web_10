const User = require('../models/Users');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const { Op } = require('sequelize');
 
const hashToken = (token) =>
    crypto.createHash('sha256').update(token).digest('hex');
 
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

module.exports = class UserController {
    
    // Método para registrar usuário
    static async register(req, res) {
        const { name, email, password} = req.body;

        // Validação de campos obrigatórios
        if (!name || !email || !password) {
            return res.status(422).json({ message: 'Todos os campos (nome, e-mail e senha) são obrigatórios!' });
        }

        // Verifica se o e-mail já existe
        const userExists = await User.findOne({ where: { email: email } });
        if (userExists) {
        return res.status(409).json({ message: 'Este e-mail já está registado no system!' });
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
    // Método para realizar o Login
    static async login(req, res) {
        const { email, password } = req.body;

        // Validação de preenchimento
        if (!email || !password) {
            return res.status(422).json({ message: 'O e-mail e a senha são obrigatórios!' });
        }

        try {
            // Verifica se o usuário existe no banco de dados
            const user = await User.findOne({ where: { email: email } });
            if (!user) {
                return res.status(404).json({ message: 'Usuário não encontrado!' });
            }

            // Compara a senha digitada com a senha criptografada do banco
            const checkPassword = await bcrypt.compare(password, user.password);
            if (!checkPassword) {
                return res.status(422).json({ message: 'Senha incorreta!' });
            }

            // Se a senha estiver correta, GERA O TOKEN!
            const token = jwt.sign(
                { id: user.id, isAdmin: user.isAdmin }, 
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN }
            );

            // Devolve a mensagem, os dados da utilizadora e o TOKEN
            res.status(200).json({ 
                message: 'Login realizado com sucesso!', 
                token: token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            });

        } catch (error) {
            res.status(500).json({ message: 'Erro interno no servidor.', error: error.message });
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
    // MÉTODO PARA GERAR TOKEN E ENVIAR E-MAIL
    static async forgotPassword(req, res) {
        const { email } = req.body;
 
        if (!email || typeof email !== 'string') {
            return res.status(422).json({ message: 'O e-mail é obrigatório!' });
        }
 
        const genericResponse = {
            message: 'Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.'
        };
 
        try {
            const user = await User.findOne({ where: { email: email.trim() } });
 
            if (user) {
                // Token enviado por e-mail
                const token = crypto.randomBytes(32).toString('hex');
 
                await user.update({
                    resetPasswordToken: hashToken(token),
                    resetPasswordExpires: new Date(Date.now() + 30 * 60 * 1000)
                });
 
                const link = `${process.env.FRONTEND_URL}/redefinir-senha/${token}`;
 
                transporter.sendMail({
                    to: user.email,
                    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                    subject: 'Recuperação de Senha - La Rose',
                    text: `Você solicitou a redefinição de senha.\n\n` +
                          `Clique no link a seguir para criar uma nova senha (válido por 30 minutos):\n\n` +
                          `${link}\n\n` +
                          `Se não solicitou isto, ignore este e-mail.`
                }).catch((err) => console.error('Erro ao enviar e-mail de recuperação:', err.message));
            }
 
            return res.status(200).json(genericResponse);
 
        } catch (error) {
            console.error('forgotPassword:', error.message);
            return res.status(500).json({ message: 'Erro ao processar a solicitação.' });
        }
    }
 
    // MÉTODO PARA GUARDAR A NOVA SENHA
    static async resetPassword(req, res) {
        const { token } = req.params;
        const { newPassword } = req.body;
 
        if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(422).json({ message: 'A senha deve ter no mínimo 8 caracteres.' });
        }
 
        try {
            // Busca pelo hash do token
            const user = await User.findOne({
                where: {
                    resetPasswordToken: hashToken(token),
                    resetPasswordExpires: { [Op.gt]: new Date() }
                }
            });
 
            if (!user) {
                return res.status(400).json({ message: 'Token inválido ou expirado. Solicite novamente.' });
            }
 
            const salt = await bcrypt.genSalt(12);
            const passwordHash = await bcrypt.hash(newPassword, salt);
 
            // Atualiza a senha e apaga o token (uso único)
            await user.update({
                password: passwordHash,
                resetPasswordToken: null,
                resetPasswordExpires: null
            });
 
            return res.status(200).json({ message: 'Senha redefinida com sucesso! Já pode fazer login.' });
 
        } catch (error) {
            console.error('resetPassword:', error.message);
            return res.status(500).json({ message: 'Erro ao redefinir a senha.' });
        }
    }
};