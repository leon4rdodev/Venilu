import { AppDataSource } from "@main/config/data-source";
import { User as UserEntity } from "@main/modules/users/entities/user.entity";
// import { User as SharedUser } from "@shared/types/models";
import bcrypt from "bcryptjs";
import { Repository } from "typeorm";

export class UsersService {
    private userRepository: Repository<UserEntity>;

    constructor() {
        this.userRepository = AppDataSource.getRepository(UserEntity);
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

    async findAll(): Promise<UserEntity[]> {
        return this.userRepository.find();
    }




    async findOne(id: string): Promise<UserEntity | null> {
        return this.userRepository.findOneBy({ id });
    }

    async findByUsername(username: string): Promise<UserEntity | null> {
        return this.userRepository.findOneBy({ username });
    }

    async create(userData: Partial<UserEntity>): Promise<UserEntity> {
        if (!userData.username || !userData.password || !userData.name) {
            throw new Error("Missing required fields");
        }

        const existingUser = await this.findByUsername(userData.username);
        if (existingUser) {
            throw new Error("Username already exists");
        }

        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        const newUser = this.userRepository.create({
            ...userData,
            password: hashedPassword,
            role: userData.role || 'employee'
        });

        return this.userRepository.save(newUser);
    }

    async update(id: string, userData: Partial<UserEntity>): Promise<UserEntity> {
        const user = await this.findOne(id);
        if (!user) {
            throw new Error("User not found");
        }

        if (userData.password) {
            userData.password = await bcrypt.hash(userData.password, 10);
        }

        // FIX: Because role_entity is eagerly loaded, TypeORM prioritizes it over role_id.
        // We must remove the existing entity reference so TypeORM uses the new role_id.
        if (userData.role_id) {
            delete user.role_entity;
        }

        this.userRepository.merge(user, userData);
        return this.userRepository.save(user);
    }

    async delete(id: string): Promise<void> {
        const result = await this.userRepository.delete(id);
        if (result.affected === 0) {
            throw new Error("User not found");
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
}
