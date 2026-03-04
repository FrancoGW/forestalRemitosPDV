import { useEffect, useRef, useState } from 'react';
import {
  Modal, Stack, Group, Text, Badge, Divider,
  SimpleGrid, Skeleton, Alert, Grid,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import api from '../api/client';

interface RemitoCompleto {
  id: number; numero: number; estado: string;
  pdv_id: number; fecha_emision: string; fecha_facturacion: string | null;
  cliente: string; predio: string; rodal: string;
  producto: string; especie: string; categoria: string; sub_categoria: string;
  empresa_elaboracion: string; empresa_extraccion: string; empresa_carga: string;
  balanza: string; patente_camion: string; tara: number; peso_bruto: number;
  toneladas_ingresada: number; toneladas_cliente: number;
  patente_acoplado: string | null; m3: number | null; largos: string | null;
  transporte: string | null; nombre_conductor: string | null;
  dni_conductor: string | null; distancia_km: number;
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
      <Text size="sm" fw={500} c={value ? 'dark' : 'dimmed'}>
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

  // Cerrar: animación primero, limpiar el padre después
  const handleClose = () => {
    setOpened(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      onClose();
    }, TRANSITION_MS);
  };

  useEffect(() => {
    if (remitoId === null) return;

    // Mismo remito ya cargado → solo abrir
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

    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [remitoId]);

  const fmtFecha = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  const fmtNum = (n: number | null | undefined, dec = 2) =>
    n != null ? n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—';

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
              {remito.estado.charAt(0).toUpperCase() + remito.estado.slice(1)}
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
          <SimpleGrid cols={3} spacing="md">
            <Campo label="Fecha emisión"     value={fmtFecha(remito.fecha_emision)} />
            <Campo label="Fecha facturación" value={fmtFecha(remito.fecha_facturacion)} />
            <Campo label="PDV"               value={`PDV ${remito.pdv_id}`} />
          </SimpleGrid>
          <Divider />

          <Seccion titulo="Datos del producto">
            <Grid gutter="md">
              <Grid.Col span={6}><Campo label="Cliente"   value={remito.cliente} /></Grid.Col>
              <Grid.Col span={6}><Campo label="Predio"    value={remito.predio} /></Grid.Col>
              <Grid.Col span={3}><Campo label="Rodal"     value={remito.rodal} /></Grid.Col>
              <Grid.Col span={3}><Campo label="Producto"  value={remito.producto} /></Grid.Col>
              <Grid.Col span={3}><Campo label="Especie"   value={remito.especie} /></Grid.Col>
              <Grid.Col span={3}><Campo label="Categoría" value={remito.categoria} /></Grid.Col>
            </Grid>
          </Seccion>

          <Seccion titulo="Empresas y balanza">
            <SimpleGrid cols={2} spacing="md">
              <Campo label="Empresa Elaboración" value={remito.empresa_elaboracion} />
              <Campo label="Empresa Extracción"  value={remito.empresa_extraccion} />
              <Campo label="Empresa Carga"       value={remito.empresa_carga} />
              <Campo label="Balanza"             value={remito.balanza} />
            </SimpleGrid>
          </Seccion>

          <Seccion titulo="Pesaje">
            <SimpleGrid cols={3} spacing="md">
              <Campo label="Patente Camión"   value={remito.patente_camion} />
              <Campo label="Patente Acoplado" value={remito.patente_acoplado} />
              <Campo label="Largos"           value={remito.largos} />
              <Campo label="Tara"             value={`${fmtNum(remito.tara)} tn`} />
              <Campo label="Peso Bruto"       value={`${fmtNum(remito.peso_bruto)} tn`} />
              <Campo label="Tn. Ingresadas"   value={`${fmtNum(remito.toneladas_ingresada)} tn`} />
              <Campo label="Tn. Cliente"      value={`${fmtNum(remito.toneladas_cliente)} tn`} />
              <Campo label="M³"               value={remito.m3 != null ? fmtNum(remito.m3) : null} />
            </SimpleGrid>
          </Seccion>

          <Stack gap="sm">
            <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Transporte y conductor
            </Text>
            <SimpleGrid cols={2} spacing="md">
              <Campo label="Empresa Transporte" value={remito.transporte} />
              <Campo label="Nombre Conductor"   value={remito.nombre_conductor} />
              <Campo label="DNI Conductor"      value={remito.dni_conductor} />
              <Campo label="Distancia"          value={remito.distancia_km ? `${remito.distancia_km} km` : null} />
            </SimpleGrid>
          </Stack>
        </Stack>
      )}
    </Modal>
  );
}
