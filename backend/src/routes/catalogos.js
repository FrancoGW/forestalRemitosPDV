const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/productos', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre FROM producto WHERE habilitado = true ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/especies', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre FROM especie WHERE habilitado = true ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/balanzas', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre FROM balanza WHERE habilitado = true ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/predios', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, codigo FROM predio WHERE habilitado = true ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/clientes', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, COALESCE(nombre1, nrocuit, 'Sin nombre') AS nombre, nrocuit
       FROM cliente WHERE habilitado = true ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/empresas-transporte', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, COALESCE(nombre1, nrocuit, 'Sin nombre') AS nombre, nrocuit
       FROM empresatransporte ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/camiones', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.patente,
              COALESCE(c.marca,'') AS marca,
              COALESCE(c.modelo,'') AS modelo,
              qr.codigo
       FROM camion c
       LEFT JOIN app_camion_qr qr ON qr.camion_id = c.id
       ORDER BY c.patente ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/categorias', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre FROM categoria WHERE habilitado = true ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/subcategorias', async (req, res) => {
  try {
    const { categoria_id } = req.query;
    const params = categoria_id ? [categoria_id] : [];
    const where = categoria_id ? 'WHERE habilitado = true AND categoria_id = $1' : 'WHERE habilitado = true';
    const { rows } = await pool.query(
      `SELECT id, nombre, categoria_id FROM subcategoria ${where} ORDER BY nombre ASC`,
      params
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
