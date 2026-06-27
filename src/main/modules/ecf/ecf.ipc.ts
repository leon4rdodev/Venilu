import { ipcMain } from "electron";
import { EcService } from "@main/modules/ecf/services/ecf.service";
import { NcfService } from "@main/modules/ecf/services/ncf.service";
import { requirePermission } from "@main/shared/session";

const ecService = new EcService();
const ncfService = new NcfService();

export function registerEcfHandlers() {
    // ─── NCF Sequences ──────────────────────────────────────────────────────
    ipcMain.handle("ecf:ncf:list", async () => {
        try {
            requirePermission("ecf:view");
            const sequences = await ncfService.findAll();
            return { success: true, data: sequences };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle("ecf:ncf:create", async (_event, data) => {
        try {
            requirePermission("ecf:config");
            const seq = await ncfService.create(data);
            return { success: true, data: seq };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle("ecf:ncf:update", async (_event, { id, data }) => {
        try {
            requirePermission("ecf:config");
            const seq = await ncfService.update(id, data);
            return { success: true, data: seq };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle("ecf:ncf:delete", async (_event, id) => {
        try {
            requirePermission("ecf:config");
            await ncfService.delete(id);
            return { success: true };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // ─── e-CF Documents ─────────────────────────────────────────────────────
    ipcMain.handle("ecf:list", async () => {
        try {
            requirePermission("ecf:view");
            const docs = await ecService.findAll();
            return { success: true, data: docs };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle("ecf:get", async (_event, id: string) => {
        try {
            requirePermission("ecf:view");
            const doc = await ecService.findOne(id);
            return { success: true, data: doc };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle("ecf:generate", async (_event, { saleId, ecfType, customerId }) => {
        try {
            requirePermission("ecf:emit");
            const doc = await ecService.generateFromSale(saleId, ecfType, customerId);
            return { success: true, data: doc };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle("ecf:void", async (_event, id: string) => {
        try {
            requirePermission("ecf:emit");
            const doc = await ecService.voidDocument(id);
            return { success: true, data: doc };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle("ecf:stats", async () => {
        try {
            requirePermission("ecf:view");
            const stats = await ecService.getStats();
            return { success: true, data: stats };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
