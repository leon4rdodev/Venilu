import { useState, useEffect } from "react";
import { Label } from "@components/ui/label";
import { Button } from "@components/ui/button";
import { Switch } from "@components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { CreditCard, Banknote, ArrowRightLeft, Zap, Shield, Volume2, Music, Speaker } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "../hooks/use-settings";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { Skeleton } from "@components/ui/skeleton";
import { initAudioContext, POSSounds } from "@renderer/features/pos/utils/sounds";

export function POSSettings() {
  const { settings, isLoading, updateSettings } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [quickSaleEnabled, setQuickSaleEnabled] = useState(false);
  const [quickSalePaymentMethod, setQuickSalePaymentMethod] = useState<'cash' | 'card' | 'transfer'>('transfer');

  // Sound settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.5);
  const [soundAddProduct, setSoundAddProduct] = useState(true);
  const [soundSaleComplete, setSoundSaleComplete] = useState(true);

  useEffect(() => {
    if (settings) {
      setQuickSaleEnabled(Boolean(settings.quick_sale_enabled));
      setQuickSalePaymentMethod((settings.quick_sale_payment_method as 'cash' | 'card' | 'transfer') || 'transfer');
      setSoundEnabled(Boolean(settings.sound_enabled ?? true));
      setSoundVolume(settings.sound_volume ?? 0.5);
      setSoundAddProduct(Boolean(settings.sound_add_product ?? true));
      setSoundSaleComplete(Boolean(settings.sound_sale_complete ?? true));
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateSettings({
        quick_sale_enabled: quickSaleEnabled,
        quick_sale_payment_method: quickSalePaymentMethod,
        sound_enabled: soundEnabled,
        sound_volume: soundVolume,
        sound_add_product: soundAddProduct,
        sound_sale_complete: soundSaleComplete,
      });

      if (result.success) {
        toast.success("Configuración guardada", {
          description: "Los ajustes del punto de venta se guardaron correctamente",
        });
      } else {
        toast.error("Error al guardar", { description: result.message });
      }
    } catch {
      toast.error("Error al guardar configuración");
    } finally {
      setIsSaving(false);
    }
  };

  const paymentMethods = [
    { id: 'transfer' as const, label: 'Transferencia', icon: ArrowRightLeft, desc: 'Procesa como pago por transferencia (recomendado para velocidad)' },
    { id: 'cash' as const, label: 'Efectivo (monto exacto)', icon: Banknote, desc: 'Asume que el cliente paga el monto exacto sin vuelto' },
    { id: 'card' as const, label: 'Tarjeta', icon: CreditCard, desc: 'Procesa como pago con tarjeta' },
  ];

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-6 border-b border-border">
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="flex justify-end pt-1">
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-6 border-b border-border">
        <WidgetHeader
          icon={Zap}
          title="Punto de Venta"
          subtitle="Configuración del comportamiento del carrito y ventas rápidas"
        />
      </div>
      <div className="p-6 space-y-6">
        {/* Venta Rápida */}
        <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Zap className="h-4 w-4 text-primary" strokeWidth={1.75} aria-hidden="true" />
                Venta Rápida
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Al activarse, el botón "Proceder al Pago" cambia a "Completar Venta" y procesa la venta
                directamente sin abrir el diálogo de pago, usando el método de pago seleccionado abajo.
              </p>
            </div>
            <Switch
              id="quick-sale-enabled"
              checked={quickSaleEnabled}
              onCheckedChange={setQuickSaleEnabled}
              disabled={isSaving}
              aria-describedby="quick-sale-hint"
            />
          </div>
          <p id="quick-sale-hint" className="text-xs text-muted-foreground">
            Atajo: F2 abre el modal de pago con más detalles por si quieres cambiar algo de esta venta (cliente, comprobante fiscal, método de pago, monto recibido, etc.) en vez de completarla directamente.
          </p>
        </div>

        {/* Método de pago por defecto para venta rápida */}
        <div className="space-y-4 rounded-lg border border-border p-4" style={{ opacity: quickSaleEnabled ? 1 : 0.5 }}>
          <Label htmlFor="quick-sale-payment-method" className="text-sm gap-1.5">
            <Shield className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Método de pago por defecto para Venta Rápida
            {!quickSaleEnabled && <span className="text-xs text-muted-foreground">(requiere Venta Rápida activa)</span>}
          </Label>
          <Select
            value={quickSalePaymentMethod}
            onValueChange={(value) => setQuickSalePaymentMethod(value as 'cash' | 'card' | 'transfer')}
            disabled={isSaving || !quickSaleEnabled}
          >
            <SelectTrigger id="quick-sale-payment-method" className="h-9 w-full max-w-xs" aria-describedby="quick-sale-method-hint">
              <SelectValue placeholder="Selecciona un método" />
            </SelectTrigger>
            <SelectContent>
              {paymentMethods.map((method) => (
                <SelectItem key={method.id} value={method.id}>
                  <method.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  <span>{method.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p id="quick-sale-method-hint" className="text-xs text-muted-foreground">
            {paymentMethods.find((m) => m.id === quickSalePaymentMethod)?.desc}. Este método se usará
            automáticamente al completar una venta rápida. Para "Efectivo (monto exacto)" se asume que el
            cliente paga el total exacto sin vuelto.
          </p>
        </div>

        {/* Información adicional */}
        <div className="rounded-lg border border-border p-4 bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-4 w-4 text-primary" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Cómo funciona la Venta Rápida:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>El botón del carrito cambia de "Proceder al Pago" a "Completar Venta"</li>
                <li>Al pulsar, la venta se procesa inmediatamente con el método configurado</li>
                <li>No se abre el diálogo de pago ni se solicita monto recibido</li>
                <li>Para efectivo: se registra como monto exacto (sin cambio)</li>
                <li>Para transferencia/tarjeta: se marca como pagado directamente</li>
                <li>El recibo se imprime automáticamente si está habilitado en Impresora</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Sonidos */}
        <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Music className="h-4 w-4 text-primary" strokeWidth={1.75} aria-hidden="true" />
            Sonidos del POS
          </div>
          <p className="text-sm text-muted-foreground">
            Sonidos sintetizados (sin archivos externos) para confirmación de acciones.
          </p>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="sound-enabled" className="text-sm cursor-pointer">Sonidos activados</Label>
              <p className="text-xs text-muted-foreground mt-1">Activa/desactiva todos los sonidos del punto de venta</p>
            </div>
            <Switch
              id="sound-enabled"
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2" style={{ opacity: soundEnabled ? 1 : 0.5 }}>
            <Label htmlFor="sound-volume" className="text-sm gap-2 flex items-center">
              <Volume2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              Volumen global
            </Label>
            <div className="flex items-center gap-3">
              <input
                id="sound-volume"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={soundVolume}
                onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                disabled={isSaving || !soundEnabled}
                className="flex-1 h-2 bg-muted rounded-lg appearance-none accent-primary"
                aria-label="Volumen de sonidos"
              />
              <span className="text-sm font-mono tabular-nums text-muted-foreground w-10 text-right">
                {Math.round(soundVolume * 100)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Ajusta el volumen de todos los sonidos del POS</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ opacity: soundEnabled ? 1 : 0.5 }}>
            <div className="space-y-2 rounded-lg border border-border p-3 bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                    <Speaker className="h-4 w-4 text-green-600 dark:text-green-400" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Agregar producto</p>
                    <p className="text-xs text-muted-foreground">Sonido al añadir item al carrito</p>
                  </div>
                </div>
                <Switch
                  id="sound-add-product"
                  checked={soundAddProduct}
                  onCheckedChange={setSoundAddProduct}
                  disabled={isSaving || !soundEnabled}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  initAudioContext();
                  POSSounds.addProduct(soundVolume);
                }}
                disabled={isSaving || !soundEnabled || !soundAddProduct}
                className="w-full justify-start gap-2"
              >
                <Volume2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                Probar sonido
              </Button>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3 bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                    <Music className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Completar venta</p>
                    <p className="text-xs text-muted-foreground">Acorde de confirmación al vender</p>
                  </div>
                </div>
                <Switch
                  id="sound-sale-complete"
                  checked={soundSaleComplete}
                  onCheckedChange={setSoundSaleComplete}
                  disabled={isSaving || !soundEnabled}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  initAudioContext();
                  POSSounds.saleComplete(soundVolume);
                }}
                disabled={isSaving || !soundEnabled || !soundSaleComplete}
                className="w-full justify-start gap-2"
              >
                <Volume2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                Probar sonido
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 px-6 shrink-0"
          >
            {isSaving ? "Guardando…" : "Guardar Cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}