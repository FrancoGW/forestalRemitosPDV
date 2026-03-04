import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Stack, Title, Text, TextInput,
  PasswordInput, Button, Alert, Group,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconLeaf, IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, cargando } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const form = useForm({
    initialValues: { username: '', password: '' },
    validate: {
      username: (v) => (v.trim().length >= 2 ? null : 'Ingresá tu usuario'),
      password: (v) => (v.length >= 4 ? null : 'Mínimo 4 caracteres'),
    },
  });

  async function handleSubmit(values: typeof form.values) {
    setError('');
    try {
      await login(values.username.trim(), values.password);
      const raw = localStorage.getItem('usuario');
      const usr = raw ? JSON.parse(raw) : null;
      navigate(usr?.rol === 'superadmin' ? '/admin' : '/pdv/remitos');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Credenciales incorrectas');
    }
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: '#f4f5f7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Paper p={40} w={380} style={{ border: '1px solid #e9ecef' }}>
        <Stack gap="xl">
          <Stack gap={4}>
            <Group gap={8} mb={2}>
              <IconLeaf size={22} color="#2d8a39" strokeWidth={2} />
              <Text fw={700} size="md" style={{ letterSpacing: '-0.01em' }}>
                Sistema Forestal
              </Text>
            </Group>
            <Title order={3} fw={600} style={{ letterSpacing: '-0.02em' }}>
              Iniciar sesión
            </Title>
            <Text size="sm" c="dimmed">
              Ingresá con tu usuario y contraseña
            </Text>
          </Stack>

          {error && (
            <Alert
              icon={<IconAlertCircle size={14} />}
              color="red"
              variant="light"
              p="sm"
              styles={{ message: { fontSize: 13 } }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <TextInput
                label="Usuario"
                placeholder="Ej: pdv13"
                size="sm"
                {...form.getInputProps('username')}
              />
              <PasswordInput
                label="Contraseña"
                placeholder="••••••••"
                size="sm"
                {...form.getInputProps('password')}
              />
              <Button
                type="submit"
                color="green"
                fullWidth
                loading={cargando}
                mt={4}
                size="sm"
              >
                Ingresar
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Box>
  );
}
