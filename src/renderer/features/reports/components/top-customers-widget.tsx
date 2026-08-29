import React from "react";
import { Users } from "lucide-react";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { formatCurrency } from "@lib/currency";
import type { TopCustomer } from "../hooks/use-reports";

interface TopCustomersWidgetProps {
  topCustomers: TopCustomer[];
  loading: boolean;
}

function CustomerRowsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse py-2">
          <div className="h-4 w-6 bg-muted rounded" />
          <div className="h-8 w-8 bg-muted rounded-full shrink-0" />
          <div className="h-4 w-36 bg-muted rounded" />
          <div className="flex-1" />
          <div className="h-4 w-12 bg-muted rounded" />
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

/** Ranking de clientes por gasto total en el período, con avatar de inicial. */
export const TopCustomersWidget = React.memo(({ topCustomers, loading }: TopCustomersWidgetProps) => {
  return (
    <div className="bg-card border border-border rounded-lg p-6 h-full">
      <WidgetHeader icon={Users} title="Mejores Clientes" subtitle="Clientes con mayor gasto en el período." />

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <CustomerRowsSkeleton />
        ) : topCustomers.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="pb-2 pr-3 font-medium w-8">#</th>
                <th className="pb-2 pr-3 font-medium">Cliente</th>
                <th className="pb-2 pr-3 font-medium text-right">Compras</th>
                <th className="pb-2 pr-3 font-medium text-right">Ticket Promedio</th>
                <th className="pb-2 font-medium text-right">Total Gastado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topCustomers.map((customer, index) => (
                <tr key={customer.customerId}>
                  <td className="py-3 pr-3 text-xs font-medium text-muted-foreground tabular-nums">
                    {index + 1}
                  </td>
                  <td className="py-3 pr-3 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground text-xs font-semibold shrink-0 select-none">
                        {customer.customerName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium truncate max-w-[220px]" title={customer.customerName}>
                        {customer.customerName}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-right text-sm text-muted-foreground font-mono tabular-nums whitespace-nowrap">
                    {customer.totalTransactions}
                  </td>
                  <td className="py-3 pr-3 text-right text-sm text-muted-foreground font-mono tabular-nums whitespace-nowrap">
                    {formatCurrency(customer.averageTicket)}
                  </td>
                  <td className="py-3 text-right text-sm font-medium font-mono tabular-nums whitespace-nowrap">
                    {formatCurrency(customer.totalSpent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <Users className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Sin clientes en el período</p>
            <p className="text-xs text-muted-foreground">
              Las ventas a clientes registrados aparecerán aquí
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
