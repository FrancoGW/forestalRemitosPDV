import { useCallback, useEffect, useState } from 'react';
import {
  Title, Text, Stack, Button, Group, Paper, Badge,
  Modal, TextInput, Table, ActionIcon, Tooltip, Skeleton,
  Alert, Box, Tabs, SimpleGrid, SegmentedControl,
  Select, Grid, Pagination,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { DatePickerInput } from '@mantine/dates';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Title as ChartTitle,
  Tooltip as ChartTooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  IconPlus, IconTrash, IconTruck, IconRefresh, IconNfc,
  IconLink, IconAlertCircle, IconChartBar,
  IconClock, IconBuildingWarehouse, IconSearch,
} from '@tabler/icons-react';
import api from '../../api/client';
import { notifications } from '@mantine/notifications';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, ChartTitle, ChartTooltip, Legend, Filler
);

const VERDE   = '#2d8a39';
const NARANJA = '#f59f00';
const AZUL    = '#339af0';
const VIOLETA = '#7950f2';
const ROJO    = '#fa5252';
const PALETTE = [VERDE, AZUL, NARANJA, VIOLETA, ROJO, '#12b886', '#fd7e14'];

type Periodo = 'historico' | 'hoy' | 'semana' | 'mes' | 'año' | 'personalizado';

interface Camion {
  id: number;
  patente: string;
  marca: string | null;
  modelo: string | null;
  nfc_id: number | null;
  nfc_uid: string | null;
  nfc_alias: string | null;
  nfc_activo: boolean | null;
  total_visitas: number;
  en_predio: number;
  total_remitos: number;
  remitos_emitidos: number;
}

interface Llavero {
  id: number;
  uid_nfc: string;
  alias: string | null;
  activo: boolean;
  creado_en: string;
  camion_id: number | null;
  camion_patente: string | null;
  camion_marca: string | null;
  camion_modelo: string | null;
}

interface Stats {
  kpis: { total_ingresos: number; camiones_unicos: number; en_predio_ahora: number; horas_promedio: number };
  enPredio: { id: number; patente: string; marca: string | null; fecha_entrada: string; pdv_nombre: string }[];
  linea: { label: string; ingresos: number }[];
  topPatentes: { patente: string; ingresos: number; horas_promedio: number }[];
  porPdv: { pdv: string; numero: number; ingresos: number }[];
}

function KpiCard({ label, value, unit, sub, icon, color }: {
  label: string; value: string | number; unit?: string; sub?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <Paper p="lg" style={{ border: '1px solid #e9ecef', background: '#fff', position: 'relative', overflow: 'hidden' }}>
      <Box style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />
      <Stack gap={6} pl={4}>
        <Group gap={6} align="center" wrap="nowrap">
          <Box style={{ color, opacity: 0.8, display: 'flex', alignItems: 'center' }}>{icon}</Box>
          <Text size="xs" fw={600} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</Text>
        </Group>
        <Group gap={6} align="baseline" wrap="nowrap">
          <Text fw={700} style={{ fontSize: 28, letterSpacing: '-0.03em', lineHeight: 1, color: '#1a1a1a' }}>{value}</Text>
          {unit && <Text size="sm" c="dimmed" fw={500}>{unit}</Text>}
        </Group>
        {sub && <Text size="xs" c="dimmed">{sub}</Text>}
      </Stack>
    </Paper>
  );
}

function ChartCard({ title, children, height = 240 }: { title: string; children: React.ReactNode; height?: number }) {
  return (
    <Paper p="lg" style={{ border: '1px solid #e9ecef', background: '#fff' }}>
      <Text size="xs" fw={600} c="dimmed" mb="md" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</Text>
      <Box style={{ height }}>{children}</Box>
    </Paper>
  );
}

const toLocalStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const toDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
};

export default function Camiones() {
  const [camiones, setCamiones]     = useState<Camion[]>([]);
  const [llaveros, setLlaveros]     = useState<Llavero[]>([]);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [cargando, setCargando]     = useState(true);
  const [cargandoStats, setCargandoStats] = useState(true);
  const [periodo, setPeriodo]       = useState<Periodo>('mes');
  const [rango, setRango]           = useState<[Date | null, Date | null]>([null, null]);

  // Búsqueda y paginación de camiones
  const [busqueda, setBusqueda]     = useState('');
  const [busquedaInput, setBusquedaInput] = useState('');
  const [paginaActual, setPaginaActual]   = useState(1);
  const [totalPaginas, setTotalPaginas]   = useState(1);
  const [totalCamiones, setTotalCamiones] = useState(0);
  const LIMITE = 50;

  const [modalCamion, { open: abrirCamion, close: cerrarCamion }] = useDisclosure(false);
  const [modalLlavero, { open: abrirLlavero, close: cerrarLlavero }] = useDisclosure(false);
  const [modalAsignar, { open: abrirAsignar, close: cerrarAsignar }] = useDisclosure(false);
  const [llaveroEditar, setLlaveroEditar] = useState<Llavero | null>(null);
  const [camionAsignar, setCamionAsignar] = useState<string | null>(null);

  const formCamion = useForm({
    initialValues: { patente: '', marca: '', modelo: '' },
    validate: { patente: (v) => (v.trim().length >= 2 ? null : 'Patente requerida') },
  });
  const formLlavero = useForm({
    initialValues: { uid_nfc: '', alias: '' },
    validate: { uid_nfc: (v) => (v.trim().length >= 2 ? null : 'UID requerido') },
  });

  async function cargarCamiones(pagina = paginaActual, buscar = busqueda) {
    setCargando(true);
    try {
      const [{ data: resp }, { data: llaves }] = await Promise.all([
        api.get('/camiones', { params: { pagina, limite: LIMITE, buscar: buscar || undefined } }),
        api.get('/camiones/nfc'),
      ]);
      setCamiones(resp.data);
      setTotalPaginas(resp.paginas);
      setTotalCamiones(resp.total);
      setLlaveros(llaves);
    } catch {
      notifications.show({ message: 'Error al cargar datos', color: 'red' });
    } finally {
      setCargando(false);
    }
  }

  // Debounce del buscador
  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(busquedaInput);
      setPaginaActual(1);
    }, 350);
    return () => clearTimeout(t);
  }, [busquedaInput]);

  const cargarStats = useCallback(async () => {
    if (periodo === 'personalizado' && !toDate(rango[0])) return;
    setCargandoStats(true);
    try {
      const params: Record<string, string> = { periodo };
      if (periodo === 'personalizado') {
        const desde = toDate(rango[0]);
        const hasta = toDate(rango[1]) ?? desde;
        if (desde) { params.desde = toLocalStr(desde); params.hasta = toLocalStr(hasta!); }
      }
      const { data } = await api.get('/camiones/stats', { params });
      setStats(data);
    } catch {
      notifications.show({ message: 'Error al cargar estadísticas', color: 'red' });
    } finally {
      setCargandoStats(false);
    }
  }, [periodo, rango]);

  useEffect(() => { cargarCamiones(1, busqueda); }, [busqueda]);
  useEffect(() => { cargarCamiones(paginaActual, busqueda); }, [paginaActual]);
  useEffect(() => { cargarStats(); }, [cargarStats]);

  async function crearCamion(values: typeof formCamion.values) {
    try {
      await api.post('/camiones', values);
      notifications.show({ message: 'Camión registrado', color: 'green' });
      cerrarCamion(); formCamion.reset(); cargarCamiones(paginaActual, busqueda);
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.error || 'Error', color: 'red' });
    }
  }

  async function eliminarCamion(c: Camion) {
    if (!confirm(`¿Eliminar camión ${c.patente}?`)) return;
    try {
      await api.delete(`/camiones/${c.id}`);
      notifications.show({ message: 'Camión eliminado', color: 'orange' });
      cargarCamiones(paginaActual, busqueda);
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.error || 'Error', color: 'red' });
    }
  }

  async function crearLlavero(values: typeof formLlavero.values) {
    try {
      await api.post('/camiones/nfc', values);
      notifications.show({ message: 'Llavero registrado', color: 'green' });
      cerrarLlavero(); formLlavero.reset(); cargarCamiones(paginaActual, busqueda);
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.error || 'Error', color: 'red' });
    }
  }

  async function eliminarLlavero(l: Llavero) {
    if (!confirm(`¿Eliminar llavero ${l.uid_nfc}?`)) return;
    try {
      await api.delete(`/camiones/nfc/${l.id}`);
      notifications.show({ message: 'Llavero eliminado', color: 'orange' });
      cargarCamiones(paginaActual, busqueda);
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.error || 'Error', color: 'red' });
    }
  }

  async function asignarLlavero() {
    if (!llaveroEditar || camionAsignar === undefined) return;
    try {
      await api.patch(`/camiones/nfc/${llaveroEditar.id}`, { camion_id: camionAsignar || null });
      notifications.show({ message: 'Asignación guardada', color: 'green' });
      cerrarAsignar(); setLlaveroEditar(null); setCamionAsignar(null); cargarCamiones(paginaActual, busqueda);
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.error || 'Error', color: 'red' });
    }
  }

  function abrirModalAsignar(l: Llavero) {
    setLlaveroEditar(l);
    setCamionAsignar(l.camion_id ? String(l.camion_id) : null);
    abrirAsignar();
  }

  const fmt = (n: number | null | undefined, dec = 0) =>
    n != null ? n.toLocaleString('es-AR', { maximumFractionDigits: dec }) : '0';

  const baseOpts = () => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#1a1a1a', padding: 10, cornerRadius: 4 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#adb5bd' } },
      y: { grid: { color: '#f1f3f5' }, ticks: { font: { size: 11 }, color: '#adb5bd' } },
    },
  });

  const optsBarH = {
    ...baseOpts(),
    indexAxis: 'y' as const,
    scales: {
      x: { grid: { color: '#f1f3f5' }, ticks: { font: { size: 11 }, color: '#adb5bd' } },
      y: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#495057' } },
    },
  };

  const lineaData = {
    labels: stats?.linea.map(r => r.label) ?? [],
    datasets: [{
      label: 'Ingresos',
      data: stats?.linea.map(r => r.ingresos) ?? [],
      borderColor: NARANJA, backgroundColor: 'rgba(245,159,0,0.12)',
      borderWidth: 2, pointRadius: 3, fill: true, tension: 0.4,
    }],
  };

  const barPatentes = {
    labels: stats?.topPatentes.map(p => p.patente) ?? [],
    datasets: [{
      label: 'Ingresos',
      data: stats?.topPatentes.map(p => p.ingresos) ?? [],
      backgroundColor: stats?.topPatentes.map((_, i) => PALETTE[i % PALETTE.length]) ?? [],
      borderRadius: 3,
    }],
  };

  const barPdv = {
    labels: stats?.porPdv.map(p => p.pdv) ?? [],
    datasets: [{
      label: 'Ingresos',
      data: stats?.porPdv.map(p => p.ingresos) ?? [],
      backgroundColor: AZUL, borderRadius: 3,
    }],
  };

  const doughnutEstado = {
    labels: ['En predio', 'Salieron'],
    datasets: [{
      data: [
        stats?.kpis.en_predio_ahora ?? 0,
        (stats?.kpis.total_ingresos ?? 0) - (stats?.kpis.en_predio_ahora ?? 0),
      ],
      backgroundColor: [NARANJA, VERDE],
      borderWidth: 0, hoverOffset: 8,
    }],
  };

  const optsDoughnut = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { size: 12 }, padding: 16, usePointStyle: true } },
      tooltip: { backgroundColor: '#1a1a1a', padding: 10, cornerRadius: 4 },
    },
    cutout: '68%',
  };

  const camionOpts = camiones.map(c => ({ value: String(c.id), label: c.patente + (c.marca ? ` — ${c.marca}` : '') }));

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} fw={600} style={{ letterSpacing: '-0.02em' }}>Control de Camiones</Title>
          <Text c="dimmed" size="sm" mt={2}>Registro NFC de entradas/salidas, llaveros y estadísticas</Text>
        </div>
        <Group gap="xs">
          <Button leftSection={<IconNfc size={14} />} variant="default" size="sm" onClick={abrirLlavero}>
            Nuevo Llavero
          </Button>
          <Button leftSection={<IconPlus size={14} />} color="green" size="sm" onClick={abrirCamion}>
            Nuevo Camión
          </Button>
        </Group>
      </Group>

      <Tabs defaultValue="estadisticas" keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="estadisticas" leftSection={<IconChartBar size={14} />}>Estadísticas</Tabs.Tab>
          <Tabs.Tab value="camiones"     leftSection={<IconTruck size={14} />}>Camiones</Tabs.Tab>
          <Tabs.Tab value="llaveros"     leftSection={<IconNfc size={14} />}>Llaveros NFC</Tabs.Tab>
          <Tabs.Tab value="en-predio"    leftSection={<IconBuildingWarehouse size={14} />}>
            En Predio
            {(stats?.kpis.en_predio_ahora ?? 0) > 0 && (
              <Badge size="xs" color="orange" ml={6}>{stats!.kpis.en_predio_ahora}</Badge>
            )}
          </Tabs.Tab>
        </Tabs.List>

        {/* ── ESTADÍSTICAS ────────────────────────────────────────── */}
        <Tabs.Panel value="estadisticas">
          <Stack gap="lg">
            {/* Selector período */}
            <Paper p="md" style={{ border: '1px solid #e9ecef', background: '#fff' }}>
              <Group gap="md" align="flex-end" wrap="wrap">
                <div>
                  <Text size="xs" fw={600} c="dimmed" mb={6} style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Período</Text>
                  <SegmentedControl
                    value={periodo}
                    onChange={(v) => setPeriodo(v as Periodo)}
                    data={[
                      { label: 'Histórico', value: 'historico' },
                      { label: 'Hoy',       value: 'hoy' },
                      { label: '7 días',    value: 'semana' },
                      { label: '30 días',   value: 'mes' },
                      { label: '12 meses',  value: 'año' },
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
                    onChange={(val) => setRango([toDate(val?.[0]), toDate(val?.[1])])}
                    valueFormat="DD/MM/YY"
                    size="xs" clearable w={200} allowSingleDateInRange
                  />
                )}
                <Button size="xs" variant="default" leftSection={<IconRefresh size={13} />}
                  loading={cargandoStats} onClick={cargarStats}>
                  Actualizar
                </Button>
              </Group>
            </Paper>

            {/* KPIs */}
            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
              <KpiCard label="Ingresos totales"   value={fmt(stats?.kpis.total_ingresos)}
                icon={<IconTruck size={15} strokeWidth={1.8} />} color={VERDE} />
              <KpiCard label="Camiones únicos"    value={fmt(stats?.kpis.camiones_unicos)}
                sub="patentes distintas" icon={<IconTruck size={15} strokeWidth={1.8} />} color={AZUL} />
              <KpiCard label="En predio ahora"    value={fmt(stats?.kpis.en_predio_ahora)}
                icon={<IconBuildingWarehouse size={15} strokeWidth={1.8} />} color={NARANJA} />
              <KpiCard label="Tiempo prom. predio" value={fmt(stats?.kpis.horas_promedio, 1)}
                unit="hs" icon={<IconClock size={15} strokeWidth={1.8} />} color={VIOLETA} />
            </SimpleGrid>

            {/* Gráficos fila 1 */}
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 8 }}>
                <ChartCard title="Ingresos al predio por período" height={260}>
                  {cargandoStats ? <Skeleton height={260} /> : <Line data={lineaData} options={baseOpts()} />}
                </ChartCard>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <ChartCard title="Estado actual de ingresos" height={260}>
                  {cargandoStats ? <Skeleton height={260} /> : <Doughnut data={doughnutEstado} options={optsDoughnut} />}
                </ChartCard>
              </Grid.Col>
            </Grid>

            {/* Gráficos fila 2 */}
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <ChartCard title="Top 10 patentes — más ingresos" height={280}>
                  {cargandoStats ? <Skeleton height={280} /> : <Bar data={barPatentes} options={optsBarH} />}
                </ChartCard>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <ChartCard title="Ingresos por Punto de Venta" height={280}>
                  {cargandoStats ? <Skeleton height={280} /> : <Bar data={barPdv} options={baseOpts()} />}
                </ChartCard>
              </Grid.Col>
            </Grid>
          </Stack>
        </Tabs.Panel>

        {/* ── CAMIONES ────────────────────────────────────────────── */}
        <Tabs.Panel value="camiones">
          <Stack gap="md">
            <Group justify="space-between" align="center" wrap="wrap" gap="sm">
              <Group gap="md">
                <TextInput
                  placeholder="Buscar por patente..."
                  leftSection={<IconSearch size={15} />}
                  value={busquedaInput}
                  onChange={(e) => setBusquedaInput(e.currentTarget.value)}
                  style={{ width: 280 }}
                  size="sm"
                />
                <Text size="sm" c="dimmed">
                  {totalCamiones} camión{totalCamiones !== 1 ? 'es' : ''}
                  {busqueda && ` para "${busqueda}"`}
                </Text>
              </Group>
              {totalPaginas > 1 && (
                <Pagination
                  value={paginaActual}
                  onChange={setPaginaActual}
                  total={totalPaginas}
                  size="sm"
                  withEdges
                />
              )}
            </Group>

            <Paper style={{ border: '1px solid #e9ecef', overflow: 'hidden', background: '#fff' }}>
              {cargando ? (
                <Stack p="md" gap="sm">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={40} />)}</Stack>
              ) : camiones.length === 0 ? (
                <Alert icon={<IconAlertCircle size={16} />} m="md" color="blue" variant="light">
                  {busqueda ? `No se encontraron camiones con "${busqueda}".` : 'No hay camiones registrados.'}
                </Alert>
              ) : (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Patente</Table.Th>
                      <Table.Th>Marca / Modelo</Table.Th>
                      <Table.Th>Llavero NFC</Table.Th>
                      <Table.Th>Estado</Table.Th>
                      <Table.Th>Remitos</Table.Th>
                      <Table.Th>Visitas</Table.Th>
                      <Table.Th>Acciones</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {camiones.map((c) => (
                      <Table.Tr key={c.id}>
                        <Table.Td fw={600} ff="monospace">{c.patente}</Table.Td>
                        <Table.Td>
                          <Text size="sm">{[c.marca, c.modelo].filter(Boolean).join(' ') || '—'}</Text>
                        </Table.Td>
                        <Table.Td>
                          {c.nfc_uid ? (
                            <Stack gap={2}>
                              <Badge variant="dot" color="teal" size="sm">{c.nfc_uid}</Badge>
                              {c.nfc_alias && <Text size="xs" c="dimmed">{c.nfc_alias}</Text>}
                            </Stack>
                          ) : (
                            <Text size="xs" c="dimmed">Sin llavero</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {Number(c.en_predio) > 0
                            ? <Badge color="orange" variant="dot">En predio</Badge>
                            : <Badge color="gray" variant="dot">Fuera</Badge>}
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="sm" fw={500}>{Number(c.total_remitos)}</Text>
                            {Number(c.remitos_emitidos) > 0 && (
                              <Text size="xs" c="dimmed">{Number(c.remitos_emitidos)} emitidos</Text>
                            )}
                          </Stack>
                        </Table.Td>
                        <Table.Td><Text size="xs" c="dimmed">{c.total_visitas} visitas</Text></Table.Td>
                        <Table.Td>
                          <Tooltip label="Eliminar">
                            <ActionIcon variant="light" color="red" onClick={() => eliminarCamion(c)}>
                              <IconTrash size={15} />
                            </ActionIcon>
                          </Tooltip>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>

          </Stack>
        </Tabs.Panel>

        {/* ── LLAVEROS NFC ────────────────────────────────────────── */}
        <Tabs.Panel value="llaveros">
          <Stack gap="md">
            <Alert icon={<IconNfc size={14} />} color="teal" variant="light" p="sm">
              <Text size="xs">
                Cuando el lector NFC registra un UID desconocido, aparece aquí automáticamente para ser asignado.
                Podés también registrar llaveros manualmente antes de entregarlos.
              </Text>
            </Alert>

            <Paper style={{ border: '1px solid #e9ecef', overflow: 'hidden', background: '#fff' }}>
              {cargando ? (
                <Stack p="md" gap="sm">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={40} />)}</Stack>
              ) : llaveros.length === 0 ? (
                <Alert icon={<IconAlertCircle size={16} />} m="md" color="blue" variant="light">
                  No hay llaveros registrados.
                </Alert>
              ) : (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>UID NFC</Table.Th>
                      <Table.Th>Alias</Table.Th>
                      <Table.Th>Camión asignado</Table.Th>
                      <Table.Th>Estado</Table.Th>
                      <Table.Th>Acciones</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {llaveros.map((l) => (
                      <Table.Tr key={l.id}>
                        <Table.Td fw={500} ff="monospace" style={{ fontSize: 12 }}>{l.uid_nfc}</Table.Td>
                        <Table.Td><Text size="sm">{l.alias || '—'}</Text></Table.Td>
                        <Table.Td>
                          {l.camion_patente ? (
                            <Badge variant="outline" color="blue">{l.camion_patente}</Badge>
                          ) : (
                            <Badge color="red" variant="light" size="sm">Sin asignar</Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Badge color={l.activo ? 'green' : 'gray'} variant="dot" size="sm">
                            {l.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Tooltip label="Asignar a camión">
                              <ActionIcon variant="light" color="blue" onClick={() => abrirModalAsignar(l)}>
                                <IconLink size={15} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Eliminar">
                              <ActionIcon variant="light" color="red" onClick={() => eliminarLlavero(l)}>
                                <IconTrash size={15} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* ── EN PREDIO ───────────────────────────────────────────── */}
        <Tabs.Panel value="en-predio">
          <Paper style={{ border: '1px solid #e9ecef', overflow: 'hidden', background: '#fff' }}>
            {cargandoStats ? (
              <Stack p="md" gap="sm">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={40} />)}</Stack>
            ) : !stats?.enPredio.length ? (
              <Alert icon={<IconBuildingWarehouse size={16} />} m="md" color="green" variant="light">
                No hay camiones en el predio en este momento.
              </Alert>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Patente</Table.Th>
                    <Table.Th>Marca</Table.Th>
                    <Table.Th>PDV</Table.Th>
                    <Table.Th>Ingresó</Table.Th>
                    <Table.Th>Tiempo en predio</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {stats.enPredio.map((m) => {
                    const diff = Date.now() - new Date(m.fecha_entrada).getTime();
                    const horas = Math.floor(diff / 3600000);
                    const mins  = Math.floor((diff % 3600000) / 60000);
                    return (
                      <Table.Tr key={m.id}>
                        <Table.Td fw={600} ff="monospace">{m.patente}</Table.Td>
                        <Table.Td>{m.marca || '—'}</Table.Td>
                        <Table.Td><Badge variant="outline" size="sm">{m.pdv_nombre}</Badge></Table.Td>
                        <Table.Td>
                          <Text size="sm">{new Date(m.fecha_entrada).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={horas >= 4 ? 'red' : horas >= 2 ? 'orange' : 'green'} variant="light">
                            {horas}h {mins}m
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* Modal nuevo camión */}
      <Modal opened={modalCamion} onClose={cerrarCamion}
        title={<Text fw={600} size="sm">Registrar camión</Text>} centered size="sm">
        <form onSubmit={formCamion.onSubmit(crearCamion)}>
          <Stack gap="md">
            <TextInput label="Patente" placeholder="Ej: SDR 830" size="sm" required
              {...formCamion.getInputProps('patente')}
              onChange={(e) => formCamion.setFieldValue('patente', e.currentTarget.value.toUpperCase())} />
            <TextInput label="Marca" placeholder="Ej: Mercedes-Benz" size="sm" {...formCamion.getInputProps('marca')} />
            <TextInput label="Modelo" placeholder="Ej: Actros 2651" size="sm" {...formCamion.getInputProps('modelo')} />
            <Group justify="flex-end">
              <Button variant="default" size="sm" onClick={cerrarCamion}>Cancelar</Button>
              <Button type="submit" color="green" size="sm">Registrar</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal nuevo llavero */}
      <Modal opened={modalLlavero} onClose={cerrarLlavero}
        title={<Text fw={600} size="sm">Registrar llavero NFC</Text>} centered size="sm">
        <form onSubmit={formLlavero.onSubmit(crearLlavero)}>
          <Stack gap="md">
            <TextInput label="UID del llavero" placeholder="Ej: A1B2C3D4" size="sm" required
              {...formLlavero.getInputProps('uid_nfc')}
              onChange={(e) => formLlavero.setFieldValue('uid_nfc', e.currentTarget.value.toUpperCase())} />
            <TextInput label="Alias (opcional)" placeholder="Ej: Llavero azul" size="sm"
              {...formLlavero.getInputProps('alias')} />
            <Alert icon={<IconNfc size={14} />} color="teal" variant="light" p="sm">
              <Text size="xs">El UID se lee desde el lector NFC del campo o se puede ingresar manualmente.</Text>
            </Alert>
            <Group justify="flex-end">
              <Button variant="default" size="sm" onClick={cerrarLlavero}>Cancelar</Button>
              <Button type="submit" color="teal" size="sm">Registrar llavero</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal asignar llavero → camión */}
      <Modal opened={modalAsignar} onClose={cerrarAsignar}
        title={
          <Group gap="xs">
            <IconLink size={15} />
            <Text fw={600} size="sm">Asignar llavero a camión</Text>
          </Group>
        }
        centered size="sm">
        <Stack gap="md">
          <Paper p="sm" style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }}>
            <Text size="xs" c="dimmed">UID del llavero</Text>
            <Text size="sm" fw={600} ff="monospace">{llaveroEditar?.uid_nfc}</Text>
            {llaveroEditar?.alias && <Text size="xs" c="dimmed">{llaveroEditar.alias}</Text>}
          </Paper>
          <Select
            label="Camión a asignar"
            placeholder="Seleccioná una patente..."
            data={camionOpts}
            value={camionAsignar}
            onChange={setCamionAsignar}
            searchable clearable size="sm"
          />
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={cerrarAsignar}>Cancelar</Button>
            <Button color="blue" size="sm" onClick={asignarLlavero}>Guardar asignación</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
