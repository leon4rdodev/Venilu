import { AppDataSource } from "@main/config/data-source";
import { Shift as ShiftEntity } from "@main/modules/shifts/entities/shift.entity";
import { ShiftExpense } from "@main/modules/shifts/entities/shift-expense.entity";
import { Sale as SaleEntity } from "@main/modules/sales/entities/sale.entity";
import { DebtPayment as DebtPaymentEntity } from "@main/modules/sales/entities/debt-payment.entity";
import { SaleReturn as SaleReturnEntity } from "@main/modules/sales/entities/sale-return.entity";
import { Repository } from "typeorm";
import { round2 } from "@shared/money";

export class ShiftsService {
    private shiftRepository: Repository<ShiftEntity>;
    private saleRepository: Repository<SaleEntity>;
    private debtPaymentRepository: Repository<DebtPaymentEntity>;

    constructor() {
        this.shiftRepository = AppDataSource.getRepository(ShiftEntity);
        this.saleRepository = AppDataSource.getRepository(SaleEntity);
        this.debtPaymentRepository = AppDataSource.getRepository(DebtPaymentEntity);
    }

    async getActiveShift(userId: string): Promise<ShiftEntity | null> {
        return this.shiftRepository.findOne({
            where: {
                user_id: userId,
                status: 'open'
            }
        });
    }

    /**
     * Most recent closed shift for the user — feeds the "suggested opening
     * float" in the open-shift dialog (cash continuity between shifts).
     */
    async getLastClosedShift(userId: string): Promise<ShiftEntity | null> {
        return this.shiftRepository.findOne({
            where: { user_id: userId, status: 'closed' },
            order: { end_time: 'DESC' },
        });
    }

    /**
     * Throws unless the shift belongs to the given user or the caller may view
     * other users' shifts.
     */
    async assertShiftAccess(shiftId: string, userId: string, canViewOthers: boolean): Promise<void> {
        if (canViewOthers) return;
        const shift = await this.shiftRepository.findOneBy({ id: shiftId });
        if (!shift) throw new Error("Turno no encontrado");
        if (shift.user_id !== userId) throw new Error("No tienes acceso a este turno");
    }

    async getShiftSales(shiftId: string): Promise<SaleEntity[]> {
        return this.saleRepository.find({
            where: { shift_id: shiftId }
        });
    }

    async getShiftWithExpenses(shiftId: string): Promise<ShiftEntity | null> {
        return this.shiftRepository.findOne({
            where: { id: shiftId },
            relations: ['expenses']
        });
    }

    private generateShortId(length: number = 8): string {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async createShift(userId: string, initialCash: number): Promise<ShiftEntity> {
        const cash = round2(Number(initialCash));
        if (!Number.isFinite(cash) || cash < 0) {
            throw new Error("El monto inicial de caja es inválido");
        }

        // Check if user already has an open shift
        const existingShift = await this.getActiveShift(userId);
        if (existingShift) {
            throw new Error("User already has an active shift");
        }

        // Generate unique short ID
        let shiftId = '';
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 10) {
            shiftId = this.generateShortId();
            const existing = await this.shiftRepository.findOneBy({ id: shiftId });
            if (!existing) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique) {
            throw new Error("Failed to generate a unique shift ID after multiple attempts");
        }

        const shift = this.shiftRepository.create({
            id: shiftId,
            user_id: userId,
            initial_cash: cash,
            start_time: new Date(),
            status: 'open'
        });

        return this.shiftRepository.save(shift);
    }

    async closeShift(shiftId: string, finalCash: number, expectedUserId?: string): Promise<ShiftEntity> {
        const cash = round2(Number(finalCash));
        if (!Number.isFinite(cash) || cash < 0) {
            throw new Error("El monto final de caja es inválido");
        }

        const shift = await this.shiftRepository.findOne({
            where: { id: shiftId },
            relations: ['expenses']
        });
        if (!shift) {
            throw new Error("Shift not found");
        }

        if (expectedUserId && shift.user_id !== expectedUserId) {
            throw new Error("Solo puedes cerrar tu propio turno");
        }

        if (shift.status === 'closed') {
            throw new Error("El turno ya está cerrado");
        }

        // Calculate expected cash from cash sales
        const sales = await this.saleRepository.find({
            where: { shift_id: shiftId }
        });

        const totalSalesCash = sales
            .filter(s => s.payment_method === 'cash' && s.status !== 'voided')
            .reduce((sum, s) => sum + Number(s.total_amount), 0);

        // Also include cash debt payments received during this shift.
        // Refunds (voided credit sales already collected) SUBTRACT — that money
        // physically left the drawer.
        const debtPayments = await this.debtPaymentRepository.find({
            where: { shift_id: shiftId }
        });
        const totalDebtCash = debtPayments
            .filter(p => p.payment_method === 'cash')
            .reduce((sum, p) => sum + (p.type === 'refund' ? -Number(p.amount) : Number(p.amount)), 0);

        // Subtract expenses
        const totalExpenses = (shift.expenses || []).reduce((sum, e) => sum + Number(e.amount), 0);

        // Devoluciones parciales pagadas desde esta caja
        const shiftReturns = await AppDataSource.getRepository(SaleReturnEntity)
            .createQueryBuilder('ret')
            .select('SUM(ret.total_refunded)', 'refunded')
            .where('ret.shift_id = :shiftId', { shiftId })
            .getRawOne();
        const totalReturns = Number(shiftReturns?.refunded) || 0;

        const expectedCash = round2(Number(shift.initial_cash) + totalSalesCash + totalDebtCash - totalExpenses - totalReturns);

        shift.final_cash = cash;
        shift.expected_cash = expectedCash;
        shift.difference = round2(cash - expectedCash);
        shift.end_time = new Date();
        shift.status = 'closed';

        return this.shiftRepository.save(shift);
    }

    async addExpense(shiftId: string, amount: number, reason: string, expectedUserId?: string): Promise<ShiftExpense> {
        const shift = await this.shiftRepository.findOneBy({ id: shiftId });
        if (!shift || shift.status !== 'open') {
            throw new Error("No hay un turno abierto válido para registrar este gasto");
        }

        if (expectedUserId && shift.user_id !== expectedUserId) {
            throw new Error("Solo puedes registrar gastos en tu propio turno");
        }

        const amt = round2(Number(amount));
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new Error("El monto del gasto debe ser un número mayor a 0");
        }

        const cleanReason = typeof reason === 'string' ? reason.trim() : '';
        if (!cleanReason) {
            throw new Error("Debes indicar el motivo del gasto");
        }

        const expenseRepository = AppDataSource.getRepository(ShiftExpense);
        const expense = expenseRepository.create({
            shift_id: shiftId,
            amount: amt,
            reason: cleanReason
        });

        return expenseRepository.save(expense);
    }

    async getShiftsHistory(userId?: string): Promise<any[]> {
        const query = this.shiftRepository.createQueryBuilder("shift")
            .leftJoinAndSelect("shift.user", "user")
            .leftJoinAndSelect("shift.sales", "sales")
            .leftJoinAndSelect("shift.debt_payments", "debt_payments")
            .leftJoinAndSelect("shift.expenses", "expenses")
            .leftJoinAndSelect("debt_payments.customer", "dp_customer")
            .orderBy("shift.start_time", "DESC")
            .addOrderBy("sales.created_at", "DESC")
            // Performance: unbounded history grew linearly with app lifetime —
            // 50 most recent shifts is plenty for the POS history view.
            .take(50);

        if (userId) {
            query.where("shift.user_id = :userId", { userId });
        }

        const shifts = await query.getMany();

        // Drop the joined user entity (contains the password hash) — expose
        // only the display name.
        return shifts.map(({ user, ...shift }) => ({
            ...shift,
            user_name: user?.name || 'Unknown',
            sales: (shift.sales || []).map(sale => ({
                ...sale,
                sale_date: sale.created_at
            })),
            debt_payments: (shift.debt_payments || []).map(dp => ({
                ...dp,
                customer_name: dp.customer?.name || 'Cliente',
            })),
            expenses: shift.expenses || [],
        }));
    }

    async getDebtPayments(shiftId: string): Promise<DebtPaymentEntity[]> {
        return this.debtPaymentRepository.find({
            where: { shift_id: shiftId },
            relations: ['customer'],
            order: { created_at: 'DESC' },
        });
    }

    async forceClose(
        shiftId: string,
        finalCash: number,
        adminId: string,
        reason?: string
    ): Promise<ShiftEntity> {
        const cash = round2(Number(finalCash));
        if (!Number.isFinite(cash) || cash < 0) {
            throw new Error("El monto final de caja es inválido");
        }

        const shift = await this.shiftRepository.findOne({
            where: { id: shiftId },
            relations: ['expenses']
        });
        if (!shift) throw new Error("Turno no encontrado");
        if (shift.status === 'closed') throw new Error("El turno ya está cerrado");

        const sales = await this.saleRepository.find({ where: { shift_id: shiftId } });
        const totalSalesCash = sales
            .filter(s => s.payment_method === 'cash' && s.status !== 'voided')
            .reduce((sum, s) => sum + Number(s.total_amount), 0);

        const debtPaymentsCash = await this.debtPaymentRepository.find({ where: { shift_id: shiftId } });
        const totalDebtCash = debtPaymentsCash
            .filter(p => p.payment_method === 'cash')
            .reduce((sum, p) => sum + (p.type === 'refund' ? -Number(p.amount) : Number(p.amount)), 0);

        const totalExpenses = (shift.expenses || []).reduce((sum, e) => sum + Number(e.amount), 0);

        const forceReturns = await AppDataSource.getRepository(SaleReturnEntity)
            .createQueryBuilder('ret')
            .select('SUM(ret.total_refunded)', 'refunded')
            .where('ret.shift_id = :shiftId', { shiftId })
            .getRawOne();
        const totalReturns = Number(forceReturns?.refunded) || 0;

        const expectedCash = round2(Number(shift.initial_cash) + totalSalesCash + totalDebtCash - totalExpenses - totalReturns);

        shift.final_cash = cash;
        shift.expected_cash = expectedCash;
        shift.difference = round2(cash - expectedCash);
        shift.end_time = new Date();
        shift.status = 'closed';
        shift.force_closed = true;
        shift.force_closed_by = adminId;
        shift.force_close_reason = reason;

        return this.shiftRepository.save(shift);
    }
}
