import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title, Text, Stack, Button, Group, Paper, Badge,
  SimpleGrid, ThemeIcon, Skeleton,
} from '@mantine/core';
import { IconFileText, IconPlus, IconTrendingUp, IconCheck } from '@tabler/icons-react';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

export default function PanelPDV() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get('/remitos').then(({ data }) => {
      const hoy = new Date().toISOString().slice(0, 10);
      setStats({
        total: data.length,
        hoy: data.filter((r: any) => r.fecha_emision?.startsWith(hoy)).length,
        emitidos: data.filter((r: any) => r.estado === 'emitido').length,
        borradores: data.filter((r: any) => r.estado === 'borrador').length,
      });
    });
  }, []);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Panel PDV</Title>
          <Group gap="xs" mt={4}>
            <Text c="dimmed" size="sm">Bienvenido,</Text>
            <Text size="sm" fw={600}>{usuario?.nombre}</Text>
            <Badge color="blue" variant="light" size="sm">PDV {usuario?.pdv_numero}</Badge>
          </Group>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          color="green"
          onClick={() => navigate('/pdv/remitos/nuevo')}
        >
          Nuevo Remito
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        {stats ? (
          <>
            <Paper shadow="sm" p="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="sm" c="dimmed">Total Remitos</Text>
                  <Text size="2rem" fw={700}>{stats.total}</Text>
                </div>
                <ThemeIcon color="blue" size={48} radius="md" variant="light">
                  <IconFileText size={24} />
                </ThemeIcon>
              </Group>
            </Paper>
            <Paper shadow="sm" p="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="sm" c="dimmed">Remitos Hoy</Text>
                  <Text size="2rem" fw={700}>{stats.hoy}</Text>
                </div>
                <ThemeIcon color="orange" size={48} radius="md" variant="light">
                  <IconTrendingUp size={24} />
                </ThemeIcon>
              </Group>
            </Paper>
            <Paper shadow="sm" p="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="sm" c="dimmed">Emitidos</Text>
                  <Text size="2rem" fw={700}>{stats.emitidos}</Text>
                </div>
                <ThemeIcon color="green" size={48} radius="md" variant="light">
                  <IconCheck size={24} />
                </ThemeIcon>
              </Group>
            </Paper>
            <Paper shadow="sm" p="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="sm" c="dimmed">Borradores</Text>
                  <Text size="2rem" fw={700}>{stats.borradores}</Text>
                </div>
                <ThemeIcon color="gray" size={48} radius="md" variant="light">
                  <IconFileText size={24} />
                </ThemeIcon>
              </Group>
            </Paper>
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={110} radius="md" />)
        )}
      </SimpleGrid>
    </Stack>
  );
}
