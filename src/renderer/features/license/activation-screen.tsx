import { KeyRound, ShoppingCart } from 'lucide-react';
import { LicenseKeyForm } from './license-key-form';
import { useLicense } from './use-license';

function formatDateEs(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Full-screen blocking gate shown when the trial or an annual license has
 * expired. Same canvas as the login screen (dark gradient + masked grid +
 * glow orbs). Activation succeeds → the license query updates and the app
 * continues on its own.
 */
export function ActivationScreen() {
  const { status } = useLicense();

  const state = status?.state;
  const license = status?.license;
  const expiredDate = formatDateEs(license?.expires);

  const title =
    state === 'expired' ? 'Tu licencia anual venció' : 'Tu período de prueba terminó';

  const subtitle =
    state === 'expired' && license
      ? `La licencia de ${license.customer}${expiredDate ? ` venció el ${expiredDate}` : ' venció'}. Activa una nueva clave para continuar.`
      : null;

  return (
    <div
      className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden p-6"
      style={{
        background: 'linear-gradient(160deg, oklch(0.07 0 0), oklch(0.13 0 0))',
      }}
    >
      {/* Decorative grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(oklch(0.98 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.98 0 0) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 75%)',
        }}
      />

      {/* Glow orbs */}
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full opacity-[0.12] blur-3xl pointer-events-none"
        style={{ background: 'oklch(0.6 0 0)' }}
      />
      <div
        className="absolute bottom-0 -right-32 w-80 h-80 rounded-full opacity-[0.08] blur-3xl pointer-events-none"
        style={{ background: 'oklch(0.45 0 0)' }}
      />

      {/* Top-left brand */}
      <div className="absolute top-0 left-0 p-8 z-10 flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'oklch(1 0 0)' }}
        >
          <ShoppingCart className="w-4 h-4" strokeWidth={2} style={{ color: 'oklch(0.145 0 0)' }} />
        </div>
        <span className="text-lg font-bold tracking-tight" style={{ color: 'oklch(0.985 0 0)' }}>
          Venilu
        </span>
      </div>

      {/* Centered card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-foreground" strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
              <p className="text-sm text-muted-foreground">
                Activa tu licencia para seguir usando Venilu. Tus datos están intactos y seguros.
              </p>
            </div>
          </div>

          <LicenseKeyForm />

          <p className="text-xs text-muted-foreground text-center border-t border-border pt-4">
            ¿Aún no tienes licencia? Escríbenos para adquirirla.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 inset-x-0 p-6 text-center z-10">
        <p className="text-xs" style={{ color: 'oklch(0.45 0 0)' }}>
          Venilu · Sistema POS · © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
