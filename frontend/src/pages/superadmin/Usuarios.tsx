import { useEffect, useState } from 'react';
import {
  Title, Text, Stack, Paper, Badge, Group,
  Table, Skeleton, Alert, TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconSearch, IconShieldCheck, IconBuilding } from '@tabler/icons-react';
import api from '../../api/client';
import { notifications } from '@mantine/notifications';

interface Usuario {
  id: number;
  username: string;
  nombre: string;
  habilitado: boolean;
  superusuario: boolean;
  pdv_id: number | null;
  pdv_numero: number | null;
  pdv_nombre: string | null;
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    api.get('/pdv/usuarios')
      .then(({ data }) => setUsuarios(data))
      .catch(() => notifications.show({ message: 'Error al cargar usuarios', color: 'red' }))
      .finally(() => setCargando(false));
  }, []);

  const filtrados = usuarios.filter((u) =>
    busqueda === '' ||
    u.username.toLowerCase().includes(busqueda.toLowerCase()) ||
    (u.nombre ?? '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const rows = filtrados.map((u) => (
    <Table.Tr key={u.id} style={{ opacity: u.habilitado ? 1 : 0.5 }}>
      <Table.Td>
        <Stack gap={2}>
          <Text size="sm" fw={500} ff="monospace">{u.username}</Text>
          <Text size="xs" c="dimmed">{u.nombre}</Text>
        </Stack>
      </Table.Td>
      <Table.Td>
        {u.superusuario ? (
          <Badge color="grape" variant="light" leftSection={<IconShieldCheck size={11} />}>
            Super Admin
          </Badge>
        ) : (
          <Badge color="blue" variant="light" leftSection={<IconBuilding size={11} />}>
            PDV
          </Badge>
        )}
      </Table.Td>
      <Table.Td>
        {u.pdv_numero != null ? (
          <Stack gap={2}>
            <Badge variant="outline" color="blue" size="sm">PDV {u.pdv_numero}</Badge>
            <Text size="xs" c="dimmed">{u.pdv_nombre}</Text>
          </Stack>
        ) : (
          <Text size="xs" c="dimmed">—</Text>
        )}
      </Table.Td>
      <Table.Td>
        <Badge color={u.habilitado ? 'green' : 'gray'} variant="dot" size="sm">
          {u.habilitado ? 'Activo' : 'Inactivo'}
        </Badge>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="xl">
      <div>
        <Title order={2} fw={600} style={{ letterSpacing: '-0.02em' }}>Usuarios</Title>
        <Text c="dimmed" size="sm" mt={2}>Todos los usuarios del sistema y sus roles asignados</Text>
      </div>

      <Group>
        <TextInput
          placeholder="Buscar por usuario o nombre..."
          leftSection={<IconSearch size={16} />}
          value={busqueda}
          onChange={(e) => setBusqueda(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 400 }}
          size="sm"
        />
        <Text size="sm" c="dimmed">
          {filtrados.length} usuario{filtrados.length !== 1 ? 's' : ''}
        </Text>
      </Group>

      <Paper style={{ border: '1px solid #e9ecef', overflow: 'hidden', background: '#fff' }}>
        {cargando ? (
          <Stack p="md" gap="sm">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={44} />)}
          </Stack>
        ) : filtrados.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} m="md" color="blue" variant="light">
            No se encontraron usuarios.
          </Alert>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Usuario / Nombre</Table.Th>
                <Table.Th>Rol</Table.Th>
                <Table.Th>Punto de Venta</Table.Th>
                <Table.Th>Estado</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}
