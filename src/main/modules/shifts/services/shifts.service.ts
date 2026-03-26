import { AppDataSource } from "@main/config/data-source";
import { Shift as ShiftEntity } from "@main/modules/shifts/entities/shift.entity";
// import { User as UserEntity } from "@main/modules/users/entities/user.entity";
import { Sale as SaleEntity } from "@main/modules/sales/entities/sale.entity";
import { DebtPayment as DebtPaymentEntity } from "@main/modules/sales/entities/debt-payment.entity";
import { Repository } from "typeorm";
// import { Shift as SharedShift } from "@shared/types/models";

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

    async getShiftSales(shiftId: string): Promise<SaleEntity[]> {
        return this.saleRepository.find({
            where: { shift_id: shiftId }
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
            initial_cash: initialCash,
            start_time: new Date(),
            status: 'open'
        });

        return this.shiftRepository.save(shift);
    }

    async closeShift(shiftId: string, finalCash: number): Promise<ShiftEntity> {
        const shift = await this.shiftRepository.findOneBy({ id: shiftId });
        if (!shift) {
            throw new Error("Shift not found");
        }

        if (shift.status === 'closed') {
            throw new Error("El turno ya está cerrado");
        }

        // Calculate expected cash from cash sales
        const sales = await this.saleRepository.find({
            where: { shift_id: shiftId }
        });

        const totalSalesCash = sales
            .filter(s => s.payment_method === 'cash')
            .reduce((sum, s) => sum + Number(s.total_amount), 0);

        // Also include cash debt payments received during this shift
        const debtPayments = await this.debtPaymentRepository.find({
            where: { shift_id: shiftId }
        });
        const totalDebtCash = debtPayments
            .filter(p => p.payment_method === 'cash')
            .reduce((sum, p) => sum + Number(p.amount), 0);

        const expectedCash = Number(shift.initial_cash) + totalSalesCash + totalDebtCash;
        
        shift.final_cash = finalCash;
        shift.expected_cash = expectedCash;
        shift.difference = finalCash - expectedCash;
        shift.end_time = new Date();
        shift.status = 'closed';


        return this.shiftRepository.save(shift);
    }

    async getShiftsHistory(userId?: string): Promise<any[]> {
        const query = this.shiftRepository.createQueryBuilder("shift")
            .leftJoinAndSelect("shift.user", "user")
            .leftJoinAndSelect("shift.sales", "sales")
            .orderBy("shift.start_time", "DESC")
            .addOrderBy("sales.created_at", "DESC");

        if (userId) {
            query.where("shift.user_id = :userId", { userId });
        }

        const shifts = await query.getMany();

        return shifts.map(shift => ({
            ...shift,
            user_name: shift.user?.name || 'Unknown',
            sales: (shift.sales || []).map(sale => ({
                ...sale,
                sale_date: sale.created_at
            }))
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
        const shift = await this.shiftRepository.findOneBy({ id: shiftId });
        if (!shift) throw new Error("Turno no encontrado");
        if (shift.status === 'closed') throw new Error("El turno ya está cerrado");

        const sales = await this.saleRepository.find({ where: { shift_id: shiftId } });
        const totalSalesCash = sales
            .filter(s => s.payment_method === 'cash')
            .reduce((sum, s) => sum + Number(s.total_amount), 0);

        const debtPaymentsCash = await this.debtPaymentRepository.find({ where: { shift_id: shiftId } });
        const totalDebtCash = debtPaymentsCash
            .filter(p => p.payment_method === 'cash')
            .reduce((sum, p) => sum + Number(p.amount), 0);

        const expectedCash = Number(shift.initial_cash) + totalSalesCash + totalDebtCash;

        shift.final_cash = finalCash;
        shift.expected_cash = expectedCash;
        shift.difference = finalCash - expectedCash;
        shift.end_time = new Date();
        shift.status = 'closed';
        shift.force_closed = true;
        shift.force_closed_by = adminId;
        shift.force_close_reason = reason;

        return this.shiftRepository.save(shift);
    }
}
