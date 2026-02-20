import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { toast } from 'sonner';
import {
    CheckCircle2, ArrowRight, ArrowLeft,
    User, Building2, Printer, Sparkles,
    Eye, EyeOff, Upload, X, ShoppingCart
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { formatPhoneNumber, formatRNC } from '@lib/format-utils';
import { capitalizeWords } from '@lib/utils';

interface OnboardingWizardProps { onComplete: () => void; }

interface AdminData {
    username: string; name: string;
    password: string; confirmPassword: string;
}

interface BusinessData {
    business_name: string; business_address: string;
    business_phone: string; business_email: string;
    business_tax_id: string; logo_filename: string | null;
    logoPreview: string | null;
}

interface PrinterData { printer_name: string | null; paper_size: string; }
interface Printer { name: string; displayName: string; }

const STEPS = [
    { title: 'Bienvenida', description: 'Todo listo para comenzar', icon: Sparkles },
    { title: 'Administrador', description: 'Crea tu cuenta de acceso', icon: User },
    { title: 'Negocio', description: 'Datos de tu establecimiento', icon: Building2 },
    { title: 'Impresora', description: 'Configuración de tickets', icon: Printer },
];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [printers, setPrinters] = useState<Printer[]>([]);
    const [slideDir, setSlideDir] = useState(1); // 1 = forward, -1 = back

    const [adminData, setAdminData] = useState<AdminData>({
        username: '', name: '', password: '', confirmPassword: '',
    });
    const [businessData, setBusinessData] = useState<BusinessData>({
        business_name: '', business_address: '', business_phone: '',
        business_email: '', business_tax_id: '', logo_filename: null, logoPreview: null,
    });
    const [printerData, setPrinterData] = useState<PrinterData>({ printer_name: null, paper_size: '80mm' });

    const canProceed = () => {
        switch (currentStep) {
            case 0: return true;
            case 1: return adminData.username.trim() !== '' && adminData.name.trim() !== '' &&
                adminData.password.length >= 4 && adminData.password === adminData.confirmPassword;
            case 2: return businessData.business_name.trim() !== '';
            case 3: return true;
            default: return false;
        }
    };

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setSlideDir(1);
            const next = currentStep + 1;
            setCurrentStep(next);
            if (next === 3) loadPrinters();
        } else {
            handleFinish();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setSlideDir(-1);
            setCurrentStep(currentStep - 1);
        }
    };

    const loadPrinters = async () => {
        try {
            if (!window.ipcRenderer) return;
            const result = await window.ipcRenderer.invoke('get-printers') as { success: boolean; printers: Printer[] };
            if (result.success && result.printers) setPrinters(result.printers);
        } catch { setPrinters([]); }
    };

    const testPrint = async () => {
        if (!printerData.printer_name) { toast.error('Selecciona una impresora primero'); return; }
        try {
            setIsLoading(true);
            const result = await window.ipcRenderer.invoke('test-print', { printerName: printerData.printer_name }) as { success: boolean; message: string };
            result.success ? toast.success('Impresión de prueba enviada') : toast.error(result.message || 'Error al imprimir');
        } catch { toast.error('Error al realizar la prueba de impresión'); } finally { setIsLoading(false); }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { toast.error('Por favor selecciona una imagen'); return; }
        if (file.size > 2 * 1024 * 1024) { toast.error('La imagen no debe superar 2MB'); return; }
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64Data = event.target?.result as string;
            setBusinessData(prev => ({ ...prev, logoPreview: base64Data }));
            if (!window.ipcRenderer) return;
            try {
                const result = await window.ipcRenderer.invoke('upload-logo', { fileName: file.name, fileData: base64Data }) as { success: boolean; fileName: string; message: string };
                if (result.success) {
                    setBusinessData(prev => ({ ...prev, logo_filename: result.fileName }));
                    toast.success('Logo cargado exitosamente');
                } else toast.error(result.message);
            } catch { toast.error('Error al cargar el logo'); }
        };
        reader.readAsDataURL(file);
    };

    const removeLogo = () => setBusinessData(prev => ({ ...prev, logo_filename: null, logoPreview: null }));

    const handleFinish = async () => {
        setIsLoading(true);
        try {
            if (!window.ipcRenderer) { toast.error('IPC no disponible'); setIsLoading(false); return; }
            const userResult = await window.ipcRenderer.invoke('create-user', {
                username: adminData.username, name: adminData.name,
                password: adminData.password, role: 'admin',
            }) as { success: boolean; message?: string };
            if (!userResult.success) { toast.error(userResult.message || 'Error al crear usuario'); setIsLoading(false); return; }

            const finalPrinterName = printerData.printer_name === 'none' ? null : printerData.printer_name;
            const settingsResult = await window.ipcRenderer.invoke('settings:update', {
                business_name: businessData.business_name,
                business_address: businessData.business_address,
                business_phone: businessData.business_phone,
                business_email: businessData.business_email,
                business_tax_id: businessData.business_tax_id,
                logo_filename: businessData.logo_filename,
                printer_name: finalPrinterName,
                paper_size: printerData.paper_size,
            }) as { success: boolean; message?: string };
            if (!settingsResult.success) { toast.error(settingsResult.message || 'Error al guardar configuración'); setIsLoading(false); return; }

            toast.success('¡Configuración completada!');
            setTimeout(() => onComplete(), 1000);
        } catch { toast.error('Error al completar la configuración'); setIsLoading(false); }
    };

    const passwordStrength = () => {
        const p = adminData.password;
        if (!p) return null;
        if (p.length < 4) return { label: 'Muy corta', color: 'bg-destructive', w: 'w-1/4' };
        if (p.length < 6) return { label: 'Débil', color: 'bg-orange-500', w: 'w-2/4' };
        if (p.length < 10) return { label: 'Aceptable', color: 'bg-yellow-500', w: 'w-3/4' };
        return { label: 'Fuerte', color: 'bg-green-500', w: 'w-full' };
    };
    const strength = passwordStrength();

    return (
        <div className="min-h-screen flex bg-background overflow-hidden">
            {/* ── Dark sidebar ── */}
            <motion.aside
                className="hidden lg:flex lg:w-[32%] flex-col justify-between relative overflow-hidden"
                initial={{ x: -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ background: 'linear-gradient(145deg, oklch(0.10 0.04 260), oklch(0.16 0.07 265), oklch(0.12 0.05 255))' }}
            >
                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(oklch(0.9 0.1 260) 1px, transparent 1px), linear-gradient(90deg, oklch(0.9 0.1 260) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                {/* Glow */}
                <div className="absolute top-1/3 -left-20 w-72 h-72 rounded-full opacity-15 blur-3xl" style={{ background: 'oklch(0.6 0.22 260)' }} />

                {/* Logo */}
                <div className="relative z-10 p-8">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'oklch(0.6 0.22 260)' }}>
                            <ShoppingCart className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xl font-bold" style={{ color: 'oklch(0.97 0.01 240)' }}>Venilu</span>
                    </div>
                </div>

                {/* Step list */}
                <div className="relative z-10 px-8 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: 'oklch(0.45 0.05 260)' }}>
                        Configuración inicial
                    </p>
                    {STEPS.map((step, i) => {
                        const done = i < currentStep;
                        const active = i === currentStep;
                        return (
                            <div key={i} className="flex items-start gap-3 py-2.5">
                                {/* Icon / indicator */}
                                <div className="relative flex flex-col items-center">
                                    <motion.div
                                        animate={{
                                            background: done ? 'oklch(0.6 0.22 260)' : active ? 'oklch(0.6 0.22 260 / 0.2)' : 'oklch(0.22 0.05 260 / 0.6)',
                                            borderColor: active ? 'oklch(0.6 0.22 260)' : done ? 'oklch(0.6 0.22 260)' : 'oklch(0.32 0.05 260)',
                                        }}
                                        transition={{ duration: 0.3 }}
                                        className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
                                    >
                                        {done ? (
                                            <CheckCircle2 className="w-4 h-4 text-white" />
                                        ) : (
                                            <step.icon className="w-4 h-4" style={{ color: active ? 'oklch(0.75 0.18 260)' : 'oklch(0.4 0.04 260)' }} />
                                        )}
                                    </motion.div>
                                    {/* connector line */}
                                    {i < STEPS.length - 1 && (
                                        <div className="w-px h-8 mt-1" style={{ background: i < currentStep ? 'oklch(0.6 0.22 260 / 0.6)' : 'oklch(0.25 0.04 260)' }} />
                                    )}
                                </div>
                                {/* Labels */}
                                <div className="pt-0.5">
                                    <p className="text-sm font-medium" style={{ color: active ? 'oklch(0.97 0.01 240)' : done ? 'oklch(0.7 0.08 260)' : 'oklch(0.42 0.04 260)' }}>
                                        {step.title}
                                    </p>
                                    <p className="text-xs" style={{ color: active ? 'oklch(0.62 0.06 260)' : 'oklch(0.35 0.04 260)' }}>
                                        {step.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom */}
                <div className="relative z-10 p-8">
                    <p className="text-xs" style={{ color: 'oklch(0.35 0.03 260)' }}>Venilu v1.0 · © 2025</p>
                </div>
            </motion.aside>

            {/* ── Right content ── */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Mobile step indicator */}
                <div className="lg:hidden px-6 pt-6">
                    <div className="flex items-center gap-2">
                        {STEPS.map((_, i) => (
                            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= currentStep ? 'bg-primary' : 'bg-muted'}`} />
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Paso {currentStep + 1} de {STEPS.length}</p>
                </div>

                {/* Step content */}
                <div className="flex-1 overflow-y-auto px-8 lg:px-16 pt-12 pb-6">
                    <AnimatePresence mode="wait" custom={slideDir}>
                        <motion.div
                            key={currentStep}
                            custom={slideDir}
                            initial={{ opacity: 0, x: slideDir * 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: slideDir * -30 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="max-w-xl space-y-6"
                        >
                            {/* Step header */}
                            <div className="space-y-1 mb-8">
                                <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-widest mb-2">
                                    {(() => { const S = STEPS[currentStep]; return <><S.icon className="w-3.5 h-3.5" />{S.description}</> })()}
                                </div>
                                <h2 className="text-3xl font-bold tracking-tight">{STEPS[currentStep].title}</h2>
                            </div>

                            {/* ── Step 0: Welcome ── */}
                            {currentStep === 0 && (
                                <div className="space-y-8">
                                    <div className="space-y-3">
                                        <p className="text-muted-foreground leading-relaxed">
                                            En los próximos minutos vamos a configurar tu sistema POS. Solo necesitas los datos básicos de tu negocio y crear una cuenta de administrador.
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        {[
                                            { icon: User, label: 'Crear tu cuenta de administrador', desc: 'Username y contraseña seguros' },
                                            { icon: Building2, label: 'Datos de tu negocio', desc: 'Nombre, dirección y logo (opcional)' },
                                            { icon: Printer, label: 'Configurar impresora', desc: 'Para tickets de venta (opcional)' },
                                        ].map((item, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, y: 12 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.1 + 0.1 }}
                                                className="flex items-start gap-4 p-4 rounded-xl border border-border/60 bg-card/50"
                                            >
                                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                                    <item.icon className="w-4 h-4 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{item.label}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── Step 1: Admin ── */}
                            {currentStep === 1 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="name" className="text-sm">Nombre completo *</Label>
                                            <Input id="name" placeholder="Juan Pérez" value={adminData.name} className="h-10"
                                                onChange={(e) => setAdminData(p => ({ ...p, name: capitalizeWords(e.target.value) }))} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="username" className="text-sm">Usuario *</Label>
                                            <Input id="username" placeholder="admin" value={adminData.username} className="h-10"
                                                onChange={(e) => setAdminData(p => ({ ...p, username: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="password" className="text-sm">Contraseña * <span className="text-muted-foreground font-normal">(mín. 4 caracteres)</span></Label>
                                        <div className="relative">
                                            <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={adminData.password} className="h-10 pr-10"
                                                onChange={(e) => setAdminData(p => ({ ...p, password: e.target.value }))} />
                                            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        {strength && (
                                            <div className="space-y-1 pt-1">
                                                <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                    <motion.div className={`h-full ${strength.color} rounded-full`} initial={{ width: 0 }} animate={{ width: undefined }} style={{ width: strength.w }} transition={{ duration: 0.3 }} />
                                                </div>
                                                <p className="text-xs text-muted-foreground">{strength.label}</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="confirm" className="text-sm">Confirmar contraseña *</Label>
                                        <div className="relative">
                                            <Input id="confirm" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" value={adminData.confirmPassword} className="h-10 pr-10"
                                                onChange={(e) => setAdminData(p => ({ ...p, confirmPassword: e.target.value }))} />
                                            <button type="button" onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        {adminData.confirmPassword && adminData.password !== adminData.confirmPassword && (
                                            <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Step 2: Business ── */}
                            {currentStep === 2 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1.5 md:col-span-2">
                                            <Label htmlFor="bname" className="text-sm">Nombre del negocio *</Label>
                                            <Input id="bname" placeholder="Mi Tienda" value={businessData.business_name} className="h-10"
                                                onChange={(e) => setBusinessData(p => ({ ...p, business_name: capitalizeWords(e.target.value) }))} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="taxid" className="text-sm">RNC / Tax ID</Label>
                                            <Input id="taxid" placeholder="123-4567890-1" value={businessData.business_tax_id} className="h-10"
                                                onChange={(e) => setBusinessData(p => ({ ...p, business_tax_id: formatRNC(e.target.value) }))} />
                                        </div>
                                        <div className="space-y-1.5 md:col-span-2">
                                            <Label htmlFor="baddress" className="text-sm">Dirección</Label>
                                            <Input id="baddress" placeholder="Calle Principal #123" value={businessData.business_address} className="h-10"
                                                onChange={(e) => setBusinessData(p => ({ ...p, business_address: e.target.value }))} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="bphone" className="text-sm">Teléfono</Label>
                                            <Input id="bphone" placeholder="(809) 555-1234" value={businessData.business_phone} className="h-10"
                                                onChange={(e) => setBusinessData(p => ({ ...p, business_phone: formatPhoneNumber(e.target.value) }))} />
                                        </div>
                                        <div className="space-y-1.5 md:col-span-3">
                                            <Label htmlFor="bemail" className="text-sm">Correo electrónico</Label>
                                            <Input id="bemail" type="email" placeholder="info@mitienda.com" value={businessData.business_email} className="h-10"
                                                onChange={(e) => setBusinessData(p => ({ ...p, business_email: e.target.value }))} />
                                        </div>
                                    </div>

                                    {/* Logo upload */}
                                    <div className="space-y-1.5">
                                        <Label className="text-sm">Logo <span className="text-muted-foreground font-normal">(opcional · PNG/JPG · máx 2MB)</span></Label>
                                        {businessData.logoPreview ? (
                                            <div className="relative inline-block group">
                                                <img src={businessData.logoPreview} alt="Logo" className="w-28 h-28 object-contain rounded-xl border border-border bg-muted" />
                                                <button onClick={removeLogo} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all">
                                                <Upload className="w-6 h-6 mb-1.5 text-muted-foreground" />
                                                <p className="text-sm text-muted-foreground">Click para subir logo</p>
                                                <input type="file" className="hidden" accept="image/png,image/jpeg,image/jpg" onChange={handleLogoUpload} />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Step 3: Printer ── */}
                            {currentStep === 3 && (
                                <div className="space-y-5">
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Conecta tu impresora térmica para imprimir tickets de venta. Puedes saltar este paso y configurarlo más tarde en Ajustes.
                                    </p>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="printer" className="text-sm">Impresora térmica</Label>
                                        <Select value={printerData.printer_name || 'none'}
                                            onValueChange={(v) => setPrinterData(p => ({ ...p, printer_name: v === 'none' ? null : v }))}>
                                            <SelectTrigger id="printer" className="h-10">
                                                <SelectValue placeholder="Configurar después" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Configurar después</SelectItem>
                                                {printers.map((p) => (
                                                    <SelectItem key={p.name} value={p.name}>{p.displayName || p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {printerData.printer_name && printerData.printer_name !== 'none' && (
                                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-sm">Tamaño de papel</Label>
                                                <Select value={printerData.paper_size} onValueChange={(v) => setPrinterData(p => ({ ...p, paper_size: v }))}>
                                                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="80mm">80mm</SelectItem>
                                                        <SelectItem value="58mm">58mm</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button variant="outline" className="w-full" onClick={testPrint} disabled={isLoading}>
                                                <Printer className="w-4 h-4 mr-2" />
                                                Imprimir ticket de prueba
                                            </Button>
                                        </motion.div>
                                    )}

                                    {printers.length === 0 && (
                                        <div className="text-center py-6 text-sm text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                                            No se encontraron impresoras físicas.<br />
                                            <span className="text-xs">Puedes configurar esto más tarde en Ajustes.</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* ── Navigation ── */}
                <div className="px-8 lg:px-16 py-6 border-t border-border/50 flex items-center justify-between">
                    <Button variant="ghost" onClick={handleBack} disabled={currentStep === 0} className="gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Atrás
                    </Button>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground hidden sm:block">
                            Paso {currentStep + 1} de {STEPS.length}
                        </span>
                        <Button onClick={handleNext} disabled={!canProceed() || isLoading} className="gap-2 min-w-[120px]">
                            {isLoading ? (
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                                    className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" />
                            ) : currentStep === STEPS.length - 1 ? (
                                <><CheckCircle2 className="w-4 h-4" />Finalizar</>
                            ) : (
                                <>Siguiente<ArrowRight className="w-4 h-4" /></>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
