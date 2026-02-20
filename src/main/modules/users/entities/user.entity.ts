import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { Shift } from "@main/modules/shifts/entities/shift.entity";
import { Sale } from "@main/modules/sales/entities/sale.entity";

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ unique: true })
    username!: string;

    @Column()
    password!: string;

    @Column()
    name!: string;

    @Column({ default: 'employee' })
    role!: 'admin' | 'employee';

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;

    @OneToMany(() => Shift, (shift) => shift.user)
    shifts?: Shift[];

    @OneToMany(() => Sale, (sale) => sale.user)
    sales?: Sale[];
}
