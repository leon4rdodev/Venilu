import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Button } from "@components/ui/button";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "../hooks/use-settings";
import { useLogoUpload } from "../hooks/use-logo-upload";
import { Spinner } from "@components/ui/spinner";
import { formatPhoneNumber, formatRNC } from "@lib/format-utils";

export function BusinessSettings() {
  const { settings, isLoading, updateSettings } = useSettings();
  const {
    logoPreview,
    logoFile,
    isUploadingLogo,
    fileInputRef,
    loadLogo,
    handleLogoSelect,
    handleRemoveLogo,
  } = useLogoUpload();

  const [formData, setFormData] = useState({
    business_name: "",
    business_address: "",
    business_phone: "",
    business_email: "",
    business_tax_id: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        business_name: settings.business_name || "",
        business_address: settings.business_address || "",
        business_phone: settings.business_phone || "",
        business_email: settings.business_email || "",
        business_tax_id: settings.business_tax_id || "",
      });
      if (settings.logo_filename) {
        loadLogo(settings.logo_filename);
      }
    }
  }, [settings, loadLogo]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.business_name.trim()) {
      toast.error("Campo requerido", { description: "El nombre del negocio es obligatorio" });
      return;
    }
    setIsSaving(true);
    try {
      const result = await updateSettings({ ...formData, logo_filename: logoFile });
      if (result.success) {
        toast.success("Configuración guardada", { description: "Los cambios se guardaron correctamente" });
      } else {
        toast.error("Error al guardar", { description: result.message });
      }
    } catch {
      toast.error("Error al guardar configuración");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Spinner className="size-8" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Información del Negocio</CardTitle>
        <CardDescription className="text-xs">Actualiza los datos de tu establecimiento</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Logo Section */}
          <div className="shrink-0 space-y-3 flex flex-col items-center lg:items-start">
            <Label className="text-sm self-start hidden lg:block">Logo</Label>
            <div className="relative group">
              {logoPreview ? (
                <div className="relative">
                  <img src={logoPreview} alt="Logo" className="w-24 h-24 object-contain rounded-lg border border-border bg-muted" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleRemoveLogo}
                    disabled={isUploadingLogo}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg border border-dashed border-border bg-muted flex items-center justify-center group-hover:border-primary/50 transition-colors">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg" onChange={handleLogoSelect} className="hidden" />
            <Button
              size="sm"
              variant="outline"
              className="w-24 h-8 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingLogo || isSaving}
            >
              {isUploadingLogo ? (
                <Spinner className="size-3" />
              ) : (
                <>
                  <Upload className="h-3 w-3 mr-1.5" />
                  {logoPreview ? "Cambiar" : "Cargar"}
                </>
              )}
            </Button>
          </div>

          {/* Business Info Grid */}
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="business-name" className="text-sm">Nombre del Negocio *</Label>
                <Input id="business-name" placeholder="Ej: Mi Cafetería" value={formData.business_name} onChange={(e) => handleInputChange("business_name", e.target.value)} disabled={isSaving} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax-id" className="text-sm">RNC / Cédula</Label>
                <Input id="tax-id" placeholder="123-4567890-1" value={formData.business_tax_id} onChange={(e) => handleInputChange("business_tax_id", formatRNC(e.target.value))} disabled={isSaving} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-sm">Teléfono</Label>
                <Input id="phone" placeholder="(809) 555-1234" value={formData.business_phone} onChange={(e) => handleInputChange("business_phone", formatPhoneNumber(e.target.value))} disabled={isSaving} className="h-9" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="address" className="text-sm">Dirección</Label>
                <Input id="address" placeholder="Ej: Calle Principal #123" value={formData.business_address} onChange={(e) => handleInputChange("business_address", e.target.value)} disabled={isSaving} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm">Correo Electrónico</Label>
                <Input id="email" type="email" placeholder="info@micafeteria.com" value={formData.business_email} onChange={(e) => handleInputChange("business_email", e.target.value)} disabled={isSaving} className="h-9" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving || isUploadingLogo}>
            {isSaving ? <><Spinner className="size-3 mr-2" />Guardando...</> : "Guardar Cambios"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
