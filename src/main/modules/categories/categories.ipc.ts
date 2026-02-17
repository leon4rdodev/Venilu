import { ipcMain } from "electron";
import { CategoriesService } from "@main/modules/categories/services/categories.service";

const categoriesService = new CategoriesService();

export function registerCategoriesHandlers() {
    ipcMain.handle('get-categories', async () => {
        const categories = await categoriesService.findAll();
        return { success: true, categories };
    });

    ipcMain.handle('get-categories-with-count', async () => {
        const categories = await categoriesService.findAllWithCount();
        return { success: true, categories };
    });

    ipcMain.handle('create-category', async (_event, name) => {
        try {
            const category = await categoriesService.create(name);
            return { success: true, category };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('update-category', async (_event, { id, name }) => {
        try {
            await categoriesService.update(id, name);
            return { success: true, message: 'Category updated successfully' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('delete-category', async (_event, id) => {
        try {
            await categoriesService.delete(id);
            return { success: true, message: 'Category deleted successfully' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
