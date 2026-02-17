

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface FinancialSummaryProps {
  loading: boolean;
}

export function FinancialSummary({ loading }: FinancialSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen Financiero</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
          {loading ? (
            <p className="text-muted-foreground">Cargando resumen financiero...</p>
          ) : (
            <p className="text-muted-foreground">Análisis financiero (placeholder)</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
