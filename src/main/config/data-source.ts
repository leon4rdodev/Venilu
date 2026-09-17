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
import { StockMovement } from "@main/modules/products/entities/stock-movement.entity";
import { InitialSchema1756150000000 } from "@main/migrations/1756150000000-InitialSchema";
import { DebtPaymentRefunds1756250000000 } from "@main/migrations/1756250000000-DebtPaymentRefunds";
import { LicenseTrial1756350000000 } from "@main/migrations/1756350000000-LicenseTrial";
import { FiscalNcf1756450000000 } from "@main/migrations/1756450000000-FiscalNcf";
import { NcfSequence } from "@main/modules/fiscal/entities/ncf-sequence.entity";
import { SaleReturn, SaleReturnItem } from "@main/modules/sales/entities/sale-return.entity";
import { SaleReturns1756550000000 } from "@main/migrations/1756550000000-SaleReturns";
import { ProductVariants1756650000000 } from "@main/migrations/1756650000000-ProductVariants";
import { SaleVoidedAt1756750000000 } from "@main/migrations/1756750000000-SaleVoidedAt";
import { Suppliers1756850000000 } from "@main/migrations/1756850000000-Suppliers";
import { LicenseClockGuard1756950000000 } from "@main/migrations/1756950000000-LicenseClockGuard";
import { Supplier } from "@main/modules/suppliers/entities/supplier.entity";
import { Purchase, PurchaseItem } from "@main/modules/suppliers/entities/purchase.entity";
import { SupplierPayment } from "@main/modules/suppliers/entities/supplier-payment.entity";

const isDev = process.env.NODE_ENV === 'development';
const dbPath = path.join(app.getPath('userData'), 'database.sqlite');

export const AppDataSource = new DataSource({
    type: "sqlite",
    database: dbPath,
    // Schema is managed by MIGRATIONS (run at boot via runMigrationsWithBaseline).
    // synchronize stays OFF: on customer installs it could silently alter or
    // drop columns. Every schema change must ship as a new migration file.
    synchronize: false,
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
        StockMovement,
        NcfSequence,
        SaleReturn,
        SaleReturnItem,
        Supplier,
        Purchase,
        PurchaseItem,
        SupplierPayment,
    ],
    migrations: [InitialSchema1756150000000, DebtPaymentRefunds1756250000000, LicenseTrial1756350000000, FiscalNcf1756450000000, SaleReturns1756550000000, ProductVariants1756650000000, SaleVoidedAt1756750000000, Suppliers1756850000000, LicenseClockGuard1756950000000],
    migrationsTableName: "migrations",
    subscribers: [],
});
