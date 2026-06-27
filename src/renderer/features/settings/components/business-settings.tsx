import { useState, useEffect } from "react";
import { Card, CardContent } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Button } from "@components/ui/button";
import { Upload, X, Image as ImageIcon, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "../hooks/use-settings";
import { useLogoUpload } from "../hooks/use-logo-upload";
import { Spinner } from "@components/ui/spinner";
import { formatPhoneNumber, formatRNC } from "@lib/formatters";

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
        toast.success("Configuración guardada");
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
      <Card className="border-border/50">
        <CardContent className="flex justify-center py-10">
          <Spinner className="size-6" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border/50">

          {/* LEFT — Identity & Locale */}
          <div className="lg:w-80 xl:w-96 shrink-0 p-6 xl:p-8 space-y-8">

            {/* Logo */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <ImageIcon className="h-3.5 w-3.5" />
                Logotipo
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="relative group w-full flex justify-center">
                  {logoPreview ? (
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="w-48 h-48 object-contain rounded-xl border border-border bg-muted"
                      />
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
                    <div className="w-48 h-48 rounded-xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-2 group-hover:border-primary/40 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                      <span className="text-xs text-muted-foreground/50 font-medium">Sin logo</span>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg" onChange={handleLogoSelect} className="hidden" />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs px-4 w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo || isSaving}
                >
                  {isUploadingLogo ? (
                    <Spinner className="size-3 mr-1.5" />
                  ) : (
                    <Upload className="h-3 w-3 mr-1.5" />
                  )}
                  {logoPreview ? "Cambiar logo" : "Cargar logo"}
                </Button>
              </div>
            </div>

          </div>

          {/* RIGHT — Business Info */}
          <div className="flex-1 p-6 space-y-5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Building2 className="h-3.5 w-3.5" />
              Datos del Negocio
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="business-name" className="text-sm">Nombre del Negocio *</Label>
                <Input
                  id="business-name"
                  placeholder="Ej: Mi Cafetería"
                  value={formData.business_name}
                  onChange={(e) => handleInputChange("business_name", e.target.value)}
                  disabled={isSaving}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tax-id" className="text-sm">RNC / Cédula</Label>
                <Input
                  id="tax-id"
                  placeholder="123-4567890-1"
                  value={formData.business_tax_id}
                  onChange={(e) => handleInputChange("business_tax_id", formatRNC(e.target.value))}
                  disabled={isSaving}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-sm">Teléfono</Label>
                <Input
                  id="phone"
                  placeholder="(809) 555-1234"
                  value={formData.business_phone}
                  onChange={(e) => handleInputChange("business_phone", formatPhoneNumber(e.target.value))}
                  disabled={isSaving}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address" className="text-sm">Dirección</Label>
                <Input
                  id="address"
                  placeholder="Ej: Calle Principal #123"
                  value={formData.business_address}
                  onChange={(e) => handleInputChange("business_address", e.target.value)}
                  disabled={isSaving}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="email" className="text-sm">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="info@minegocio.com"
                  value={formData.business_email}
                  onChange={(e) => handleInputChange("business_email", e.target.value)}
                  disabled={isSaving}
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button onClick={handleSave} disabled={isSaving || isUploadingLogo} className="h-9 px-6">
                {isSaving ? <><Spinner className="size-3 mr-2" />Guardando...</> : "Guardar Cambios"}
              </Button>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
