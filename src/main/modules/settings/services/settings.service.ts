import { AppDataSource } from "@main/config/data-source";
import { Setting as SettingEntity } from "@main/modules/settings/entities/setting.entity";
import { Repository } from "typeorm";
import path from "path";

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
                business_name: 'Venilu',
                paper_size: '80mm'
            });
            await this.settingsRepository.save(settings);
        }
        return settings;
    }

    private static readonly EDITABLE_FIELDS = [
        'business_name', 'business_address', 'business_phone', 'business_email',
        'business_tax_id', 'logo_filename', 'printer_name', 'paper_size', 'currency',
        'receipt_footer', 'auto_backup',
    ] as const;

    /**
     * Whitelists known editable fields from an untrusted payload.
     * logo_filename is reduced to a bare file name (no path traversal) and
     * paper_size is validated against the supported sizes.
     */
    private sanitize(settingsData: Partial<SettingEntity>): Partial<SettingEntity> {
        const clean: any = {};
        for (const field of SettingsService.EDITABLE_FIELDS) {
            const value = (settingsData as any)[field];
            if (value === undefined) continue;
            if (value !== null && typeof value !== 'string') {
                throw new Error(`Campo de configuración inválido: ${field}`);
            }
            clean[field] = value;
        }

        if (typeof clean.logo_filename === 'string' && clean.logo_filename) {
            clean.logo_filename = path.basename(clean.logo_filename);
        }
        if (clean.paper_size != null && !['58mm', '80mm'].includes(clean.paper_size)) {
            throw new Error("Tamaño de papel inválido");
        }
        if (clean.auto_backup != null && !['off', 'daily', 'weekly'].includes(clean.auto_backup)) {
            throw new Error("Frecuencia de backup automático inválida");
        }
        if (typeof clean.receipt_footer === 'string' && clean.receipt_footer.length > 300) {
            clean.receipt_footer = clean.receipt_footer.slice(0, 300);
        }

        // Non-string editable fields are handled explicitly below
        const autoPrint = (settingsData as any).auto_print_receipt;
        if (autoPrint !== undefined) {
            clean.auto_print_receipt = Boolean(autoPrint);
        }

        const retention = (settingsData as any).auto_backup_retention;
        if (retention !== undefined) {
            const n = Number(retention);
            if (!Number.isInteger(n) || n < 1 || n > 30) {
                throw new Error("La retención de backups debe estar entre 1 y 30.");
            }
            clean.auto_backup_retention = n;
        }
        return clean;
    }

    async update(settingsData: Partial<SettingEntity>): Promise<SettingEntity> {
        const clean = this.sanitize(settingsData);
        let settings = await this.settingsRepository.findOneBy({ id: 1 });
        if (!settings) {
            settings = this.settingsRepository.create({ id: 1, ...clean });
        } else {
            this.settingsRepository.merge(settings, clean);
        }
        return this.settingsRepository.save(settings);
    }
}
