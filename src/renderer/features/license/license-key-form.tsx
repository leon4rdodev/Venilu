import { useId, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@components/ui/textarea';
import { Label } from '@components/ui/label';
import { Button } from '@components/ui/button';
import { useLicense, type LicenseStatus } from './use-license';

interface LicenseKeyFormProps {
  /** Called after a successful activation (the status is already in cache). */
  onActivated?: (status: LicenseStatus) => void;
}

/**
 * Shared "paste your key → activate" form, used by the blocking activation
 * screen and by Ajustes → Acerca de.
 */
export function LicenseKeyForm({ onActivated }: LicenseKeyFormProps) {
  const { activate } = useLicense();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || isActivating) return;
    setError('');
    setIsActivating(true);
    try {
      const result = await activate(key.trim());
      if (result.success && result.status) {
        const customer = result.status.license?.customer;
        toast.success('Licencia activada', {
          description: customer ? `Bienvenido, ${customer}` : 'Gracias por usar Venilu',
        });
        setKey('');
        onActivated?.(result.status);
      } else {
        setError(result.message || 'No se pudo activar la licencia.');
      }
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor={fieldId} className="text-sm font-medium">
          Clave de licencia
        </Label>
        <Textarea
          id={fieldId}
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            if (error) setError('');
          }}
          placeholder="VNL-…"
          rows={3}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="none"
          disabled={isActivating}
          className="font-mono text-xs rounded-lg min-h-0 resize-none break-all"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        />
        <p id={hintId} className="text-xs text-muted-foreground">
          Pega la clave completa tal como la recibiste; empieza por «VNL-».
        </p>
      </div>

      {error && (
        <div
          id={errorId}
          role="alert"
          className="flex items-start gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-11 text-sm font-semibold"
        disabled={isActivating || !key.trim()}
        aria-busy={isActivating || undefined}
      >
        {isActivating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />
            Activando…
          </>
        ) : (
          'Activar licencia'
        )}
      </Button>
    </form>
  );
}
