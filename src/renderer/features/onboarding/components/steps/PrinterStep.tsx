import { Printer } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@components/ui/select';
import type {
    Printer as PrinterType,
    PrinterData,
} from '@renderer/features/onboarding/types/onboarding.types';

interface PrinterStepProps {
    printers: PrinterType[];
    printerData: PrinterData;
    setPrinterData: React.Dispatch<React.SetStateAction<PrinterData>>;
    testPrint: () => Promise<void>;
    isLoading: boolean;
}

export function PrinterStep({
    printers,
    printerData,
    setPrinterData,
    testPrint,
    isLoading,
}: PrinterStepProps) {
    const hasPrinterSelected =
        printerData.printer_name && printerData.printer_name !== 'none';

    return (
        <div className="space-y-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
                Conecta tu impresora térmica para imprimir tickets de venta.
                Puedes saltar este paso y configurarlo más tarde en Ajustes.
            </p>

            <div className="space-y-1.5">
                <Label htmlFor="printer" className="text-sm">Impresora térmica</Label>
                <Select
                    value={printerData.printer_name || 'none'}
                    onValueChange={(v) =>
                        setPrinterData(p => ({ ...p, printer_name: v === 'none' ? null : v }))
                    }
                >
                    <SelectTrigger id="printer" className="h-10">
                        <SelectValue placeholder="Configurar después" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Configurar después</SelectItem>
                        {printers.map((p) => (
                            <SelectItem key={p.name} value={p.name}>
                                {p.displayName || p.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {hasPrinterSelected && (
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label className="text-sm">Tamaño de papel</Label>
                        <Select
                            value={printerData.paper_size}
                            onValueChange={(v) =>
                                setPrinterData(p => ({ ...p, paper_size: v }))
                            }
                        >
                            <SelectTrigger className="h-10">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="80mm">80mm</SelectItem>
                                <SelectItem value="58mm">58mm</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={testPrint}
                        disabled={isLoading}
                    >
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir ticket de prueba
                    </Button>
                </div>
            )}

            {printers.length === 0 && (
                <div className="text-center py-6 text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border">
                    No se encontraron impresoras físicas.<br />
                    <span className="text-xs">
                        Puedes configurar esto más tarde en Ajustes.
                    </span>
                </div>
            )}
        </div>
    );
}
