/**
 * Format phone number as user types
 * Supports Dominican Republic format: (XXX) XXX-XXXX
 */
export function formatPhoneNumber(value: string): string {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');

    // Limit to 10 digits
    const limited = digits.slice(0, 10);

    if (limited.length === 0) return '';
    if (limited.length <= 3) return `(${limited}`;
    if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

/**
 * Format RNC (Registro Nacional del Contribuyente) as user types
 * Dominican format: XXX-XXXXXXX-X (total 11 digits)
 */
export function formatRNC(value: string): string {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');

    // Limit to 11 digits (RNC format)
    const limited = digits.slice(0, 11);

    if (limited.length === 0) return '';
    if (limited.length <= 3) return limited;
    if (limited.length <= 10) return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    return `${limited.slice(0, 3)}-${limited.slice(3, 10)}-${limited.slice(10)}`;
}

/**
 * Get unformatted value (digits only)
 */
export function getDigitsOnly(value: string): string {
    return value.replace(/\D/g, '');
}
