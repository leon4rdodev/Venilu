import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IPCResponse } from '@shared/types/ipc';
import { CODIGO_DGII, ESTADO_ECF, EcfDocument, EcfStats, ResumenEmision } from '../types';

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
