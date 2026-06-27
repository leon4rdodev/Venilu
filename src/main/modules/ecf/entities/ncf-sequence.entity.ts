import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

export type NcfType = "01" | "02" | "03" | "04" | "07" | "11" | "12" | "14" | "15";

@Entity("ncf_sequences")
export class NcfSequence {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    description!: string;

    @Column({ length: 2 })
    ncf_type!: NcfType;

    @Column({ length: 3 })
    branch_code!: string;

    @Column({ length: 9 })
    current_number!: string;

    @Column({ length: 9 })
    final_number!: string;

    @Column()
    valid_from!: Date;

    @Column()
    valid_to!: Date;

    @Column({ default: true })
    active!: boolean;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}
