import { AppDataSource } from "@main/config/data-source";
import { stockMovementsService } from "./stock-movements.service";
import { Product as ProductEntity } from "@main/modules/products/entities/product.entity";
import { ProductBarcode as ProductBarcodeEntity } from "@main/modules/products/entities/product-barcode.entity";
import { SaleItem as SaleItemEntity } from "@main/modules/sales/entities/sale-item.entity";
import { PurchaseItem as PurchaseItemEntity } from "@main/modules/suppliers/entities/purchase.entity";
import { imagesService } from "@main/shared/services/images.service";
import { In, IsNull, Not, Repository } from "typeorm";

interface ProductQueryOptions {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    /** 'low' = stock <= min_stock (and > 0), 'out' = stock 0 */
    stockFilter?: 'all' | 'low' | 'out';
    /** true = carpeta de archivados; por defecto solo productos activos. */
    archived?: boolean;
}

const MAX_CODE_LENGTH = 64;

export class ProductsService {
    private productRepository: Repository<ProductEntity>;
    private saleItemRepository: Repository<SaleItemEntity>;
    private barcodeRepository: Repository<ProductBarcodeEntity>;
    private purchaseItemRepository: Repository<PurchaseItemEntity>;

    constructor() {
        this.productRepository = AppDataSource.getRepository(ProductEntity);
        this.saleItemRepository = AppDataSource.getRepository(SaleItemEntity);
        this.barcodeRepository = AppDataSource.getRepository(ProductBarcodeEntity);
        this.purchaseItemRepository = AppDataSource.getRepository(PurchaseItemEntity);
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
            .leftJoinAndSelect("product.category", "category")
            .leftJoinAndSelect("product.barcodes", "barcodes");

        queryBuilder.andWhere(options.archived ? "product.archived_at IS NOT NULL" : "product.archived_at IS NULL");

        if (search) {
            queryBuilder.andWhere(
                "(product.name LIKE :search OR product.sku LIKE :search OR product.barcode LIKE :search"
                + " OR EXISTS (SELECT 1 FROM product_barcodes pb WHERE pb.product_id = product.id AND pb.code LIKE :search))",
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
        const allowedSort = ['name', 'sale_price', 'stock', 'created_at', 'updated_at', 'archived_at'];
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

        // Archivados: la UI necesita saber cuáles se pueden borrar definitivamente
        // (solo los que nunca tuvieron ventas ni compras). Una consulta por página.
        if (options.archived && products.length > 0) {
            const used = await this.getIdsWithHistory(products.map(p => p.id));
            for (const p of products) (p as any).has_sales = used.has(p.id);
        }

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
        return this.productRepository.findOne({ where: { id }, relations: ['barcodes'] });
    }

    /** Ids (de los dados) que aparecen en ventas o compras — no se pueden borrar definitivamente. */
    private async getIdsWithHistory(ids: string[]): Promise<Set<string>> {
        if (ids.length === 0) return new Set();
        const [sold, bought] = await Promise.all([
            this.saleItemRepository.createQueryBuilder('si')
                .select('DISTINCT si.product_id', 'product_id')
                .where({ product_id: In(ids) }).getRawMany(),
            this.purchaseItemRepository.createQueryBuilder('pi')
                .select('DISTINCT pi.product_id', 'product_id')
                .where({ product_id: In(ids) }).getRawMany(),
        ]);
        return new Set([...sold, ...bought].map((r: { product_id: string }) => r.product_id));
    }

    /**
     * Normaliza los códigos adicionales de un payload no confiable: recorta,
     * descarta vacíos y repetidos (también contra barcode/sku del mismo producto).
     * undefined = el payload no los trae → no se tocan.
     */
    private normalizeExtraBarcodes(raw: unknown, own: Array<string | null | undefined>): string[] | undefined {
        if (raw === undefined) return undefined;
        if (!Array.isArray(raw)) throw new Error("Códigos de barras adicionales inválidos");
        const seen = new Set(own.filter((c): c is string => !!c));
        const result: string[] = [];
        for (const item of raw) {
            if (typeof item !== 'string' && typeof item !== 'number') throw new Error("Códigos de barras adicionales inválidos");
            const code = String(item).trim();
            if (!code || seen.has(code)) continue;
            if (code.length > MAX_CODE_LENGTH) throw new Error(`El código "${code.slice(0, 20)}…" es demasiado largo`);
            seen.add(code);
            result.push(code);
        }
        return result;
    }

    /** Producto ACTIVO (distinto de selfId) que ya usa el código en barcode, sku o códigos adicionales. */
    private async findCodeOwner(code: string, selfId: string | null): Promise<ProductEntity | null> {
        const qb = this.productRepository.createQueryBuilder('p')
            .where('p.archived_at IS NULL')
            .andWhere(
                '(p.sku = :code OR p.barcode = :code'
                + ' OR EXISTS (SELECT 1 FROM product_barcodes pb WHERE pb.product_id = p.id AND pb.code = :code))',
                { code }
            );
        if (selfId) qb.andWhere('p.id != :selfId', { selfId });
        return qb.getOne();
    }

    /**
     * SKU, código de barras y códigos adicionales deben ser únicos entre TODOS
     * los productos activos (y entre sí): el escáner del POS busca por
     * cualquiera de ellos y un código repetido devolvería dos productos
     * distintos. Los archivados no cuentan — su choque se valida al restaurar.
     */
    private async assertCodesUnique(
        data: { sku?: unknown; barcode?: unknown },
        selfId: string | null,
        extraBarcodes: string[] = []
    ): Promise<void> {
        const codes: Array<{ label: string; value: string }> = [];
        for (const field of ['sku', 'barcode'] as const) {
            const raw = data[field];
            if (typeof raw !== 'string') continue;
            const value = raw.trim();
            (data as any)[field] = value || null;
            if (value) codes.push({ label: field === 'sku' ? 'SKU / código' : 'código de barras', value });
        }
        if (codes.length === 2 && codes[0].value === codes[1].value) {
            throw new Error("El SKU y el código de barras no pueden ser iguales");
        }
        for (const value of extraBarcodes) codes.push({ label: 'código de barras', value });

        for (const { label, value } of codes) {
            const clash = await this.findCodeOwner(value, selfId);
            if (clash) {
                throw new Error(`El ${label} "${value}" ya está en uso por "${clash.name}"`);
            }
        }
    }

    /** Reemplaza el set completo de códigos adicionales de un producto. */
    private async replaceExtraBarcodes(productId: string, codes: string[]): Promise<void> {
        const current = await this.barcodeRepository.find({ where: { product_id: productId } });
        const wanted = new Set(codes);
        const stale = current.filter(b => !wanted.has(b.code));
        if (stale.length > 0) await this.barcodeRepository.delete({ id: In(stale.map(b => b.id)) });
        const existing = new Set(current.map(b => b.code));
        const fresh = codes.filter(code => !existing.has(code));
        if (fresh.length > 0) {
            await this.barcodeRepository.save(fresh.map(code => this.barcodeRepository.create({ product_id: productId, code })));
        }
    }

    async create(productData: Partial<ProductEntity>): Promise<ProductEntity> {
        const data = this.pickEditableFields(productData);

        if (typeof data.name !== 'string' || !data.name.trim()) {
            throw new Error("El nombre del producto es requerido");
        }
        data.name = data.name.trim();
        this.validateNumericFields(data);
        // assertCodesUnique normaliza barcode/sku; los adicionales se depuran contra ellos después
        let extraBarcodes = this.normalizeExtraBarcodes((productData as any).extra_barcodes, []) ?? [];
        await this.assertCodesUnique(data, null, extraBarcodes);
        extraBarcodes = extraBarcodes.filter(code => code !== data.barcode && code !== data.sku);

        if (data.image !== undefined) {
            data.image = this.processIncomingImage(data.image, null);
        }

        await this.validateVariantLink(data, null);

        const product = this.productRepository.create(data as Partial<ProductEntity>);
        const saved = await this.productRepository.save(product);
        if (extraBarcodes.length > 0) await this.replaceExtraBarcodes(saved.id, extraBarcodes);

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
        if (current.archived_at) throw new Error("El producto está archivado: restáuralo antes de editarlo");

        const dataToUpdate = this.pickEditableFields(productData);

        if (dataToUpdate.name !== undefined) {
            if (typeof dataToUpdate.name !== 'string' || !dataToUpdate.name.trim()) {
                throw new Error("El nombre del producto es requerido");
            }
            dataToUpdate.name = dataToUpdate.name.trim();
        }
        this.validateNumericFields(dataToUpdate);
        const incomingExtras = this.normalizeExtraBarcodes((productData as any).extra_barcodes, []);
        await this.assertCodesUnique(dataToUpdate, id, incomingExtras ?? []);

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

        if (Object.keys(dataToUpdate).length === 0 && incomingExtras === undefined) return current;

        if (dataToUpdate.parent_product_id !== undefined) {
            await this.validateVariantLink(dataToUpdate, id);
        }

        if (Object.keys(dataToUpdate).length > 0) {
            await this.productRepository.update({ id }, dataToUpdate);
        }

        // Códigos adicionales: nunca duplican el barcode/sku vigente del propio
        // producto (p. ej. al promover un código adicional a principal).
        const codesTouched = incomingExtras !== undefined || dataToUpdate.barcode !== undefined || dataToUpdate.sku !== undefined;
        if (codesTouched) {
            const barcode = dataToUpdate.barcode !== undefined ? dataToUpdate.barcode : current.barcode;
            const sku = dataToUpdate.sku !== undefined ? dataToUpdate.sku : current.sku;
            const base = incomingExtras
                ?? (await this.barcodeRepository.find({ where: { product_id: id } })).map(b => b.code);
            await this.replaceExtraBarcodes(id, base.filter(code => code !== barcode && code !== sku));
        }

        const updated = await this.productRepository.findOne({ where: { id }, relations: ['barcodes'] });
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
            where: { parent_product_id: productId, archived_at: IsNull() },
            relations: ['barcodes'],
            order: { variant_name: 'ASC', name: 'ASC' },
        });
    }

    /**
     * Borrado lógico: el producto sale de inventario, POS y escáner pero se
     * conserva (con su historial de ventas y kardex) en la carpeta de
     * archivados, desde donde se puede restaurar o borrar definitivamente.
     */
    async archive(id: string): Promise<ProductEntity> {
        if (id === undefined || id === null) throw new Error("ID requerido para archivar");

        const product = await this.productRepository.findOneBy({ id });
        if (!product) throw new Error("Producto no encontrado");
        if (product.archived_at) return product;

        // Un padre con presentaciones activas no se archiva — primero sus presentaciones
        const variantCount = await this.productRepository.count({
            where: { parent_product_id: id, archived_at: IsNull() },
        });
        if (variantCount > 0) {
            throw new Error("No se puede archivar: el producto tiene presentaciones activas. Archívalas primero.");
        }

        product.archived_at = new Date();
        await this.productRepository.update({ id }, { archived_at: product.archived_at });
        return product;
    }

    /** Devuelve un producto archivado al inventario activo. */
    async restore(id: string): Promise<ProductEntity> {
        if (!id) throw new Error("ID requerido para restaurar");

        const product = await this.productRepository.findOne({ where: { id }, relations: ['barcodes'] });
        if (!product) throw new Error("Producto no encontrado");
        if (!product.archived_at) return product;

        // Mientras estuvo archivado, otro producto pudo tomar alguno de sus códigos
        const codes = [product.barcode, product.sku, ...(product.barcodes ?? []).map(b => b.code)]
            .filter((c): c is string => !!c);
        for (const code of codes) {
            const clash = await this.findCodeOwner(code, id);
            if (clash) {
                throw new Error(`No se puede restaurar: el código "${code}" ahora lo usa "${clash.name}". Cámbialo en ese producto primero.`);
            }
        }

        if (product.parent_product_id) {
            const parent = await this.productRepository.findOneBy({ id: product.parent_product_id });
            if (parent?.archived_at) {
                throw new Error(`No se puede restaurar: su producto principal "${parent.name}" está archivado. Restáuralo primero.`);
            }
        }

        await this.productRepository.update({ id }, { archived_at: null });
        product.archived_at = null;
        return product;
    }

    /**
     * Borrado DEFINITIVO — solo desde la carpeta de archivados y solo si el
     * producto nunca se vendió ni se compró (su historial debe sobrevivir).
     */
    async deletePermanently(id: string): Promise<ProductEntity> {
        if (!id) throw new Error("ID requerido para eliminar");

        const product = await this.productRepository.findOneBy({ id });
        if (!product) throw new Error("Producto no encontrado");
        if (!product.archived_at) {
            throw new Error("Solo se pueden eliminar definitivamente productos archivados");
        }

        const variantCount = await this.productRepository.count({ where: { parent_product_id: id } });
        if (variantCount > 0) {
            throw new Error("No se puede eliminar: el producto tiene presentaciones. Elimínalas primero.");
        }

        const salesCount = await this.saleItemRepository.count({ where: { product_id: id } });
        if (salesCount > 0) {
            throw new Error("No se puede eliminar definitivamente: el producto tiene ventas asociadas");
        }
        const purchaseCount = await this.purchaseItemRepository.count({ where: { product_id: id } });
        if (purchaseCount > 0) {
            throw new Error("No se puede eliminar definitivamente: el producto tiene compras a proveedores asociadas");
        }

        await this.productRepository.delete({ id });

        // Clean up the image file on disk (no-op for legacy/absent images)
        if (product.image) imagesService.deleteImage(product.image);
        return product;
    }

    async countArchived(): Promise<number> {
        return this.productRepository.count({ where: { archived_at: Not(IsNull()) } });
    }

    /** Exact barcode/SKU lookup for the POS scanner (incluye códigos adicionales; ignora archivados). */
    async findByCode(code: string): Promise<ProductEntity | null> {
        const trimmed = String(code ?? '').trim();
        if (!trimmed) return null;
        return this.productRepository.createQueryBuilder('product')
            .leftJoinAndSelect('product.category', 'category')
            .where('product.archived_at IS NULL')
            .andWhere(
                '(product.barcode = :code OR product.sku = :code'
                + ' OR EXISTS (SELECT 1 FROM product_barcodes pb WHERE pb.product_id = product.id AND pb.code = :code))',
                { code: trimmed }
            )
            .getOne();
    }

    async getLowStock(limit: number = 5): Promise<ProductEntity[]> {
        return this.productRepository.createQueryBuilder("product")
            // Agotados también son "atención a reposición" (cuadra con la tarjeta de alertas)
            .where("product.stock <= product.min_stock")
            .andWhere("product.archived_at IS NULL")
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
            .where("p.archived_at IS NULL")
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
