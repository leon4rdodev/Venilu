import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("settings")
export class Setting {
    @PrimaryColumn({ default: 1 })
    id!: number;

    @Column({ nullable: true })
    business_name?: string;

    @Column({ nullable: true })
    business_address?: string;

    @Column({ nullable: true })
    business_phone?: string;

    @Column({ nullable: true })
    business_email?: string;

    @Column({ nullable: true })
    business_tax_id?: string;

    @Column({ nullable: true })
    logo_filename?: string;

    @Column({ nullable: true })
    printer_name?: string;

    @Column({ default: '80mm' })
    paper_size!: string;

    @Column({ default: 'DOP' })
    currency!: string;

    /** Custom message printed at the bottom of every receipt. */
    @Column({ nullable: true, type: 'text' })
    receipt_footer?: string;

    /** Print the receipt automatically right after each completed sale. */
    @Column({ default: false })
    auto_print_receipt!: boolean;

    /** Automatic backup cadence: 'off' | 'daily' | 'weekly'. */
    @Column({ default: 'daily' })
    auto_backup!: string;

    /** How many automatic backups to keep before pruning the oldest. */
    @Column({ default: 7 })
    auto_backup_retention!: number;

    /** Facturación con comprobantes fiscales (NCF) activada. */
    @Column({ default: false })
    fiscal_enabled!: boolean;

    /** Tasa de ITBIS vigente (%). */
    @Column("decimal", { precision: 5, scale: 2, default: 18 })
    itbis_rate!: number;

    /**
     * Escala de interfaz (zoom tipo navegador): 1 = 100%, 1.25 = 125%…
     * Se aplica vía webContents.setZoomFactor y se persiste para que la vista
     * se mantenga entre sesiones. Rango editable: 0.75–1.5.
     */
    @Column("real", { default: 1 })
    ui_scale!: number;

    /**
     * Trial anchor (ISO date) — set once on first boot. Lives in the DB so
     * wiping a file can't reset the trial. NOT client-editable.
     */
    @Column({ nullable: true })
    trial_started_at?: string;

    /**
     * Licensing clock high-water mark (ISO): the latest moment the app has
     * witnessed, to detect a system clock set back. NOT client-editable.
     */
    @Column({ nullable: true })
    license_last_seen_at?: string;
}

