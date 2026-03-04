import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title, Text, Stack, Button, Group, Paper, Badge,
  Table, ActionIcon, Tooltip, Skeleton, Select, TextInput,
  Alert,
} from '@mantine/core';
import {
  IconPlus, IconEdit, IconBan, IconEye, IconSearch, IconFileText,
} from '@tabler/icons-react';
import api from '../../api/client';
import { notifications } from '@mantine/notifications';
import RemitoDetalle from '../../components/RemitoDetalle';

interface Remito {
  id: number;
  numero: number;
  pdv_numero: number;
  pdv_nombre: string;
  cliente: string;
  predio: string;
  especie: string;
  producto: string;
  toneladas_ingresada: number;
  fecha_emision: string;
  estado: 'borrador' | 'emitido' | 'anulado';
}

const colorEstado = { borrador: 'gray', emitido: 'green', anulado: 'red' } as const;

export default function Remitos() {
  const navigate = useNavigate();
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [verRemitoId, setVerRemitoId] = useState<number | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const params: any = {};
      if (filtroEstado) params.estado = filtroEstado;
      const { data } = await api.get('/remitos', { params });
      setRemitos(data);
    } catch {
      notifications.show({ message: 'Error al cargar remitos', color: 'red' });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [filtroEstado]);

  const anular = useCallback(async (remito: Remito) => {
    if (!confirm(`¿Anular el remito #${remito.numero}?`)) return;
    try {
      await api.patch(`/remitos/${remito.id}/anular`);
      notifications.show({ message: 'Remito anulado', color: 'orange' });
      cargar();
    } catch {
      notifications.show({ message: 'Error al anular', color: 'red' });
    }
  }, []);

  const verRemito = useCallback((id: number) => setVerRemitoId(id), []);
  const cerrarModal = useCallback(() => setVerRemitoId(null), []);

  const filtrados = useMemo(() =>
    remitos.filter((r) =>
      busqueda === '' ||
      (r.cliente ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (r.predio ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
      String(r.numero ?? '').includes(busqueda)
    ),
    [remitos, busqueda]
  );

  // Separamos las rows en su propio useMemo para que NO re-rendericen al abrir/cerrar el modal
  const rows = useMemo(() => filtrados.map((r) => (
    <Table.Tr key={r.id}>
      <Table.Td>
        <Group gap="xs">
          <Badge variant="outline" size="sm">PDV {r.pdv_numero}</Badge>
          <Text fw={600}>#{r.numero}</Text>
        </Group>
      </Table.Td>
      <Table.Td>{r.cliente}</Table.Td>
      <Table.Td>{r.predio}</Table.Td>
      <Table.Td>{r.especie} / {r.producto}</Table.Td>
      <Table.Td>
        <Text fw={500}>{r.toneladas_ingresada != null ? Number(r.toneladas_ingresada).toFixed(2) : '—'} tn</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {new Date(r.fecha_emision).toLocaleDateString('es-AR')}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge color={colorEstado[r.estado] ?? 'gray'} variant="light">
          {r.estado ? r.estado.charAt(0).toUpperCase() + r.estado.slice(1) : '-'}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Tooltip label="Ver detalle">
            <ActionIcon variant="light" color="blue" onClick={() => verRemito(r.id)}>
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          {r.estado !== 'anulado' && (
            <Tooltip label="Editar">
              <ActionIcon variant="light" color="orange" onClick={() => navigate(`/admin/remitos/${r.id}/editar`)}>
                <IconEdit size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {r.estado !== 'anulado' && (
            <Tooltip label="Anular">
              <ActionIcon variant="light" color="red" onClick={() => anular(r)}>
                <IconBan size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  )), [filtrados, verRemito, anular, navigate]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} fw={600} style={{ letterSpacing: '-0.02em' }}>Remitos</Title>
          <Text c="dimmed" size="sm" mt={2}>Todos los remitos del sistema</Text>
        </div>
        <Button leftSection={<IconPlus size={14} />} color="green" size="sm" onClick={() => navigate('/admin/remitos/nuevo')}>
          Nuevo Remito
        </Button>
      </Group>

      <Group gap="md">
        <TextInput
          placeholder="Buscar por cliente, predio o número..."
          leftSection={<IconSearch size={16} />}
          value={busqueda}
          onChange={(e) => setBusqueda(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Todos los estados"
          data={[
            { value: 'borrador', label: 'Borrador' },
            { value: 'emitido', label: 'Emitido' },
            { value: 'anulado', label: 'Anulado' },
          ]}
          clearable
          value={filtroEstado}
          onChange={setFiltroEstado}
          w={180}
        />
      </Group>

      <Paper style={{ border: '1px solid #e9ecef', overflow: 'hidden', background: '#fff' }}>
        {cargando ? (
          <Stack p="md" gap="sm">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={44} />)}
          </Stack>
        ) : filtrados.length === 0 ? (
          <Alert icon={<IconFileText size={16} />} m="md" color="blue" variant="light">
            No se encontraron remitos. {!remitos.length && 'Hacé clic en "Nuevo Remito" para comenzar.'}
          </Alert>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>PDV / Nº</Table.Th>
                <Table.Th>Cliente</Table.Th>
                <Table.Th>Predio</Table.Th>
                <Table.Th>Especie / Producto</Table.Th>
                <Table.Th>Toneladas</Table.Th>
                <Table.Th>Fecha</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        )}
      </Paper>

      <RemitoDetalle remitoId={verRemitoId} onClose={cerrarModal} />
    </Stack>
  );
}
