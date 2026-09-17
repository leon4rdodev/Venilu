import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { Truck, Receipt } from "lucide-react";
import { SuppliersStats } from "./suppliers-stats";
import { SuppliersTable } from "./suppliers-table";
import { PurchasesTable } from "./purchases-table";

const TAB_TRIGGER_CLASS = "flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pt-1 pb-3 text-sm font-medium text-muted-foreground gap-2 shadow-none transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-foreground dark:data-[state=active]:bg-transparent";

/** Pantalla Suplidores: tarjetas + pestañas Suplidores / Compras. */
export function SuppliersInterface() {
  const [tab, setTab] = useState("suppliers");
  return (
    <div className="space-y-6">
      <SuppliersStats />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full h-auto justify-start bg-transparent p-0 gap-6 rounded-none border-b border-border">
          <TabsTrigger value="suppliers" className={TAB_TRIGGER_CLASS}><Truck className="h-4 w-4" strokeWidth={1.75} />Suplidores</TabsTrigger>
          <TabsTrigger value="purchases" className={TAB_TRIGGER_CLASS}><Receipt className="h-4 w-4" strokeWidth={1.75} />Compras</TabsTrigger>
        </TabsList>
        <TabsContent value="suppliers" className="pt-5"><SuppliersTable /></TabsContent>
        <TabsContent value="purchases" className="pt-5"><PurchasesTable /></TabsContent>
      </Tabs>
    </div>
  );
}
