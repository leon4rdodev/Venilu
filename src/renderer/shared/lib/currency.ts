export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `RD$${formatted}`;
}

export function getCurrencySymbol(): string {
  return 'RD$';
}
