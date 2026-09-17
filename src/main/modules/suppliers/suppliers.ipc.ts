import { ipcMain } from "electron";
import { SuppliersService } from "@main/modules/suppliers/services/suppliers.service";
import { PurchasesService } from "@main/modules/suppliers/services/purchases.service";
import { requirePermission } from "@main/shared/session";
import { auditService } from "@main/modules/audit/services/audit.service";
import { csvRow, saveCsv } from "@main/shared/services/csv.util";

const suppliersService = new SuppliersService();
const purchasesService = new PurchasesService();

const fail = (error: unknown) => ({ success: false, message: error instanceof Error ? error.message : String(error) });

export function registerSuppliersHandlers() {
    // ─── Suplidores ───────────────────────────────────────────────────────────
    ipcMain.handle('suppliers:list', async (_event, options) => {
        try {
            requirePermission('suppliers:view');
            return { success: true, data: await suppliersService.list(options ?? {}) };
        } catch (error) { return fail(error); }
    });

    ipcMain.handle('suppliers:active', async () => {
        try {
            requirePermission('suppliers:view');
            return { success: true, data: await suppliersService.findActive() };
        } catch (error) { return fail(error); }
    });

    ipcMain.handle('suppliers:search', async (_event, query: string) => {
        try {
            requirePermission('suppliers:view');
            return { success: true, data: await suppliersService.search(query) };
        } catch (error) { return fail(error); }
    });

    ipcMain.handle('suppliers:get', async (_event, id: string) => {
        try {
            requirePermission('suppliers:view');
            return { success: true, data: await suppliersService.findOne(String(id ?? '')) };
        } catch (error) { return fail(error); }
    });

    ipcMain.handle('suppliers:stats', async () => {
        try {
            requirePermission('suppliers:view');
            return { success: true, data: await suppliersService.getStats() };
        } catch (error) { return fail(error); }
    });

    ipcMain.handle('suppliers:summary', async (_event, id: string) => {
        try {
            requirePermission('suppliers:view');
            return { success: true, data: await suppliersService.getSummary(String(id ?? '')) };
        } catch (error) { return fail(error); }
    });

    ipcMain.handle('suppliers:create', async (_event, data) => {
        try {
            requirePermission('suppliers:manage');
            const supplier = await suppliersService.create(data ?? {});
            auditService.log('suppliers:create', supplier.id, supplier.name);
            return { success: true, data: supplier };
        } catch (error) { return fail(error); }
    });

    ipcMain.handle('suppliers:update', async (_event, { supplierId, data } = {}) => {
        try {
            requirePermission('suppliers:manage');
            const supplier = await suppliersService.update(String(supplierId ?? ''), data ?? {});
            auditService.log('suppliers:update', supplier.id, supplier.name, { fields: Object.keys(data ?? {}) });
            return { success: true, data: supplier };
        } catch (error) { return fail(error); }
    });

    ipcMain.handle('suppliers:delete', async (_event, supplierId: string) => {
        try {
            requirePermission('suppliers:manage');
            const victim = await suppliersService.findOne(String(supplierId ?? ''));
            const result = await suppliersService.delete(String(supplierId ?? ''));
            auditService.log(result.deleted ? 'suppliers:delete' : 'suppliers:deactivate', String(supplierId), victim?.name);
            return { success: true, data: result };
        } catch (error) { return fail(error); }
    });

    ipcMain.handle('suppliers:payments', async (_event, { supplierId, page = 1, limit = 15 } = {}) => {
        try {
            requirePermission('suppliers:view');
            const result = await suppliersService.getPayments(String(supplierId ?? ''), page, limit);
            return { success: true, data: result.items, total: result.total, totalPages: result.totalPages };
        } catch (error) { return fail(error); }
    });

    ipcMain.handle('suppliers:pay', async (_event, { supplierId, amount, paymentMethod, notes } = {}) => {
        try {
            const session = requirePermission('suppliers:pay');
            const method = paymentMethod ?? 'cash';
            const result = await purchasesService.paySupplier(String(supplierId ?? ''), amount, method, session.id, notes);
            auditService.log('suppliers:pay', String(supplierId),
                `${Number(result.payment.amount).toFixed(2)} (${method === 'cash' ? 'efectivo' : 'transferencia'}) · pendiente ${Number(result.newBalance).toFixed(2)}`,
                { amount: result.payment.amount, method, newBalance: result.newBalance });
            return { success: true, data: result };
        } catch (error) { return fail(error); }
    });

    ipcMain.handle('suppliers:export-csv', async () => {
        try {
            requirePermission('suppliers:view');
            const { items } = await suppliersService.list({ page: 1, pageSize: 100, filter: 'all' });
            const inactive = await suppliersService.list({ page: 1, pageSize: 100, filter: 'inactive' });
            const rows = [...items, ...inactive.items];
            const lines = [csvRow('Nombre', 'RNC', 'Contacto', 'Teléfono', 'Email', 'Dirección', 'Días de crédito', 'Cuenta por pagar', 'Compras', 'Total comprado', 'Última compra', 'Activo')];
            for (const s of rows) {
                lines.push(csvRow(
                    s.name, s.rnc ?? '', s.contact_name ?? '', s.phone ?? '', s.email ?? '', s.address ?? '',
                    String(s.credit_days), Number(s.balance).toFixed(2), String(s.purchases_count),
                    Number(s.total_purchased).toFixed(2), s.last_purchase_at ? String(s.last_purchase_at).slice(0, 10) : '',
                    s.active ? 'Sí' : 'No',
                ));
            }
            const date = new Date().toISOString().slice(0, 10);
            return await saveCsv(`Suplidores_${date}.csv`, lines);
        } catch (error) { return fail(error); }
    });

    // ─── Compras ──────────────────────────────────────────────────────────────
    ipcMain.handle('purchases:list', async (_event, options) => {
        try {
            requirePermission('suppliers:view');
            return { success: true, data: await purchasesService.list(options ?? {}) };
        } catch (error) { return fail(error); }
    });

    ipcMain.handle('purchases:get', async (_event, id: string) => {
        try {
            requirePermission('suppliers:view');
            return { success: true, data: await purchasesService.findOne(String(id ?? '')) };
        } catch (error) { return fail(error); }
    });

    ipcMain.handle('purchases:create', async (_event, input) => {
        try {
            const session = requirePermission('purchases:create');
            const purchase = await purchasesService.create(input, session.id);
            auditService.log('purchases:create', purchase.id,
                `${purchase.supplier_name} · ${Number(purchase.total_amount).toFixed(2)} (${purchase.payment_status === 'paid' ? 'pagada' : purchase.payment_status === 'partial' ? 'pago parcial' : 'a crédito'})`,
                { total: purchase.total_amount, amount_paid: purchase.amount_paid, items: purchase.items.length });
            return { success: true, data: purchase };
        } catch (error) { return fail(error); }
    });

    ipcMain.handle('purchases:cancel', async (_event, { purchaseId, reason } = {}) => {
        try {
            requirePermission('purchases:cancel');
            const purchase = await purchasesService.cancel(String(purchaseId ?? ''), reason);
            auditService.log('purchases:cancel', purchase.id, `${purchase.supplier_name} · ${Number(purchase.total_amount).toFixed(2)}`, { reason });
            return { success: true, data: purchase };
        } catch (error) { return fail(error); }
    });
}
