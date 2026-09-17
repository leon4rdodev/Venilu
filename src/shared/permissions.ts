/**
 * Permission registry — single source of truth for all granular permissions.
 * Shared between the Electron main process and the React renderer.
 *
 * Adding a new permission:
 *   1. Add a constant here.
 *   2. Wire it into requirePermission() calls in the relevant IPC handler.
 *   3. Use usePermission() in the renderer to conditionally render UI.
 */

export const PERMISSIONS = {
  // ─── POS ──────────────────────────────────────────────────────────────────
  /** Access and operate the point-of-sale screen */
  POS_ACCESS:        'pos:access',
  /** Open a cash shift */
  POS_OPEN_SHIFT:    'pos:open_shift',
  /** Close own cash shift */
  POS_CLOSE_SHIFT:   'pos:close_shift',
  /** Apply discounts to sales */
  POS_DISCOUNT:      'pos:apply_discount',
  /** Create credit sales */
  POS_CREDIT_SALE:   'pos:credit_sale',

  // ─── Inventory ────────────────────────────────────────────────────────────
  /** View product catalog: name, stock, sale price, SKU, barcode */
  INV_VIEW:          'inventory:view',
  /** View cost price (sensitive financial data) */
  INV_VIEW_COSTS:    'inventory:view_costs',
  /** Create new products */
  INV_CREATE:        'inventory:create',
  /** Edit basic product info: name, description, category, SKU, barcode */
  INV_EDIT:          'inventory:edit',
  /** Modify sale price */
  INV_EDIT_PRICE:    'inventory:edit_price',
  /** Manually adjust stock quantity without a sale */
  INV_ADJUST_STOCK:  'inventory:adjust_stock',
  /** Delete products */
  INV_DELETE:        'inventory:delete',
  /** Create/edit/delete categories */
  INV_CATEGORIES:    'inventory:categories',
  /** Configure minimum stock thresholds and alerts */
  INV_STOCK_ALERTS:  'inventory:stock_alerts',

  // ─── Customers ────────────────────────────────────────────────────────────
  /** View customer list and details */
  CUST_VIEW:         'customers:view',
  /** View customer balance / debt (sensitive) */
  CUST_VIEW_BALANCE: 'customers:view_balance',
  /** Create and edit customers */
  CUST_CREATE:       'customers:create',
  /** Delete customers */
  CUST_DELETE:       'customers:delete',
  /** Register debt payments */
  CUST_PAY_DEBT:     'customers:pay_debt',
  /** Modify customer credit limits */
  CUST_EDIT_LIMIT:   'customers:edit_limit',

  // ─── Suppliers & Purchases ───────────────────────────────────────────────
  /** View suppliers, purchases and accounts payable */
  SUP_VIEW:          'suppliers:view',
  /** Create, edit, deactivate and delete suppliers */
  SUP_MANAGE:        'suppliers:manage',
  /** Register purchases (stock in, cost update) */
  PUR_CREATE:        'purchases:create',
  /** Cancel a purchase (stock out) */
  PUR_CANCEL:        'purchases:cancel',
  /** Pay accounts payable to suppliers */
  SUP_PAY:           'suppliers:pay',

  // ─── Sales ────────────────────────────────────────────────────────────────
  /** View all sales history */
  SALES_VIEW:        'sales:view',
  /** Void/Cancel an existing sale and restore stock */
  SALES_VOID:        'sales:void',
  /** Process product returns */
  SALES_RETURN:      'sales:return',

  // ─── Reports ──────────────────────────────────────────────────────────────
  /** View summary metrics on the dashboard (revenue, ticket avg, top products) */
  RPT_SUMMARY:       'reports:view_summary',
  /** Access the full Reports page */
  RPT_FULL:          'reports:view_full',
  /** Export PDF reports */
  RPT_EXPORT:        'reports:export_pdf',

  // ─── Settings ─────────────────────────────────────────────────────────────
  /** View business settings */
  SET_VIEW:          'settings:view',
  /** Modify business settings */
  SET_EDIT:          'settings:edit',
  /** Upload/delete the business logo */
  SET_LOGO:          'settings:logo',
  /** Configure printer */
  SET_PRINTER:       'settings:printer',
  /** Configure tax rates and currency */
  SET_TAXES:         'settings:taxes',

  // ─── Users & Roles ────────────────────────────────────────────────────────
  /** View user list */
  USR_VIEW:          'users:view',
  /** Create/edit/delete users */
  USR_MANAGE:        'users:manage',
  /** Create/edit/delete custom roles */
  USR_ROLES:         'users:roles',

  // ─── System & Advanced ───────────────────────────────────────────────────
  /** Create/restore/delete database backups */
  BACKUPS:           'backups:manage',
  /** Force-close another user's shift */
  SHIFTS_FORCE:      'shifts:force_close',
  /** View shift history of other users */
  SHIFTS_VIEW_OTHERS: 'shifts:view_others',
  /** Manage cash expenses/withdrawals during a shift */
  SHIFTS_EXPENSES:   'shifts:manage_expenses',
  /** View system audit logs */
  AUDIT_VIEW:        'audit:view',
  /** Overwrite product prices at the moment of sale */
  POS_PRICE_OVERRIDE: 'pos:price_override',
  /** Install app updates */
  SYS_UPDATE:        'system:update',
} as const;

/** Union type of all valid permission strings */
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/** All permissions as a flat array (used to seed the Administrador role) */
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS) as Permission[];

/**
 * Default permissions assigned to the built-in "Empleado Base" role.
 * Admins can create custom roles with any combination.
 */
export const EMPLOYEE_BASE_PERMISSIONS: Permission[] = [
  PERMISSIONS.POS_ACCESS,
  PERMISSIONS.POS_OPEN_SHIFT,
  PERMISSIONS.POS_CLOSE_SHIFT,
  PERMISSIONS.INV_VIEW,
  PERMISSIONS.CUST_VIEW,
  PERMISSIONS.CUST_CREATE,
  PERMISSIONS.CUST_PAY_DEBT,
];
