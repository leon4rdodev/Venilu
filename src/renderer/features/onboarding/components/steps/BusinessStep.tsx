import { Upload, X } from 'lucide-react';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@components/ui/select';
import { formatPhoneNumber, formatRNC } from '@lib/formatters';
import { capitalizeWords } from '@lib/utils';
import type { BusinessData } from '@renderer/features/onboarding/types/onboarding.types';

interface BusinessStepProps {
    businessData: BusinessData;
    setBusinessData: React.Dispatch<React.SetStateAction<BusinessData>>;
    handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    removeLogo: () => void;
}

const CURRENCIES = [
    { code: 'DOP', label: 'DOP — Peso Dominicano', symbol: 'RD$' },
    { code: 'USD', label: 'USD — Dólar Estadounidense', symbol: '$' },
    { code: 'EUR', label: 'EUR — Euro', symbol: '€' },
    { code: 'MXN', label: 'MXN — Peso Mexicano', symbol: '$' },
    { code: 'COP', label: 'COP — Peso Colombiano', symbol: '$' },
    { code: 'ARS', label: 'ARS — Peso Argentino', symbol: '$' },
    { code: 'CLP', label: 'CLP — Peso Chileno', symbol: '$' },
    { code: 'PEN', label: 'PEN — Sol Peruano', symbol: 'S/' },
    { code: 'BRL', label: 'BRL — Real Brasileño', symbol: 'R$' },
    { code: 'GTQ', label: 'GTQ — Quetzal Guatemalteco', symbol: 'Q' },
    { code: 'HNL', label: 'HNL — Lempira Hondureño', symbol: 'L' },
    { code: 'NIO', label: 'NIO — Córdoba Nicaragüense', symbol: 'C$' },
    { code: 'CRC', label: 'CRC — Colón Costarricense', symbol: '₡' },
    { code: 'PAB', label: 'PAB — Balboa Panameño', symbol: 'B/.' },
    { code: 'VES', label: 'VES — Bolívar Venezolano', symbol: 'Bs.S' },
    { code: 'BOB', label: 'BOB — Boliviano', symbol: 'Bs.' },
    { code: 'PYG', label: 'PYG — Guaraní Paraguayo', symbol: '₲' },
    { code: 'UYU', label: 'UYU — Peso Uruguayo', symbol: '$U' },
    { code: 'GBP', label: 'GBP — Libra Esterlina', symbol: '£' },
    { code: 'CAD', label: 'CAD — Dólar Canadiense', symbol: 'CA$' },
] as const;

export function BusinessStep({
    businessData,
    setBusinessData,
    handleLogoUpload,
    removeLogo,
}: BusinessStepProps) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="bname" className="text-sm">Nombre del negocio *</Label>
                    <Input
                        id="bname"
                        placeholder="Mi Tienda"
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
                        placeholder="(809) 555-1234"
                        value={businessData.business_phone}
                        className="h-10"
                        onChange={(e) =>
                            setBusinessData(p => ({ ...p, business_phone: formatPhoneNumber(e.target.value) }))
                        }
                    />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="bemail" className="text-sm">Correo electrónico</Label>
                    <Input
                        id="bemail"
                        type="email"
                        placeholder="info@mitienda.com"
                        value={businessData.business_email}
                        className="h-10"
                        onChange={(e) =>
                            setBusinessData(p => ({ ...p, business_email: e.target.value }))
                        }
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="currency" className="text-sm">Moneda</Label>
                    <Select
                        value={businessData.currency}
                        onValueChange={(v) => setBusinessData(p => ({ ...p, currency: v }))}
                    >
                        <SelectTrigger id="currency" className="h-10">
                            <SelectValue placeholder="Selecciona una moneda" />
                        </SelectTrigger>
                        <SelectContent>
                            {CURRENCIES.map(({ code, label, symbol }) => (
                                <SelectItem key={code} value={code}>
                                    <span className="font-mono text-xs text-muted-foreground w-8 inline-block">
                                        {symbol}
                                    </span>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Logo upload */}
            <div className="space-y-1.5">
                <Label className="text-sm">
                    Logo{' '}
                    <span className="text-muted-foreground font-normal">
                        (opcional · PNG/JPG · máx 2MB)
                    </span>
                </Label>
                {businessData.logoPreview ? (
                    <div className="relative inline-block group">
                        <img
                            src={businessData.logoPreview}
                            alt="Logo"
                            className="w-28 h-28 object-contain rounded-xl border border-border bg-muted"
                        />
                        <button
                            onClick={removeLogo}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all">
                        <Upload className="w-6 h-6 mb-1.5 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Click para subir logo</p>
                        <input
                            type="file"
                            className="hidden"
                            accept="image/png,image/jpeg,image/jpg"
                            onChange={handleLogoUpload}
                        />
                    </label>
                )}
            </div>
        </div>
    );
}
