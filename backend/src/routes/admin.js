const express = require('express');
const { pool } = require('../db');
const { authMiddleware, soloSuperAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware, soloSuperAdmin);

router.get('/stats', async (req, res) => {
  try {
    const { periodo = 'semana', desde, hasta } = req.query;

    const hoy = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);

    let fechaDesde, fechaHasta, groupExpr;
    let historico = false;

    switch (periodo) {
      case 'historico': {
        historico = true;
        groupExpr = `TO_CHAR(fecha, 'YYYY-MM')`;
        break;
      }
      case 'dia': {
        fechaDesde = fmt(hoy);
        fechaHasta = fmt(hoy);
        groupExpr = `TO_CHAR(fecha, 'HH24:00')`;
        break;
      }
      case 'semana': {
        const d = new Date(hoy); d.setDate(d.getDate() - 5);
        fechaDesde = fmt(d); fechaHasta = fmt(hoy);
        groupExpr = `TO_CHAR(fecha, 'YYYY-MM-DD')`;
        break;
      }
      case 'mes': {
        const d = new Date(hoy); d.setDate(d.getDate() - 29);
        fechaDesde = fmt(d); fechaHasta = fmt(hoy);
        groupExpr = `TO_CHAR(fecha, 'YYYY-MM-DD')`;
        break;
      }
      case 'año': {
        const d = new Date(hoy); d.setMonth(d.getMonth() - 11); d.setDate(1);
        fechaDesde = fmt(d); fechaHasta = fmt(hoy);
        groupExpr = `TO_CHAR(fecha, 'YYYY-MM')`;
        break;
      }
      case 'personalizado': {
        fechaDesde = desde || fmt(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
        fechaHasta = hasta || fmt(hoy);
        // Si el rango supera 60 días agrupar por mes, si no por día
        const dias = Math.round((new Date(fechaHasta) - new Date(fechaDesde)) / 86400000);
        groupExpr = dias > 60
          ? `TO_CHAR(fecha, 'YYYY-MM')`
          : `TO_CHAR(fecha, 'YYYY-MM-DD')`;
        break;
      }
      default: {
        const d = new Date(hoy); d.setDate(d.getDate() - 5);
        fechaDesde = fmt(d); fechaHasta = fmt(hoy);
        groupExpr = `TO_CHAR(fecha, 'YYYY-MM-DD')`;
      }
    }

    // Cláusula WHERE de fechas para despacho
    const dateWhere = historico
      ? ''
      : `AND fecha::date >= $1 AND fecha::date <= $2`;
    const dateParams = historico ? [] : [fechaDesde, fechaHasta];

    // Cláusula WHERE de fechas para app_movimientos
    const movGroupExpr = historico
      ? `TO_CHAR(fecha_entrada, 'YYYY-MM')`
      : (periodo === 'año' || (periodo === 'personalizado' && groupExpr.includes('YYYY-MM')))
        ? `TO_CHAR(fecha_entrada, 'YYYY-MM')`
        : periodo === 'dia'
          ? `TO_CHAR(fecha_entrada, 'HH24:00')`
          : `TO_CHAR(fecha_entrada, 'YYYY-MM-DD')`;

    const movDateWhere = historico
      ? ''
      : `AND fecha_entrada::date >= $1 AND fecha_entrada::date <= $2`;

    const [
      remitosLinea,
      camionesLinea,
      porEspecie,
      porEstado,
      topClientes,
      porProducto,
      kpisRow,
      kpiPdvs,
      kpiMovs,
      porPdv,
      topCamiones,
      camionePorPredio,
    ] = await Promise.all([

      // Remitos + toneladas por período
      pool.query(`
        SELECT
          ${groupExpr} AS label,
          COUNT(*) AS total_remitos,
          ROUND(SUM(CASE WHEN estado_id IN (2,3) THEN (pesobruto - taracamion) ELSE 0 END)::numeric, 2) AS toneladas,
          ROUND(SUM(CASE WHEN estado_id IN (2,3) THEN COALESCE(m3, 0) ELSE 0 END)::numeric, 2)         AS m3_total
        FROM despacho
        WHERE 1=1 ${dateWhere}
        GROUP BY 1
        ORDER BY 1 ASC
      `, dateParams),

      // Movimientos de camiones por período
      pool.query(`
        SELECT
          ${movGroupExpr} AS label,
          COUNT(*) AS total
        FROM app_movimientos
        WHERE 1=1 ${movDateWhere}
        GROUP BY 1
        ORDER BY 1 ASC
      `, dateParams),

      // Toneladas por especie (filtrado por período)
      pool.query(`
        SELECT
          COALESCE(e.nombre, 'Sin especie') AS especie,
          ROUND(SUM(d.pesobruto - d.taracamion)::numeric, 2) AS toneladas,
          COUNT(*) AS remitos
        FROM despacho d
        LEFT JOIN especie e ON e.id = d.especie_id
        WHERE d.estado_id = 3 ${historico ? '' : 'AND d.fecha::date >= $1 AND d.fecha::date <= $2'}
        GROUP BY e.nombre
        ORDER BY toneladas DESC
        LIMIT 10
      `, dateParams),

      // Remitos por estado (filtrado por período)
      pool.query(`
        SELECT
          CASE estado_id WHEN 4 THEN 'anulado'
                         WHEN 3 THEN 'emitido'
                         ELSE 'borrador' END AS estado,
          COUNT(*) AS total
        FROM despacho
        WHERE 1=1 ${dateWhere}
        GROUP BY
          CASE estado_id WHEN 4 THEN 'anulado'
                         WHEN 3 THEN 'emitido'
                         ELSE 'borrador' END
      `, dateParams),

      // Top 6 clientes por toneladas (filtrado por período)
      pool.query(`
        SELECT
          COALESCE(c.nombre1, 'Sin cliente') AS cliente,
          ROUND(SUM(d.pesobruto - d.taracamion)::numeric, 2) AS toneladas,
          COUNT(*) AS remitos
        FROM despacho d
        LEFT JOIN cliente c ON c.id = d.cliente_id
        WHERE d.estado_id = 3 ${historico ? '' : 'AND d.fecha::date >= $1 AND d.fecha::date <= $2'}
        GROUP BY c.nombre1
        ORDER BY toneladas DESC
        LIMIT 6
      `, dateParams),

      // Toneladas y M³ por producto (filtrado por período)
      pool.query(`
        SELECT
          COALESCE(p.nombre, 'Sin producto') AS producto,
          ROUND(SUM(d.pesobruto - d.taracamion)::numeric, 2)  AS toneladas,
          ROUND(SUM(COALESCE(d.m3, 0))::numeric, 2)           AS m3
        FROM despacho d
        LEFT JOIN producto p ON p.id = d.producto_id
        WHERE d.estado_id = 3 ${historico ? '' : 'AND d.fecha::date >= $1 AND d.fecha::date <= $2'}
        GROUP BY p.nombre
        ORDER BY toneladas DESC
      `, dateParams),

      // KPIs filtrados por período
      pool.query(`
        SELECT
          COUNT(*) AS total_remitos,
          SUM(CASE WHEN estado_id = 3 THEN 1 ELSE 0 END) AS emitidos,
          ROUND(SUM(CASE WHEN estado_id = 3 THEN (pesobruto - taracamion) ELSE 0 END)::numeric, 1) AS total_toneladas,
          ROUND(SUM(CASE WHEN estado_id = 3 THEN COALESCE(m3, 0) ELSE 0 END)::numeric, 1) AS total_m3,
          COUNT(DISTINCT camion_id) AS camiones_unicos
        FROM despacho
        WHERE 1=1 ${dateWhere}
      `, dateParams),

      // KPI PDVs activos (siempre global)
      pool.query(`SELECT COUNT(*) AS total FROM puntoventa WHERE mostrar = true`, []),

      // KPI movimientos (filtrado por período)
      pool.query(`
        SELECT
          COUNT(*) AS total_movimientos,
          SUM(CASE WHEN estado = 'en_predio' THEN 1 ELSE 0 END) AS en_predio_ahora
        FROM app_movimientos
        WHERE 1=1 ${movDateWhere}
      `, dateParams),

      // Actividad por PDV (filtrado por período)
      pool.query(`
        SELECT
          pv.nombre AS pdv, pv.numero,
          COUNT(d.id) AS remitos,
          ROUND(SUM(CASE WHEN d.estado_id = 3 THEN (d.pesobruto - d.taracamion) ELSE 0 END)::numeric, 2) AS toneladas
        FROM puntoventa pv
        LEFT JOIN despacho d ON d.puntoventa_id = pv.id
          ${historico ? '' : 'AND d.fecha::date >= $1 AND d.fecha::date <= $2'}
        GROUP BY pv.id, pv.nombre, pv.numero
        ORDER BY toneladas DESC NULLS LAST
        LIMIT 20
      `, dateParams),

      // Top camiones despachados (patente + cantidad de despachos + toneladas)
      pool.query(`
        SELECT
          COALESCE(cam.patente, 'Sin patente') AS patente,
          COUNT(d.id) AS despachos,
          ROUND(SUM(CASE WHEN d.estado_id = 3 THEN (d.pesobruto - d.taracamion) ELSE 0 END)::numeric, 1) AS toneladas
        FROM despacho d
        LEFT JOIN camion cam ON cam.id = d.camion_id
        WHERE d.camion_id IS NOT NULL ${dateWhere}
        GROUP BY cam.patente
        ORDER BY despachos DESC
        LIMIT 10
      `, dateParams),

      // Camiones despachados por predio (top 10 predios con más despachos únicos de camiones)
      pool.query(`
        SELECT
          COALESCE(pr.nombre, 'Sin predio') AS predio,
          COUNT(DISTINCT d.camion_id)        AS camiones_unicos,
          COUNT(d.id)                        AS despachos
        FROM despacho d
        LEFT JOIN predio pr ON pr.id = d.predio_id
        WHERE d.camion_id IS NOT NULL ${dateWhere}
        GROUP BY pr.nombre
        ORDER BY despachos DESC
        LIMIT 10
      `, dateParams),
    ]);

    const kpis = kpisRow.rows[0];
    const n = (v) => parseFloat(v) || 0;
    const ni = (v) => parseInt(v) || 0;

    res.json({
      periodo: { desde: fechaDesde, hasta: fechaHasta, tipo: periodo },
      lineas: {
        remitos: remitosLinea.rows.map((r) => ({
          label:         r.label,
          total_remitos: ni(r.total_remitos),
          toneladas:     n(r.toneladas),
          m3_total:      n(r.m3_total),
        })),
        camiones: camionesLinea.rows.map((r) => ({
          label: r.label,
          total: ni(r.total),
        })),
      },
      porEspecie: porEspecie.rows.map((r) => ({
        especie:   r.especie,
        toneladas: n(r.toneladas),
        remitos:   ni(r.remitos),
      })),
      porEstado: porEstado.rows.map((r) => ({
        estado: r.estado,
        total:  ni(r.total),
      })),
      topClientes: topClientes.rows.map((r) => ({
        cliente:   r.cliente,
        toneladas: n(r.toneladas),
        remitos:   ni(r.remitos),
      })),
      porProducto: porProducto.rows.map((r) => ({
        producto:  r.producto,
        toneladas: n(r.toneladas),
        m3:        n(r.m3),
      })),
      porPdv: porPdv.rows.map((r) => ({
        pdv:       r.pdv,
        numero:    ni(r.numero),
        remitos:   ni(r.remitos),
        toneladas: n(r.toneladas),
      })),
      topCamiones: topCamiones.rows.map((r) => ({
        patente:   r.patente,
        despachos: ni(r.despachos),
        toneladas: n(r.toneladas),
      })),
      camionePorPredio: camionePorPredio.rows.map((r) => ({
        predio:          r.predio,
        camiones_unicos: ni(r.camiones_unicos),
        despachos:       ni(r.despachos),
      })),
      kpis: {
        total_remitos:     ni(kpis.total_remitos),
        emitidos:          ni(kpis.emitidos),
        total_toneladas:   n(kpis.total_toneladas),
        total_m3:          n(kpis.total_m3),
        camiones_unicos:   ni(kpis.camiones_unicos),
        total_movimientos: ni(kpiMovs.rows[0].total_movimientos),
        en_predio_ahora:   ni(kpiMovs.rows[0].en_predio_ahora),
        total_pdvs:        ni(kpiPdvs.rows[0].total),
      },
    });
  } catch (e) {
    console.error('[GET /admin/stats]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
