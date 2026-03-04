import { useEffect, useState } from 'react';
import {
  Title, Text, Stack, Button, Group, Paper, Badge,
  Modal, TextInput, PasswordInput, NumberInput,
  Table, ActionIcon, Tooltip, Skeleton, Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import {
  IconPlus, IconEdit, IconTrash, IconAlertCircle, IconToggleLeft, IconToggleRight,
} from '@tabler/icons-react';
import api from '../../api/client';
import { notifications } from '@mantine/notifications';

interface PDV {
  id: number;
  numero: number;
  nombre: string;
  usuario_username: string;
  usuario_nombre: string;
  activo: number;
  creado_en: string;
}

export default function PuntosDeVenta() {
  const [pdvs, setPdvs] = useState<PDV[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<PDV | null>(null);
  const [modalAbierto, { open, close }] = useDisclosure(false);

  const form = useForm({
    initialValues: {
      numero: 1,
      nombre: '',
      username: '',
      password: '',
    },
    validate: {
      numero: (v) => (v > 0 ? null : 'Número inválido'),
      nombre: (v) => (v.trim().length > 2 ? null : 'Nombre muy corto'),
      username: (v) => (v.trim().length >= 3 ? null : 'Mínimo 3 caracteres'),
      password: (v) => (!editando && v.length < 4 ? 'Mínimo 4 caracteres' : null),
    },
  });

  async function cargar() {
    setCargando(true);
    try {
      const { data } = await api.get('/pdv');
      setPdvs(data);
    } catch {
      notifications.show({ message: 'Error al cargar PDVs', color: 'red' });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  function abrirCrear() {
    setEditando(null);
    form.reset();
    open();
  }

  function abrirEditar(pdv: PDV) {
    setEditando(pdv);
    form.setValues({ numero: pdv.numero, nombre: pdv.nombre, username: pdv.usuario_username, password: '' });
    open();
  }

  async function guardar(values: typeof form.values) {
    try {
      if (editando) {
        const payload: any = { nombre: values.nombre, username: values.username };
        if (values.password) payload.password = values.password;
        await api.put(`/pdv/${editando.id}`, payload);
        notifications.show({ message: 'Punto de venta actualizado', color: 'green' });
      } else {
        await api.post('/pdv', values);
        notifications.show({ message: 'Punto de venta creado', color: 'green' });
      }
      close();
      cargar();
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.error || 'Error al guardar', color: 'red' });
    }
  }

  async function toggleActivo(pdv: PDV) {
    try {
      await api.put(`/pdv/${pdv.id}`, { activo: !pdv.activo });
      cargar();
    } catch {
      notifications.show({ message: 'Error al cambiar estado', color: 'red' });
    }
  }

  async function eliminar(pdv: PDV) {
    if (!confirm(`¿Eliminar el PDV "${pdv.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/pdv/${pdv.id}`);
      notifications.show({ message: 'Punto de venta eliminado', color: 'orange' });
      cargar();
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.error || 'Error al eliminar', color: 'red' });
    }
  }

  const rows = pdvs.map((pdv) => (
    <Table.Tr key={pdv.id}>
      <Table.Td>
        <Badge variant="light" color="blue">PDV {pdv.numero}</Badge>
      </Table.Td>
      <Table.Td fw={500}>{pdv.nombre}</Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed" ff="monospace">{pdv.usuario_username}</Text>
      </Table.Td>
      <Table.Td>
        <Badge color={pdv.activo ? 'green' : 'gray'} variant="dot">
          {pdv.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed">{new Date(pdv.creado_en).toLocaleDateString('es-AR')}</Text>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Tooltip label="Editar">
            <ActionIcon variant="light" color="blue" onClick={() => abrirEditar(pdv)}>
              <IconEdit size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={pdv.activo ? 'Desactivar' : 'Activar'}>
            <ActionIcon variant="light" color={pdv.activo ? 'orange' : 'green'} onClick={() => toggleActivo(pdv)}>
              {pdv.activo ? <IconToggleRight size={15} /> : <IconToggleLeft size={15} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Eliminar">
            <ActionIcon variant="light" color="red" onClick={() => eliminar(pdv)}>
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
          <Title order={2} fw={600} style={{ letterSpacing: '-0.02em' }}>Puntos de Venta</Title>
          <Text c="dimmed" size="sm" mt={2}>Gestioná los PDV y sus credenciales de acceso</Text>
        </div>
        <Button leftSection={<IconPlus size={14} />} color="green" size="sm" onClick={abrirCrear}>
          Nuevo PDV
        </Button>
      </Group>

      <Paper style={{ border: '1px solid #e9ecef', overflow: 'hidden', background: '#fff' }}>
        {cargando ? (
          <Stack p="md" gap="sm">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={40} />)}
          </Stack>
        ) : pdvs.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} m="md" color="blue" variant="light">
            No hay puntos de venta creados aún. Hacé clic en "Nuevo PDV" para comenzar.
          </Alert>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nº PDV</Table.Th>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Usuario</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Creado</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal
        opened={modalAbierto}
        onClose={close}
        title={<Text fw={600} size="sm">{editando ? 'Editar Punto de Venta' : 'Nuevo Punto de Venta'}</Text>}
        centered
        size="sm"
      >
        <form onSubmit={form.onSubmit(guardar)}>
          <Stack gap="md">
            {!editando && (
              <NumberInput
                label="Número de PDV"
                placeholder="Ej: 13"
                min={1}
                size="sm"
                {...form.getInputProps('numero')}
              />
            )}
            <TextInput
              label="Nombre del PDV"
              placeholder="Ej: Sucursal Norte"
              size="sm"
              {...form.getInputProps('nombre')}
            />
            <TextInput
              label="Usuario"
              placeholder="Ej: pdv13"
              description="Con este usuario ingresará al sistema"
              size="sm"
              {...form.getInputProps('username')}
              onChange={(e) => form.setFieldValue('username', e.currentTarget.value.toLowerCase().replace(/\s/g, ''))}
            />
            <PasswordInput
              label={editando ? 'Nueva contraseña' : 'Contraseña'}
              placeholder="••••••••"
              description={editando ? 'Dejá vacío para no cambiarla' : undefined}
              size="sm"
              {...form.getInputProps('password')}
            />
            <Group justify="flex-end" mt="xs">
              <Button variant="default" size="sm" onClick={close}>Cancelar</Button>
              <Button type="submit" color="green" size="sm">
                {editando ? 'Guardar cambios' : 'Crear PDV'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
