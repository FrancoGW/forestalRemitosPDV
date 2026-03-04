import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Stack, Button, Text, Alert, Paper } from '@mantine/core';
import { IconCamera, IconCameraOff, IconAlertCircle } from '@tabler/icons-react';

interface Props {
  onScan: (codigo: string) => void;
  activo?: boolean;
}

export default function QrScanner({ onScan, activo = true }: Props) {
  const [corriendo, setCorriendo] = useState(false);
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-scanner-container';

  async function iniciar() {
    setError('');
    try {
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          onScan(decoded);
        },
        () => {}
      );
      setCorriendo(true);
    } catch (e: any) {
      setError('No se pudo acceder a la cámara. Verificá los permisos del navegador.');
    }
  }

  async function detener() {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
      scannerRef.current.clear();
    }
    setCorriendo(false);
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <Stack gap="sm" align="center">
      <Paper
        style={{
          border: '1px solid #e9ecef',
          overflow: 'hidden',
          width: '100%',
          maxWidth: 360,
          minHeight: corriendo ? 'auto' : 0,
        }}
      >
        <div id={containerId} style={{ width: '100%' }} />
      </Paper>

      {error && (
        <Alert icon={<IconAlertCircle size={14} />} color="red" variant="light" w="100%" maw={360}>
          {error}
        </Alert>
      )}

      {!corriendo ? (
        <Button
          leftSection={<IconCamera size={16} />}
          color="green"
          onClick={iniciar}
          disabled={!activo}
        >
          Activar cámara
        </Button>
      ) : (
        <Button
          leftSection={<IconCameraOff size={16} />}
          variant="default"
          onClick={detener}
        >
          Detener cámara
        </Button>
      )}

      {corriendo && (
        <Text size="xs" c="dimmed">Apuntá la cámara al código QR del camión</Text>
      )}
    </Stack>
  );
}
