import { Sparkles, User, Building2, Printer } from 'lucide-react';

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface AdminData {
    username: string;
    name: string;
    password: string;
    confirmPassword: string;
}

export interface BusinessData {
    business_name: string;
    business_address: string;
    business_phone: string;
    business_email: string;
    business_tax_id: string;
    logo_filename: string | null;
    logoPreview: string | null;
    currency: string;
}

export interface PrinterData {
    printer_name: string | null;
    paper_size: string;
}

export interface Printer {
    name: string;
    displayName: string;
}

// ─── Step configuration ────────────────────────────────────────────────────────

export const STEPS = [
    { title: 'Bienvenida', description: 'Todo listo para comenzar', icon: Sparkles },
    { title: 'Administrador', description: 'Crea tu cuenta de acceso', icon: User },
    { title: 'Negocio', description: 'Datos de tu establecimiento', icon: Building2 },
    { title: 'Impresora', description: 'Configuración de tickets', icon: Printer },
] as const;

export type StepIndex = 0 | 1 | 2 | 3;
