import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { toast } from 'sonner';
import {
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    User,
    Building2,
    Printer,
    Sparkles,
    Eye,
    EyeOff,
    Upload,
    X
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { formatPhoneNumber, formatRNC } from '@lib/format-utils';
import { capitalizeWords } from '@lib/utils';

interface OnboardingWizardProps {
    onComplete: () => void;
}

interface AdminData {
    username: string;
    name: string;
    password: string;
    confirmPassword: string;
}

interface BusinessData {
    business_name: string;
    business_address: string;
    business_phone: string;
    business_email: string;
    business_tax_id: string;
    logo_filename: string | null;
    logoPreview: string | null;
}

interface PrinterData {
    printer_name: string | null;
    paper_size: string;
}

interface Printer {
    name: string;
    displayName: string;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [printers, setPrinters] = useState<Printer[]>([]);

    const [adminData, setAdminData] = useState<AdminData>({
        username: '',
        name: '',
        password: '',
        confirmPassword: '',
    });

    const [businessData, setBusinessData] = useState<BusinessData>({
        business_name: '',
        business_address: '',
        business_phone: '',
        business_email: '',
        business_tax_id: '',
        logo_filename: null,
        logoPreview: null,
    });

    const [printerData, setPrinterData] = useState<PrinterData>({
        printer_name: null,
        paper_size: '80mm',
    });

    const steps = [
        { title: 'Bienvenida', icon: Sparkles },
        { title: 'Administrador', icon: User },
        { title: 'Negocio', icon: Building2 },
        { title: 'Impresora', icon: Printer },
    ];

    // Validate current step
    const canProceed = () => {
        switch (currentStep) {
            case 0:
                return true; // Welcome screen
            case 1:
                // Admin validation
                return (
                    adminData.username.trim() !== '' &&
                    adminData.name.trim() !== '' &&
                    adminData.password.length >= 4 &&
                    adminData.password === adminData.confirmPassword
                );
            case 2:
                // Business validation - only business name is required
                return businessData.business_name.trim() !== '';
            case 3:
                // Printer is optional
                return true;
            default:
                return false;
        }
    };

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            const nextStep = currentStep + 1;
            setCurrentStep(nextStep);

            // Load printers when reaching printer step (step 3)
            if (nextStep === 3) {
                loadPrinters();
            }
        } else {
            handleFinish();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const loadPrinters = async () => {
        try {
            if (!window.ipcRenderer) {
                console.warn('ipcRenderer not available');
                setPrinters([]);
                return;
            }

            console.log('Loading printers...');
            const result = await window.ipcRenderer.invoke('get-printers') as { success: boolean; printers: Printer[] };
            console.log('Printers result:', result);
            if (result.success && result.printers) {
                setPrinters(result.printers);
            } else {
                console.warn('No printers found or failed to load');
                setPrinters([]);
            }
        } catch (error) {
            console.error('Error loading printers:', error);
            // Don't show error toast - just continue without printers
            setPrinters([]);
        }
    };

    const testPrint = async () => {
        if (!printerData.printer_name) {
            toast.error('Selecciona una impresora primero');
            return;
        }

        if (!window.ipcRenderer) {
            toast.error('IPC no disponible');
            return;
        }

        try {
            setIsLoading(true);
            const result = await window.ipcRenderer.invoke('test-print', {
                printerName: printerData.printer_name,
            }) as { success: boolean; message: string };

            if (result.success) {
                toast.success('Impresión de prueba enviada');
            } else {
                toast.error(result.message || 'Error al imprimir');
            }
        } catch (error) {
            console.error('Error testing printer:', error);
            toast.error('Error al realizar la prueba de impresión');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Por favor selecciona una imagen');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast.error('La imagen no debe superar 2MB');
            return;
        }

        try {
            // Read file as base64
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Data = event.target?.result as string;

                setBusinessData({
                    ...businessData,
                    logoPreview: base64Data,
                });

                // Upload to electron
                if (!window.ipcRenderer) {
                    toast.error('IPC no disponible');
                    return;
                }

                try {
                    const result = await window.ipcRenderer.invoke('upload-logo', {
                        fileName: file.name,
                        fileData: base64Data,
                    }) as { success: boolean; fileName: string; message: string };

                    if (result.success) {
                        setBusinessData(prev => ({
                            ...prev,
                            logo_filename: result.fileName,
                        }));
                        toast.success('Logo cargado exitosamente');
                    } else {
                        toast.error(result.message);
                    }
                } catch (error) {
                    console.error('Error uploading logo:', error);
                    toast.error('Error al cargar el logo');
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error reading file:', error);
            toast.error('Error al leer el archivo');
        }
    };

    const removeLogo = () => {
        setBusinessData({
            ...businessData,
            logo_filename: null,
            logoPreview: null,
        });
    };

    const handleFinish = async () => {
        setIsLoading(true);
        try {
            if (!window.ipcRenderer) {
                toast.error('IPC no disponible');
                setIsLoading(false);
                return;
            }

            console.log('Starting onboarding completion...');

            // 1. Create admin user
            console.log('Creating admin user...');
            const userResult = await window.ipcRenderer.invoke('create-user', {
                username: adminData.username,
                name: adminData.name,
                password: adminData.password,
                role: 'admin',
            }) as { success: boolean; message?: string };

            if (!userResult.success) {
                console.error('Failed to create user:', userResult.message);
                toast.error(userResult.message || 'Error al crear usuario');
                setIsLoading(false);
                return;
            }
            console.log('Admin user created successfully');

            // 2. Save business settings
            console.log('Saving business settings...');

            // Convert 'none' to null for printer_name
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

            if (!settingsResult.success) {
                console.error('Failed to save settings:', settingsResult.message);
                toast.error(settingsResult.message || 'Error al guardar configuración');
                setIsLoading(false);
                return;
            }
            console.log('Settings saved successfully');

            toast.success('¡Configuración completada exitosamente!');
            setTimeout(() => {
                console.log('Calling onComplete callback');
                onComplete();
            }, 1000);
        } catch (error) {
            console.error('Error completing onboarding:', error);
            toast.error('Error al completar la configuración');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl shadow-2xl">
                <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                        {steps.map((step, index) => (
                            <div key={index} className="flex items-center">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${index === currentStep
                                        ? 'bg-primary text-primary-foreground scale-110'
                                        : index < currentStep
                                            ? 'bg-primary/20 text-primary'
                                            : 'bg-muted text-muted-foreground'
                                        }`}
                                >
                                    {index < currentStep ? (
                                        <CheckCircle2 className="w-5 h-5" />
                                    ) : (
                                        <step.icon className="w-5 h-5" />
                                    )}
                                </div>
                                {index < steps.length - 1 && (
                                    <div
                                        className={`w-12 h-1 mx-2 transition-all ${index < currentStep ? 'bg-primary' : 'bg-muted'
                                            }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <CardTitle className="text-2xl">{steps[currentStep].title}</CardTitle>
                    <CardDescription>
                        Paso {currentStep + 1} de {steps.length}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {/* Step 0: Welcome */}
                            {currentStep === 0 && (
                                <div className="space-y-6 py-8">
                                    <div className="text-center">
                                        <Sparkles className="w-16 h-16 mx-auto text-primary mb-4" />
                                        <h2 className="text-3xl font-bold mb-4">¡Bienvenido a tu Sistema POS!</h2>
                                        <p className="text-muted-foreground text-lg mb-6">
                                            Vamos a configurar tu sistema en solo unos pasos
                                        </p>
                                        <div className="bg-muted/50 rounded-lg p-6 text-left space-y-3">
                                            <p className="flex items-center gap-2">
                                                <User className="w-5 h-5 text-primary" />
                                                <span>Crear tu usuario administrador</span>
                                            </p>
                                            <p className="flex items-center gap-2">
                                                <Building2 className="w-5 h-5 text-primary" />
                                                <span>Configurar información de tu negocio</span>
                                            </p>
                                            <p className="flex items-center gap-2">
                                                <Printer className="w-5 h-5 text-primary" />
                                                <span>Seleccionar tu impresora (opcional)</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 1: Admin User */}
                            {currentStep === 1 && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Nombre Completo *</Label>
                                        <Input
                                            id="name"
                                            placeholder="Ej: Juan Pérez"
                                            value={adminData.name}
                                            onChange={(e) => setAdminData({ ...adminData, name: capitalizeWords(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="username">Nombre de Usuario *</Label>
                                        <Input
                                            id="username"
                                            placeholder="Ej: admin"
                                            value={adminData.username}
                                            onChange={(e) => setAdminData({ ...adminData, username: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Contraseña * (mínimo 4 caracteres)</Label>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                value={adminData.password}
                                                onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Confirmar Contraseña *</Label>
                                        <div className="relative">
                                            <Input
                                                id="confirmPassword"
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                value={adminData.confirmPassword}
                                                onChange={(e) =>
                                                    setAdminData({ ...adminData, confirmPassword: e.target.value })
                                                }
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        {adminData.confirmPassword && adminData.password !== adminData.confirmPassword && (
                                            <p className="text-sm text-destructive">Las contraseñas no coinciden</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Business Info */}
                            {currentStep === 2 && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="business_name">Nombre del Negocio *</Label>
                                        <Input
                                            id="business_name"
                                            placeholder="Ej: Mi Tienda"
                                            value={businessData.business_name}
                                            onChange={(e) =>
                                                setBusinessData({ ...businessData, business_name: capitalizeWords(e.target.value) })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="business_address">Dirección</Label>
                                        <Input
                                            id="business_address"
                                            placeholder="Ej: Calle Principal #123"
                                            value={businessData.business_address}
                                            onChange={(e) =>
                                                setBusinessData({ ...businessData, business_address: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="business_phone">Teléfono</Label>
                                            <Input
                                                id="business_phone"
                                                placeholder="(809) 555-1234"
                                                value={businessData.business_phone}
                                                onChange={(e) =>
                                                    setBusinessData({ ...businessData, business_phone: formatPhoneNumber(e.target.value) })
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="business_email">Email</Label>
                                            <Input
                                                id="business_email"
                                                type="email"
                                                placeholder="Ej: info@mitienda.com"
                                                value={businessData.business_email}
                                                onChange={(e) =>
                                                    setBusinessData({ ...businessData, business_email: e.target.value })
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="business_tax_id">RNC / Tax ID</Label>
                                        <Input
                                            id="business_tax_id"
                                            placeholder="123-4567890-1"
                                            value={businessData.business_tax_id}
                                            onChange={(e) =>
                                                setBusinessData({ ...businessData, business_tax_id: formatRNC(e.target.value) })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Logo (opcional)</Label>
                                        {businessData.logoPreview ? (
                                            <div className="relative inline-block">
                                                <img
                                                    src={businessData.logoPreview}
                                                    alt="Logo preview"
                                                    className="w-32 h-32 object-contain border rounded"
                                                />
                                                <button
                                                    onClick={removeLogo}
                                                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:scale-110 transition-transform"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors">
                                                <div className="text-center">
                                                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                                    <p className="text-sm text-muted-foreground">Haz click para subir</p>
                                                    <p className="text-xs text-muted-foreground">PNG, JPG (Max 2MB)</p>
                                                </div>
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
                            )}

                            {/* Step 3: Printer */}
                            {currentStep === 3 && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="printer">Impresora Térmica (opcional)</Label>
                                        <Select
                                            value={printerData.printer_name || "none"}
                                            onValueChange={(value) => {
                                                setPrinterData({
                                                    ...printerData,
                                                    printer_name: value === "none" ? null : value
                                                });
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona una impresora o configura después" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Configurar después</SelectItem>
                                                {printers.map((printer) => (
                                                    <SelectItem key={printer.name} value={printer.name}>
                                                        {printer.displayName || printer.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {printerData.printer_name && printerData.printer_name !== "none" && (
                                        <>
                                            <div className="space-y-2">
                                                <Label htmlFor="paper_size">Tamaño de Papel</Label>
                                                <Select
                                                    value={printerData.paper_size}
                                                    onValueChange={(value) =>
                                                        setPrinterData({ ...printerData, paper_size: value })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="80mm">80mm</SelectItem>
                                                        <SelectItem value="58mm">58mm</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={testPrint}
                                                disabled={isLoading}
                                                className="w-full"
                                            >
                                                <Printer className="w-4 h-4 mr-2" />
                                                Probar Impresión
                                            </Button>
                                        </>
                                    )}

                                    {printers.length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            No se encontraron impresoras físicas. Puedes configurar esto más tarde en
                                            ajustes.
                                        </p>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    <div className="flex justify-between mt-8">
                        <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Atrás
                        </Button>
                        <Button onClick={handleNext} disabled={!canProceed() || isLoading}>
                            {currentStep === steps.length - 1 ? (
                                <>
                                    {isLoading ? 'Configurando...' : 'Finalizar'}
                                    <CheckCircle2 className="w-4 h-4 ml-2" />
                                </>
                            ) : (
                                <>
                                    Siguiente
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
