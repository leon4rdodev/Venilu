import { useState, useEffect } from "react";
import { Button } from "@components/ui/button";
import { Download, RefreshCw, Database, AlertTriangle, Trash2, Upload } from "lucide-react";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@components/ui/alert-dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@components/ui/table";

interface BackupInfo {
    fileName: string;
    filePath: string;
    size: number;
    createdAt: string;
    type: 'manual' | 'auto' | 'pre-restore';
}

export function BackupSettings() {
    const [backups, setBackups] = useState<BackupInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);

    const loadBackups = async () => {
        try {
            setLoading(true);
            const result = await window.ipcRenderer.invoke('backup:list') as {
                success: boolean;
                backups: BackupInfo[];
                message?: string;
            };

            if (result.success) {
                setBackups(result.backups);
            } else {
                toast.error(result.message || 'Error al cargar copias de seguridad');
            }
        } catch (error) {
            console.error('Error loading backups:', error);
            toast.error('Error al cargar copias de seguridad');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBackups();
    }, []);

    const handleCreateBackup = async () => {
        try {
            setLoading(true);
            const result = await window.ipcRenderer.invoke('backup:create', 'manual') as {
                success: boolean;
                message: string;
            };

            if (result.success) {
                toast.success('Copia de seguridad creada exitosamente');
                await loadBackups();
            } else {
                toast.error(result.message || 'Error al crear copia de seguridad');
            }
        } catch (error) {
            console.error('Error creating backup:', error);
            toast.error('Error al crear copia de seguridad');
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreBackup = async () => {
        if (!selectedBackup) return;

        try {
            setLoading(true);
            const result = await window.ipcRenderer.invoke('backup:restore', selectedBackup.fileName) as {
                success: boolean;
                message: string;
            };

            if (result.success) {
                toast.success('Base de datos restaurada exitosamente');
                setRestoreDialogOpen(false);
                await loadBackups();
            } else {
                toast.error(result.message || 'Error al restaurar copia de seguridad');
            }
        } catch (error) {
            console.error('Error restoring backup:', error);
            toast.error('Error al restaurar copia de seguridad');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBackup = async () => {
        if (!selectedBackup) return;

        try {
            setLoading(true);
            const result = await window.ipcRenderer.invoke('backup:delete', selectedBackup.fileName) as {
                success: boolean;
                message: string;
            };

            if (result.success) {
                toast.success('Copia de seguridad eliminada');
                setDeleteDialogOpen(false);
                await loadBackups();
            } else {
                toast.error(result.message || 'Error al eliminar copia de seguridad');
            }
        } catch (error) {
            console.error('Error deleting backup:', error);
            toast.error('Error al eliminar copia de seguridad');
        } finally {
            setLoading(false);
        }
    };

    const handleExportBackup = async (backup: BackupInfo) => {
        try {
            setLoading(true);

            // Open dialog to select destination
            const dialogResult = await window.ipcRenderer.invoke('dialog:selectBackupLocation', backup.fileName) as {
                success: boolean;
                filePath?: string;
                message?: string;
            };

            if (!dialogResult.success || !dialogResult.filePath) {
                setLoading(false);
                return;
            }

            // Export backup to selected location
            const result = await window.ipcRenderer.invoke('backup:export', {
                fileName: backup.fileName,
                destinationPath: dialogResult.filePath
            }) as {
                success: boolean;
                message: string;
            };

            if (result.success) {
                toast.success('Copia de seguridad exportada exitosamente');
            } else {
                toast.error(result.message || 'Error al exportar copia de seguridad');
            }
        } catch (error) {
            console.error('Error exporting backup:', error);
            toast.error('Error al exportar copia de seguridad');
        } finally {
            setLoading(false);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const getBackupTypeBadge = (type: string) => {
        switch (type) {
            case 'manual':
                return <span className="inline-flex items-center rounded-full bg-foreground px-2 py-1 text-xs font-medium text-background whitespace-nowrap">Manual</span>;
            case 'auto':
                return <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground whitespace-nowrap">Automático</span>;
            case 'pre-restore':
                return <span className="inline-flex items-center rounded-full border border-border px-2 py-1 text-xs font-medium text-muted-foreground whitespace-nowrap">Pre-restauración</span>;
            default:
                return <span className="inline-flex items-center rounded-full border border-border px-2 py-1 text-xs font-medium text-muted-foreground whitespace-nowrap">{type}</span>;
        }
    };

    return (
        <div className="bg-card border border-border rounded-lg p-6">
            <WidgetHeader
                icon={Database}
                title="Copias de Seguridad"
                subtitle="Gestiona las copias de seguridad de tu base de datos"
                action={
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadBackups}
                            disabled={loading}
                        >
                            <RefreshCw className="h-4 w-4 mr-2" strokeWidth={1.75} />
                            Actualizar
                        </Button>
                        <Button
                            onClick={handleCreateBackup}
                            disabled={loading}
                            size="sm"
                        >
                            <Database className="h-4 w-4 mr-2" strokeWidth={1.75} />
                            Crear Copia de Seguridad
                        </Button>
                    </div>
                }
            />
            <div className="mt-4">
                {backups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                            <Database className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No hay copias de seguridad disponibles</p>
                        <p className="text-sm text-muted-foreground mt-1">Crea tu primera copia de seguridad para proteger tus datos</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-border hover:bg-transparent">
                                <TableHead className="text-xs text-muted-foreground font-medium">Fecha</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium">Tipo</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium">Tamaño</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border [&_tr]:border-0">
                            {backups.map((backup) => (
                                <TableRow key={backup.fileName}>
                                    <TableCell className="font-medium">
                                        {formatDate(backup.createdAt)}
                                    </TableCell>
                                    <TableCell>{getBackupTypeBadge(backup.type)}</TableCell>
                                    <TableCell className="text-muted-foreground tabular-nums">{formatFileSize(backup.size)}</TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleExportBackup(backup)}
                                                disabled={loading}
                                            >
                                                <Upload className="h-4 w-4 mr-1" strokeWidth={1.75} />
                                                Exportar
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedBackup(backup);
                                                    setRestoreDialogOpen(true);
                                                }}
                                                disabled={loading}
                                            >
                                                <Download className="h-4 w-4 mr-1" strokeWidth={1.75} />
                                                Restaurar
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedBackup(backup);
                                                    setDeleteDialogOpen(true);
                                                }}
                                                disabled={loading}
                                            >
                                                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}

                {/* Restore Confirmation Dialog */}
                <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                ¿Restaurar Copia de Seguridad?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="space-y-2">
                                <p>
                                    Esta acción reemplazará todos los datos actuales con los datos de la copia de seguridad.
                                </p>
                                <p className="font-semibold">
                                    Se creará una copia de seguridad de los datos actuales antes de restaurar.
                                </p>
                                {selectedBackup && (
                                    <div className="mt-4 p-4 bg-muted rounded-md">
                                        <p className="text-sm">
                                            <strong>Archivo:</strong> {selectedBackup.fileName}
                                        </p>
                                        <p className="text-sm">
                                            <strong>Fecha:</strong> {formatDate(selectedBackup.createdAt)}
                                        </p>
                                        <p className="text-sm">
                                            <strong>Tamaño:</strong> {formatFileSize(selectedBackup.size)}
                                        </p>
                                    </div>
                                )}
                                <p className="text-sm text-muted-foreground mt-4">
                                    Los datos se actualizarán automáticamente, no es necesario reiniciar la aplicación.
                                </p>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleRestoreBackup}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                Restaurar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar Copia de Seguridad?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción no se puede deshacer. La copia de seguridad será eliminada permanentemente.
                                {selectedBackup && (
                                    <div className="mt-4 p-4 bg-muted rounded-md">
                                        <p className="text-sm">
                                            <strong>Archivo:</strong> {selectedBackup.fileName}
                                        </p>
                                        <p className="text-sm">
                                            <strong>Fecha:</strong> {formatDate(selectedBackup.createdAt)}
                                        </p>
                                    </div>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteBackup}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                Eliminar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
