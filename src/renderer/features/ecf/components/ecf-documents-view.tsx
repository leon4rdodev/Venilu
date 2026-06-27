import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { FileText, RefreshCw, CheckCircle2, XCircle, Clock, Ban } from "lucide-react";
import { useEcfDocuments } from "../hooks/use-ecf-documents";
import { EcStatus } from "@shared/types/models";
import { formatCurrency } from "@lib/currency";
import { formatDateTime } from "@lib/formatters";
import { cn } from "@lib/utils";

const STATUS_MAP: Record<EcStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", variant: "secondary" },
  sent: { label: "Enviado", variant: "outline" },
  authorized: { label: "Autorizado", variant: "default" },
  rejected: { label: "Rechazado", variant: "destructive" },
  voided: { label: "Anulado", variant: "outline" },
};

const STATUS_ICONS: Record<EcStatus, typeof Clock> = {
  pending: Clock,
  sent: Clock,
  authorized: CheckCircle2,
  rejected: XCircle,
  voided: Ban,
};

export function EcfDocumentsView() {
  const { documents, stats, loading, fetchDocuments } = useEcfDocuments();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">e-CF</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Documentos electrónicos fiscales
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDocuments} disabled={loading} className="gap-1.5">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {([
          { label: "Total", value: stats.total, color: "" },
          { label: "Autorizados", value: stats.authorized, color: "text-green-600 dark:text-green-400" },
          { label: "Pendientes", value: stats.pending, color: "text-amber-600 dark:text-amber-400" },
          { label: "Rechazados", value: stats.rejected, color: "text-destructive" },
          { label: "Anulados", value: stats.voided, color: "text-muted-foreground" },
        ] as const).map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className={cn("text-2xl font-bold tabular-nums", stat.color)}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Documentos e-CF
          </CardTitle>
          <CardDescription>
            {documents.length} documento{documents.length !== 1 ? "s" : ""} emitido{documents.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">NCF</TableHead>
                  <TableHead className="font-semibold">Cliente</TableHead>
                  <TableHead className="font-semibold">RNC</TableHead>
                  <TableHead className="font-semibold text-right">Total</TableHead>
                  <TableHead className="font-semibold text-right">ITBIS</TableHead>
                  <TableHead className="font-semibold">Estado</TableHead>
                  <TableHead className="font-semibold">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Cargando documentos...
                    </TableCell>
                  </TableRow>
                ) : documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      No hay documentos e-CF emitidos
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map((doc) => {
                    const status = STATUS_MAP[doc.status] || STATUS_MAP.pending;
                    const StatusIcon = STATUS_ICONS[doc.status] || Clock;
                    return (
                      <TableRow key={doc.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell>
                          <span className="font-mono text-sm font-semibold">{doc.ncf}</span>
                        </TableCell>
                        <TableCell className="text-sm">{doc.customer_name || "Consumidor Final"}</TableCell>
                        <TableCell className="text-sm font-mono">{doc.customer_rnc || "—"}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatCurrency(doc.total_amount)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatCurrency(doc.itbis_total)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(doc.authorized_at || doc.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
