import { ipcMain } from "electron";
import { UsersService } from "@main/modules/users/services/users.service";
import { User } from "@shared/types/models";
import { IPCResponse } from "@shared/types/ipc";

const usersService = new UsersService();

export function registerUsersHandlers() {
    ipcMain.handle('login-request', async (_event, { username, password }): Promise<IPCResponse<User>> => {
        const user = await usersService.verifyCredentials(username, password);
        if (user) {
            return {
                success: true,
                data: {
                    id: user.id,
                    role: user.role,
                    name: user.name,
                    username: user.username,
                    created_at: user.created_at,
                    updated_at: user.updated_at
                }
            };
        }
        return { success: false, message: 'Invalid username or password.' };
    });

    ipcMain.handle('get-users', async () => {
        const users = await usersService.findAll();
        return { success: true, users };
    });

    ipcMain.handle('create-user', async (_event, userData) => {
        try {
            const user = await usersService.create(userData);
            return { success: true, user };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('update-user', async (_event, { userId, userData }) => {
        try {
            await usersService.update(userId, userData);
            return { success: true };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('delete-user', async (_event, userId) => {
        try {
            await usersService.delete(userId);
            return { success: true };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('onboarding:check', async () => {
        return await usersService.checkOnboardingStatus();
    });
}
