const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('../db');
const { authMiddleware, soloSuperAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware, soloSuperAdmin);

// Estado del seed (solo lectura)
router.get('/seed-demo/estado', (req, res) => {
  const cargado = !!db.prepare("SELECT id FROM usuarios WHERE username = 'test'").get();
  res.json({ cargado });
});

// ── Seed demo ──────────────────────────────────────────────────────────────
router.post('/seed-demo', (req, res) => {
  const yaExiste = db.prepare("SELECT id FROM usuarios WHERE username = 'test'").get();
  if (yaExiste) {
    return res.status(409).json({ error: 'Los datos de demo ya fueron cargados anteriormente.' });
  }
  const clientes   = ['FEPAL S.A.', 'Madera Norte S.R.L.', 'Tableros del Sur', 'Aserradero García', 'Pino del Este S.A.'];
  const predios    = ['Toro Cuare', 'Las Palmas', 'El Pinar', 'Monte Verde', 'Los Aromos'];
  const especies   = ['Pino', 'Eucalipto', 'Álamo'];
  const productos  = ['Aserrable', 'Triturado', 'Debobinado'];
  const categorias = ['Super Grueso', 'Grueso', 'Mediano', 'Fino'];
  const empresas   = ['CASTELFIDARDO SA', 'Maderera Sur S.A.', 'Extracciones Norte', 'LogForest SA'];
  const balanzas   = ['La Fuente', 'El Alamo', 'Central'];
  const patentes   = ['SDR 830', 'RDW 661', 'ABC 123', 'XYZ 789', 'MNP 456', 'QRS 012'];
  const conductores= ['Fernandez Benjamin', 'García Carlos', 'López Marcos', 'Soria Pablo', 'Ruiz Diego'];
  const transportes= ['Seubert German', 'García Transporte', 'López Fletes', 'Trans Norte'];
  const rodales    = ['45', '12', '7', '33', '21', '18', '55'];

  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randNum = (min, max) => +(Math.random() * (max - min) + min).toFixed(2);
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().replace('T', ' ').slice(0, 19);
  };

  db.exec('BEGIN');
  try {
    // PDV test
    let pdvId;
    const existeUser = db.prepare("SELECT id FROM usuarios WHERE username = 'test'").get();
    if (!existeUser) {
      const hash = bcrypt.hashSync('test', 10);
      const { lastInsertRowid: userId } = db.prepare(
        "INSERT INTO usuarios (nombre, username, password, rol) VALUES ('PDV Test', 'test', ?, 'pdv')"
      ).run(hash);
      const existePdv = db.prepare("SELECT id FROM puntos_de_venta WHERE numero = 99").get();
      if (!existePdv) {
        const { lastInsertRowid } = db.prepare(
          "INSERT INTO puntos_de_venta (numero, nombre, usuario_id) VALUES (99, 'PDV Demo', ?)"
        ).run(userId);
        pdvId = lastInsertRowid;
      } else {
        pdvId = existePdv.id;
      }
    } else {
      const pdvRow = db.prepare("SELECT p.id FROM puntos_de_venta p JOIN usuarios u ON u.id = p.usuario_id WHERE u.username='test'").get();
      pdvId = pdvRow?.id;
    }

    if (!pdvId) throw new Error('No se pudo obtener pdvId');

    // Camiones
    const codigosCamion = [];
    for (const pat of patentes) {
      const existe = db.prepare("SELECT id, codigo FROM camiones WHERE patente = ?").get(pat);
      if (existe) {
        codigosCamion.push({ id: existe.id, codigo: existe.codigo });
      } else {
        const codigo = crypto.randomUUID();
        const { lastInsertRowid } = db.prepare(
          "INSERT INTO camiones (codigo, nombre, patente, cliente) VALUES (?, ?, ?, ?)"
        ).run(codigo, `Camión ${pat}`, pat, rand(clientes));
        codigosCamion.push({ id: lastInsertRowid, codigo });
      }
    }

    // Remitos — 80 registros en los últimos 90 días
    const stmtRemito = db.prepare(`
      INSERT INTO remitos (
        numero, pdv_id, fecha_emision, cliente, predio, rodal, producto, especie,
        categoria, sub_categoria, empresa_elaboracion, empresa_extraccion, empresa_carga,
        balanza, patente_camion, tara, peso_bruto, toneladas_cliente, patente_acoplado,
        m3, largos, transporte, nombre_conductor, dni_conductor, distancia_km, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const ultimoNum = db.prepare("SELECT MAX(numero) as m FROM remitos WHERE pdv_id = ?").get(pdvId);
    let numBase = (ultimoNum?.m || 0) + 1;

    for (let i = 0; i < 80; i++) {
      const diasAtras = Math.floor(Math.random() * 90);
      const tara = randNum(10, 18);
      const pesoBruto = randNum(30, 52);
      const cat = rand(categorias);
      const estado = Math.random() > 0.15 ? 'emitido' : (Math.random() > 0.5 ? 'borrador' : 'anulado');
      stmtRemito.run(
        numBase++, pdvId, daysAgo(diasAtras),
        rand(clientes), rand(predios), rand(rodales),
        rand(productos), rand(especies), cat, cat,
        rand(empresas), rand(empresas), rand(empresas),
        rand(balanzas), rand(patentes),
        tara, pesoBruto, pesoBruto - tara,
        rand(patentes), randNum(20, 50), '3.15',
        rand(transportes), rand(conductores),
        `${Math.floor(Math.random() * 30000000 + 10000000)}`,
        randNum(10, 200), estado
      );
    }

    // Movimientos
    const stmtMov = db.prepare(
      "INSERT INTO movimientos (camion_id, pdv_id, fecha_entrada, fecha_salida, estado) VALUES (?, ?, ?, ?, ?)"
    );
    for (let i = 0; i < 60; i++) {
      const diasAtras = Math.floor(Math.random() * 60);
      const entrada = daysAgo(diasAtras);
      const camion = codigosCamion[Math.floor(Math.random() * codigosCamion.length)];
      const salio = Math.random() > 0.1;
      const salida = salio
        ? new Date(new Date(entrada).getTime() + Math.floor(Math.random() * 7200000 + 1800000))
            .toISOString().replace('T', ' ').slice(0, 19)
        : null;
      stmtMov.run(camion.id, pdvId, entrada, salida, salio ? 'salio' : 'en_predio');
    }

    db.exec('COMMIT');
    res.json({ mensaje: 'Datos de demo cargados. Usuario: test / Contraseña: test', pdvId });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: e.message });
  }
});

// ── Stats ──────────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const { periodo = 'semana', desde, hasta } = req.query;

  let fechaDesde, fechaHasta, groupBy, labelFormat;

  const hoy = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  switch (periodo) {
    case 'dia': {
      fechaDesde = fmt(hoy);
      fechaHasta = fmt(hoy);
      groupBy = "strftime('%H:00', fecha_emision)";
      labelFormat = "strftime('%H:00', fecha_emision)";
      break;
    }
    case 'semana': {
      const d = new Date(hoy); d.setDate(d.getDate() - 6);
      fechaDesde = fmt(d); fechaHasta = fmt(hoy);
      groupBy = "DATE(fecha_emision)";
      labelFormat = "DATE(fecha_emision)";
      break;
    }
    case 'mes': {
      const d = new Date(hoy); d.setDate(d.getDate() - 29);
      fechaDesde = fmt(d); fechaHasta = fmt(hoy);
      groupBy = "DATE(fecha_emision)";
      labelFormat = "DATE(fecha_emision)";
      break;
    }
    case 'año': {
      const d = new Date(hoy); d.setMonth(d.getMonth() - 11); d.setDate(1);
      fechaDesde = fmt(d); fechaHasta = fmt(hoy);
      groupBy = "strftime('%Y-%m', fecha_emision)";
      labelFormat = "strftime('%Y-%m', fecha_emision)";
      break;
    }
    case 'personalizado': {
      fechaDesde = desde || fmt(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
      fechaHasta = hasta || fmt(hoy);
      groupBy = "DATE(fecha_emision)";
      labelFormat = "DATE(fecha_emision)";
      break;
    }
    default: {
      const d = new Date(hoy); d.setDate(d.getDate() - 6);
      fechaDesde = fmt(d); fechaHasta = fmt(hoy);
      groupBy = "DATE(fecha_emision)"; labelFormat = "DATE(fecha_emision)";
    }
  }

  // Remitos + toneladas por período
  const remitosLinea = db.prepare(`
    SELECT ${labelFormat} as label,
      COUNT(*) as total_remitos,
      ROUND(SUM(CASE WHEN estado='emitido' THEN toneladas_ingresada ELSE 0 END), 2) as toneladas,
      ROUND(SUM(CASE WHEN estado='emitido' THEN m3 ELSE 0 END), 2) as m3_total
    FROM remitos
    WHERE DATE(fecha_emision) >= ? AND DATE(fecha_emision) <= ?
    GROUP BY ${groupBy}
    ORDER BY label ASC
  `).all(fechaDesde, fechaHasta);

  // Camiones por período
  const camionesLinea = db.prepare(`
    SELECT ${periodo === 'año'
      ? "strftime('%Y-%m', fecha_entrada)"
      : (periodo === 'dia' ? "strftime('%H:00', fecha_entrada)" : "DATE(fecha_entrada)")} as label,
      COUNT(*) as total
    FROM movimientos
    WHERE DATE(fecha_entrada) >= ? AND DATE(fecha_entrada) <= ?
    GROUP BY label
    ORDER BY label ASC
  `).all(fechaDesde, fechaHasta);

  // Toneladas por especie (acumulado total)
  const porEspecie = db.prepare(`
    SELECT especie, ROUND(SUM(toneladas_ingresada), 2) as toneladas, COUNT(*) as remitos
    FROM remitos WHERE estado = 'emitido'
    GROUP BY especie ORDER BY toneladas DESC
  `).all();

  // Remitos por estado
  const porEstado = db.prepare(`
    SELECT estado, COUNT(*) as total FROM remitos GROUP BY estado
  `).all();

  // Top 5 clientes por toneladas
  const topClientes = db.prepare(`
    SELECT cliente, ROUND(SUM(toneladas_ingresada), 2) as toneladas, COUNT(*) as remitos
    FROM remitos WHERE estado = 'emitido'
    GROUP BY cliente ORDER BY toneladas DESC LIMIT 6
  `).all();

  // M3 por producto
  const porProducto = db.prepare(`
    SELECT producto,
      ROUND(SUM(CASE WHEN m3 IS NOT NULL THEN m3 ELSE 0 END), 2) as m3,
      ROUND(SUM(toneladas_ingresada), 2) as toneladas
    FROM remitos WHERE estado = 'emitido'
    GROUP BY producto ORDER BY toneladas DESC
  `).all();

  // KPIs totales
  const kpis = db.prepare(`
    SELECT
      COUNT(*) as total_remitos,
      SUM(CASE WHEN estado='emitido' THEN 1 ELSE 0 END) as emitidos,
      ROUND(SUM(CASE WHEN estado='emitido' THEN toneladas_ingresada ELSE 0 END), 2) as total_toneladas,
      ROUND(SUM(CASE WHEN estado='emitido' THEN m3 ELSE 0 END), 2) as total_m3
    FROM remitos
  `).get();

  const kpiCamiones = db.prepare(`
    SELECT
      COUNT(*) as total_movimientos,
      SUM(CASE WHEN estado='en_predio' THEN 1 ELSE 0 END) as en_predio_ahora
    FROM movimientos
  `).get();

  const kpiPdvs = db.prepare("SELECT COUNT(*) as total FROM puntos_de_venta WHERE activo = 1").get();

  // Actividad por PDV
  const porPdv = db.prepare(`
    SELECT p.nombre as pdv, p.numero,
      COUNT(r.id) as remitos,
      ROUND(SUM(CASE WHEN r.estado='emitido' THEN r.toneladas_ingresada ELSE 0 END), 2) as toneladas
    FROM puntos_de_venta p
    LEFT JOIN remitos r ON r.pdv_id = p.id
    GROUP BY p.id ORDER BY toneladas DESC
  `).all();

  res.json({
    periodo: { desde: fechaDesde, hasta: fechaHasta, tipo: periodo },
    lineas: { remitos: remitosLinea, camiones: camionesLinea },
    porEspecie,
    porEstado,
    topClientes,
    porProducto,
    porPdv,
    kpis: { ...kpis, ...kpiCamiones, total_pdvs: kpiPdvs.total },
  });
});

module.exports = router;
