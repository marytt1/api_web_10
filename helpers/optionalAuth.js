const jwt = require('jsonwebtoken');

// Se vier um token válido, preenche req.user; se não, segue como visitante
module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      // token inválido: trata como visitante
    }
  }
  next();
};
