const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function soloSuperAdmin(req, res, next) {
  if (req.user?.rol !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso denegado: se requiere superadmin' });
  }
  next();
}

module.exports = { authMiddleware, soloSuperAdmin };
