import { User, Building2, Printer } from 'lucide-react';

const CHECKLIST = [
    { icon: User, label: 'Crear tu cuenta de administrador', desc: 'Username y contraseña seguros' },
    { icon: Building2, label: 'Datos de tu negocio', desc: 'Nombre, dirección y logo (opcional)' },
    { icon: Printer, label: 'Configurar impresora', desc: 'Para tickets de venta (opcional)' },
] as const;

export function WelcomeStep() {
    return (
        <div className="space-y-8">
            <p className="text-muted-foreground leading-relaxed">
                En los próximos minutos vamos a configurar tu sistema POS. Solo necesitas
                los datos básicos de tu negocio y crear una cuenta de administrador.
            </p>

            <div className="space-y-3">
                {CHECKLIST.map((item, i) => (
                    <div
                        key={i}
                        className="flex items-start gap-4 p-4 rounded-lg border border-border/60 bg-card/50"
                    >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <item.icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">{item.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
