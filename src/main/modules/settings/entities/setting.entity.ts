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
}

