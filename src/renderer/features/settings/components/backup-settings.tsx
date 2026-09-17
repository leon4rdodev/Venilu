import { useState, useEffect } from "react";
import { Button, buttonVariants } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Download, RefreshCw, Database, AlertTriangle, Trash2, Upload, CalendarClock } from "lucide-react";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { toast } from "sonner";
import { useSettings } from "../hooks/use-settings";
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

const AUTO_BACKUP_OPTIONS: { value: string; label: string }[] = [
    { value: 'off', label: 'Desactivado' },
    { value: 'daily', label: 'Diario' },
    { value: 'weekly', label: 'Semanal' },
];

/** Auto-backup cadence + retention — persisted through settings:update. */
function AutoBackupCard() {
    const { settings, updateSettings } = useSettings();
    const [retentionInput, setRetentionInput] = useState<string>('');

    const autoBackup = settings?.auto_backup ?? 'daily';
    const retention = settings?.auto_backup_retention ?? 7;

    useEffect(() => {
        setRetentionInput(String(retention));
    }, [retention]);

    const handleFrequencyChange = async (value: string) => {
        const result = await updateSettings({ auto_backup: value });
        if (result.success) {
            const label = AUTO_BACKUP_OPTIONS.find(o => o.value === value)?.label ?? value;
            toast.success('Backup automático actualizado', { description: `Frecuencia: ${label}` });
        } else {
            toast.error('Error al guardar', { description: result.message });
        }
    };

    const commitRetention = async () => {
        const parsed = Math.round(Number(retentionInput));
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 30) {
            setRetentionInput(String(retention));
            if (retentionInput.trim() !== '' && retentionInput !== String(retention)) {
                toast.error('Valor inválido', { description: 'Debe estar entre 1 y 30 copias' });
            }
            return;
        }
        if (parsed === retention) return;
        const result = await updateSettings({ auto_backup_retention: parsed });
        if (result.success) {
            toast.success('Retención actualizada', { description: `Se conservarán ${parsed} copias automáticas` });
        } else {
            toast.error('Error al guardar', { description: result.message });
        }
    };

    return (
        <div className="bg-card border border-border rounded-lg p-6">
            <WidgetHeader
                icon={CalendarClock}
                title="Backup Automático"
                subtitle="Crea copias de seguridad periódicas sin intervención manual"
            />
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="auto-backup-frequency" className="text-sm">Frecuencia</Label>
                    <Select value={autoBackup} onValueChange={handleFrequencyChange}>
                        <SelectTrigger id="auto-backup-frequency" className="h-9 w-full" aria-describedby="auto-backup-hint">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {AUTO_BACKUP_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="auto-backup-retention" className="text-sm">Copias automáticas a conservar</Label>
                    <Input
                        id="auto-backup-retention"
                        type="number"
                        min={1}
                        max={30}
                        value={retentionInput}
                        onChange={(e) => setRetentionInput(e.target.value)}
                        onBlur={commitRetention}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        disabled={autoBackup === 'off'}
                        aria-describedby="auto-backup-retention-hint"
                        className="h-9 tabular-nums"
                    />
                    <p id="auto-backup-retention-hint" className="text-xs text-muted-foreground">
                        Entre 1 y 30. Las copias más antiguas se eliminan solas.
                    </p>
                </div>
            </div>
            <p id="auto-backup-hint" className="mt-3 text-xs text-muted-foreground">
                El backup automático se crea al iniciar la aplicación cuando ha pasado el intervalo configurado. Los cambios se guardan al instante.
            </p>
        </div>
    );
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
                setRestoreDialogOpen(false);
                toast.success('Base de datos restaurada', {
                    description: 'La aplicación se reiniciará para cargar los datos restaurados.',
                });
                // The restored DB is a different dataset: the session, the open
                // shift and every cached query may no longer exist in it. A full
                // reload through login is the only state that's guaranteed sane.
                window.localStorage.removeItem('session_token');
                setTimeout(() => window.location.reload(), 1500);
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

    /** "Hoy HH:mm" / "Ayer HH:mm" / "dd MMM yyyy HH:mm" */
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '—';
        const time = date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false });
        const sameDay = (a: Date, b: Date) =>
            a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        if (sameDay(date, today)) return `Hoy ${time}`;
        if (sameDay(date, yesterday)) return `Ayer ${time}`;
        return `${date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })} ${time}`;
    };

    const getBackupTypeBadge = (type: string) => {
        switch (type) {
            case 'manual':
                return <span className="inline-flex items-center rounded-full bg-foreground px-2 py-1 text-xs font-medium text-background whitespace-nowrap">Manual</span>;
            case 'auto':
                return <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground whitespace-nowrap">Auto</span>;
            case 'pre-restore':
                return <span className="inline-flex items-center rounded-full border border-border px-2 py-1 text-xs font-medium text-muted-foreground whitespace-nowrap">Pre-restauración</span>;
            default:
                return <span className="inline-flex items-center rounded-full border border-border px-2 py-1 text-xs font-medium text-muted-foreground whitespace-nowrap">{type}</span>;
        }
    };

    return (
        <div className="space-y-6">
            <AutoBackupCard />

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
                            aria-label="Actualizar lista de copias"
                            title="Actualizar lista"
                        >
                            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={1.75} aria-hidden="true" />
                            Actualizar
                        </Button>
                        <Button
                            onClick={handleCreateBackup}
                            disabled={loading}
                            size="sm"
                        >
                            <Database className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                            Crear Copia de Seguridad
                        </Button>
                    </div>
                }
            />
            <div className="mt-4">
                {loading && backups.length === 0 ? (
                    <div className="rounded-lg border border-border overflow-hidden divide-y divide-border" aria-busy="true" aria-label="Cargando copias de seguridad">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-6 w-16 rounded-full" />
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-8 w-64" />
                            </div>
                        ))}
                    </div>
                ) : backups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                            <Database className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} aria-hidden="true" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No hay copias de seguridad disponibles</p>
                        <p className="text-sm text-muted-foreground mt-1">Crea tu primera copia de seguridad para proteger tus datos</p>
                    </div>
                ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-border hover:bg-transparent">
                                <TableHead className="text-xs text-muted-foreground font-medium">Fecha</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium">Tipo</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium text-right">Tamaño</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border [&_tr]:border-0">
                            {backups.map((backup) => (
                                <TableRow key={backup.fileName} className="hover:bg-muted/40 transition-colors">
                                    <TableCell className="text-sm font-medium whitespace-nowrap">
                                        {formatDate(backup.createdAt)}
                                    </TableCell>
                                    <TableCell>{getBackupTypeBadge(backup.type)}</TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-sm tabular-nums whitespace-nowrap text-right">{formatFileSize(backup.size)}</TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleExportBackup(backup)}
                                                disabled={loading}
                                                aria-label={`Exportar copia del ${formatDate(backup.createdAt)}`}
                                            >
                                                <Upload className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
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
                                                aria-label={`Restaurar copia del ${formatDate(backup.createdAt)}`}
                                            >
                                                <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                                                Restaurar
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon-sm"
                                                onClick={() => {
                                                    setSelectedBackup(backup);
                                                    setDeleteDialogOpen(true);
                                                }}
                                                disabled={loading}
                                                aria-label={`Eliminar copia del ${formatDate(backup.createdAt)}`}
                                                title="Eliminar copia"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </div>
                )}

                {/* Restore Confirmation Dialog */}
                <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" strokeWidth={1.75} aria-hidden="true" />
                                ¿Restaurar Copia de Seguridad?
                            </AlertDialogTitle>
                            {/* asChild → <div>: la descripción contiene bloques, y <p> no admite <p>/<div> anidados */}
                            <AlertDialogDescription asChild>
                                <div className="space-y-2">
                                    <p>
                                        Esta acción reemplazará todos los datos actuales con los datos de la copia de seguridad.
                                    </p>
                                    <p className="font-medium text-foreground">
                                        Se creará una copia de seguridad de los datos actuales antes de restaurar.
                                    </p>
                                    {selectedBackup && (
                                        <dl className="mt-4 rounded-md bg-muted p-4 text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                                            <dt className="text-muted-foreground">Archivo</dt>
                                            <dd className="font-mono text-foreground break-all">{selectedBackup.fileName}</dd>
                                            <dt className="text-muted-foreground">Fecha</dt>
                                            <dd className="text-foreground tabular-nums">{formatDate(selectedBackup.createdAt)}</dd>
                                            <dt className="text-muted-foreground">Tamaño</dt>
                                            <dd className="text-foreground tabular-nums">{formatFileSize(selectedBackup.size)}</dd>
                                        </dl>
                                    )}
                                    <p className="text-sm text-muted-foreground mt-4">
                                        Al terminar se cerrará la sesión y deberás iniciar sesión de nuevo.
                                    </p>
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleRestoreBackup}
                                disabled={loading}
                                className={buttonVariants({ variant: "destructive" })}
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
                            <AlertDialogDescription asChild>
                                <div className="space-y-2">
                                    <p>Esta acción no se puede deshacer. La copia de seguridad será eliminada permanentemente.</p>
                                    {selectedBackup && (
                                        <dl className="mt-4 rounded-md bg-muted p-4 text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                                            <dt className="text-muted-foreground">Archivo</dt>
                                            <dd className="font-mono text-foreground break-all">{selectedBackup.fileName}</dd>
                                            <dt className="text-muted-foreground">Fecha</dt>
                                            <dd className="text-foreground tabular-nums">{formatDate(selectedBackup.createdAt)}</dd>
                                        </dl>
                                    )}
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteBackup}
                                disabled={loading}
                                className={buttonVariants({ variant: "destructive" })}
                            >
                                Eliminar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
            </div>
        </div>
    );
}
