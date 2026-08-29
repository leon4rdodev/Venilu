import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@components/ui/textarea';
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          if (error) setError('');
        }}
        placeholder="VNL-..."
        rows={3}
        spellCheck={false}
        autoComplete="off"
        disabled={isActivating}
        className="font-mono text-xs rounded-lg min-h-0 resize-none break-all"
        aria-label="Clave de licencia"
      />

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-11 text-sm font-semibold"
        disabled={isActivating || !key.trim()}
      >
        {isActivating ? 'Activando...' : 'Activar Licencia'}
      </Button>
    </form>
  );
}
