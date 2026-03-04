import { useState } from 'react';
import {
  Title, Text, Stack, Group, Paper, Badge, Button,
  Modal, Select, Tabs, Table, Skeleton, Alert,
  ThemeIcon, Divider, TextInput, Box,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconQrcode, IconLogin, IconLogout, IconClock,
  IconCircleCheck, IconAlertCircle, IconSearch, IconTruck,
} from '@tabler/icons-react';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import QrScanner from '../../components/QrScanner';

interface Camion {
  id: number; codigo: string; nombre: string;
  patente: string | null; cliente: string | null;
}
interface MovimientoActivo {
  id: number; fecha_entrada: string;
  pdv_numero: number; pdv_nombre: string;
}
interface EscaneoResultado {
  camion: Camion;
  movimiento_activo: MovimientoActivo | null;
}
interface Remito {
  id: number; numero: number; cliente: string;
  patente_camion: string; fecha_emision: string; estado: string;
}
interface Movimiento {
  id: number; camion_nombre: string; camion_patente: string | null;
  camion_cliente: string | null; fecha_entrada: string;
  fecha_salida: string | null; estado: string;
  remito_numero: number | null; pdv_numero: number;
}

function tiempoTranscurrido(fechaISO: string): string {
  const diff = Date.now() - new Date(fechaISO).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}min` : `${hrs}h`;
}

export default function Accesos() {
  const { usuario } = useAuth();
  const [resultado, setResultado] = useState<EscaneoResultado | null>(null);
  const [codigoManual, setCodigoManual] = useState('');
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [remitoSel, setRemitoSel] = useState<string | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargandoHist, setCargandoHist] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [modalSalida, { open: abrirSalida, close: cerrarSalida }] = useDisclosure(false);
  const [tab, setTab] = useState<string | null>('escanear');

  async function procesarCodigo(codigo: string) {
    if (!codigo.trim()) return;
    try {
      const { data } = await api.get(`/movimientos/escanear/${codigo.trim()}`);
      setResultado(data);
      setCodigoManual('');

      if (data.movimiento_activo) {
        // Camión adentro → preparar salida
        const pdvId = usuario?.pdv_id;
        const { data: rems } = await api.get('/movimientos/remitos-disponibles', {
          params: { pdv_id: pdvId },
        });
        setRemitos(rems);
        setRemitoSel(null);
        abrirSalida();
      }
    } catch (e: any) {
      notifications.show({
        message: e?.response?.data?.error || 'QR no reconocido',
        color: 'red',
      });
      setResultado(null);
    }
  }

  async function registrarEntrada() {
    if (!resultado) return;
    setProcesando(true);
    try {
      const { data } = await api.post('/movimientos/entrada', {
        codigo: resultado.camion.codigo,
        pdv_id: usuario?.pdv_id,
      });
      notifications.show({
        message: `Entrada registrada para ${resultado.camion.nombre}`,
        color: 'green',
        icon: <IconLogin size={16} />,
      });
      setResultado(null);
      cargarHistorial();
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.error || 'Error', color: 'red' });
    } finally {
      setProcesando(false);
    }
  }

  async function registrarSalida() {
    if (!resultado?.movimiento_activo || !remitoSel) return;
    setProcesando(true);
    try {
      await api.post('/movimientos/salida', {
        movimiento_id: resultado.movimiento_activo.id,
        remito_id: Number(remitoSel),
      });
      notifications.show({
        message: `Salida registrada — Remito #${remitos.find(r => String(r.id) === remitoSel)?.numero} vinculado`,
        color: 'green',
        icon: <IconCircleCheck size={16} />,
      });
      cerrarSalida();
      setResultado(null);
      setRemitoSel(null);
      cargarHistorial();
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.error || 'Error', color: 'red' });
    } finally {
      setProcesando(false);
    }
  }

  async function cargarHistorial() {
    setCargandoHist(true);
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const { data } = await api.get('/movimientos', { params: { fecha: hoy } });
      setMovimientos(data);
    } catch {
      notifications.show({ message: 'Error al cargar historial', color: 'red' });
    } finally {
      setCargandoHist(false);
    }
  }

  function handleTabChange(t: string | null) {
    setTab(t);
    if (t === 'historial') cargarHistorial();
  }

  const remitosOpciones = remitos.map((r) => ({
    value: String(r.id),
    label: `#${r.numero} — ${r.cliente} (${r.patente_camion})`,
  }));

  return (
    <Stack gap="xl">
      <div>
        <Title order={2} fw={600} style={{ letterSpacing: '-0.02em' }}>Control de Acceso</Title>
        <Text c="dimmed" size="sm" mt={2}>Registrá entradas y salidas de camiones escaneando su QR</Text>
      </div>

      <Tabs value={tab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="escanear" leftSection={<IconQrcode size={14} />}>Escanear</Tabs.Tab>
          <Tabs.Tab value="historial" leftSection={<IconClock size={14} />}>Historial de hoy</Tabs.Tab>
        </Tabs.List>

        {/* ── Tab Escanear ── */}
        <Tabs.Panel value="escanear" pt="lg">
          <Stack gap="lg" align="center" maw={420} mx="auto">
            <QrScanner onScan={procesarCodigo} />

            <Divider label="o ingresá el código manualmente" labelPosition="center" w="100%" />

            <Group w="100%" gap="xs">
              <TextInput
                placeholder="Código QR del camión..."
                value={codigoManual}
                onChange={(e) => setCodigoManual(e.currentTarget.value)}
                style={{ flex: 1 }}
                size="sm"
                leftSection={<IconSearch size={14} />}
                onKeyDown={(e) => e.key === 'Enter' && procesarCodigo(codigoManual)}
              />
              <Button size="sm" variant="default" onClick={() => procesarCodigo(codigoManual)}>
                Buscar
              </Button>
            </Group>

            {/* Resultado del escaneo — camión sin entrada activa */}
            {resultado && !resultado.movimiento_activo && (
              <Paper w="100%" p="lg" style={{ border: '2px solid #2d8a39' }}>
                <Stack gap="sm">
                  <Group gap="xs">
                    <ThemeIcon color="green" size={32} radius="xs" variant="light">
                      <IconTruck size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>{resultado.camion.nombre}</Text>
                      {resultado.camion.patente && (
                        <Text size="xs" c="dimmed" ff="monospace">{resultado.camion.patente}</Text>
                      )}
                    </div>
                    <Badge color="gray" variant="light" ml="auto">Fuera del predio</Badge>
                  </Group>
                  {resultado.camion.cliente && (
                    <Text size="sm" c="dimmed">Cliente: {resultado.camion.cliente}</Text>
                  )}
                  <Divider />
                  <Button
                    leftSection={<IconLogin size={16} />}
                    color="green"
                    fullWidth
                    loading={procesando}
                    onClick={registrarEntrada}
                  >
                    Confirmar Entrada
                  </Button>
                </Stack>
              </Paper>
            )}
          </Stack>
        </Tabs.Panel>

        {/* ── Tab Historial ── */}
        <Tabs.Panel value="historial" pt="lg">
          <Paper style={{ border: '1px solid #e9ecef', overflow: 'hidden', background: '#fff' }}>
            {cargandoHist ? (
              <Stack p="md" gap="sm">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={40} />)}
              </Stack>
            ) : movimientos.length === 0 ? (
              <Alert icon={<IconAlertCircle size={14} />} m="md" color="blue" variant="light">
                No hay movimientos registrados hoy.
              </Alert>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Camión</Table.Th>
                    <Table.Th>Entrada</Table.Th>
                    <Table.Th>Salida</Table.Th>
                    <Table.Th>Tiempo</Table.Th>
                    <Table.Th>Remito</Table.Th>
                    <Table.Th>Estado</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {movimientos.map((m) => (
                    <Table.Tr key={m.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>{m.camion_nombre}</Text>
                        {m.camion_patente && (
                          <Text size="xs" c="dimmed" ff="monospace">{m.camion_patente}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{new Date(m.fecha_entrada).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</Text>
                      </Table.Td>
                      <Table.Td>
                        {m.fecha_salida
                          ? <Text size="xs">{new Date(m.fecha_salida).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</Text>
                          : <Text size="xs" c="dimmed">—</Text>
                        }
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {m.fecha_salida
                            ? tiempoTranscurrido(m.fecha_entrada).replace(tiempoTranscurrido(m.fecha_entrada), (() => {
                                const diff = new Date(m.fecha_salida).getTime() - new Date(m.fecha_entrada).getTime();
                                const mins = Math.floor(diff / 60000);
                                return mins < 60 ? `${mins} min` : `${Math.floor(mins/60)}h ${mins%60}min`;
                              })())
                            : tiempoTranscurrido(m.fecha_entrada)
                          }
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {m.remito_numero
                          ? <Badge variant="outline" size="xs">#{m.remito_numero}</Badge>
                          : <Text size="xs" c="dimmed">—</Text>
                        }
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={m.estado === 'en_predio' ? 'orange' : 'green'}
                          variant="light"
                          size="xs"
                        >
                          {m.estado === 'en_predio' ? 'En predio' : 'Salió'}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* Modal registrar salida */}
      <Modal
        opened={modalSalida}
        onClose={() => { cerrarSalida(); setResultado(null); }}
        title={
          <Group gap="xs">
            <ThemeIcon color="orange" size={28} radius="xs" variant="light">
              <IconLogout size={16} />
            </ThemeIcon>
            <Text fw={600} size="sm">Registrar Salida</Text>
          </Group>
        }
        centered
        size="sm"
      >
        {resultado && (
          <Stack gap="md">
            <Paper p="md" style={{ border: '1px solid #e9ecef', background: '#fafafa' }}>
              <Group justify="space-between">
                <div>
                  <Text fw={600}>{resultado.camion.nombre}</Text>
                  {resultado.camion.patente && (
                    <Text size="xs" c="dimmed" ff="monospace">{resultado.camion.patente}</Text>
                  )}
                </div>
                <Badge color="orange" variant="light">En predio</Badge>
              </Group>
              {resultado.movimiento_activo && (
                <Text size="xs" c="dimmed" mt="xs">
                  Ingresó hace {tiempoTranscurrido(resultado.movimiento_activo.fecha_entrada)}
                </Text>
              )}
            </Paper>

            <Select
              label="Asociar Remito"
              description="Seleccioná el remito generado para este camión"
              placeholder="Seleccioná un remito..."
              data={remitosOpciones}
              value={remitoSel}
              onChange={setRemitoSel}
              searchable
              required
              size="sm"
            />

            {remitosOpciones.length === 0 && (
              <Alert icon={<IconAlertCircle size={14} />} color="orange" variant="light" p="sm">
                <Text size="xs">
                  No hay remitos disponibles. Generá el remito desde la sección <strong>Remitos</strong> antes de registrar la salida.
                </Text>
              </Alert>
            )}

            <Group justify="flex-end" mt="xs">
              <Button variant="default" size="sm" onClick={() => { cerrarSalida(); setResultado(null); }}>
                Cancelar
              </Button>
              <Button
                leftSection={<IconCircleCheck size={15} />}
                color="green"
                size="sm"
                disabled={!remitoSel}
                loading={procesando}
                onClick={registrarSalida}
              >
                Confirmar Salida
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
