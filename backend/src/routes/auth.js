const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.*,
              pv.id     AS pdv_id,
              pv.numero AS pdv_numero,
              pv.nombre AS pdv_nombre
       FROM usuario u
       LEFT JOIN app_usuario_pdv aup ON aup.usuario_id = u.id
       LEFT JOIN puntoventa pv       ON pv.id = aup.puntoventa_id
       WHERE u.codigoacesso = $1 AND u.habilitado = true`,
      [username.trim()]
    );

    const usuario = rows[0];
    if (!usuario || usuario.senha !== password) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const rol = usuario.superusuario ? 'superadmin' : 'pdv';
    const payload = {
      id:          usuario.id,
      nombre:      usuario.nome,
      username:    usuario.codigoacesso,
      rol,
      pdv_id:      usuario.pdv_id     || null,
      pdv_numero:  usuario.pdv_numero || null,
      pdv_nombre:  usuario.pdv_nombre || null,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, usuario: payload });
  } catch (e) {
    console.error('[auth/login]', e.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ usuario: req.user });
});

module.exports = router;
