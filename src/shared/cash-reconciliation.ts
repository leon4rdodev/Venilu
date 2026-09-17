import { round2 } from './money';

/**
 * Arqueo de caja — ÚNICA fuente de verdad para "efectivo esperado".
 *
 * Lo usan el backend (closeShift / forceClose) y el renderer (letrero de
 * caja, diálogo de cierre, pestaña Turnos) para que nunca vuelvan a
 * divergir. Regla:
 *
 *   esperado = fondo inicial
 *            + ventas en efectivo (no anuladas)
 *            + abonos en efectivo
 *            − reembolsos en efectivo (anulación de ventas fiadas ya cobradas)
 *            − salidas de caja (gastos)
 *            − devoluciones parciales (se reembolsan en efectivo)
 */

export interface CashSaleLike {
  payment_method: string;
  status?: string;
  total_amount: number | string;
}

export interface CashDebtPaymentLike {
  payment_method: string;
  amount: number | string;
  type?: 'payment' | 'refund' | string;
}

export interface CashExpenseLike {
  amount: number | string;
}

export interface CashReturnLike {
  total_refunded: number | string;
}

export interface ShiftCashInput {
  initialCash: number | string;
  sales: CashSaleLike[];
  debtPayments: CashDebtPaymentLike[];
  expenses: CashExpenseLike[];
  /** Devoluciones parciales cargadas a este turno (o su total ya sumado). */
  returns?: CashReturnLike[] | number;
}

export interface ShiftCashBreakdown {
  initialCash: number;
  /** Ventas en efectivo no anuladas. */
  cashSalesTotal: number;
  /** Abonos en efectivo recibidos (sin restar reembolsos). */
  cashDebtReceived: number;
  /** Reembolsos en efectivo (abonos devueltos al anular una venta fiada). */
  cashRefunds: number;
  /** Abonos en transferencia (no afectan la caja, solo informativos). */
  transferDebtReceived: number;
  /** Salidas de caja. */
  totalExpenses: number;
  /** Devoluciones parciales reembolsadas en efectivo. */
  totalReturns: number;
  /** Efectivo que debe haber físicamente en la caja. */
  expectedCash: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function computeShiftCash(input: ShiftCashInput): ShiftCashBreakdown {
  const initialCash = round2(num(input.initialCash));

  const cashSalesTotal = round2(
    (input.sales || [])
      .filter((s) => s.payment_method === 'cash' && s.status !== 'voided')
      .reduce((sum, s) => sum + num(s.total_amount), 0),
  );

  let cashDebtReceived = 0;
  let cashRefunds = 0;
  let transferDebtReceived = 0;
  for (const p of input.debtPayments || []) {
    const amount = num(p.amount);
    if (p.payment_method === 'cash') {
      if (p.type === 'refund') cashRefunds += amount;
      else cashDebtReceived += amount;
    } else if (p.payment_method === 'transfer' && p.type !== 'refund') {
      transferDebtReceived += amount;
    }
  }
  cashDebtReceived = round2(cashDebtReceived);
  cashRefunds = round2(cashRefunds);
  transferDebtReceived = round2(transferDebtReceived);

  const totalExpenses = round2(
    (input.expenses || []).reduce((sum, e) => sum + num(e.amount), 0),
  );

  const totalReturns = round2(
    typeof input.returns === 'number'
      ? num(input.returns)
      : (input.returns || []).reduce((sum, r) => sum + num(r.total_refunded), 0),
  );

  const expectedCash = round2(
    initialCash + cashSalesTotal + cashDebtReceived - cashRefunds - totalExpenses - totalReturns,
  );

  return {
    initialCash,
    cashSalesTotal,
    cashDebtReceived,
    cashRefunds,
    transferDebtReceived,
    totalExpenses,
    totalReturns,
    expectedCash,
  };
}
