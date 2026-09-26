import { useQuery } from '@tanstack/react-query';
import { IPCResponse } from '@shared/types/ipc';
import { EcfDocument, EcfStats } from '../types';

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
