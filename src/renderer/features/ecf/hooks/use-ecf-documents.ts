import { useState, useEffect, useCallback } from "react";
import { ipc } from "@lib/ipc";
import { toast } from "sonner";
import { EcDocument, NcfSequence } from "@shared/types/models";

export function useEcfDocuments() {
  const [documents, setDocuments] = useState<EcDocument[]>([]);
  const [sequences, setSequences] = useState<NcfSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, authorized: 0, pending: 0, rejected: 0, voided: 0 });

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const [docResult, seqResult, statsResult] = await Promise.all([
        ipc.invoke("ecf:list") as Promise<{ success: boolean; data?: EcDocument[]; message?: string }>,
        ipc.invoke("ecf:ncf:list") as Promise<{ success: boolean; data?: NcfSequence[]; message?: string }>,
        ipc.invoke("ecf:stats") as Promise<{ success: boolean; data?: typeof stats; message?: string }>,
      ]);

      if (docResult.success && docResult.data) setDocuments(docResult.data);
      if (seqResult.success && seqResult.data) setSequences(seqResult.data);
      if (statsResult.success && statsResult.data) setStats(statsResult.data);
    } catch (error) {
      console.error("Error fetching e-CF data:", error);
      toast.error("Error al cargar documentos e-CF");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const generateFromSale = async (saleId: string, ecfType: string, customerId?: string) => {
    const result = await ipc.invoke("ecf:generate", { saleId, ecfType, customerId }) as {
      success: boolean; data?: EcDocument; message?: string;
    };
    if (result.success) {
      toast.success("Documento e-CF generado");
      await fetchDocuments();
    } else {
      toast.error("Error al generar e-CF", { description: result.message });
    }
    return result.success;
  };

  return {
    documents,
    sequences,
    stats,
    loading,
    fetchDocuments,
    generateFromSale,
  };
}
