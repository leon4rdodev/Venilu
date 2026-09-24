import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { Shift } from "./shift.entity";

/**
 * Inyección de capital (aporte de efectivo) a la caja de un turno: el
 * dueño mete dinero al cajón a mitad de turno. A diferencia de
 * shift_expenses, SUMA al efectivo esperado del arqueo.
 */
@Entity("shift_capital")
@Index("idx_shift_capital_shift", ["shift_id"])
export class ShiftCapital {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    shift_id!: string;

    @ManyToOne(() => Shift, (shift) => shift.capitals)
    @JoinColumn({ name: "shift_id" })
    shift?: Shift;

    @Column("decimal", { precision: 10, scale: 2 })
    amount!: number;

    /** Motivo opcional — el servicio aplica "Aporte a caja" si viene vacío. */
    @Column({ nullable: true })
    reason?: string;

    @CreateDateColumn()
    created_at!: Date;
}
