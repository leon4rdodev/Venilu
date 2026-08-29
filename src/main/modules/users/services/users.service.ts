import { AppDataSource } from "@main/config/data-source";
import { User as UserEntity } from "@main/modules/users/entities/user.entity";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Repository } from "typeorm";

/** User without secrets — safe to send to the renderer. */
export type SafeUser = Omit<UserEntity, 'password' | 'session_token'>;

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export class UsersService {
    private userRepository: Repository<UserEntity>;

    constructor() {
        this.userRepository = AppDataSource.getRepository(UserEntity);
    }

    /** Strips password hash and session token before crossing the IPC boundary. */
    static toSafeUser(user: UserEntity): SafeUser {
        const { password: _password, session_token: _token, ...safe } = user;
        return safe;
    }

    async checkOnboardingStatus(): Promise<{ success: boolean; completed: boolean; message: string }> {
         const adminCount = await this.userRepository.count({ where: { role: 'admin' } });
         const completed = adminCount > 0;
         return {
             success: true,
             completed,
             message: completed ? 'Onboarding already completed' : 'Onboarding required'
         };
    }

    /** Returns all users WITHOUT password hashes or session tokens. */
    async findAll(): Promise<SafeUser[]> {
        const users = await this.userRepository.find();
        return users.map(UsersService.toSafeUser);
    }

    /**
     * Minimal profiles for the login user picker — the standard pattern on a
     * shared POS terminal (like an OS lock screen). Exposes ONLY display data:
     * no password hashes, tokens, permissions or timestamps.
     */
    async listLoginProfiles(): Promise<Array<{ id: string; name: string; username: string; roleLabel: string }>> {
        const users = await this.userRepository.find({
            relations: ['role_entity'],
            order: { name: 'ASC' },
        });
        return users.map(u => ({
            id: u.id,
            name: u.name,
            username: u.username,
            roleLabel: u.role_entity?.name ?? (u.role === 'admin' ? 'Administrador' : 'Empleado'),
        }));
    }

    async findOne(id: string): Promise<UserEntity | null> {
        return this.userRepository.findOneBy({ id });
    }

    async findByUsername(username: string): Promise<UserEntity | null> {
        return this.userRepository.findOneBy({ username });
    }

    async create(userData: Partial<UserEntity>): Promise<UserEntity> {
        // Whitelist — never accept arbitrary fields (id, session_token, timestamps…)
        const username = typeof userData.username === 'string' ? userData.username.trim() : '';
        const name = typeof userData.name === 'string' ? userData.name.trim() : '';
        const password = typeof userData.password === 'string' ? userData.password : '';
        const role = userData.role ?? 'employee';

        if (!username || !password || !name) {
            throw new Error("Faltan campos requeridos (usuario, nombre o contraseña).");
        }
        if (role !== 'admin' && role !== 'employee') {
            throw new Error("Rol inválido.");
        }

        const existingUser = await this.findByUsername(username);
        if (existingUser) {
            throw new Error("El nombre de usuario ya existe.");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = this.userRepository.create({
            username,
            name,
            password: hashedPassword,
            role,
            role_id: typeof userData.role_id === 'string' && userData.role_id ? userData.role_id : undefined,
        });

        return this.userRepository.save(newUser);
    }

    /**
     * Updates a user with a whitelisted set of fields.
     * @param actorId id of the session user performing the update — used to
     *                prevent self privilege escalation/demotion.
     */
    async update(id: string, userData: Partial<UserEntity>, actorId?: string): Promise<UserEntity> {
        const user = await this.findOne(id);
        if (!user) {
            throw new Error("Usuario no encontrado.");
        }

        const changes: Partial<UserEntity> = {};

        if (userData.name !== undefined) {
            const name = typeof userData.name === 'string' ? userData.name.trim() : '';
            if (!name) throw new Error("El nombre no puede estar vacío.");
            changes.name = name;
        }

        if (userData.username !== undefined) {
            const username = typeof userData.username === 'string' ? userData.username.trim() : '';
            if (!username) throw new Error("El nombre de usuario no puede estar vacío.");
            if (username !== user.username) {
                const duplicate = await this.findByUsername(username);
                if (duplicate && duplicate.id !== id) throw new Error("El nombre de usuario ya existe.");
            }
            changes.username = username;
        }

        // Empty password string means "keep current password" (edit dialogs send '')
        if (typeof userData.password === 'string' && userData.password.length > 0) {
            changes.password = await bcrypt.hash(userData.password, 10);
        }

        if (userData.role !== undefined) {
            if (userData.role !== 'admin' && userData.role !== 'employee') {
                throw new Error("Rol inválido.");
            }
            changes.role = userData.role;
        }

        if (userData.role_id !== undefined) {
            if (typeof userData.role_id !== 'string' || !userData.role_id) {
                throw new Error("Rol inválido.");
            }
            changes.role_id = userData.role_id;
        }

        // Prevent self privilege changes — another admin must do it.
        if (actorId && actorId === id) {
            if (changes.role !== undefined && changes.role !== user.role) {
                throw new Error("No puedes cambiar tu propio rol.");
            }
            if (changes.role_id !== undefined && changes.role_id !== user.role_id) {
                throw new Error("No puedes cambiar tu propio rol.");
            }
        }

        // FIX: Because role_entity is eagerly loaded, TypeORM prioritizes it over role_id.
        // We must remove the existing entity reference so TypeORM uses the new role_id.
        if (changes.role_id) {
            delete user.role_entity;
        }

        this.userRepository.merge(user, changes);
        return this.userRepository.save(user);
    }

    /**
     * Deletes a user. Refuses to delete the acting user or the last admin
     * (deleting the last admin would re-open the public onboarding flow).
     */
    async delete(id: string, actorId?: string): Promise<void> {
        if (actorId && actorId === id) {
            throw new Error("No puedes eliminar tu propio usuario.");
        }

        const user = await this.findOne(id);
        if (!user) {
            throw new Error("Usuario no encontrado.");
        }

        if (user.role === 'admin') {
            const adminCount = await this.userRepository.count({ where: { role: 'admin' } });
            if (adminCount <= 1) {
                throw new Error("No puedes eliminar el último administrador.");
            }
        }

        const result = await this.userRepository.delete(id);
        if (result.affected === 0) {
            throw new Error("Usuario no encontrado.");
        }
    }

    async verifyCredentials(username: string, password: string): Promise<UserEntity | null> {
        const user = await this.userRepository.findOneBy({ username });
        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        // role_entity is eagerly loaded — permissions are available immediately
        return user;
    }

    /**
     * Load a user by ID with their role entity (eager).
     * Used by session restoration to re-hydrate permissions from DB — never trust the renderer.
     */
    async findOneWithRole(id: string): Promise<UserEntity | null> {
        return this.userRepository.findOneBy({ id });
    }

    // ─── Session tokens ───────────────────────────────────────────────────────

    /**
     * Issues a new session token for the user and persists its SHA-256 hash.
     * The raw token is returned once — the renderer stores it to restore the
     * session across app restarts. Issuing a new token invalidates the old one.
     */
    async issueSessionToken(userId: string): Promise<string> {
        const token = crypto.randomBytes(32).toString('hex');
        await this.userRepository.update({ id: userId }, { session_token: hashToken(token) });
        return token;
    }

    /** Constant-time comparison of a presented token against the stored hash. */
    async verifySessionToken(userId: string, token: string): Promise<boolean> {
        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user || !user.session_token) return false;
        const presented = Buffer.from(hashToken(token), 'hex');
        const stored = Buffer.from(user.session_token, 'hex');
        if (presented.length !== stored.length) return false;
        return crypto.timingSafeEqual(presented, stored);
    }

    async clearSessionToken(userId: string): Promise<void> {
        await this.userRepository.update({ id: userId }, { session_token: null });
    }
}
