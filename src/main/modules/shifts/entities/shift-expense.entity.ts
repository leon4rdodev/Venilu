import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { Shift } from "./shift.entity";

@Entity("shift_expenses")
@Index("idx_shift_expenses_shift", ["shift_id"])
export class ShiftExpense {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    shift_id!: string;

    @ManyToOne(() => Shift, (shift) => shift.expenses)
    @JoinColumn({ name: "shift_id" })
    shift?: Shift;

    @Column("decimal", { precision: 10, scale: 2 })
    amount!: number;

    @Column()
    reason!: string;

    @CreateDateColumn()
    created_at!: Date;
}
