import { AppDataSource } from "@main/config/data-source";
import { stockMovementsService } from "./stock-movements.service";
import { Product as ProductEntity } from "@main/modules/products/entities/product.entity";
import { SaleItem as SaleItemEntity } from "@main/modules/sales/entities/sale-item.entity";
import { imagesService } from "@main/shared/services/images.service";
import { Repository } from "typeorm";

interface ProductQueryOptions {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    /** 'low' = stock <= min_stock (and > 0), 'out' = stock 0 */
    stockFilter?: 'all' | 'low' | 'out';
}

export class ProductsService {
    private productRepository: Repository<ProductEntity>;
    private saleItemRepository: Repository<SaleItemEntity>;

    constructor() {
        this.productRepository = AppDataSource.getRepository(ProductEntity);
        this.saleItemRepository = AppDataSource.getRepository(SaleItemEntity);
    }

    async findAll(options: ProductQueryOptions = {}) {
        const {
            page = 1,
            pageSize = 10,
            search = '',
            category = 'all',
            sortBy = 'name',
            sortOrder = 'ASC'
        } = options;

        const take = Math.min(100, Math.max(10, pageSize));
        const skip = (Math.max(1, page) - 1) * take;

        const queryBuilder = this.productRepository.createQueryBuilder("product")
            .leftJoinAndSelect("product.category", "category");

        if (search) {
            queryBuilder.andWhere(
                "(product.name LIKE :search OR product.sku LIKE :search OR product.barcode LIKE :search)",
                { search: `%${search}%` }
            );
        }

        if (category && category !== 'all') {
            queryBuilder.andWhere("product.category_id = :category", { category });
        }

        if (options.stockFilter === 'out') {
            queryBuilder.andWhere("product.stock = 0");
        } else if (options.stockFilter === 'low') {
            queryBuilder.andWhere("product.stock > 0 AND product.stock <= product.min_stock");
        }

        // Validate Sort By to prevent SQL injection or errors (allowlist)
        const allowedSort = ['name', 'sale_price', 'stock', 'created_at', 'updated_at'];
        const sortField = allowedSort.includes(sortBy) ? `product.${sortBy}` : 'product.name';
        
        // Handle special case if sorting by category name (joined column)
        if (sortBy === 'category') {
            queryBuilder.orderBy("category.name", sortOrder);
        } else {
            queryBuilder.orderBy(sortField, sortOrder);
        }

        // Get count and data
        const [products, total] = await queryBuilder
            .take(take)
            .skip(skip)
            .getManyAndCount();

        // Map has_sales manually if needed, or check on delete.
        // The original code did a subquery for `has_sales` for the listing.
        // We can replicate that if needed for UI disabling, but skipping for now unless explicit requirement.
        // Actually, the UI might toggle delete button based on this. Let's add it properly if we can,
        // or just let the delete fail with an error message (which is handled in `delete` method).

        return {
            products,
            pagination: {
                currentPage: page,
                pageSize: take,
                totalItems: total,
                totalPages: Math.ceil(total / take),
                hasNextPage: page < Math.ceil(total / take),
                hasPreviousPage: page > 1
            }
        };
    }

    async getForPOS(options: ProductQueryOptions = {}) {
        // Similar to findAll but might return a simplified object or include stock status
        const result = await this.findAll({ ...options, pageSize: options.pageSize || 40 });
        
        const productsWithStatus = result.products.map(p => {
             let stockStatus = 'in_stock';
             if (p.stock === 0) stockStatus = 'out_of_stock';
             // Assuming min_stock isn't in entity yet, if it was: else if (p.stock <= p.min_stock) stockStatus = 'low_stock';
             
             return {
                 ...p,
                 stock_status: stockStatus
             };
        });

        return {
            ...result,
            products: productsWithStatus
        };
    }

    /** Coerces and validates numeric product fields from an untrusted payload. */
    private validateNumericFields(data: any): void {
        if (data.sale_price !== undefined) {
            data.sale_price = Number(data.sale_price);
            if (!Number.isFinite(data.sale_price) || data.sale_price < 0) throw new Error("Precio de venta inválido");
        }
        if (data.cost_price !== undefined) {
            data.cost_price = Number(data.cost_price);
            if (!Number.isFinite(data.cost_price) || data.cost_price < 0) throw new Error("Precio de compra inválido");
        }
        if (data.stock !== undefined) {
            data.stock = Number(data.stock);
            if (!Number.isInteger(data.stock) || data.stock < 0) throw new Error("Stock inválido");
        }
        if (data.min_stock !== undefined) {
            data.min_stock = Number(data.min_stock);
            if (!Number.isInteger(data.min_stock) || data.min_stock < 0) throw new Error("Stock mínimo inválido");
        }
    }

    /** Whitelists editable fields — never accepts id/timestamps/relations. */
    private pickEditableFields(productData: Partial<ProductEntity>): any {
        const { name, description, sale_price, cost_price, stock, min_stock, barcode, sku, image, category_id, itbis_exempt, parent_product_id, variant_name } =
            productData as any;
        const data: any = { name, description, sale_price, cost_price, stock, min_stock, barcode, sku, image, category_id, parent_product_id, variant_name };
        if (itbis_exempt !== undefined) data.itbis_exempt = Boolean(itbis_exempt);
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

        // Convert empty string category_id to null to satisfy foreign key constraint
        if (data.category_id === "") {
            data.category_id = null;
        }
        return data;
    }

    /**
     * Turns an incoming image value into a stored file name.
     * - data URL (already WebP-compressed by the renderer) → saved to disk
     * - existing managed file name → kept as-is
     * - null/'' → cleared (old file deleted)
     * The DB only ever stores the file name — never image bytes.
     */
    private processIncomingImage(value: unknown, currentFileName: string | null): string | null {
        if (value === null || value === '') {
            imagesService.deleteImage(currentFileName);
            return null;
        }
        if (typeof value === 'string' && value.startsWith('data:image/')) {
            const fileName = imagesService.saveFromDataUrl(value);
            if (currentFileName && currentFileName !== fileName) {
                imagesService.deleteImage(currentFileName);
            }
            return fileName;
        }
        if (imagesService.isManagedFileName(value)) {
            return value;
        }
        throw new Error("Imagen de producto inválida");
    }

    async getById(id: string): Promise<ProductEntity | null> {
        if (!id) return null;
        return this.productRepository.findOneBy({ id });
    }

    /**
     * SKU y código de barras deben ser únicos entre TODOS los productos (y
     * entre ambos campos): el escáner del POS busca por cualquiera de los dos
     * y un código repetido devolvería dos productos distintos.
     */
    private async assertCodesUnique(data: { sku?: unknown; barcode?: unknown }, selfId: string | null): Promise<void> {
        const codes: Array<{ field: 'sku' | 'barcode'; value: string }> = [];
        for (const field of ['sku', 'barcode'] as const) {
            const raw = data[field];
            if (typeof raw !== 'string') continue;
            const value = raw.trim();
            (data as any)[field] = value || null;
            if (value) codes.push({ field, value });
        }
        for (const { field, value } of codes) {
            const qb = this.productRepository.createQueryBuilder('p')
                .where('(p.sku = :value OR p.barcode = :value)', { value });
            if (selfId) qb.andWhere('p.id != :selfId', { selfId });
            const clash = await qb.getOne();
            if (clash) {
                const label = field === 'sku' ? 'SKU / código' : 'código de barras';
                throw new Error(`El ${label} "${value}" ya está en uso por "${clash.name}"`);
            }
        }
    }

    async create(productData: Partial<ProductEntity>): Promise<ProductEntity> {
        const data = this.pickEditableFields(productData);

        if (typeof data.name !== 'string' || !data.name.trim()) {
            throw new Error("El nombre del producto es requerido");
        }
        data.name = data.name.trim();
        this.validateNumericFields(data);
        await this.assertCodesUnique(data, null);

        if (data.image !== undefined) {
            data.image = this.processIncomingImage(data.image, null);
        }

        await this.validateVariantLink(data, null);

        const product = this.productRepository.create(data as Partial<ProductEntity>);
        const saved = await this.productRepository.save(product);

        // Kardex: opening stock
        if (Number(saved.stock) > 0) {
            await stockMovementsService.record({
                product_id: saved.id,
                type: 'initial',
                quantity_delta: Number(saved.stock),
                stock_after: Number(saved.stock),
                note: 'Stock inicial',
            });
        }
        return saved;
    }

    async update(
        id: string,
        productData: Partial<ProductEntity>,
        opts: { canEditPrice?: boolean; canAdjustStock?: boolean } = { canEditPrice: true, canAdjustStock: true }
    ): Promise<ProductEntity> {
        if (!id) {
            throw new Error("Se requiere un ID de producto para actualizar");
        }

        const current = await this.productRepository.findOneBy({ id });
        if (!current) throw new Error("Producto no encontrado");

        const dataToUpdate = this.pickEditableFields(productData);

        if (dataToUpdate.name !== undefined) {
            if (typeof dataToUpdate.name !== 'string' || !dataToUpdate.name.trim()) {
                throw new Error("El nombre del producto es requerido");
            }
            dataToUpdate.name = dataToUpdate.name.trim();
        }
        this.validateNumericFields(dataToUpdate);
        await this.assertCodesUnique(dataToUpdate, id);

        if (dataToUpdate.image !== undefined) {
            dataToUpdate.image = this.processIncomingImage(dataToUpdate.image, current.image ?? null);
        }

        // Permission-gated fields: only enforced when the value actually
        // changes, so edit dialogs may resend unchanged values freely.
        const changedPrice =
            (dataToUpdate.sale_price !== undefined && dataToUpdate.sale_price !== Number(current.sale_price)) ||
            (dataToUpdate.cost_price !== undefined && dataToUpdate.cost_price !== Number(current.cost_price));
        if (changedPrice && !opts.canEditPrice) {
            throw new Error("Sin permiso para modificar precios");
        }
        if (!opts.canEditPrice) {
            delete dataToUpdate.sale_price;
            delete dataToUpdate.cost_price;
        }

        const changedStock = dataToUpdate.stock !== undefined && dataToUpdate.stock !== Number(current.stock);
        if (changedStock && !opts.canAdjustStock) {
            throw new Error("Sin permiso para ajustar el stock");
        }
        if (!opts.canAdjustStock) {
            delete dataToUpdate.stock;
        }

        if (Object.keys(dataToUpdate).length === 0) return current;

        if (dataToUpdate.parent_product_id !== undefined) {
            await this.validateVariantLink(dataToUpdate, id);
        }

        await this.productRepository.update({ id }, dataToUpdate);
        const updated = await this.productRepository.findOneBy({ id });
        if (!updated) throw new Error("Producto no encontrado después de la actualización");

        // Kardex: manual stock adjustment (only when the value really changed)
        if (changedStock && opts.canAdjustStock) {
            await stockMovementsService.record({
                product_id: id,
                type: 'adjustment',
                quantity_delta: Number(updated.stock) - Number(current.stock),
                stock_after: Number(updated.stock),
                note: 'Ajuste manual',
            });
        }
        return updated;
    }

    /**
     * Reglas de presentaciones: el padre debe existir, no puede ser una
     * presentación a su vez (un solo nivel), un producto no puede ser su
     * propio padre, y un producto CON presentaciones no puede convertirse en
     * presentación de otro.
     */
    private async validateVariantLink(data: any, selfId: string | null): Promise<void> {
        const parentId = data.parent_product_id;
        if (parentId === undefined) return;
        if (parentId === null || parentId === '') {
            data.parent_product_id = null;
            return;
        }
        if (selfId && parentId === selfId) {
            throw new Error("Un producto no puede ser presentación de sí mismo");
        }
        const parent = await this.productRepository.findOneBy({ id: parentId });
        if (!parent) throw new Error("El producto padre no existe");
        if (parent.parent_product_id) {
            throw new Error("Una presentación no puede tener presentaciones (elige el producto principal como padre)");
        }
        if (selfId) {
            const children = await this.productRepository.count({ where: { parent_product_id: selfId } });
            if (children > 0) {
                throw new Error("Este producto tiene presentaciones: no puede convertirse en presentación de otro");
            }
        }
        if (typeof data.variant_name === 'string') data.variant_name = data.variant_name.trim() || null;
    }

    /** Presentaciones de un producto (ordenadas por nombre de presentación). */
    async getVariants(productId: string): Promise<ProductEntity[]> {
        return this.productRepository.find({
            where: { parent_product_id: productId },
            order: { variant_name: 'ASC', name: 'ASC' },
        });
    }

    async delete(id: string): Promise<void> {
        if (id === undefined || id === null) throw new Error("ID requerido para eliminar");

        // Un padre con presentaciones no se elimina — primero sus presentaciones
        const variantCount = await this.productRepository.count({ where: { parent_product_id: id } });
        if (variantCount > 0) {
            throw new Error("No se puede eliminar: el producto tiene presentaciones. Elimínalas primero.");
        }

        // Check for sales dependencies
        const salesCount = await this.saleItemRepository.count({ where: { product_id: id } });
        if (salesCount > 0) {
            throw new Error("No se puede eliminar: el producto tiene ventas asociadas");
        }

        const product = await this.productRepository.findOneBy({ id });
        const result = await this.productRepository.delete({ id: id });
        if (result.affected === 0) {
            throw new Error("Producto no encontrado");
        }

        // Clean up the image file on disk (no-op for legacy/absent images)
        if (product?.image) imagesService.deleteImage(product.image);
    }

    /** Exact barcode/SKU lookup for the POS scanner. */
    async findByCode(code: string): Promise<ProductEntity | null> {
        const trimmed = String(code ?? '').trim();
        if (!trimmed) return null;
        return this.productRepository.createQueryBuilder('product')
            .leftJoinAndSelect('product.category', 'category')
            .where('product.barcode = :code OR product.sku = :code', { code: trimmed })
            .getOne();
    }

    async getLowStock(limit: number = 5): Promise<ProductEntity[]> {
        return this.productRepository.createQueryBuilder("product")
            // Agotados también son "atención a reposición" (cuadra con la tarjeta de alertas)
            .where("product.stock <= product.min_stock")
            .orderBy("product.stock", "ASC")
            .take(limit)
            .getMany();
    }

    async getInventoryStats() {
        const stats = await this.productRepository.createQueryBuilder("p")
            .select("COUNT(p.id)", "totalProducts")
            .addSelect("SUM(p.stock)", "totalStockUnits")
            .addSelect("SUM(p.cost_price * p.stock)", "totalStockValue")
            .addSelect("SUM(p.sale_price * p.stock)", "totalRetailValue")
            .addSelect("COUNT(CASE WHEN p.stock = 0 THEN 1 END)", "outOfStockProducts")
            .addSelect("COUNT(CASE WHEN p.stock <= p.min_stock AND p.stock > 0 THEN 1 END)", "lowStockProducts")
            .getRawOne();

        return {
            totalProducts: Number(stats.totalProducts) || 0,
            totalStockUnits: Number(stats.totalStockUnits) || 0,
            totalStockValue: Number(stats.totalStockValue) || 0,
            totalRetailValue: Number(stats.totalRetailValue) || 0,
            outOfStockProducts: Number(stats.outOfStockProducts) || 0,
            lowStockProducts: Number(stats.lowStockProducts) || 0
        };
    }
}
