const User = require('../models/Users');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { computeSize } = require('../helpers/sizeTable');
require('dotenv').config();

// Guarda o email em minúsculo e sem espaços
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
        const { name, password } = req.body;
        const email = normalizeEmail(req.body.email);

        // Validação de campos obrigatórios
        if (!name || !email || !password) {
            return res.status(422).json({ message: 'Todos os campos (nome, e-mail e senha) são obrigatórios!' });
        }
        // Validar email
        if (!isValidEmail(email)) {
            return res.status(422).json({ message: 'Informe um e-mail válido.' });
        }
        // Validar senha
        if (typeof password !== 'string' || password.length < 8) {
            return res.status(422).json({ message: 'A senha deve ter no mínimo 8 caracteres.' });
        }

        try {
            // Verifica se o e-mail já existe
            const userExists = await User.findOne({ where: { email } });
            if (userExists) {
                return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
            }

            // Criptografar a senha
            const salt = await bcrypt.genSalt(12);
            const passwordHash = await bcrypt.hash(password, salt);

            // Criar o novo usuário no banco
            await User.create({ name: String(name).trim(), email, password: passwordHash });
            res.status(200).json({ message: 'Usuário cadastrado com sucesso' });
        } catch (error) {
            console.error('register:', error.message);
            res.status(500).json({ message: 'Erro ao cadastrar o usuário.' });
        }
    }
  
    // Método para listar todos os usuários (excluso senhas)
    static async listAll(req, res) {
        try {
            const users = await User.findAll({
                attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] },
            });
            res.status(200).json({ users });    
        } catch (error) {
            res.status(422).json({ error: error.message });
        }
    }
    
    // Método para realizar o Login
    static async login(req, res) {
        const { password } = req.body;
        const email = normalizeEmail(req.body.email);

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
                    email: user.email,
                    isAdmin: user.isAdmin
                }
            });

        } catch (error) {
            res.status(500).json({ message: 'Erro interno no servidor.', error: error.message });
        }
    }

    // CALCULADORA DE TAMANHOS
    static async calculateSize(req, res) {
        const busto = Number((req.body || {}).busto);
        const cintura = Number((req.body || {}).cintura);
        const quadril = Number((req.body || {}).quadril);

        const valid = [busto, cintura, quadril].every((v) => Number.isFinite(v) && v >= 30 && v <= 250);
        if (!valid) {
        return res.status(422).json({
            message: 'Informe busto, cintura e quadril em centímetros (valores entre 30 e 250).',
        });
        }

        const result = computeSize(busto, cintura, quadril);

        // Logado: guarda as medidas no perfil 
        if (req.user && req.user.id) {
        try {
            await User.update({ busto, cintura, quadril }, { where: { id: req.user.id } });
        } catch (error) {
            console.error('calculateSize (salvar medidas):', error.message);
        }
        }

        if (result.status === 'above') {
        return res.status(200).json({
            message: 'Alguma medida passa do maior tamanho da tabela.',
            status: 'above',
            tamanhoSugerido: 'Sob Medida (Consulte no WhatsApp)',
        });
        }

        res.status(200).json({
        message: 'Cálculo realizado com sucesso!',
        ...result,
        tamanhoSugerido: result.size,
        });
    }

    // MÉTODO PARA GERAR TOKEN E ENVIAR E-MAIL
    static async forgotPassword(req, res) {
        const email = normalizeEmail(req.body.email);

        if (typeof req.body.email !== 'string' || !email) {
            return res.status(422).json({ message: 'O e-mail é obrigatório!' });
        }
 
        // Mesma resposta sempre, exista o e-mail ou não
        const genericResponse = {
            message: 'Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.'
        };
 
        try {
            if (!process.env.FRONTEND_URL) {
                console.error('forgotPassword: FRONTEND_URL não está definido no .env');
                return res.status(500).json({ message: 'Erro ao processar a solicitação.' });
            }
 
            const user = await User.findOne({ where: { email: email} });
 
            if (user) {
                const token = crypto.randomBytes(32).toString('hex');
 
                // No banco vai apenas o HASH do token, com validade de 30 minutos
                await user.update({
                    resetPasswordToken: hashToken(token),
                    resetPasswordExpires: new Date(Date.now() + 30 * 60 * 1000)
                });
 
                const link = `${process.env.FRONTEND_URL}/redefinir-senha?token=${token}`;
 
                // Sem await: o tempo de resposta não revela se o e-mail existe
                transporter.sendMail({
                    to: user.email,
                    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                    subject: 'Recuperação de Senha - La Rose',
                    text: `Você solicitou a redefinição de senha.\n\n` +
                          `Para criar uma nova senha (link válido por 30 minutos), acesse:\n${link}\n\n` +
                          `Se não solicitou isto, ignore este e-mail.`,
                    // um botão que leva direto para a página de redefinição
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #3a3a3a;">
                            <h2 style="color: #8b1538; margin-bottom: 4px;">La Rose</h2>
                            <p>Você solicitou a redefinição de senha.</p>
                            <p>
                                <a href="${link}"
                                   style="display: inline-block; background: #8b1538; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 24px; font-weight: bold;">
                                    Criar nova senha
                                </a>
                            </p>
                            <p style="font-size: 12px; color: #777777;">
                                O link vale por 30 minutos. Se você não fez essa solicitação, ignore este e-mail.
                            </p>
                        </div>`
                }).catch((err) => console.error('Erro ao enviar e-mail de recuperação:', err.message));
            }
 
            return res.status(200).json(genericResponse);
 
        } catch (error) {
            console.error('forgotPassword:', error.message);
            return res.status(500).json({ message: 'Erro ao processar a solicitação.' });
        }
    }
 
    // MÉTODO PARA GUARDAR A NOVA SENHA (USUÁRIO NÃO LOGADO)
    static async resetPassword(req, res) {
        const { token } = req.params;
        const { newPassword } = req.body;
 
        if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(422).json({ message: 'A senha deve ter no mínimo 8 caracteres.' });
        }
 
        try {
            // Busca pelo hash do token, já exigindo que não tenha expirado
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

    // MÉTODO PARA ALTERAR A SENHA (USUÁRIO LOGADO)
    static async changePassword(req, res) {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(422).json({ message: 'Informe a senha atual e a nova senha.' });
        }
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(422).json({ message: 'A nova senha deve ter no mínimo 8 caracteres.' });
        }

        try {
            const user = await User.findByPk(req.user.id);
            if (!user) {
                return res.status(404).json({ message: 'Usuário não encontrado!' });
            }

            const ok = await bcrypt.compare(currentPassword, user.password);
            if (!ok) {
            // 422 (e não 401): 401 faria o front deslogar o usuário
                return res.status(422).json({ message: 'Senha atual incorreta.' });
            }

            const salt = await bcrypt.genSalt(12);
            await user.update({ password: await bcrypt.hash(newPassword, salt) });

            res.status(200).json({ message: 'Senha alterada com sucesso!' });
        } catch (error) {
        console.error('changePassword:', error.message);
        res.status(500).json({ message: 'Erro ao alterar a senha.' });
    }
  }
}