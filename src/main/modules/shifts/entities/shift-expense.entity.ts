import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Shift } from "./shift.entity";

@Entity("shift_expenses")
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
