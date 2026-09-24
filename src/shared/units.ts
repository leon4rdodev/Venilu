/**
 * Unidades de medida de producto — fuente única de verdad para main y renderer.
 *
 * Regla central del sistema:
 *   - `unidad`      → cantidades ENTERAS estrictas (comportamiento histórico,
 *                     idéntico al de antes de existir las medidas).
 *   - cualquier otra → cantidades fraccionables con hasta 3 decimales
 *                     (0.5 lb = media libra, 1.75 kg, 2.5 litros…).
 *
 * El precio de venta/compra y el stock de un producto se interpretan SIEMPRE
 * en su unidad: un queso "por libra" con precio RD$120 cuesta RD$60 media libra.
 *
 * Nota de persistencia: las columnas de cantidades en SQLite tienen afinidad
 * INTEGER, que preserva valores REALES con decimales (solo convierte a entero
 * cuando la conversión es sin pérdida). Por eso no hizo falta reconstruir
 * tablas en la migración: `stock = 12.5` se guarda tal cual.
 */

export interface UnitDef {
    /** Valor persistido en products.unit / sale_items.unit. */
    value: string;
    /** Nombre para el selector del formulario. */
    label: string;
    singular: string;
    plural: string;
    /** Abreviatura corta para tickets y tarjetas: "lb", "kg", "L". */
    abbr: string;
    /** Incremento por clic en los botones +/− del carrito. */
    step: number;
    /** true = solo cantidades enteras (unidad tradicional). */
    integerOnly: boolean;
}

export const UNITS: UnitDef[] = [
    { value: "unidad", label: "Unidad", singular: "unidad", plural: "unidades", abbr: "un.", step: 1, integerOnly: true },
    { value: "libra", label: "Libra", singular: "libra", plural: "libras", abbr: "lb", step: 0.5, integerOnly: false },
    { value: "kilo", label: "Kilo", singular: "kilo", plural: "kilos", abbr: "kg", step: 0.5, integerOnly: false },
    { value: "litro", label: "Litro", singular: "litro", plural: "litros", abbr: "L", step: 0.5, integerOnly: false },
    { value: "galon", label: "Galón", singular: "galón", plural: "galones", abbr: "gal", step: 0.5, integerOnly: false },
    { value: "onza", label: "Onza", singular: "onza", plural: "onzas", abbr: "oz", step: 0.5, integerOnly: false },
    { value: "docena", label: "Docena", singular: "docena", plural: "docenas", abbr: "doc", step: 1, integerOnly: false },
    { value: "caja", label: "Caja", singular: "caja", plural: "cajas", abbr: "cj", step: 1, integerOnly: false },
    { value: "bolsa", label: "Bolsa", singular: "bolsa", plural: "bolsas", abbr: "bol", step: 1, integerOnly: false },
];

export const DEFAULT_UNIT = "unidad";

export const UNIT_VALUES: string[] = UNITS.map((u) => u.value);

/** Tolerancia para comparaciones con decimales (0.1 + 0.2 − 0.3 etc). */
export const QTY_EPSILON = 1e-9;

/** Definición de una unidad; valores desconocidos caen a "unidad". */
export function unitDef(unit?: string | null): UnitDef {
    return UNITS.find((u) => u.value === unit) ?? UNITS[0];
}

export function isKnownUnit(unit: unknown): unit is string {
    return typeof unit === "string" && UNIT_VALUES.includes(unit);
}

/** true si la unidad acepta cantidades con decimales. */
export function isFractionalUnit(unit?: string | null): boolean {
    return !unitDef(unit).integerOnly;
}

/** Redondea a 3 decimales (1 g en una balanza electrónica). */
export function round3(n: number): number {
    return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
}

/** Compara cantidades fraccionales ignorando ruido de punto flotante. */
export function qtyLte(a: number, b: number): boolean {
    return a <= b + QTY_EPSILON;
}

/**
 * Valida una cantidad según la unidad:
 *   - numérica finita y > 0
 *   - hasta 3 decimales
 *   - entera estricta si la unidad es `unidad`
 */
export function isValidQuantity(raw: number, unit?: string | null): boolean {
    const q = Number(raw);
    if (!Number.isFinite(q) || q <= 0) return false;
    if (Math.abs(q - round3(q)) > QTY_EPSILON) return false;
    if (unitDef(unit).integerOnly) return Number.isInteger(q);
    return true;
}

/** Cantidad formateada sin ceros sobrantes: 2, 2.5, 1.75. */
export function formatQty(n: number): string {
    const q = round3(Number(n));
    if (!Number.isFinite(q)) return "0";
    return String(q);
}

/** "3.5 libras" / "2 unidades" — para mensajes y etiquetas de stock. */
export function formatQtyWithUnit(n: number, unit?: string | null): string {
    const def = unitDef(unit);
    const value = formatQty(n);
    const name = Number(n) === 1 ? def.singular : def.plural;
    return `${value} ${name}`;
}

/** "0.5 lb" — forma corta para tickets, carrito y tarjetas. */
export function formatQtyAbbr(n: number, unit?: string | null): string {
    const def = unitDef(unit);
    return `${formatQty(n)} ${def.abbr}`;
}
