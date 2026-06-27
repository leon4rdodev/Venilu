import { useState, useEffect } from "react";
import { Card, CardContent } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Button } from "@components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Separator } from "@components/ui/separator";
import { FileText, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "../hooks/use-settings";
import { Spinner } from "@components/ui/spinner";
import { NcfSequence, NcfType } from "@shared/types/models";
import { ipc } from "@lib/ipc";

const NCF_TYPE_LABELS: Record<NcfType, string> = {
  "01": "01 - Factura de Crédito Fiscal",
  "02": "02 - Factura de Consumo",
  "03": "03 - Nota de Débito",
  "04": "04 - Nota de Crédito",
  "07": "07 - Comprobante de Compras",
  "11": "11 - Regímenes Especiales",
  "12": "12 - Ingresos por Turismo",
  "14": "14 - Factura Gubernamental",
  "15": "15 - Comprobante para Exportaciones",
};

export function NcfSettings() {
  const { settings, isLoading: settingsLoading, updateSettings } = useSettings();
  const [sequences, setSequences] = useState<NcfSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSeq, setEditingSeq] = useState<NcfSequence | null>(null);

  const [formData, setFormData] = useState({
    ecf_enabled: false,
    ecf_test_mode: true,
    ecf_default_ncf_type: "02" as NcfType,
    ecf_certificate_path: "",
    ecf_certificate_password: "",
  });
  const [seqForm, setSeqForm] = useState({
    ncf_type: "02" as NcfType,
    branch_code: "",
    description: "",
    current_number: "",
    final_number: "",
    valid_from: "",
    valid_to: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchSequences = async () => {
    try {
      const result = await ipc.invoke("ecf:ncf:list") as { success: boolean; data?: NcfSequence[] };
      if (result.success && result.data) setSequences(result.data);
    } catch {
      console.error("Error loading NCF sequences");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSequences();
  }, []);

  useEffect(() => {
    if (settings) {
      setFormData({
        ecf_enabled: settings.ecf_enabled ?? false,
        ecf_test_mode: settings.ecf_test_mode ?? true,
        ecf_default_ncf_type: (settings.ecf_default_ncf_type as NcfType) || "02",
        ecf_certificate_path: settings.ecf_certificate_path || "",
        ecf_certificate_password: settings.ecf_certificate_password || "",
      });
    }
  }, [settings]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const result = await updateSettings(formData);
      if (result.success) {
        toast.success("Configuración e-CF guardada");
      } else {
        toast.error("Error al guardar", { description: result.message });
      }
    } catch {
      toast.error("Error al guardar configuración e-CF");
    } finally {
      setIsSaving(false);
    }
  };

  const resetSeqForm = () => {
    setSeqForm({
      ncf_type: "02" as NcfType,
      branch_code: "",
      description: "",
      current_number: "",
      final_number: "",
      valid_from: "",
      valid_to: "",
    });
    setEditingSeq(null);
    setShowForm(false);
  };

  const handleEditSeq = (seq: NcfSequence) => {
    setEditingSeq(seq);
    setSeqForm({
      ncf_type: seq.ncf_type,
      branch_code: seq.branch_code,
      description: seq.description,
      current_number: seq.current_number,
      final_number: seq.final_number,
      valid_from: seq.valid_from instanceof Date
        ? seq.valid_from.toISOString().split("T")[0]
        : String(seq.valid_from).split("T")[0],
      valid_to: seq.valid_to instanceof Date
        ? seq.valid_to.toISOString().split("T")[0]
        : String(seq.valid_to).split("T")[0],
    });
    setShowForm(true);
  };

  const handleSaveSeq = async () => {
    try {
      if (editingSeq) {
        const result = await ipc.invoke("ecf:ncf:update", {
          id: editingSeq.id,
          data: seqForm,
        }) as { success: boolean; message?: string };
        if (result.success) {
          toast.success("Secuencia actualizada");
        } else {
          toast.error("Error al actualizar", { description: result.message });
          return;
        }
      } else {
        const result = await ipc.invoke("ecf:ncf:create", seqForm) as { success: boolean; message?: string };
        if (result.success) {
          toast.success("Secuencia creada");
        } else {
          toast.error("Error al crear", { description: result.message });
          return;
        }
      }
      resetSeqForm();
      await fetchSequences();
    } catch {
      toast.error("Error al guardar secuencia");
    }
  };

  const handleDeleteSeq = async (seq: NcfSequence) => {
    try {
      const result = await ipc.invoke("ecf:ncf:delete", seq.id) as { success: boolean; message?: string };
      if (result.success) {
        toast.success("Secuencia eliminada");
        await fetchSequences();
      } else {
        toast.error("Error al eliminar", { description: result.message });
      }
    } catch {
      toast.error("Error al eliminar secuencia");
    }
  };

  if (settingsLoading || loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex justify-center py-10">
          <Spinner className="size-6" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* General Config */}
      <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <FileText className="h-3.5 w-3.5" />
            Configuración General
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ecf-enabled">Habilitar e-CF</Label>
              <Select
                value={formData.ecf_enabled ? "true" : "false"}
                onValueChange={(v) => setFormData((p) => ({ ...p, ecf_enabled: v === "true" }))}
              >
                <SelectTrigger id="ecf-enabled" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Activado</SelectItem>
                  <SelectItem value="false">Desactivado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ecf-test-mode">Modo Pruebas</Label>
              <Select
                value={formData.ecf_test_mode ? "true" : "false"}
                onValueChange={(v) => setFormData((p) => ({ ...p, ecf_test_mode: v === "true" }))}
              >
                <SelectTrigger id="ecf-test-mode" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Pruebas (sandbox)</SelectItem>
                  <SelectItem value="false">Producción</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ecf-default-type">Tipo NCF por Defecto</Label>
              <Select
                value={formData.ecf_default_ncf_type}
                onValueChange={(v) => setFormData((p) => ({ ...p, ecf_default_ncf_type: v as NcfType }))}
              >
                <SelectTrigger id="ecf-default-type" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(NCF_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <FileText className="h-3.5 w-3.5" />
            Certificado Digital
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ecf-cert-path">Ruta del Certificado (.p12)</Label>
              <Input
                id="ecf-cert-path"
                placeholder="/ruta/al/certificado.p12"
                value={formData.ecf_certificate_path}
                onChange={(e) => setFormData((p) => ({ ...p, ecf_certificate_path: e.target.value }))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ecf-cert-pass">Contraseña del Certificado</Label>
              <Input
                id="ecf-cert-pass"
                type="password"
                placeholder="••••••••"
                value={formData.ecf_certificate_password}
                onChange={(e) => setFormData((p) => ({ ...p, ecf_certificate_password: e.target.value }))}
                className="h-9"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveConfig} disabled={isSaving} className="h-9 px-6">
              {isSaving ? <><Spinner className="size-3 mr-2" />Guardando...</> : "Guardar Cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* NCF Sequences */}
      <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <FileText className="h-3.5 w-3.5" />
              Secuencias NCF
            </div>
            <Button size="sm" onClick={() => { resetSeqForm(); setShowForm(true); }} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nueva Secuencia
            </Button>
          </div>

          {showForm && (
            <div className="rounded-xl border p-4 space-y-4 bg-muted/20">
              <h4 className="text-sm font-semibold">
                {editingSeq ? "Editar Secuencia" : "Nueva Secuencia"}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Tipo NCF</Label>
                  <Select
                    value={seqForm.ncf_type}
                    onValueChange={(v) => setSeqForm((p) => ({ ...p, ncf_type: v as NcfType }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(NCF_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Sucursal</Label>
                  <Input
                    placeholder="001"
                    value={seqForm.branch_code}
                    onChange={(e) => setSeqForm((p) => ({ ...p, branch_code: e.target.value }))}
                    maxLength={3}
                    className="h-9 font-mono"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-sm">Descripción</Label>
                  <Input
                    placeholder="Ej: Facturas de consumo 2026"
                    value={seqForm.description}
                    onChange={(e) => setSeqForm((p) => ({ ...p, description: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Número Inicial</Label>
                  <Input
                    placeholder="00000001"
                    value={seqForm.current_number}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 9);
                      setSeqForm((p) => ({ ...p, current_number: v }));
                    }}
                    maxLength={9}
                    className="h-9 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Número Final</Label>
                  <Input
                    placeholder="00001000"
                    value={seqForm.final_number}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 9);
                      setSeqForm((p) => ({ ...p, final_number: v }));
                    }}
                    maxLength={9}
                    className="h-9 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Válido Desde</Label>
                  <Input
                    type="date"
                    value={seqForm.valid_from}
                    onChange={(e) => setSeqForm((p) => ({ ...p, valid_from: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Válido Hasta</Label>
                  <Input
                    type="date"
                    value={seqForm.valid_to}
                    onChange={(e) => setSeqForm((p) => ({ ...p, valid_to: e.target.value }))}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={resetSeqForm}>Cancelar</Button>
                <Button size="sm" onClick={handleSaveSeq}>
                  {editingSeq ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </div>
          )}

          {sequences.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No hay secuencias NCF configuradas. Agrega una para comenzar.
            </div>
          ) : (
            <div className="space-y-2">
              {sequences.map((seq) => (
                <div key={seq.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{NCF_TYPE_LABELS[seq.ncf_type] || seq.ncf_type}</span>
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {seq.branch_code}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{seq.description}</p>
                    <p className="text-xs font-mono">
                      {seq.current_number.padStart(8, "0")} → {seq.final_number.padStart(8, "0")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditSeq(seq)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteSeq(seq)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
