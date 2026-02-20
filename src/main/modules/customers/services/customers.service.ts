import { AppDataSource } from "@main/config/data-source";
import { Customer } from "@main/modules/customers/entities/customer.entity";
import { Repository, Like } from "typeorm";

export class CustomersService {
    private customerRepository: Repository<Customer>;

    constructor() {
        this.customerRepository = AppDataSource.getRepository(Customer);
    }

    async findAll(): Promise<Customer[]> {
        return this.customerRepository.find({
            order: { name: "ASC" },
        });
    }

    async findOne(id: string): Promise<Customer | null> {
        return this.customerRepository.findOneBy({ id });
    }

    async search(query: string): Promise<Customer[]> {
        return this.customerRepository.find({
            where: [
                { name: Like(`%${query}%`) },
                { phone: Like(`%${query}%`) },
                { email: Like(`%${query}%`) },
            ],
            order: { name: "ASC" },
        });
    }

    async create(customerData: Partial<Customer>): Promise<Customer> {
        if (!customerData.name) {
            throw new Error("El nombre del cliente es requerido");
        }

        const newCustomer = this.customerRepository.create(customerData);
        return this.customerRepository.save(newCustomer);
    }

    async update(id: string, customerData: Partial<Customer>): Promise<Customer> {
        const customer = await this.findOne(id);
        if (!customer) {
            throw new Error("Cliente no encontrado");
        }

        this.customerRepository.merge(customer, customerData);
        return this.customerRepository.save(customer);
    }

    async delete(id: string): Promise<void> {
        const result = await this.customerRepository.delete(id);
        if (result.affected === 0) {
            throw new Error("Cliente no encontrado");
        }
    }

    async getStats(): Promise<{
        totalCustomers: number;
        newThisMonth: number;
        withEmail: number;
        withPhone: number;
    }> {
        const totalCustomers = await this.customerRepository.count();

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const newThisMonth = await this.customerRepository
            .createQueryBuilder("customer")
            .where("customer.created_at >= :startOfMonth", { startOfMonth })
            .getCount();

        const withEmail = await this.customerRepository
            .createQueryBuilder("customer")
            .where("customer.email IS NOT NULL AND customer.email != ''")
            .getCount();

        const withPhone = await this.customerRepository
            .createQueryBuilder("customer")
            .where("customer.phone IS NOT NULL AND customer.phone != ''")
            .getCount();

        return { totalCustomers, newThisMonth, withEmail, withPhone };
    }
}
