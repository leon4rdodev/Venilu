import { describe, it, expect } from 'vitest';
import { computeShiftCash } from './cash-reconciliation';

describe('computeShiftCash', () => {
  it('replica el escenario del E2E: abono, reembolso, gasto y devolución', () => {
    const r = computeShiftCash({
      initialCash: 1000,
      sales: [
        { payment_method: 'cash', status: 'paid', total_amount: 240 },
        { payment_method: 'card', status: 'voided', total_amount: 169.99 },
        { payment_method: 'credit', status: 'voided', total_amount: 500 },
        { payment_method: 'transfer', status: 'paid', total_amount: 200 },
        { payment_method: 'cash', status: 'paid', total_amount: 100 },
        { payment_method: 'cash', status: 'paid', total_amount: 10 },
      ],
      debtPayments: [
        { payment_method: 'cash', amount: 200, type: 'payment' },
        { payment_method: 'cash', amount: 200, type: 'refund' },
      ],
      expenses: [{ amount: 150 }],
      returns: [{ total_refunded: 100 }],
    });
    expect(r.cashSalesTotal).toBe(350);
    expect(r.cashDebtReceived).toBe(200);
    expect(r.cashRefunds).toBe(200);
    expect(r.totalExpenses).toBe(150);
    expect(r.totalReturns).toBe(100);
    expect(r.expectedCash).toBe(1100);
  });

  it('acepta el total de devoluciones como número y trata strings decimales', () => {
    const r = computeShiftCash({
      initialCash: '500.00',
      sales: [{ payment_method: 'cash', total_amount: '99.99' }],
      debtPayments: [{ payment_method: 'transfer', amount: 50 }],
      expenses: [],
      returns: 9.99,
    });
    expect(r.transferDebtReceived).toBe(50);
    expect(r.expectedCash).toBe(590);
  });

  it('sin movimientos devuelve el fondo inicial', () => {
    expect(computeShiftCash({ initialCash: 0, sales: [], debtPayments: [], expenses: [] }).expectedCash).toBe(0);
  });
});
