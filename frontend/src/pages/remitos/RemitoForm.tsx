import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Title, Text, Stack, Button, Group, Paper,
  Select, TextInput, NumberInput, Grid, Badge,
  Skeleton, ActionIcon, Combobox, useCombobox, InputBase, ScrollArea,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft, IconDeviceFloppy, IconSend,
} from '@tabler/icons-react';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import 'dayjs/locale/es';

interface Opcion { id: number; nombre: string; [key: string]: any; }

interface PDV { id: number; numero: number; nombre: string; }

function SeccionTitulo({ titulo }: { titulo: string }) {
  return (
    <Text
      size="xs" fw={600} c="dimmed" mb="md"
      style={{ textTransform: 'uppercase', letterSpacing: '0.07em' }}
    >
      {titulo}
    </Text>
  );
}

// Select con búsqueda inline para listas grandes (clientes, predios, camiones)
function SelectBusqueda({
  label, placeholder, data, value, onChange, required, error,
}: {
  label: string;
  placeholder?: string;
  data: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
}) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const [search, setSearch] = useState('');

  const filtradas = data.filter((item) =>
    (item.label ?? '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 80);

  const seleccionada = data.find((d) => d.value === value);

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(val) => {
        onChange(val);
        setSearch('');
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          label={label}
          placeholder={placeholder || 'Buscar...'}
          required={required}
          error={error}
          value={combobox.dropdownOpened ? search : (seleccionada?.label ?? '')}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            combobox.openDropdown();
            combobox.updateSelectedOptionIndex();
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => { combobox.openDropdown(); setSearch(''); }}
          rightSection={<Combobox.Chevron />}
          rightSectionPointerEvents="none"
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          placeholder="Buscar..."
        />
        <Combobox.Options>
          <ScrollArea.Autosize mah={220} type="scroll">
            {filtradas.length > 0
              ? filtradas.map((item) => (
                  <Combobox.Option key={item.value} value={item.value}>
                    {item.label}
                  </Combobox.Option>
                ))
              : <Combobox.Empty>Sin resultados</Combobox.Empty>
            }
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

function toOpts(arr: Opcion[], labelKey = 'nombre') {
  return arr.map((o) => ({ value: String(o.id), label: (o[labelKey] ?? '') as string }));
}

export default function RemitoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const esEdicion = Boolean(id);

  const [pdvs, setPdvs] = useState<PDV[]>([]);
  const [productos, setProductos] = useState<Opcion[]>([]);
  const [especies, setEspecies] = useState<Opcion[]>([]);
  const [balanzas, setBalanzas] = useState<Opcion[]>([]);
  const [predios, setPredios] = useState<Opcion[]>([]);
  const [clientes, setClientes] = useState<Opcion[]>([]);
  const [empresasTransporte, setEmpresasTransporte] = useState<Opcion[]>([]);
  const [camiones, setCamiones] = useState<Opcion[]>([]);
  const [categorias, setCategorias] = useState<Opcion[]>([]);
  const [subcategorias, setSubcategorias] = useState<Opcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const form = useForm({
    initialValues: {
      puntoventa_id:        usuario?.pdv_id ? String(usuario.pdv_id) : '',
      fecha:                null as Date | null,
      cliente_id:           '',
      predio_id:            '',
      rodal:                '',
      producto_id:          '',
      especie_id:           '',
      categoria_id:         '',
      subcategoria_id:      '',
      elaborador_id:        '',
      extractor_id:         '',
      cargador_id:          '',
      balanza_id:           '',
      camion_id:            '',
      acopladocamion_id:    '',
      taracamion:           0 as number,
      pesobruto:            0 as number,
      volumencliente:       0 as number,
      m3:                   null as number | null,
      largos:               '',
      largo:                null as number | null,
      empresatransporte_id: '',
      conductor:            '',
      dniconductor:         '',
      distancia:            null as number | null,
      observaciones:        '',
    },
    validate: {
      cliente_id:  (v) => (v ? null : 'Requerido'),
      predio_id:   (v) => (v ? null : 'Requerido'),
      rodal:       (v) => (v.trim() ? null : 'Requerido'),
      producto_id: (v) => (v ? null : 'Requerido'),
      balanza_id:  (v) => (v ? null : 'Requerido'),
    },
  });

  const toneladasIngresada = (form.values.pesobruto || 0) - (form.values.taracamion || 0);

  useEffect(() => {
    async function cargar() {
      try {
        const promesas: Promise<any>[] = [
          api.get('/catalogos/productos'),
          api.get('/catalogos/especies'),
          api.get('/catalogos/balanzas'),
          api.get('/catalogos/predios'),
          api.get('/catalogos/clientes'),
          api.get('/catalogos/empresas-transporte'),
          api.get('/catalogos/camiones'),
          api.get('/catalogos/categorias'),
          api.get('/catalogos/subcategorias'),
        ];
        if (usuario?.rol === 'superadmin') promesas.push(api.get('/pdv'));

        const [
          prodRes, espRes, balRes, predRes, cliRes,
          etRes, camRes, catRes, scRes, pdvRes,
        ] = await Promise.all(promesas);

        setProductos(prodRes.data);
        setEspecies(espRes.data);
        setBalanzas(balRes.data);
        setPredios(predRes.data);
        setClientes(cliRes.data);
        setEmpresasTransporte(etRes.data);
        setCamiones(camRes.data.map((c: any) => ({
          id: c.id,
          nombre: `${c.patente}${c.marca ? ` — ${c.marca}` : ''}`,
        })));
        setCategorias(catRes.data);
        setSubcategorias(scRes.data);
        if (pdvRes) setPdvs(pdvRes.data);

        if (esEdicion) {
          const { data } = await api.get(`/remitos/${id}`);
          form.setValues({
            puntoventa_id:        String(data.puntoventa_id ?? ''),
            fecha:                data.fecha ? new Date(data.fecha) : null,
            cliente_id:           String(data.cliente_id ?? ''),
            predio_id:            String(data.predio_id ?? ''),
            rodal:                data.rodal ?? '',
            producto_id:          String(data.producto_id ?? ''),
            especie_id:           String(data.especie_id ?? ''),
            categoria_id:         String(data.categoria_id ?? ''),
            subcategoria_id:      String(data.subcategoria_id ?? ''),
            elaborador_id:        String(data.elaborador_id ?? ''),
            extractor_id:         String(data.extractor_id ?? ''),
            cargador_id:          String(data.cargador_id ?? ''),
            balanza_id:           String(data.balanza_id ?? ''),
            camion_id:            String(data.camion_id ?? ''),
            acopladocamion_id:    String(data.acopladocamion_id ?? ''),
            taracamion:           data.taracamion ?? 0,
            pesobruto:            data.pesobruto ?? 0,
            volumencliente:       data.volumencliente ?? 0,
            m3:                   data.m3 ?? null,
            largos:               data.largos ?? '',
            largo:                data.largo ?? null,
            empresatransporte_id: String(data.empresatransporte_id ?? ''),
            conductor:            data.conductor ?? '',
            dniconductor:         data.dniconductor ?? '',
            distancia:            data.distancia ?? null,
            observaciones:        data.observaciones ?? '',
          });
        }
      } catch {
        notifications.show({ message: 'Error al cargar datos', color: 'red' });
      } finally {
        setCargando(false);
      }
    }
    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function guardar(estadoLabel: 'borrador' | 'emitido') {
    const valid = form.validate();
    if (valid.hasErrors) return;

    setGuardando(true);
    try {
      const payload = {
        ...form.values,
        puntoventa_id: form.values.puntoventa_id || usuario?.pdv_id,
        fecha: form.values.fecha
          ? form.values.fecha.toISOString()
          : new Date().toISOString(),
        estado: estadoLabel,
        // Convertir strings vacíos a null para FK
        especie_id:           form.values.especie_id || null,
        categoria_id:         form.values.categoria_id || null,
        subcategoria_id:      form.values.subcategoria_id || null,
        elaborador_id:        form.values.elaborador_id || null,
        extractor_id:         form.values.extractor_id || null,
        cargador_id:          form.values.cargador_id || null,
        camion_id:            form.values.camion_id || null,
        acopladocamion_id:    form.values.acopladocamion_id || null,
        empresatransporte_id: form.values.empresatransporte_id || null,
      };

      if (esEdicion) {
        await api.put(`/remitos/${id}`, payload);
        notifications.show({ message: 'Remito actualizado', color: 'green' });
      } else {
        await api.post('/remitos', payload);
        notifications.show({
          message: estadoLabel === 'emitido' ? 'Remito emitido exitosamente' : 'Borrador guardado',
          color: 'green',
        });
      }

      navigate(usuario?.rol === 'superadmin' ? '/admin/remitos' : '/pdv/remitos');
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

  const clienteOpts  = toOpts(clientes);
  const predioOpts   = toOpts(predios);
  const camionOpts   = toOpts(camiones);
  const simpleOpts   = (arr: Opcion[]) => toOpts(arr);

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

      {/* ── Identificación ── */}
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
                {...form.getInputProps('puntoventa_id')}
              />
            </Grid.Col>
          )}
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <DatePickerInput
              label="Fecha"
              placeholder="Seleccioná una fecha"
              locale="es"
              clearable
              valueFormat="DD/MM/YYYY"
              {...form.getInputProps('fecha')}
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── Datos del Producto ── */}
      <Paper p="lg" style={{ border: '1px solid #e9ecef', background: '#fff' }}>
        <SeccionTitulo titulo="Datos del Producto" />
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <SelectBusqueda
              label="Cliente"
              placeholder="Buscar cliente"
              data={clienteOpts}
              value={form.values.cliente_id}
              onChange={(v) => form.setFieldValue('cliente_id', v)}
              required
              error={form.errors.cliente_id as string}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <SelectBusqueda
              label="Predio"
              placeholder="Buscar predio"
              data={predioOpts}
              value={form.values.predio_id}
              onChange={(v) => form.setFieldValue('predio_id', v)}
              required
              error={form.errors.predio_id as string}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              label="Rodal"
              placeholder="Nº de rodal"
              required
              {...form.getInputProps('rodal')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              label="Producto"
              placeholder="Seleccioná"
              data={simpleOpts(productos)}
              searchable
              required
              {...form.getInputProps('producto_id')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              label="Especie"
              placeholder="Seleccioná"
              data={simpleOpts(especies)}
              searchable
              {...form.getInputProps('especie_id')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Categoría"
              placeholder="Seleccioná"
              data={simpleOpts(categorias)}
              searchable
              clearable
              {...form.getInputProps('categoria_id')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Sub-Categoría"
              placeholder="Seleccioná"
              data={simpleOpts(subcategorias)}
              searchable
              clearable
              {...form.getInputProps('subcategoria_id')}
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── Empresas y Balanza ── */}
      <Paper p="lg" style={{ border: '1px solid #e9ecef', background: '#fff' }}>
        <SeccionTitulo titulo="Empresas y Balanza" />
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <SelectBusqueda
              label="Empresa Elaboración"
              placeholder="Buscar empresa"
              data={clienteOpts}
              value={form.values.elaborador_id}
              onChange={(v) => form.setFieldValue('elaborador_id', v)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <SelectBusqueda
              label="Empresa Extracción"
              placeholder="Buscar empresa"
              data={clienteOpts}
              value={form.values.extractor_id}
              onChange={(v) => form.setFieldValue('extractor_id', v)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <SelectBusqueda
              label="Empresa Carga"
              placeholder="Buscar empresa"
              data={clienteOpts}
              value={form.values.cargador_id}
              onChange={(v) => form.setFieldValue('cargador_id', v)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Balanza"
              placeholder="Seleccioná"
              data={simpleOpts(balanzas)}
              required
              {...form.getInputProps('balanza_id')}
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── Pesaje ── */}
      <Paper p="lg" style={{ border: '1px solid #e9ecef', background: '#fff' }}>
        <SeccionTitulo titulo="Pesaje" />
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <SelectBusqueda
              label="Camión"
              placeholder="Buscar por patente"
              data={camionOpts}
              value={form.values.camion_id}
              onChange={(v) => form.setFieldValue('camion_id', v)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <SelectBusqueda
              label="Acoplado"
              placeholder="Buscar por patente"
              data={camionOpts}
              value={form.values.acopladocamion_id}
              onChange={(v) => form.setFieldValue('acopladocamion_id', v)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <NumberInput
              label="Tara"
              placeholder="0,00"
              decimalScale={3}
              min={0}
              suffix=" tn"
              {...form.getInputProps('taracamion')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <NumberInput
              label="Peso Bruto"
              placeholder="0,00"
              decimalScale={3}
              min={0}
              suffix=" tn"
              {...form.getInputProps('pesobruto')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <TextInput
              label="Tn. Ingresadas"
              value={toneladasIngresada.toFixed(3)}
              readOnly
              styles={{ input: { background: '#f8f9fa', fontWeight: 600, color: '#2e7d32' } }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <NumberInput
              label="Tn. Cliente"
              placeholder="0,00"
              decimalScale={3}
              min={0}
              suffix=" tn"
              {...form.getInputProps('volumencliente')}
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
            <NumberInput
              label="Largo (m)"
              placeholder="0,00"
              decimalScale={2}
              min={0}
              {...form.getInputProps('largo')}
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

      {/* ── Transporte y Conductor ── */}
      <Paper p="lg" style={{ border: '1px solid #e9ecef', background: '#fff' }}>
        <SeccionTitulo titulo="Transporte y Conductor" />
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <SelectBusqueda
              label="Empresa Transporte"
              placeholder="Buscar empresa"
              data={toOpts(empresasTransporte)}
              value={form.values.empresatransporte_id}
              onChange={(v) => form.setFieldValue('empresatransporte_id', v)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Conductor"
              placeholder="Apellido Nombre"
              {...form.getInputProps('conductor')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              label="DNI Conductor"
              placeholder="Ej: 28456789"
              {...form.getInputProps('dniconductor')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <NumberInput
              label="Distancia (Km)"
              placeholder="0"
              min={0}
              suffix=" km"
              {...form.getInputProps('distancia')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              label="Observaciones"
              placeholder="Notas adicionales"
              {...form.getInputProps('observaciones')}
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
