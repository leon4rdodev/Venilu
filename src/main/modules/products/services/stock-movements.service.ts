import { AppDataSource } from "@main/config/data-source";
import { EntityManager } from "typeorm";
import { StockMovement } from "@main/modules/products/entities/stock-movement.entity";
import { getSessionUser } from "@main/shared/session";

export interface MovementInput {
    product_id: string;
    type: StockMovement['type'];
    quantity_delta: number;
    stock_after: number;
    reference?: string;
    note?: string;
}

export class StockMovementsService {

    /**
     * Records one kardex entry. Pass the transaction's EntityManager when the
     * stock change happens inside a transaction (sales/voids) so the movement
     * commits or rolls back with it; omit it for standalone changes.
     */
    async record(input: MovementInput, manager?: EntityManager): Promise<void> {
        const em = manager ?? AppDataSource.manager;
        const session = getSessionUser();
        const movement = em.create(StockMovement, {
            ...input,
            user_id: session?.id,
            username: session?.username,
        });
        await em.save(StockMovement, movement);
    }

    /** Paginated kardex for one product, newest first. */
    async listByProduct(productId: string, page = 1, pageSize = 15) {
        const safePage = Math.max(1, Number(page) || 1);
        const safeSize = Math.min(50, Math.max(1, Number(pageSize) || 15));

        // created_at has second resolution in SQLite, so a multi-line sale
        // produces identical timestamps — rowid breaks the tie by insert order.
        const [items, total] = await AppDataSource.getRepository(StockMovement)
            .createQueryBuilder('movement')
            .where('movement.product_id = :productId', { productId })
            .orderBy('movement.created_at', 'DESC')
            .addOrderBy('movement.rowid', 'DESC')
            .skip((safePage - 1) * safeSize)
            .take(safeSize)
            .getManyAndCount();

        return {
            items,
            total,
            page: safePage,
            pageSize: safeSize,
            totalPages: Math.max(1, Math.ceil(total / safeSize)),
        };
    }
}

export const stockMovementsService = new StockMovementsService();
