import { useState, useEffect, useRef } from "react";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Button } from "@components/ui/button";
import { Upload, X, Image as ImageIcon, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "../hooks/use-settings";
import { useLogoUpload } from "../hooks/use-logo-upload";
import { useDebouncedCallback } from "../hooks/use-debounced-callback";
import { Skeleton } from "@components/ui/skeleton";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
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
    currency: "DOP",
  });

  // Re-sincroniza el formulario cuando llegan ajustes nuevos
  // (p. ej. tras guardar el logotipo): ajuste durante el
  // render, el patrón recomendado en vez de setState en un effect.
  // syncedSettings arranca vacío a propósito: así, al remontar
  // con la caché caliente, la primera render con datos sí carga
  // los valores guardados en el formulario.
  const [syncedSettings, setSyncedSettings] = useState<typeof settings>();
  if (settings && settings !== syncedSettings) {
    setSyncedSettings(settings);
    setFormData((prev) => {
      const next = {
        business_name: settings.business_name || "",
        business_address: settings.business_address || "",
        business_phone: settings.business_phone || "",
        business_email: settings.business_email || "",
        business_tax_id: settings.business_tax_id || "",
        currency: settings.currency || "DOP",
      };
      const unchanged = (Object.keys(next) as (keyof typeof next)[]).every(
        (key) => next[key] === prev[key],
      );
      return unchanged ? prev : next;
    });
  }

  // Vista previa del logotipo: se carga cuando cambia el nombre
  // guardado (seguimiento por ref para no repetir la carga).
  const loadedLogoRef = useRef<string | null>(null);
  useEffect(() => {
    const name = settings?.logo_filename ?? null;
    if (name && name !== loadedLogoRef.current) {
      loadedLogoRef.current = name;
      loadLogo(name);
    }
  }, [settings, loadLogo]);

  // El logotipo se persiste apenas se carga o se quita: el archivo ya
  // se subió por su vía, aquí solo se registra el nombre en los ajustes.
  const logoLoadedRef = useRef(false);
  useEffect(() => {
    if (!settings) return;
    if (!logoLoadedRef.current) {
      logoLoadedRef.current = true;
      return;
    }
    if (logoFile === (settings.logo_filename ?? null)) return;
    void updateSettings({ logo_filename: logoFile }).then((result) => {
      if (!result.success) {
        toast.error("Error al guardar el logotipo", { description: result.message });
      }
    });
  }, [logoFile, settings, updateSettings]);

  // Auto-guardado con debounce: persiste ~600ms después de dejar de
  // escribir, sin esperar a un botón.
  const debouncedSave = useDebouncedCallback((data: typeof formData) => {
    if (!data.business_name.trim()) return; // obligatorio: no persistir vacío
    void updateSettings(data).then((result) => {
      if (result.success) {
        window.dispatchEvent(new CustomEvent('currency-updated', { detail: data.currency }));
      } else {
        toast.error("Error al guardar", { description: result.message });
      }
    });
  }, 600);

  const handleInputChange = (field: string, value: string) => {
    const next = { ...formData, [field]: value };
    setFormData(next);
    debouncedSave(next);
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-6 border-b border-border">
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border">
          <div className="lg:w-80 xl:w-96 shrink-0 p-6 xl:p-8 space-y-6">
            <Skeleton className="h-48 w-48 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="flex-1 p-6 xl:p-8 space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
            <div className="flex justify-end pt-1">
              <Skeleton className="h-9 w-36" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-6 border-b border-border">
        <WidgetHeader
          icon={Building2}
          title="Información del Negocio"
          subtitle="Estos datos aparecen en los recibos y comprobantes que emites"
        />
      </div>
      <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border">

          {/* LEFT — Identity & Locale */}
          <div className="lg:w-80 xl:w-96 shrink-0 p-6 xl:p-8 space-y-8">

            {/* Logo */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                Logotipo
              </h3>
              <div className="flex flex-col items-center gap-3">
                <div className="relative group w-full flex justify-center">
                  {logoPreview ? (
                    <div className="relative w-full">
                      <img
                        src={logoPreview}
                        alt="Logo del negocio"
                        className="w-full aspect-square object-contain rounded-lg border border-border bg-muted"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        aria-label="Quitar logo"
                        title="Quitar logo"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                        onClick={handleRemoveLogo}
                        disabled={isUploadingLogo}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label="Cargar logo"
                      disabled={isUploadingLogo}
                      className="w-full aspect-square rounded-lg border border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-2 hover:border-foreground/30 hover:bg-muted transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} aria-hidden="true" />
                      <span className="text-xs text-muted-foreground font-medium">Sin logo</span>
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  onChange={handleLogoSelect}
                  className="hidden"
                  aria-hidden="true"
                  tabIndex={-1}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs px-4 w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                >
                  {isUploadingLogo ? (
                    "Subiendo…"
                  ) : (
                    <>
                      <Upload className="h-3 w-3" aria-hidden="true" />
                      {logoPreview ? "Cambiar logo" : "Cargar logo"}
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  PNG o JPG. Se imprime en la cabecera de los recibos.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT — Business Info */}
          <div className="flex-1 p-6 space-y-5">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              Datos del Negocio
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="business-name" className="text-sm gap-1">
                  Nombre del Negocio
                  <span aria-hidden="true" className="text-muted-foreground">*</span>
                  <span className="sr-only">(obligatorio)</span>
                </Label>
                <Input
                  id="business-name"
                  placeholder="Ej: Mi Cafetería"
                  value={formData.business_name}
                  onChange={(e) => handleInputChange("business_name", e.target.value)}
                  aria-required="true"
                  autoComplete="organization"
                  className="h-9"
                />
                {!formData.business_name.trim() && (
                  <p className="text-xs text-destructive">El nombre del negocio es obligatorio</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tax-id" className="text-sm">RNC / Cédula</Label>
                <Input
                  id="tax-id"
                  placeholder="123-4567890-1"
                  inputMode="numeric"
                  value={formData.business_tax_id}
                  onChange={(e) => handleInputChange("business_tax_id", formatRNC(e.target.value))}
                  aria-describedby="tax-id-hint"
                  className="h-9 font-mono tabular-nums"
                />
                <p id="tax-id-hint" className="text-xs text-muted-foreground">
                  Obligatorio para emitir comprobantes fiscales (NCF).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-sm">Teléfono</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(809) 555-1234"
                  value={formData.business_phone}
                  onChange={(e) => handleInputChange("business_phone", formatPhoneNumber(e.target.value))}
                  className="h-9 tabular-nums"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address" className="text-sm">Dirección</Label>
                <Input
                  id="address"
                  autoComplete="street-address"
                  placeholder="Ej: Calle Principal #123"
                  value={formData.business_address}
                  onChange={(e) => handleInputChange("business_address", e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="email" className="text-sm">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="info@minegocio.com"
                  value={formData.business_email}
                  onChange={(e) => handleInputChange("business_email", e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-1">
              Los cambios se guardan automáticamente mientras escribes.
            </p>
          </div>

        </div>
    </div>
  );
}
