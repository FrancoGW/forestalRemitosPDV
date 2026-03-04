import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Title, Text, Stack, Button, Group, Paper, Divider,
  Select, TextInput, NumberInput, Grid, Badge, Alert,
  Skeleton, ActionIcon, Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft, IconDeviceFloppy, IconSend, IconAlertCircle,
} from '@tabler/icons-react';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import 'dayjs/locale/es';

interface Catalogos {
  producto?: string[];
  especie?: string[];
  categoria?: string[];
  sub_categoria?: string[];
  balanza?: string[];
}

interface PDV { id: number; numero: number; nombre: string; }

function SeccionTitulo({ titulo }: { titulo: string }) {
  return (
    <Text
      size="xs"
      fw={600}
      c="dimmed"
      mb="md"
      style={{ textTransform: 'uppercase', letterSpacing: '0.07em' }}
    >
      {titulo}
    </Text>
  );
}

export default function RemitoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const esEdicion = Boolean(id);

  const [catalogos, setCatalogos] = useState<Catalogos>({});
  const [pdvs, setPdvs] = useState<PDV[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const form = useForm({
    initialValues: {
      pdv_id: usuario?.pdv_id ? String(usuario.pdv_id) : '',
      fecha_facturacion: null as Date | null,
      cliente: '',
      predio: '',
      rodal: '',
      producto: '',
      especie: '',
      categoria: '',
      sub_categoria: '',
      empresa_elaboracion: '',
      empresa_extraccion: '',
      empresa_carga: '',
      balanza: '',
      patente_camion: '',
      tara: 0,
      peso_bruto: 0,
      toneladas_cliente: 0,
      patente_acoplado: '',
      m3: 0,
      largos: '',
      transporte: '',
      nombre_conductor: '',
      dni_conductor: '',
      distancia_km: 0,
    },
    validate: {
      cliente: (v) => (v.trim() ? null : 'Requerido'),
      predio: (v) => (v.trim() ? null : 'Requerido'),
      rodal: (v) => (v.trim() ? null : 'Requerido'),
      producto: (v) => (v ? null : 'Requerido'),
      especie: (v) => (v ? null : 'Requerido'),
      categoria: (v) => (v ? null : 'Requerido'),
      sub_categoria: (v) => (v ? null : 'Requerido'),
      empresa_elaboracion: (v) => (v.trim() ? null : 'Requerido'),
      empresa_extraccion: (v) => (v.trim() ? null : 'Requerido'),
      empresa_carga: (v) => (v.trim() ? null : 'Requerido'),
      balanza: (v) => (v ? null : 'Requerido'),
      patente_camion: (v) => (v.trim() ? null : 'Requerido'),
    },
  });

  const toneladasIngresada = (form.values.peso_bruto || 0) - (form.values.tara || 0);

  useEffect(() => {
    async function cargar() {
      try {
        const promesas: Promise<any>[] = [api.get('/catalogos')];
        if (usuario?.rol === 'superadmin') promesas.push(api.get('/pdv'));
        const [catRes, pdvRes] = await Promise.all(promesas);
        setCatalogos(catRes.data);
        if (pdvRes) setPdvs(pdvRes.data);

        if (esEdicion) {
          const { data } = await api.get(`/remitos/${id}`);
          form.setValues({
            ...data,
            pdv_id: String(data.pdv_id),
            fecha_facturacion: data.fecha_facturacion ? new Date(data.fecha_facturacion) : null,
          });
        }
      } catch {
        notifications.show({ message: 'Error al cargar datos', color: 'red' });
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [id]);

  async function guardar(estado: 'borrador' | 'emitido') {
    const valid = form.validate();
    if (valid.hasErrors) return;

    setGuardando(true);
    try {
      const payload = {
        ...form.values,
        pdv_id: form.values.pdv_id || usuario?.pdv_id,
        fecha_facturacion: form.values.fecha_facturacion
          ? form.values.fecha_facturacion.toISOString().slice(0, 10)
          : null,
        estado,
      };

      if (esEdicion) {
        await api.put(`/remitos/${id}`, payload);
        notifications.show({ message: 'Remito actualizado', color: 'green' });
      } else {
        await api.post('/remitos', payload);
        notifications.show({ message: estado === 'emitido' ? 'Remito emitido exitosamente' : 'Borrador guardado', color: 'green' });
      }

      const base = usuario?.rol === 'superadmin' ? '/admin' : '/pdv';
      navigate(`${base}/remitos`);
    } catch (e: any) {
      notifications.show({ message: e?.response?.data?.error || 'Error al guardar', color: 'red' });
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <Stack gap="md">
        <Skeleton height={40} w={200} />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={120} radius="md" />)}
      </Stack>
    );
  }

  const toSelect = (arr?: string[]) => (arr || []).map((v) => ({ value: v, label: v }));

  return (
      <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Group gap="xs">
          <ActionIcon variant="subtle" color="gray" onClick={() => navigate(-1)}>
            <IconArrowLeft size={16} />
          </ActionIcon>
          <div>
            <Title order={2} fw={600} style={{ letterSpacing: '-0.02em' }}>
              {esEdicion ? 'Editar Remito' : 'Nuevo Remito'}
            </Title>
            <Text c="dimmed" size="sm" mt={2}>Completá los datos del remito forestal</Text>
          </div>
        </Group>
        {usuario?.pdv_id && (
          <Badge color="blue" variant="outline" size="sm">
            PDV {usuario.pdv_numero} — {usuario.pdv_nombre}
          </Badge>
        )}
      </Group>

      {/* ── Cabecera ── */}
      <Paper p="lg" style={{ border: '1px solid #e9ecef', background: '#fff' }}>
        <SeccionTitulo titulo="Identificación" />
        <Grid gutter="md">
          {usuario?.rol === 'superadmin' && (
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Punto de Venta"
                placeholder="Seleccioná un PDV"
                data={pdvs.map((p) => ({ value: String(p.id), label: `PDV ${p.numero} — ${p.nombre}` }))}
                searchable
                required
                {...form.getInputProps('pdv_id')}
              />
            </Grid.Col>
          )}
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <DatePickerInput
              label="Fecha de Facturación"
              placeholder="Seleccioná una fecha"
              locale="es"
              clearable
              valueFormat="DD/MM/YYYY"
              {...form.getInputProps('fecha_facturacion')}
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── Producto ── */}
      <Paper p="lg" style={{ border: '1px solid #e9ecef', background: '#fff' }}>
        <SeccionTitulo titulo="Datos del Producto" />
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label="Cliente" placeholder="Nombre del cliente" required {...form.getInputProps('cliente')} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label="Predio" placeholder="Nombre del predio" required {...form.getInputProps('predio')} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput label="Rodal" placeholder="Nº de rodal" required {...form.getInputProps('rodal')} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              label="Producto"
              placeholder="Seleccioná"
              data={toSelect(catalogos.producto)}
              searchable
              required
              {...form.getInputProps('producto')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              label="Especie"
              placeholder="Seleccioná"
              data={toSelect(catalogos.especie)}
              searchable
              required
              {...form.getInputProps('especie')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Categoría"
              placeholder="Seleccioná"
              data={toSelect(catalogos.categoria)}
              required
              {...form.getInputProps('categoria')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Sub-Categoría"
              placeholder="Seleccioná"
              data={toSelect(catalogos.sub_categoria)}
              required
              {...form.getInputProps('sub_categoria')}
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── Empresas ── */}
      <Paper p="lg" style={{ border: '1px solid #e9ecef', background: '#fff' }}>
        <SeccionTitulo titulo="Empresas y Balanza" />
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput label="Empresa Elaboración" placeholder="Nombre empresa" required {...form.getInputProps('empresa_elaboracion')} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput label="Empresa Extracción" placeholder="Nombre empresa" required {...form.getInputProps('empresa_extraccion')} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput label="Empresa Carga" placeholder="Nombre empresa" required {...form.getInputProps('empresa_carga')} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Balanza"
              placeholder="Seleccioná"
              data={toSelect(catalogos.balanza)}
              required
              {...form.getInputProps('balanza')}
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── Pesaje ── */}
      <Paper p="lg" style={{ border: '1px solid #e9ecef', background: '#fff' }}>
        <SeccionTitulo titulo="Pesaje" />
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Patente Camión"
              placeholder="Ej: SDR 830"
              required
              styles={{ input: { textTransform: 'uppercase' } }}
              {...form.getInputProps('patente_camion')}
              onChange={(e) => form.setFieldValue('patente_camion', e.currentTarget.value.toUpperCase())}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Patente Acoplado"
              placeholder="Ej: RDW 661"
              styles={{ input: { textTransform: 'uppercase' } }}
              {...form.getInputProps('patente_acoplado')}
              onChange={(e) => form.setFieldValue('patente_acoplado', e.currentTarget.value.toUpperCase())}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <NumberInput
              label="Tara"
              placeholder="0,00"
              decimalScale={2}
              min={0}
              suffix=" tn"
              {...form.getInputProps('tara')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <NumberInput
              label="Peso Bruto"
              placeholder="0,00"
              decimalScale={2}
              min={0}
              suffix=" tn"
              {...form.getInputProps('peso_bruto')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <TextInput
              label="Tn. Ingresadas"
              value={toneladasIngresada.toFixed(2)}
              readOnly
              styles={{ input: { background: '#f8f9fa', fontWeight: 600, color: '#2e7d32' } }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <NumberInput
              label="Tn. Cliente"
              placeholder="0,00"
              decimalScale={2}
              min={0}
              suffix=" tn"
              {...form.getInputProps('toneladas_cliente')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <NumberInput
              label="M³"
              placeholder="0,00"
              decimalScale={2}
              min={0}
              {...form.getInputProps('m3')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              label="Largos"
              placeholder="Ej: 3.15"
              {...form.getInputProps('largos')}
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── Transporte ── */}
      <Paper p="lg" style={{ border: '1px solid #e9ecef', background: '#fff' }}>
        <SeccionTitulo titulo="Transporte y Conductor" />
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label="Empresa Transporte" placeholder="Nombre empresa" {...form.getInputProps('transporte')} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label="Nombre Conductor" placeholder="Apellido Nombre" {...form.getInputProps('nombre_conductor')} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label="DNI Conductor" placeholder="Ej: 28.456.789" {...form.getInputProps('dni_conductor')} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <NumberInput
              label="Distancia (Km)"
              placeholder="0"
              min={0}
              suffix=" km"
              {...form.getInputProps('distancia_km')}
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── Acciones ── */}
      <Group justify="flex-end" gap="md" pb="xl">
        <Button variant="default" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
        <Button
          variant="outline"
          color="gray"
          leftSection={<IconDeviceFloppy size={16} />}
          loading={guardando}
          onClick={() => guardar('borrador')}
        >
          Guardar borrador
        </Button>
        <Button
          color="green"
          leftSection={<IconSend size={16} />}
          loading={guardando}
          onClick={() => guardar('emitido')}
        >
          Emitir Remito
        </Button>
      </Group>
    </Stack>
  );
}
