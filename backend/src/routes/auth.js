const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const usuario = db.prepare(`
    SELECT u.*, p.id as pdv_id, p.numero as pdv_numero, p.nombre as pdv_nombre
    FROM usuarios u
    LEFT JOIN puntos_de_venta p ON p.usuario_id = u.id
    WHERE u.username = ? AND u.activo = 1
  `).get(username);

  if (!usuario || !bcrypt.compareSync(password, usuario.password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const payload = {
    id: usuario.id,
    nombre: usuario.nombre,
    username: usuario.username,
    rol: usuario.rol,
    pdv_id: usuario.pdv_id || null,
    pdv_numero: usuario.pdv_numero || null,
    pdv_nombre: usuario.pdv_nombre || null,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, usuario: payload });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ usuario: req.user });
});

module.exports = router;
