import { ipcMain } from "electron";
import { CategoriesService } from "@main/modules/categories/services/categories.service";
import { requirePermission, requireAuth } from "@main/shared/session";

const categoriesService = new CategoriesService();

export function registerCategoriesHandlers() {
    // Any authenticated user can read categories
    ipcMain.handle('get-categories', async () => {
        try {
            requireAuth();
            const categories = await categoriesService.findAll();
            return { success: true, data: categories };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-categories-with-count', async () => {
        try {
            requireAuth();
            const categories = await categoriesService.findAllWithCount();
            return { success: true, data: categories };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Managed by inventory:categories permission
    ipcMain.handle('create-category', async (_event, name) => {
        try {
            requirePermission('inventory:categories');
            const category = await categoriesService.create(name);
            return { success: true, data: category };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Managed by inventory:categories permission
    ipcMain.handle('update-category', async (_event, { id, name }) => {
        try {
            requirePermission('inventory:categories');
            await categoriesService.update(id, name);
            return { success: true, message: 'Category updated successfully' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Managed by inventory:categories permission
    ipcMain.handle('delete-category', async (_event, id) => {
        try {
            requirePermission('inventory:categories');
            await categoriesService.delete(id);
            return { success: true, message: 'Category deleted successfully' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
