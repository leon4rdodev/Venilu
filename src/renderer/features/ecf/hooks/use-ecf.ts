import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IPCResponse } from '@shared/types/ipc';
import {
  CODIGO_DGII,
  ESTADO_ECF,
  EcfDocument,
  EcfStats,
  EstadoContingencia,
  ResumenEmision,
  ResumenReemplazos,
} from '../types';

/** Últimos comprobantes electrónicos emitidos, más recientes primero. */
export function useEcfDocuments(limite = 200) {
  return useQuery<IPCResponse<EcfDocument[]>>({
    queryKey: ['ecf-documents', limite],
    queryFn: async () =>
      (await window.ipcRenderer.invoke('ecf:list', limite)) as IPCResponse<EcfDocument[]>,
  });
}

/** Contadores por estado, para las tarjetas de resumen. */
export function useEcfStats() {
  return useQuery<IPCResponse<EcfStats>>({
    queryKey: ['ecf-stats'],
    queryFn: async () =>
      (await window.ipcRenderer.invoke('ecf:stats')) as IPCResponse<EcfStats>,
  });
}

/** Refresca la tabla y las tarjetas (lista + contadores). */
function refrescar(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['ecf-documents'] });
  void qc.invalidateQueries({ queryKey: ['ecf-stats'] });
  void qc.invalidateQueries({ queryKey: ['ecf-contingencia'] });
}

function leer<T>(res: IPCResponse<T>): T {
  if (!res.success || res.data === undefined) {
    throw new Error(res.message ?? 'La operación falló.');
  }
  return res.data;
}

function estadoTexto(doc: EcfDocument): string {
  const estado = ESTADO_ECF[doc.estado].label;
  const codigo =
    doc.dgii_code !== null && doc.dgii_code !== undefined
      ? ` · ${doc.dgii_code} ${CODIGO_DGII[doc.dgii_code] ?? ''}`
      : '';
  return `${estado}${codigo}`;
}

/**
 * Firma (si hace falta) y transmite UN comprobante. Permiso `ecf:emit`.
 * El error también queda en `last_error` del comprobante, visible en la tabla.
 */
export function useEcfEmit() {
  const qc = useQueryClient();
  return useMutation<EcfDocument, Error, string>({
    mutationFn: async (id) =>
      leer(await (window.ipcRenderer.invoke('ecf:emit', id) as Promise<IPCResponse<EcfDocument>>)),
    onSuccess: (doc) =>
      toast.success(`${doc.encf} transmitido`, { description: estadoTexto(doc) }),
    onError: (err) => toast.error('No se pudo emitir', { description: err.message }),
    onSettled: () => refrescar(qc),
  });
}

/** Consulta el estado de un comprobante ya transmitido. Permiso `ecf:view`. */
export function useEcfRefresh() {
  const qc = useQueryClient();
  return useMutation<EcfDocument, Error, string>({
    mutationFn: async (id) =>
      leer(await (window.ipcRenderer.invoke('ecf:refresh', id) as Promise<IPCResponse<EcfDocument>>)),
    onSuccess: (doc) => {
      const detalle = doc.dgii_mensajes || estadoTexto(doc);
      if (doc.estado === 'accepted') toast.success(`${doc.encf} aceptado`, { description: detalle });
      else if (doc.estado === 'rejected') toast.error(`${doc.encf} rechazado`, { description: detalle });
      else toast.info(`${doc.encf}: ${estadoTexto(doc)}`, { description: detalle });
    },
    onError: (err) => toast.error('No se pudo consultar', { description: err.message }),
    onSettled: () => refrescar(qc),
  });
}

/** Firma y transmite todo lo pendiente vencido (lo que hace el worker). */
export function useEcfEmitPending() {
  const qc = useQueryClient();
  return useMutation<ResumenEmision, Error, void>({
    mutationFn: async () =>
      leer(
        await (window.ipcRenderer.invoke('ecf:emit-pending') as Promise<IPCResponse<ResumenEmision>>)
      ),
    onSuccess: (r) => {
      const partes = [
        r.emitidos > 0 ? `${r.emitidos} firmado(s)/enviado(s)` : null,
        r.enviados > 0 ? `${r.enviados} reenviado(s)` : null,
        r.consultados > 0 ? `${r.consultados} consultado(s)` : null,
        r.fallos > 0 ? `${r.fallos} con error` : null,
      ].filter(Boolean);
      if (partes.length === 0) toast.info('No había nada pendiente de emitir');
      else if (r.fallos > 0) toast.warning('Emisión completada con errores', { description: partes.join(' · ') });
      else toast.success('Emisión completada', { description: partes.join(' · ') });
    },
    onError: (err) => toast.error('No se pudo procesar la cola', { description: err.message }),
    onSettled: () => refrescar(qc),
  });
}

/** Imprime la Representación Impresa de un e-CF (factura o Nota de Crédito). */
export function useEcfPrint() {
  const qc = useQueryClient();
  return useMutation<{ aviso?: string | null }, Error, string>({
    mutationFn: async (id) => {
      const res = (await window.ipcRenderer.invoke('ecf:print', { id })) as {
        success: boolean;
        message?: string;
        aviso?: string | null;
      };
      if (!res.success) throw new Error(res.message ?? 'No se pudo imprimir.');
      return { aviso: res.aviso };
    },
    onSuccess: ({ aviso }) => {
      if (aviso) toast.warning('Comprobante impreso con advertencia', { description: aviso, duration: 10_000 });
      else toast.success('Comprobante impreso');
    },
    onError: (err) => toast.error('No se pudo imprimir', { description: err.message }),
    // Imprimir puede firmar un borrador: refrescar el estado.
    onSettled: () => refrescar(qc),
  });
}

/** Estado de la contingencia por imposibilidad técnica. */
export function useContingencia() {
  return useQuery<IPCResponse<EstadoContingencia>>({
    queryKey: ['ecf-contingencia'],
    queryFn: async () =>
      (await window.ipcRenderer.invoke('ecf:contingencia:estado')) as IPCResponse<EstadoContingencia>,
    refetchInterval: 60_000,
  });
}

function avisarReemplazos(r: ResumenReemplazos) {
  if (r.errores.length > 0) {
    toast.warning(`${r.creados} e-CF de reemplazo creados, ${r.errores.length} con error`, {
      description: r.errores.slice(0, 3).join('\n'),
      duration: 12_000,
    });
  } else if (r.creados > 0) {
    toast.success(`${r.creados} e-CF de reemplazo creados`, {
      description: 'Se firman y transmiten solos; no se entregan al cliente.',
    });
  }
}

export function useIniciarContingencia() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: async (motivo) =>
      leer(await (window.ipcRenderer.invoke('ecf:contingencia:iniciar', { motivo }) as Promise<IPCResponse<unknown>>)),
    onSuccess: () =>
      toast.warning('Contingencia activada', {
        description: 'Las ventas con comprobante usarán NCF serie B. Registra la contingencia en la Oficina Virtual de la DGII.',
        duration: 10_000,
      }),
    onError: (err) => toast.error('No se pudo activar la contingencia', { description: err.message }),
    onSettled: () => refrescar(qc),
  });
}

export function useFinalizarContingencia() {
  const qc = useQueryClient();
  return useMutation<{ reemplazos: ResumenReemplazos }, Error, string>({
    mutationFn: async (motivo) =>
      leer(
        await (window.ipcRenderer.invoke('ecf:contingencia:finalizar', { motivo }) as Promise<
          IPCResponse<{ reemplazos: ResumenReemplazos }>
        >)
      ),
    onSuccess: ({ reemplazos }) => {
      toast.success('Contingencia finalizada', {
        description: 'Registra también la salida en la Oficina Virtual de la DGII.',
      });
      avisarReemplazos(reemplazos);
    },
    onError: (err) => toast.error('No se pudo finalizar la contingencia', { description: err.message }),
    onSettled: () => refrescar(qc),
  });
}

export function useGenerarReemplazos() {
  const qc = useQueryClient();
  return useMutation<ResumenReemplazos, Error, void>({
    mutationFn: async () =>
      leer(
        await (window.ipcRenderer.invoke('ecf:contingencia:reemplazos') as Promise<IPCResponse<ResumenReemplazos>>)
      ),
    onSuccess: (r) => {
      if (r.creados === 0 && r.errores.length === 0) toast.info('No hay comprobantes por reemplazar');
      else avisarReemplazos(r);
    },
    onError: (err) => toast.error('No se pudieron generar los reemplazos', { description: err.message }),
    onSettled: () => refrescar(qc),
  });
}
