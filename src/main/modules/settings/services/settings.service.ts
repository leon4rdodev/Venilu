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
        const clean: Partial<SettingEntity> = {};
        for (const field of SettingsService.EDITABLE_FIELDS) {
            const value = settingsData[field];
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
        const autoPrint = settingsData.auto_print_receipt;
        if (autoPrint !== undefined) {
            clean.auto_print_receipt = Boolean(autoPrint);
        }

        const fiscalEnabled = settingsData.fiscal_enabled;
        if (fiscalEnabled !== undefined) {
            clean.fiscal_enabled = Boolean(fiscalEnabled);
        }

        const itbisRate = settingsData.itbis_rate;
        if (itbisRate !== undefined) {
            const rate = Number(itbisRate);
            if (!Number.isFinite(rate) || rate < 0 || rate > 30) {
                throw new Error("La tasa de ITBIS debe estar entre 0 y 30");
            }
            clean.itbis_rate = Math.round(rate * 100) / 100;
        }

        const retention = settingsData.auto_backup_retention;
        if (retention !== undefined) {
            const n = Number(retention);
            if (!Number.isInteger(n) || n < 1 || n > 30) {
                throw new Error("La retención de backups debe estar entre 1 y 30.");
            }
            clean.auto_backup_retention = n;
        }

        const uiScale = settingsData.ui_scale;
        if (uiScale !== undefined) {
            const scale = Number(uiScale);
            if (!Number.isFinite(scale) || scale < 0.75 || scale > 1.5) {
                throw new Error("La escala de interfaz debe estar entre 75% y 150%");
            }
            clean.ui_scale = Math.round(scale * 100) / 100;
        }

        const quickSaleEnabled = settingsData.quick_sale_enabled;
        if (quickSaleEnabled !== undefined) {
            clean.quick_sale_enabled = Boolean(quickSaleEnabled);
        }

        const quickSaleMethod = settingsData.quick_sale_payment_method;
        if (quickSaleMethod !== undefined) {
            if (!['cash', 'card', 'transfer'].includes(quickSaleMethod)) {
                throw new Error("Método de pago para Venta Rápida inválido");
            }
            clean.quick_sale_payment_method = quickSaleMethod;
        }

        const soundEnabled = settingsData.sound_enabled;
        if (soundEnabled !== undefined) {
            clean.sound_enabled = Boolean(soundEnabled);
        }

        const soundVolume = settingsData.sound_volume;
        if (soundVolume !== undefined) {
            const volume = Number(soundVolume);
            if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
                throw new Error("El volumen de sonidos debe estar entre 0 y 1");
            }
            clean.sound_volume = Math.round(volume * 100) / 100;
        }

        const soundAddProduct = settingsData.sound_add_product;
        if (soundAddProduct !== undefined) {
            clean.sound_add_product = Boolean(soundAddProduct);
        }

        const soundSaleComplete = settingsData.sound_sale_complete;
        if (soundSaleComplete !== undefined) {
            clean.sound_sale_complete = Boolean(soundSaleComplete);
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
