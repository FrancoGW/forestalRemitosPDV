import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Title, Text, Stack, Button, Group, Paper, Badge,
  Modal, TextInput, Table, ActionIcon, Tooltip,
  Skeleton, Alert, Divider, Box,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import {
  IconPlus, IconQrcode, IconTrash, IconAlertCircle,
  IconDownload, IconPrinter, IconTruck,
} from '@tabler/icons-react';
import api from '../../api/client';
import { notifications } from '@mantine/notifications';

interface Camion {
  id: number;
  codigo: string;
  nombre: string;
  patente: string | null;
  cliente: string | null;
  activo: number;
  total_visitas: number;
  en_predio: number;
  creado_en: string;
}

export default function Camiones() {
  const [camiones, setCamiones] = useState<Camion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [camionQR, setCamionQR] = useState<Camion | null>(null);
  const [modalCrear, { open: abrirCrear, close: cerrarCrear }] = useDisclosure(false);
  const [modalQR, { open: abrirQR, close: cerrarQR }] = useDisclosure(false);
  const qrRef = useRef<HTMLCanvasElement | null>(null);

  const form = useForm({
    initialValues: { nombre: '', patente: '', cliente: '' },
    validate: {
      nombre: (v) => (v.trim().length >= 2 ? null : 'Nombre requerido'),
    },
  });

  async function cargar() {
    setCargando(true);
    try {
      const { data } = await api.get('/camiones');
      setCamiones(data);
    } catch {
      notifications.show({ message: 'Error al cargar camiones', color: 'red' });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function crear(values: typeof form.values) {
    try {
      await api.post('/camiones', values);
      notifications.show({ message: 'Camión creado con QR único', color: 'green' });
      cerrarCrear();
      form.reset();
      cargar();
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.error || 'Error al crear', color: 'red' });
    }
  }

  async function eliminar(c: Camion) {
    if (!confirm(`¿Eliminar "${c.nombre}"? Se eliminarán también sus movimientos.`)) return;
    try {
      await api.delete(`/camiones/${c.id}`);
      notifications.show({ message: 'Camión eliminado', color: 'orange' });
      cargar();
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.error || 'Error al eliminar', color: 'red' });
    }
  }

  function verQR(c: Camion) {
    setCamionQR(c);
    abrirQR();
  }

  function descargarQR() {
    if (!camionQR) return;
    const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR-${camionQR.nombre.replace(/\s/g, '_')}.png`;
    a.click();
  }

  function imprimirQR() {
    const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
    if (!canvas || !camionQR) return;
    const url = canvas.toDataURL('image/png');
    const ventana = window.open('', '_blank');
    if (!ventana) return;
    ventana.document.write(`
      <html><head><title>QR - ${camionQR.nombre}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
        h2 { font-size: 20px; margin-bottom: 4px; }
        p { color: #555; font-size: 14px; margin: 2px 0; }
        img { display: block; margin: 20px auto; }
        .codigo { font-family: monospace; font-size: 11px; color: #999; margin-top: 8px; }
      </style></head><body>
      <h2>${camionQR.nombre}</h2>
      ${camionQR.patente ? `<p>Patente: <strong>${camionQR.patente}</strong></p>` : ''}
      ${camionQR.cliente ? `<p>Cliente: ${camionQR.cliente}</p>` : ''}
      <img src="${url}" width="300" />
      <p class="codigo">${camionQR.codigo}</p>
      </body></html>
    `);
    ventana.document.close();
    ventana.print();
  }

  const rows = camiones.map((c) => (
    <Table.Tr key={c.id}>
      <Table.Td fw={500}>{c.nombre}</Table.Td>
      <Table.Td>
        <Text size="sm" ff="monospace" c="dimmed">{c.patente || '—'}</Text>
      </Table.Td>
      <Table.Td>{c.cliente || '—'}</Table.Td>
      <Table.Td>
        {c.en_predio > 0 ? (
          <Badge color="orange" variant="dot">En predio</Badge>
        ) : (
          <Badge color="gray" variant="dot">Fuera</Badge>
        )}
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed">{c.total_visitas} visitas</Text>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Tooltip label="Ver QR">
            <ActionIcon variant="light" color="green" onClick={() => verQR(c)}>
              <IconQrcode size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Eliminar">
            <ActionIcon variant="light" color="red" onClick={() => eliminar(c)}>
              <IconTrash size={15} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} fw={600} style={{ letterSpacing: '-0.02em' }}>QR Camiones</Title>
          <Text c="dimmed" size="sm" mt={2}>
            Generá códigos QR únicos por camión o cliente
          </Text>
        </div>
        <Button leftSection={<IconPlus size={14} />} color="green" size="sm" onClick={abrirCrear}>
          Nuevo Camión
        </Button>
      </Group>

      <Paper style={{ border: '1px solid #e9ecef', overflow: 'hidden', background: '#fff' }}>
        {cargando ? (
          <Stack p="md" gap="sm">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={40} />)}
          </Stack>
        ) : camiones.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} m="md" color="blue" variant="light">
            No hay camiones registrados. Creá el primero para generar su QR.
          </Alert>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre / Empresa</Table.Th>
                <Table.Th>Patente</Table.Th>
                <Table.Th>Cliente</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Historial</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Modal crear */}
      <Modal
        opened={modalCrear}
        onClose={cerrarCrear}
        title={<Text fw={600} size="sm">Nuevo Camión / Cliente</Text>}
        centered
        size="sm"
      >
        <form onSubmit={form.onSubmit(crear)}>
          <Stack gap="md">
            <TextInput
              label="Nombre o empresa"
              placeholder="Ej: Transporte García"
              size="sm"
              required
              {...form.getInputProps('nombre')}
            />
            <TextInput
              label="Patente"
              placeholder="Ej: SDR 830"
              size="sm"
              {...form.getInputProps('patente')}
              onChange={(e) => form.setFieldValue('patente', e.currentTarget.value.toUpperCase())}
            />
            <TextInput
              label="Cliente asociado"
              placeholder="Ej: FEPAL S.A."
              size="sm"
              {...form.getInputProps('cliente')}
            />
            <Alert icon={<IconQrcode size={14} />} color="green" variant="light" p="sm">
              <Text size="xs">Al crear el camión se generará automáticamente su QR único e irrepetible.</Text>
            </Alert>
            <Group justify="flex-end">
              <Button variant="default" size="sm" onClick={cerrarCrear}>Cancelar</Button>
              <Button type="submit" color="green" size="sm">Crear y generar QR</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal QR */}
      <Modal
        opened={modalQR}
        onClose={cerrarQR}
        title={
          <Group gap="xs">
            <IconTruck size={16} />
            <Text fw={600} size="sm">{camionQR?.nombre}</Text>
          </Group>
        }
        centered
        size="sm"
      >
        {camionQR && (
          <Stack gap="md" align="center">
            {camionQR.patente && (
              <Text size="sm" c="dimmed">Patente: <strong>{camionQR.patente}</strong></Text>
            )}

            <Box p="md" style={{ border: '1px solid #e9ecef', background: '#fafafa' }}>
              <QRCodeCanvas
                id="qr-canvas"
                value={camionQR.codigo}
                size={260}
                level="M"
                includeMargin
              />
            </Box>

            <Text size="xs" c="dimmed" ff="monospace" ta="center" style={{ wordBreak: 'break-all' }}>
              {camionQR.codigo}
            </Text>

            <Divider w="100%" />

            <Group gap="sm">
              <Button
                leftSection={<IconDownload size={14} />}
                variant="default"
                size="sm"
                onClick={descargarQR}
              >
                Descargar PNG
              </Button>
              <Button
                leftSection={<IconPrinter size={14} />}
                color="green"
                size="sm"
                onClick={imprimirQR}
              >
                Imprimir
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
