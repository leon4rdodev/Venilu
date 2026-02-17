export function formatDateTime(dateString: string | null | Date): string {
  if (!dateString) return "N/A";

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
  if (!dateString) return "N/A";

  const date = new Date(dateString);

  return new Intl.DateTimeFormat('es-ES', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }).format(date);
}