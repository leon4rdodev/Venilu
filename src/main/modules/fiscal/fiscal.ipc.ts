import { ipcMain } from 'electron';
import { AppDataSource } from '@main/config/data-source';
import { Sale } from '@main/modules/sales/entities/sale.entity';
import { SaleReturn } from '@main/modules/sales/entities/sale-return.entity';
import { fiscalService } from '@main/modules/fiscal/services/fiscal.service';
import { requirePermission } from '@main/shared/session';
import { auditService } from '@main/modules/audit/services/audit.service';
import { csvRow, saveCsv } from '@main/shared/services/csv.util';

export function registerFiscalHandlers() {
  /** Secuencias NCF con estado (restantes/vencida) — Ajustes → Fiscal. */
  ipcMain.handle('fiscal:get-sequences', async () => {
    try {
      requirePermission('settings:view');
      return { success: true, data: await fiscalService.listSequences() };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('fiscal:save-sequence', async (_event, data) => {
    try {
      requirePermission('settings:edit');
      const seq = await fiscalService.saveSequence(data ?? {});
      auditService.log('fiscal:save-sequence', seq.id, `${seq.type} ${seq.from_number}-${seq.to_number}`);
      return { success: true, data: seq };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('fiscal:delete-sequence', async (_event, { id } = {}) => {
    try {
      requirePermission('settings:edit');
      await fiscalService.deleteSequence(String(id ?? ''));
      auditService.log('fiscal:delete-sequence', String(id ?? ''));
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /**
   * Reporte 607 (ventas con comprobante) del mes dado, como CSV para el
   * contador. Incluye las Notas de Crédito B04 como filas propias que
   * referencian el NCF modificado. Payload: { year, month (1-12) }.
   */
  ipcMain.handle('fiscal:export-607', async (_event, { year, month } = {}) => {
    try {
      requirePermission('reports:export_pdf');
      const y = Number(year);
      const m = Number(month);
      if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12 || y < 2020 || y > 2100) {
        throw new Error('Mes inválido');
      }

      const start = `${y}-${String(m).padStart(2, '0')}-01 00:00:00`;
      const endDate = new Date(y, m, 1); // primer día del mes siguiente
      const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;

      const sales = await AppDataSource.getRepository(Sale)
        .createQueryBuilder('sale')
        .where('sale.ncf IS NOT NULL')
        .andWhere('sale.created_at >= :start AND sale.created_at < :end', { start, end })
        .orderBy('sale.ncf', 'ASC')
        .getMany();

      const num = (n: unknown) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
      const dateOf = (d: Date | string) => {
        const date = d instanceof Date ? d : new Date(String(d).replace(' ', 'T'));
        return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10).replace(/-/g, '');
      };

      const lines: string[] = [];
      lines.push(csvRow(
        'RNC/Cédula', 'Tipo Identificación', 'NCF', 'NCF Modificado',
        'Tipo Comprobante', 'Fecha Comprobante (AAAAMMDD)',
        'Monto Facturado', 'ITBIS Facturado',
      ));

      for (const s of sales) {
        const rnc = s.fiscal_customer_rnc ?? '';
        const idType = rnc.length === 9 ? '1' : rnc.length === 11 ? '2' : '';
        lines.push(csvRow(
          rnc, idType, s.ncf, '', s.ncf_type ?? '',
          dateOf(s.created_at), num(s.total_amount), num(s.itbis_amount ?? 0),
        ));
        // Nota de crédito de una venta anulada — misma magnitud, NCF B04 propio
        if (s.credit_note_ncf) {
          lines.push(csvRow(
            rnc, idType, s.credit_note_ncf, s.ncf, 'B04',
            dateOf(s.voided_at ?? s.created_at), num(s.total_amount), num(s.itbis_amount ?? 0),
          ));
        }
      }

      // Notas de Crédito B04 de DEVOLUCIONES PARCIALES del mes
      const returns = await AppDataSource.getRepository(SaleReturn)
        .createQueryBuilder('ret')
        .leftJoinAndSelect('ret.sale', 'sale')
        .where('ret.credit_note_ncf IS NOT NULL')
        .andWhere('ret.created_at >= :start AND ret.created_at < :end', { start, end })
        .orderBy('ret.credit_note_ncf', 'ASC')
        .getMany();

      for (const r of returns) {
        const rnc = r.sale?.fiscal_customer_rnc ?? '';
        const idType = rnc.length === 9 ? '1' : rnc.length === 11 ? '2' : '';
        lines.push(csvRow(
          rnc, idType, r.credit_note_ncf, r.sale?.ncf ?? '', 'B04',
          dateOf(r.created_at), num(r.total_refunded), num(r.itbis_refunded ?? 0),
        ));
      }

      if (lines.length === 1) {
        return { success: false, message: `No hay ventas con comprobante en ${String(m).padStart(2, '0')}/${y}.` };
      }

      return await saveCsv(`607_${y}${String(m).padStart(2, '0')}.csv`, lines);
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });
}
