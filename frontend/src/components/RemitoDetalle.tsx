import { useEffect, useRef, useState } from 'react';
import {
  Modal, Stack, Group, Text, Badge, Divider,
  SimpleGrid, Skeleton, Alert, Grid,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import api from '../api/client';

interface RemitoCompleto {
  id: number;
  numero: string;
  estado: string;
  pdv_id: number;
  pdv_numero: number;
  pdv_nombre: string;
  fecha_emision: string;
  fecha_facturacion: string | null;
  cliente: string | null;
  predio: string | null;
  rodal: string | null;
  producto: string | null;
  especie: string | null;
  categoria_nombre: string | null;
  subcategoria_nombre: string | null;
  elaborador_nombre: string | null;
  extractor_nombre: string | null;
  cargador_nombre: string | null;
  balanza: string | null;
  camion_patente: string | null;
  acoplado_patente: string | null;
  taracamion: number | null;
  pesobruto: number | null;
  toneladas_ingresada: number | null;
  volumencliente: number | null;
  m3: number | null;
  largos: string | null;
  largo: string | null;
  empresa_transporte: string | null;
  conductor: string | null;
  dniconductor: string | null;
  distancia: number | null;
  observaciones: string | null;
}

const colorEstado: Record<string, string> = {
  borrador: 'gray', emitido: 'green', anulado: 'red',
};

function Campo({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={600} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Text>
      <Text size="sm" fw={500} c={value != null && value !== '' ? 'dark' : 'dimmed'}>
        {value ?? '—'}
      </Text>
    </Stack>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Stack gap="sm">
      <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {titulo}
      </Text>
      {children}
      <Divider />
    </Stack>
  );
}

const TRANSITION_MS = 150;

interface Props {
  remitoId: number | null;
  onClose: () => void;
}

export default function RemitoDetalle({ remitoId, onClose }: Props) {
  const [opened, setOpened] = useState(false);
  const [remito, setRemito] = useState<RemitoCompleto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const loadedId = useRef<number | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = () => {
    setOpened(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => { onClose(); }, TRANSITION_MS);
  };

  useEffect(() => {
    if (remitoId === null) return;

    if (remitoId === loadedId.current && remito) {
      setOpened(true);
      return;
    }

    loadedId.current = remitoId;
    setError('');
    setCargando(true);
    setOpened(true);

    api.get(`/remitos/${remitoId}`)
      .then(({ data }) => setRemito(data))
      .catch(() => setError('No se pudo cargar el remito.'))
      .finally(() => setCargando(false));

    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, [remitoId]);

  const fmtFecha = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  const fmtNum = (n: number | string | null | undefined, dec = 3) => {
    if (n == null) return '—';
    const num = typeof n === 'string' ? parseFloat(n) : n;
    return isNaN(num) ? '—' : num.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      transitionProps={{ duration: TRANSITION_MS, transition: 'fade' }}
      title={
        remito && !cargando ? (
          <Group gap="sm">
            <Text fw={700} size="md">Remito #{remito.numero}</Text>
            <Badge color={colorEstado[remito.estado] ?? 'gray'} variant="light" size="sm">
              {remito.estado ? remito.estado.charAt(0).toUpperCase() + remito.estado.slice(1) : '—'}
            </Badge>
          </Group>
        ) : <Text fw={700}>Remito</Text>
      }
      size="lg"
      centered
    >
      {cargando && (
        <Stack gap="sm">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={36} />)}
        </Stack>
      )}

      {error && (
        <Alert icon={<IconAlertCircle size={14} />} color="red" variant="light">{error}</Alert>
      )}

      {remito && !cargando && (
        <Stack gap="lg">

          {/* Cabecera */}
          <SimpleGrid cols={3} spacing="md">
            <Campo label="Fecha emisión"     value={fmtFecha(remito.fecha_emision)} />
            <Campo label="Fecha facturación" value={fmtFecha(remito.fecha_facturacion)} />
            <Campo label="PDV"               value={remito.pdv_numero != null ? `PDV ${remito.pdv_numero} — ${remito.pdv_nombre ?? ''}` : '—'} />
          </SimpleGrid>
          <Divider />

          {/* Producto */}
          <Seccion titulo="Datos del producto">
            <Grid gutter="md">
              <Grid.Col span={6}><Campo label="Cliente"        value={remito.cliente} /></Grid.Col>
              <Grid.Col span={6}><Campo label="Predio"         value={remito.predio} /></Grid.Col>
              <Grid.Col span={3}><Campo label="Rodal"          value={remito.rodal} /></Grid.Col>
              <Grid.Col span={3}><Campo label="Producto"       value={remito.producto} /></Grid.Col>
              <Grid.Col span={3}><Campo label="Especie"        value={remito.especie} /></Grid.Col>
              <Grid.Col span={3}><Campo label="Categoría"      value={remito.categoria_nombre} /></Grid.Col>
              <Grid.Col span={6}><Campo label="Sub-categoría"  value={remito.subcategoria_nombre} /></Grid.Col>
            </Grid>
          </Seccion>

          {/* Empresas */}
          <Seccion titulo="Empresas y balanza">
            <SimpleGrid cols={2} spacing="md">
              <Campo label="Empresa Elaboración" value={remito.elaborador_nombre} />
              <Campo label="Empresa Extracción"  value={remito.extractor_nombre} />
              <Campo label="Empresa Carga"       value={remito.cargador_nombre} />
              <Campo label="Balanza"             value={remito.balanza} />
            </SimpleGrid>
          </Seccion>

          {/* Pesaje */}
          <Seccion titulo="Pesaje">
            <SimpleGrid cols={3} spacing="md">
              <Campo label="Patente Camión"   value={remito.camion_patente} />
              <Campo label="Patente Acoplado" value={remito.acoplado_patente} />
              <Campo label="Largos"           value={remito.largos ?? remito.largo} />
              <Campo label="Tara"             value={`${fmtNum(remito.taracamion)} tn`} />
              <Campo label="Peso Bruto"       value={`${fmtNum(remito.pesobruto)} tn`} />
              <Campo label="Tn. Ingresadas"   value={`${fmtNum(remito.toneladas_ingresada)} tn`} />
              <Campo label="Tn. Cliente"      value={`${fmtNum(remito.volumencliente)} tn`} />
              <Campo label="M³"               value={remito.m3 != null ? fmtNum(remito.m3, 2) : null} />
            </SimpleGrid>
          </Seccion>

          {/* Transporte */}
          <Stack gap="sm">
            <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Transporte y conductor
            </Text>
            <SimpleGrid cols={2} spacing="md">
              <Campo label="Empresa Transporte" value={remito.empresa_transporte} />
              <Campo label="Nombre Conductor"   value={remito.conductor} />
              <Campo label="DNI Conductor"      value={remito.dniconductor} />
              <Campo label="Distancia"          value={remito.distancia != null ? `${remito.distancia} km` : null} />
            </SimpleGrid>
          </Stack>

          {/* Observaciones */}
          {remito.observaciones && (
            <>
              <Divider />
              <Stack gap={4}>
                <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Observaciones
                </Text>
                <Text size="sm">{remito.observaciones}</Text>
              </Stack>
            </>
          )}

        </Stack>
      )}
    </Modal>
  );
}
