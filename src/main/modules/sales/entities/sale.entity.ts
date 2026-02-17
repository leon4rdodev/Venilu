import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { User } from "@main/modules/users/entities/user.entity";
import { Shift } from "@main/modules/shifts/entities/shift.entity";
import { SaleItem } from "@main/modules/sales/entities/sale-item.entity";

@Entity("sales")
export class Sale {
    @PrimaryColumn()
    id!: string;

    @Column()
    user_id!: string;

    @ManyToOne(() => User, (user) => user.sales)
    @JoinColumn({ name: "user_id" })
    user?: User;

    @Column({ nullable: true })
    shift_id?: string;

    @ManyToOne(() => Shift, (shift) => shift.sales)
    @JoinColumn({ name: "shift_id" })
    shift?: Shift;

    @Column("decimal", { precision: 10, scale: 2 })
    total_amount!: number;

    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    amount_paid?: number;

    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    change_given?: number;

    @Column()
    payment_method!: 'cash' | 'card' | 'transfer';

    @CreateDateColumn()
    created_at!: Date;

    @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
    items!: SaleItem[];
}
