import { DataSource } from "typeorm";
import { app } from "electron";
import path from "path";

import { User } from "@main/modules/users/entities/user.entity";
import { Product } from "@main/modules/products/entities/product.entity";
import { Category } from "@main/modules/categories/entities/category.entity";
import { Sale } from "@main/modules/sales/entities/sale.entity";
import { SaleItem } from "@main/modules/sales/entities/sale-item.entity";
import { DebtPayment } from "@main/modules/sales/entities/debt-payment.entity";
import { Shift } from "@main/modules/shifts/entities/shift.entity";
import { ShiftExpense } from "@main/modules/shifts/entities/shift-expense.entity";
import { Setting } from "@main/modules/settings/entities/setting.entity";
import { Customer } from "@main/modules/customers/entities/customer.entity";
import { Role } from "@main/modules/users/entities/role.entity";
import { AuditLog } from "@main/modules/audit/entities/audit-log.entity";

const isDev = process.env.NODE_ENV === 'development';
const dbPath = path.join(app.getPath('userData'), 'database.sqlite');

export const AppDataSource = new DataSource({
    type: "sqlite",
    database: dbPath,
    synchronize: true, // Auto-create tables (dev only ideally, but good for MVP)
    logging: isDev,
    entities: [
        User,
        Role,
        Product,
        Category,
        Sale,
        SaleItem,
        DebtPayment,
        Shift,
        ShiftExpense,
        Setting,
        Customer,
        AuditLog,
    ],
    migrations: [],
    subscribers: [],
});
