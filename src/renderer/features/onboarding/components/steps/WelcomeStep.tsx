import { User, Building2, Printer } from 'lucide-react';

const CHECKLIST = [
    { icon: User, label: 'Crear tu cuenta de administrador', desc: 'Usuario y contraseña seguros' },
    { icon: Building2, label: 'Datos de tu negocio', desc: 'Nombre, dirección y logo (opcional)' },
    { icon: Printer, label: 'Configurar impresora', desc: 'Para tickets de venta (opcional)' },
] as const;

export function WelcomeStep() {
    return (
        <div className="space-y-8">
            <p className="text-sm text-muted-foreground leading-relaxed">
                En los próximos minutos vamos a configurar tu sistema POS. Solo necesitas
                los datos básicos de tu negocio y crear una cuenta de administrador.
            </p>

            <ol className="space-y-3" aria-label="Pasos de la configuración">
                {CHECKLIST.map((item, i) => (
                    <li
                        key={i}
                        className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card"
                    >
                        <div
                            aria-hidden
                            className="w-9 h-9 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0"
                        >
                            <item.icon className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 pt-0.5">
                            <p className="text-sm font-medium text-foreground">
                                <span className="text-muted-foreground tabular-nums">{i + 1}.</span>{' '}
                                {item.label}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                    </li>
                ))}
            </ol>

            <p className="text-xs text-muted-foreground">
                Todo lo que configures aquí se puede cambiar después desde Ajustes.
            </p>
        </div>
    );
}
