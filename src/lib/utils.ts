import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Capitalizes the first letter of each word in a string.
 * Only capitalizes after spaces or at the beginning of the string.
 * Handles accented characters and punctuation correctly.
 */
export function capitalizeWords(str: string): string {
  return str.replace(/(^|\s)\S/g, (match) => match.toUpperCase());
}
