import { AppDataSource } from "@main/config/data-source";
import { Category as CategoryEntity } from "@main/modules/categories/entities/category.entity";
import { Product as ProductEntity } from "@main/modules/products/entities/product.entity";
import { Repository } from "typeorm";

export class CategoriesService {
    private categoryRepository: Repository<CategoryEntity>;
    private productRepository: Repository<ProductEntity>;

    constructor() {
        this.categoryRepository = AppDataSource.getRepository(CategoryEntity);
        this.productRepository = AppDataSource.getRepository(ProductEntity);
    }

    async findAll(): Promise<CategoryEntity[]> {
        return this.categoryRepository.find({
            order: { name: 'ASC' }
        });
    }

    async findAllWithCount(): Promise<any[]> {
        // Using QueryBuilder to match the original raw SQL logic efficiently
        return this.categoryRepository.createQueryBuilder("category")
            .leftJoinAndSelect("category.products", "product")
            .loadRelationCountAndMap("category.product_count", "category.products")
            .orderBy("category.name", "ASC")
            .getMany();
    }

    async findById(id: string): Promise<CategoryEntity | null> {
        return this.categoryRepository.findOneBy({ id });
    }

    async create(name: string): Promise<CategoryEntity> {
        const trimmedName = name.trim();
        if (!trimmedName) {
            throw new Error("Category name cannot be empty");
        }

        // Case-insensitive check (SQLite is case-insensitive by default in LIKE but let's be explicit if needed or rely on collation)
        // In TypeORM with SQLite, simple findOne might be adventurous with case, but let's use a standard simplified approach first.
        // Case-insensitive duplicate check using LOWER() for SQLite
        
        // For now, let's stick to exact match or handle it via a manual check if needed, but the original used LOWER.
        // Let's implement the LOWER check properly.
        const existingCaseInsensitive = await this.categoryRepository.createQueryBuilder("category")
            .where("LOWER(category.name) = LOWER(:name)", { name: trimmedName })
            .getOne();

        if (existingCaseInsensitive) {
            throw new Error("Category with this name already exists");
        }

        const category = this.categoryRepository.create({ name: trimmedName });
        return this.categoryRepository.save(category);
    }

    async update(id: string, name: string): Promise<CategoryEntity> {
        const trimmedName = name.trim();
        if (!trimmedName) {
            throw new Error("Category name cannot be empty");
        }

        const category = await this.findById(id);
        if (!category) {
            throw new Error("Category not found");
        }

        const existingCaseInsensitive = await this.categoryRepository.createQueryBuilder("category")
            .where("LOWER(category.name) = LOWER(:name)", { name: trimmedName })
            .andWhere("category.id != :id", { id })
            .getOne();

        if (existingCaseInsensitive) {
            throw new Error("Category with this name already exists");
        }

        category.name = trimmedName;
        return this.categoryRepository.save(category);
    }

    async delete(id: string): Promise<void> {
        const count = await this.productRepository.count({ where: { category_id: id } });
        if (count > 0) {
            throw new Error(`Cannot delete category because ${count} product(s) are using it.`);
        }

        const result = await this.categoryRepository.delete(id);
        if (result.affected === 0) {
            throw new Error("Category not found");
        }
    }
}
