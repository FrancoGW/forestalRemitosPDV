import { useEffect, useState, useCallback } from 'react';
import {
  Title, Text, Stack, SimpleGrid, Paper, Group,
  SegmentedControl, Button, Skeleton,
  Box, Grid,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title as ChartTitle,
  Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  IconReceipt2, IconScale, IconBuilding,
  IconTruck, IconRefresh, IconTrees,
} from '@tabler/icons-react';
import api from '../../api/client';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, ChartTitle, Tooltip, Legend, Filler
);

const VERDE   = '#2d8a39';
const VERDE_L = 'rgba(45,138,57,0.12)';
const AZUL    = '#339af0';
const AZUL_L  = 'rgba(51,154,240,0.12)';
const NARANJA = '#f59f00';
const VIOLETA = '#7950f2';
const ROJO    = '#fa5252';
const GRIS    = '#adb5bd';

const PALETTE = [VERDE, AZUL, NARANJA, VIOLETA, ROJO, '#12b886', '#fd7e14'];

type Periodo = 'dia' | 'semana' | 'mes' | 'año' | 'personalizado';

interface KPI {
  total_remitos: number; emitidos: number;
  total_toneladas: number; total_m3: number;
  total_movimientos: number; en_predio_ahora: number; total_pdvs: number;
}

interface Stats {
  kpis: KPI;
  lineas: {
    remitos: { label: string; total_remitos: number; toneladas: number; m3_total: number }[];
    camiones: { label: string; total: number }[];
  };
  porEspecie: { especie: string; toneladas: number; remitos: number }[];
  porEstado: { estado: string; total: number }[];
  topClientes: { cliente: string; toneladas: number; remitos: number }[];
  porProducto: { producto: string; m3: number; toneladas: number }[];
  porPdv: { pdv: string; numero: number; remitos: number; toneladas: number }[];
}

function KpiCard({ label, value, unit, sub, icon, color, size = 'md' }: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  size?: 'md' | 'sm';
}) {
  return (
    <Paper
      p={size === 'md' ? 'lg' : 'md'}
      style={{ border: '1px solid #e9ecef', background: '#fff', position: 'relative', overflow: 'hidden' }}
    >
      {/* barra lateral de color */}
      <Box
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: color,
        }}
      />
      <Stack gap={6} pl={4}>
        <Group gap={6} align="center" wrap="nowrap">
          <Box style={{ color, opacity: 0.8, display: 'flex', alignItems: 'center' }}>{icon}</Box>
          <Text
            size="xs" fw={600} c="dimmed"
            style={{ textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}
          >
            {label}
          </Text>
        </Group>

        <Group gap={6} align="baseline" wrap="nowrap">
          <Text
            fw={700}
            style={{
              fontSize: size === 'md' ? 32 : 24,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: '#1a1a1a',
            }}
          >
            {value}
          </Text>
          {unit && (
            <Text size="sm" c="dimmed" fw={500}>{unit}</Text>
          )}
        </Group>

        {sub && (
          <Text size="xs" c="dimmed">{sub}</Text>
        )}
      </Stack>
    </Paper>
  );
}

function ChartCard({ title, children, height = 240 }: { title: string; children: React.ReactNode; height?: number }) {
  return (
    <Paper p="lg" style={{ border: '1px solid #e9ecef', background: '#fff' }}>
      <Text size="xs" fw={600} c="dimmed" mb="md" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </Text>
      <Box style={{ height }}>{children}</Box>
    </Paper>
  );
}

const baseOpts = (titulo?: string) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: false },
    tooltip: { backgroundColor: '#1a1a1a', padding: 10, cornerRadius: 4 },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#adb5bd' } },
    y: { grid: { color: '#f1f3f5' }, ticks: { font: { size: 11 }, color: '#adb5bd' } },
  },
});

export default function PanelAdmin() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [rango, setRango] = useState<[Date | null, Date | null]>([null, null]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params: any = { periodo };
      if (periodo === 'personalizado' && rango[0] && rango[1]) {
        params.desde = rango[0].toISOString().slice(0, 10);
        params.hasta = rango[1].toISOString().slice(0, 10);
      }
      const { data } = await api.get('/admin/stats', { params });
      setStats(data);
    } finally {
      setCargando(false);
    }
  }, [periodo, rango]);

  useEffect(() => { cargar(); }, [cargar]);

  const fmt = (n: number | null | undefined, dec = 0) =>
    n != null ? n.toLocaleString('es-AR', { maximumFractionDigits: dec }) : '0';

  if (!stats && cargando) {
    return (
      <Stack gap="lg">
        <Skeleton height={40} w={300} />
        <SimpleGrid cols={4} spacing="md">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={100} />)}
        </SimpleGrid>
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={260} />)}
      </Stack>
    );
  }

  const k = stats?.kpis;
  const labels = stats?.lineas.remitos.map(r => r.label) ?? [];
  const camionLabels = stats?.lineas.camiones.map(c => c.label) ?? [];

  // ── Chart datasets ──────────────────────────────────────────────
  const lineaToneladas = {
    labels,
    datasets: [
      {
        label: 'Toneladas',
        data: stats?.lineas.remitos.map(r => r.toneladas) ?? [],
        borderColor: VERDE, backgroundColor: VERDE_L,
        borderWidth: 2, pointRadius: 3, fill: true, tension: 0.4,
      },
      {
        label: 'M³',
        data: stats?.lineas.remitos.map(r => r.m3_total ?? 0) ?? [],
        borderColor: AZUL, backgroundColor: AZUL_L,
        borderWidth: 2, pointRadius: 3, fill: true, tension: 0.4,
      },
    ],
  };

  const lineaCamiones = {
    labels: camionLabels,
    datasets: [{
      label: 'Camiones',
      data: stats?.lineas.camiones.map(c => c.total) ?? [],
      borderColor: NARANJA, backgroundColor: 'rgba(245,159,0,0.12)',
      borderWidth: 2, pointRadius: 4, fill: true, tension: 0.4,
    }],
  };

  const doughnutEstado = {
    labels: stats?.porEstado.map(e => e.estado.charAt(0).toUpperCase() + e.estado.slice(1)) ?? [],
    datasets: [{
      data: stats?.porEstado.map(e => e.total) ?? [],
      backgroundColor: [VERDE, GRIS, ROJO],
      borderWidth: 0, hoverOffset: 8,
    }],
  };

  const barEspecie = {
    labels: stats?.porEspecie.map(e => e.especie) ?? [],
    datasets: [{
      label: 'Toneladas',
      data: stats?.porEspecie.map(e => e.toneladas) ?? [],
      backgroundColor: stats?.porEspecie.map((_, i) => PALETTE[i % PALETTE.length]) ?? [],
      borderRadius: 3, borderSkipped: false,
    }],
  };

  const barClientes = {
    labels: stats?.topClientes.map(c => c.cliente) ?? [],
    datasets: [{
      label: 'Toneladas',
      data: stats?.topClientes.map(c => c.toneladas) ?? [],
      backgroundColor: AZUL, borderRadius: 3,
    }],
  };

  const barProducto = {
    labels: stats?.porProducto.map(p => p.producto) ?? [],
    datasets: [
      {
        label: 'Toneladas',
        data: stats?.porProducto.map(p => p.toneladas) ?? [],
        backgroundColor: VERDE, borderRadius: 3,
      },
      {
        label: 'M³',
        data: stats?.porProducto.map(p => p.m3) ?? [],
        backgroundColor: VIOLETA, borderRadius: 3,
      },
    ],
  };

  const barPdv = {
    labels: stats?.porPdv.map(p => `PDV ${p.numero}`) ?? [],
    datasets: [{
      label: 'Toneladas',
      data: stats?.porPdv.map(p => p.toneladas) ?? [],
      backgroundColor: stats?.porPdv.map((_, i) => PALETTE[i % PALETTE.length]) ?? [],
      borderRadius: 3,
    }],
  };

  const optsLinea = {
    ...baseOpts(),
    plugins: {
      ...baseOpts().plugins,
      legend: { display: true, position: 'top' as const, labels: { font: { size: 11 }, padding: 16, usePointStyle: true } },
    },
  };

  const optsBarH = {
    ...baseOpts(),
    indexAxis: 'y' as const,
    scales: {
      x: { grid: { color: '#f1f3f5' }, ticks: { font: { size: 11 }, color: '#adb5bd' } },
      y: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#495057' } },
    },
  };

  const optsBarMulti = {
    ...baseOpts(),
    plugins: {
      ...baseOpts().plugins,
      legend: { display: true, position: 'top' as const, labels: { font: { size: 11 }, padding: 16, usePointStyle: true } },
    },
  };

  const optsDoughnut = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { size: 12 }, padding: 16, usePointStyle: true } },
      tooltip: { backgroundColor: '#1a1a1a', padding: 10, cornerRadius: 4 },
    },
    cutout: '68%',
  };

  return (
    <Stack gap="xl">
      {/* Header */}
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <div>
          <Title order={2} fw={600} style={{ letterSpacing: '-0.02em' }}>Panel de Control</Title>
          <Text c="dimmed" size="sm" mt={2}>Análisis y estadísticas del sistema</Text>
        </div>
        <Group gap="xs">
          <Button
            size="xs"
            variant="default"
            leftSection={<IconRefresh size={13} />}
            loading={cargando}
            onClick={cargar}
          >
            Actualizar
          </Button>
        </Group>
      </Group>

      {/* Selector de período */}
      <Paper p="md" style={{ border: '1px solid #e9ecef', background: '#fff' }}>
        <Group gap="md" align="flex-end" wrap="wrap">
          <div>
            <Text size="xs" fw={600} c="dimmed" mb={6} style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Período
            </Text>
            <SegmentedControl
              value={periodo}
              onChange={(v) => setPeriodo(v as Periodo)}
              data={[
                { label: 'Hoy', value: 'dia' },
                { label: '7 días', value: 'semana' },
                { label: '30 días', value: 'mes' },
                { label: '12 meses', value: 'año' },
                { label: 'Personalizado', value: 'personalizado' },
              ]}
              size="xs"
            />
          </div>
          {periodo === 'personalizado' && (
            <DatePickerInput
              type="range"
              placeholder="Desde — Hasta"
              value={rango}
              onChange={setRango}
              valueFormat="DD/MM/YY"
              size="xs"
              clearable
            />
          )}
        </Group>
      </Paper>

      {/* KPIs — fila principal */}
      <SimpleGrid cols={{ base: 2, sm: 2, md: 4 }} spacing="md">
        <KpiCard
          label="Total Remitos"
          value={fmt(k?.total_remitos)}
          sub={`${fmt(k?.emitidos)} emitidos (${k ? Math.round((k.emitidos / Math.max(k.total_remitos, 1)) * 100) : 0}%)`}
          icon={<IconReceipt2 size={15} strokeWidth={1.8} />}
          color={VERDE}
        />
        <KpiCard
          label="Toneladas ingresadas"
          value={fmt(k?.total_toneladas, 1)}
          unit="tn"
          icon={<IconScale size={15} strokeWidth={1.8} />}
          color={NARANJA}
        />
        <KpiCard
          label="M³ vendidos"
          value={fmt(k?.total_m3, 1)}
          unit="m³"
          icon={<IconTrees size={15} strokeWidth={1.8} />}
          color={VIOLETA}
        />
        <KpiCard
          label="Movimientos camiones"
          value={fmt(k?.total_movimientos)}
          sub={`${fmt(k?.en_predio_ahora)} en predio ahora`}
          icon={<IconTruck size={15} strokeWidth={1.8} />}
          color={AZUL}
        />
      </SimpleGrid>

      {/* KPIs — fila secundaria */}
      <SimpleGrid cols={{ base: 3, sm: 3 }} spacing="md">
        <KpiCard
          label="PDVs activos"
          value={fmt(k?.total_pdvs)}
          icon={<IconBuilding size={13} strokeWidth={1.8} />}
          color="#fd7e14"
          size="sm"
        />
        <KpiCard
          label="En predio ahora"
          value={fmt(k?.en_predio_ahora)}
          icon={<IconTruck size={13} strokeWidth={1.8} />}
          color={ROJO}
          size="sm"
        />
        <KpiCard
          label="Tasa de emisión"
          value={`${k ? Math.round((k.emitidos / Math.max(k.total_remitos, 1)) * 100) : 0}%`}
          sub={`${fmt(k?.emitidos)} de ${fmt(k?.total_remitos)} remitos`}
          icon={<IconReceipt2 size={13} strokeWidth={1.8} />}
          color={VERDE}
          size="sm"
        />
      </SimpleGrid>

      {/* Fila 1: Líneas principales */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <ChartCard title="Toneladas y M³ por período" height={260}>
            <Line data={lineaToneladas} options={optsLinea} />
          </ChartCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <ChartCard title="Remitos por estado" height={260}>
            <Doughnut data={doughnutEstado} options={optsDoughnut} />
          </ChartCard>
        </Grid.Col>
      </Grid>

      {/* Fila 2: Camiones + Especie */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <ChartCard title="Entradas de camiones por período" height={240}>
            <Line data={lineaCamiones} options={baseOpts()} />
          </ChartCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <ChartCard title="Toneladas por especie" height={240}>
            <Bar data={barEspecie} options={baseOpts()} />
          </ChartCard>
        </Grid.Col>
      </Grid>

      {/* Fila 3: Clientes + Producto */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <ChartCard title="Top clientes — Toneladas acumuladas" height={260}>
            <Bar data={barClientes} options={optsBarH} />
          </ChartCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <ChartCard title="Toneladas y M³ por producto" height={260}>
            <Bar data={barProducto} options={optsBarMulti} />
          </ChartCard>
        </Grid.Col>
      </Grid>

      {/* Fila 4: PDV */}
      <ChartCard title="Toneladas por Punto de Venta" height={200}>
        <Bar data={barPdv} options={baseOpts()} />
      </ChartCard>
    </Stack>
  );
}
