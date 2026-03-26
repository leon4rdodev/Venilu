export function formatDateTime(dateString: string | null | Date): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }).format(date);
}

export function formatTime(dateString: string | null | Date): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-ES', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }).format(date);
}

/**
 * Get unformatted value (digits only)
 */
export function getDigitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Format a stored phone number for display.
 * Supports US format: (XXX) XXX-XXXX or +1 (XXX) XXX-XXXX
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const cleaned = getDigitsOnly(phone);
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Format phone number as user types.
 * Supports Dominican Republic format: (XXX) XXX-XXXX
 */
export function formatPhoneNumber(value: string): string {
  const limited = getDigitsOnly(value).slice(0, 10);
  if (limited.length === 0) return '';
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

/**
 * Format RNC (Registro Nacional del Contribuyente) as user types.
 * Dominican format: XXX-XXXXXXX-X (total 11 digits)
 */
export function formatRNC(value: string): string {
  const limited = getDigitsOnly(value).slice(0, 11);
  if (limited.length === 0) return '';
  if (limited.length <= 3) return limited;
  if (limited.length <= 10) return `${limited.slice(0, 3)}-${limited.slice(3)}`;
  return `${limited.slice(0, 3)}-${limited.slice(3, 10)}-${limited.slice(10)}`;
}