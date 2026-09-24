import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from "typeorm";
import { User } from "@main/modules/users/entities/user.entity";
import { Sale } from "@main/modules/sales/entities/sale.entity";
import { DebtPayment } from "@main/modules/sales/entities/debt-payment.entity";
import { ShiftExpense } from "./shift-expense.entity";
import { ShiftCapital } from "./shift-capital.entity";

@Entity("shifts")
// getActiveShift/getLastClosedShift query by (user_id, status) on every boot
// and POS interaction.
@Index("idx_shifts_user_status", ["user_id", "status"])
export class Shift {
    @PrimaryColumn()
    id!: string;

    @Column()
    user_id!: string;

    @ManyToOne(() => User, (user) => user.shifts, { onDelete: 'CASCADE' })
    @JoinColumn({ name: "user_id" })
    user?: User;

    @OneToMany(() => Sale, (sale) => sale.shift)
    sales!: Sale[];

    @OneToMany(() => DebtPayment, (dp) => dp.shift)
    debt_payments!: DebtPayment[];

    @OneToMany(() => ShiftExpense, (expense) => expense.shift)
    expenses!: ShiftExpense[];

    @OneToMany(() => ShiftCapital, (capital) => capital.shift)
    capitals!: ShiftCapital[];

    @CreateDateColumn()
    start_time!: Date;

    @Column({ type: "datetime", nullable: true })
    end_time?: Date;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    initial_cash!: number;

    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    final_cash?: number;

    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    expected_cash?: number;

    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    difference?: number;

    @Column({ default: 'open' })
    status!: 'open' | 'closed';

    /** True when an admin force-closed this shift */
    @Column({ default: false })
    force_closed!: boolean;

    /** User ID of the admin who force-closed */
    @Column({ nullable: true })
    force_closed_by?: string;

    /** Optional reason provided by the admin */
    @Column({ nullable: true })
    force_close_reason?: string;
}
