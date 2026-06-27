import React, { useState } from 'react';
import { toast } from 'sonner';
import {
    AdminData,
    BusinessData,
    PrinterData,
    Printer,
    STEPS,
} from '@renderer/features/onboarding/types/onboarding.types';

interface UseOnboardingWizardReturn {
    // Navigation state
    currentStep: number;
    slideDir: number;
    isLoading: boolean;
    canProceed: () => boolean;
    handleNext: () => void;
    handleBack: () => void;
    // Admin step
    adminData: AdminData;
    setAdminData: React.Dispatch<React.SetStateAction<AdminData>>;
    showPassword: boolean;
    setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
    showConfirmPassword: boolean;
    setShowConfirmPassword: React.Dispatch<React.SetStateAction<boolean>>;
    passwordStrength: () => { label: string; color: string; w: string } | null;
    // Business step
    businessData: BusinessData;
    setBusinessData: React.Dispatch<React.SetStateAction<BusinessData>>;
    handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    removeLogo: () => void;
    // Printer step
    printers: Printer[];
    printerData: PrinterData;
    setPrinterData: React.Dispatch<React.SetStateAction<PrinterData>>;
    testPrint: () => Promise<void>;
}

export function useOnboardingWizard(onComplete: () => void): UseOnboardingWizardReturn {
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [printers, setPrinters] = useState<Printer[]>([]);
    const [slideDir, setSlideDir] = useState(1);

    const [adminData, setAdminData] = useState<AdminData>({
        username: '', name: '', password: '', confirmPassword: '',
    });
    const [businessData, setBusinessData] = useState<BusinessData>({
        business_name: '', business_address: '', business_phone: '',
        business_email: '', business_tax_id: '', logo_filename: null, logoPreview: null,
    });
    const [printerData, setPrinterData] = useState<PrinterData>({
        printer_name: null, paper_size: '80mm',
    });

    // ─── Validation ───────────────────────────────────────────────────────────

    const canProceed = (): boolean => {
        switch (currentStep) {
            case 0: return true;
            case 1: return (
                adminData.username.trim() !== '' &&
                adminData.name.trim() !== '' &&
                adminData.password.length >= 4 &&
                adminData.password === adminData.confirmPassword
            );
            case 2: return businessData.business_name.trim() !== '';
            case 3: return true;
            default: return false;
        }
    };

    const passwordStrength = (): { label: string; color: string; w: string } | null => {
        const p = adminData.password;
        if (!p) return null;
        if (p.length < 4) return { label: 'Muy corta', color: 'bg-destructive', w: 'w-1/4' };
        if (p.length < 6) return { label: 'Débil', color: 'bg-orange-500', w: 'w-2/4' };
        if (p.length < 10) return { label: 'Aceptable', color: 'bg-yellow-500', w: 'w-3/4' };
        return { label: 'Fuerte', color: 'bg-green-500', w: 'w-full' };
    };

    // ─── Navigation ───────────────────────────────────────────────────────────

    const loadPrinters = async () => {
        try {
            if (!window.ipcRenderer) return;
            const result = await window.ipcRenderer.invoke('get-printers') as {
                success: boolean;
                printers: Printer[];
            };
            if (result.success && result.printers) setPrinters(result.printers);
        } catch {
            setPrinters([]);
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
            setCurrentStep(prev => prev - 1);
        }
    };

    // ─── Finish ───────────────────────────────────────────────────────────────

    const handleFinish = async () => {
        setIsLoading(true);
        try {
            if (!window.ipcRenderer) {
                toast.error('IPC no disponible');
                return;
            }

            const userResult = await window.ipcRenderer.invoke('create-user', {
                username: adminData.username,
                name: adminData.name,
                password: adminData.password,
                role: 'admin',
            }) as {
                success: boolean;
                data?: { id: string; role: 'admin' | 'employee'; username: string; name: string };
                message?: string;
            };

            if (!userResult.success) {
                toast.error(userResult.message || 'Error al crear usuario');
                return;
            }

            // Auto-login: sets the session so settings:update passes requireRole('admin')
            if (userResult.data) {
                await window.ipcRenderer.invoke('set-logged-in-user', {
                    id: userResult.data.id,
                    role: userResult.data.role,
                    username: userResult.data.username,
                    name: userResult.data.name,
                });
            }

            const settingsResult = await window.ipcRenderer.invoke('settings:update', {
                business_name: businessData.business_name,
                business_address: businessData.business_address,
                business_phone: businessData.business_phone,
                business_email: businessData.business_email,
                business_tax_id: businessData.business_tax_id,
                logo_filename: businessData.logo_filename,
                printer_name: printerData.printer_name === 'none' ? null : printerData.printer_name,
                paper_size: printerData.paper_size,
            }) as { success: boolean; message?: string };

            if (!settingsResult.success) {
                toast.error(settingsResult.message || 'Error al guardar configuración');
                return;
            }

            toast.success('¡Configuración completada!');
            setTimeout(() => onComplete(), 1000);
        } catch {
            toast.error('Error al completar la configuración');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Logo handlers ────────────────────────────────────────────────────────

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
                const result = await window.ipcRenderer.invoke('upload-logo', {
                    fileName: file.name,
                    fileData: base64Data,
                }) as { success: boolean; fileName: string; message: string };
                if (result.success) {
                    setBusinessData(prev => ({ ...prev, logo_filename: result.fileName }));
                    toast.success('Logo cargado exitosamente');
                } else {
                    toast.error(result.message);
                }
            } catch {
                toast.error('Error al cargar el logo');
            }
        };
        reader.readAsDataURL(file);
    };

    const removeLogo = () =>
        setBusinessData(prev => ({ ...prev, logo_filename: null, logoPreview: null }));

    // ─── Printer ──────────────────────────────────────────────────────────────

    const testPrint = async () => {
        if (!printerData.printer_name) { toast.error('Selecciona una impresora primero'); return; }
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
        } catch {
            toast.error('Error al realizar la prueba de impresión');
        } finally {
            setIsLoading(false);
        }
    };

    return {
        currentStep, slideDir, isLoading, canProceed, handleNext, handleBack,
        adminData, setAdminData, showPassword, setShowPassword,
        showConfirmPassword, setShowConfirmPassword, passwordStrength,
        businessData, setBusinessData, handleLogoUpload, removeLogo,
        printers, printerData, setPrinterData, testPrint,
    };
}
