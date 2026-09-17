import { Upload, X } from 'lucide-react';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { formatPhoneNumber, formatRNC } from '@lib/formatters';
import { capitalizeWords } from '@lib/utils';
import type { BusinessData } from '@renderer/features/onboarding/types/onboarding.types';

interface BusinessStepProps {
    businessData: BusinessData;
    setBusinessData: React.Dispatch<React.SetStateAction<BusinessData>>;
    handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    removeLogo: () => void;
}

export function BusinessStep({
    businessData,
    setBusinessData,
    handleLogoUpload,
    removeLogo,
}: BusinessStepProps) {
    return (
        <div className="space-y-5">
            <p className="text-xs text-muted-foreground">
                Los campos marcados con <span aria-hidden>*</span>
                <span className="sr-only">asterisco</span> son obligatorios. Estos datos aparecen en tus tickets y podrás cambiarlos luego en Ajustes.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="bname" className="text-sm">
                        Nombre del negocio <span aria-hidden>*</span>
                    </Label>
                    <Input
                        id="bname"
                        placeholder="Mi Tienda"
                        autoComplete="organization"
                        required
                        value={businessData.business_name}
                        className="h-10"
                        onChange={(e) =>
                            setBusinessData(p => ({ ...p, business_name: capitalizeWords(e.target.value) }))
                        }
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="taxid" className="text-sm">RNC / Tax ID</Label>
                    <Input
                        id="taxid"
                        placeholder="123-4567890-1"
                        inputMode="numeric"
                        value={businessData.business_tax_id}
                        className="h-10"
                        onChange={(e) =>
                            setBusinessData(p => ({ ...p, business_tax_id: formatRNC(e.target.value) }))
                        }
                    />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="baddress" className="text-sm">Dirección</Label>
                    <Input
                        id="baddress"
                        placeholder="Calle Principal #123"
                        value={businessData.business_address}
                        className="h-10"
                        onChange={(e) =>
                            setBusinessData(p => ({ ...p, business_address: e.target.value }))
                        }
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="bphone" className="text-sm">Teléfono</Label>
                    <Input
                        id="bphone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(809) 555-1234"
                        value={businessData.business_phone}
                        className="h-10"
                        onChange={(e) =>
                            setBusinessData(p => ({ ...p, business_phone: formatPhoneNumber(e.target.value) }))
                        }
                    />
                </div>
                <div className="space-y-1.5 md:col-span-3">
                    <Label htmlFor="bemail" className="text-sm">Correo electrónico</Label>
                    <Input
                        id="bemail"
                        type="email"
                        autoComplete="email"
                        placeholder="info@mitienda.com"
                        value={businessData.business_email}
                        className="h-10"
                        onChange={(e) =>
                            setBusinessData(p => ({ ...p, business_email: e.target.value }))
                        }
                    />
                </div>
            </div>

            {/* Logo upload */}
            <div className="space-y-1.5">
                <Label htmlFor="blogo" className="text-sm">
                    Logo{' '}
                    <span className="text-muted-foreground font-normal">
                        (opcional · PNG o JPG · máx. 2 MB)
                    </span>
                </Label>
                {businessData.logoPreview ? (
                    <div className="flex items-center gap-4">
                        <img
                            src={businessData.logoPreview}
                            alt="Vista previa del logo del negocio"
                            className="w-24 h-24 object-contain rounded-lg border border-border bg-muted"
                        />
                        <button
                            type="button"
                            onClick={removeLogo}
                            className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            <X className="w-4 h-4" strokeWidth={1.75} aria-hidden />
                            Quitar logo
                        </button>
                    </div>
                ) : (
                    <label
                        htmlFor="blogo"
                        className="flex flex-col items-center justify-center w-full h-24 border border-dashed border-border rounded-lg cursor-pointer text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-muted/40 hover:text-foreground focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
                    >
                        <Upload className="w-5 h-5 mb-1.5" strokeWidth={1.75} aria-hidden />
                        <span className="text-sm">Haz clic para subir el logo</span>
                        <input
                            id="blogo"
                            type="file"
                            className="sr-only"
                            accept="image/png,image/jpeg,image/jpg"
                            onChange={handleLogoUpload}
                        />
                    </label>
                )}
            </div>
        </div>
    );
}
