import { AppDataSource } from "@main/config/data-source";
import { Setting as SettingEntity } from "@main/modules/settings/entities/setting.entity";
import { Repository } from "typeorm";

export class SettingsService {
    private settingsRepository: Repository<SettingEntity>;

    constructor() {
        this.settingsRepository = AppDataSource.getRepository(SettingEntity);
    }

    async get(): Promise<SettingEntity> {
        let settings = await this.settingsRepository.findOneBy({ id: 1 });
        if (!settings) {
            // Create default if not exists
            settings = this.settingsRepository.create({
                id: 1,
                business_name: 'Mi Negocio',
                paper_size: '80mm'
            });
            await this.settingsRepository.save(settings);
        }
        return settings;
    }

    async update(settingsData: Partial<SettingEntity>): Promise<SettingEntity> {
        let settings = await this.settingsRepository.findOneBy({ id: 1 });
        if (!settings) {
            settings = this.settingsRepository.create({ id: 1, ...settingsData });
        } else {
            this.settingsRepository.merge(settings, settingsData);
        }
        return this.settingsRepository.save(settings);
    }
}
