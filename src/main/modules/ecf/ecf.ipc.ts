import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

import { requirePermission } from '@main/shared/session';
import { auditService } from '@main/modules/audit/services/audit.service';
import { AppDataSource } from '@main/config/data-source';
import { Setting } from '@main/modules/settings/entities/setting.entity';

import { ecfService, EcfConfigView } from '@main/modules/ecf/services/ecf.service';
import {
    consultarDocumento,
    emitirDocumento,
    procesarPendientes,
} from '@main/modules/ecf/services/emision';
import {
    estatusServicios,
    probarAmbiente,
    autenticar,
    limpiarToken,
    ResultadoRed,
} from '@main/modules/ecf/dgii/client';
import { Ambiente } from '@main/modules/ecf/dgii/endpoints';
import {
    cargarCertificadoP12,
    certificadoVigente,
    verificarTitularCertificado,
} from '@main/modules/ecf/signing/p12';

/** Estado del certificado digital, tal como se muestra en Ajustes → Fiscal. */
interface EstadoCertificado {
    ruta: string;
    existe: boolean;
    vigente: boolean;
    /** `SN` (o `CN`) declarado por el certificado — debe ser el RNC/cédula. */
    nif: string | null;
    serial: string;
    emisor: string | null;
    valido_desde: string;
    valido_hasta: string;
    /** `null` cuando el certificado corresponde al negocio. */
    aviso_titular: string | null;
    /** Motivo por el que no se pudo leer el .p12, si aplica. */
    error: string | null;
}

const EXTENSIONES = ['p12', 'pfx'];

async function settingsRow(): Promise<Setting> {
    const repo = AppDataSource.getRepository(Setting);
    const s = await repo.findOneBy({ id: 1 });
    if (s) return s;
    return repo.save(repo.create({ id: 1 }));
}

/**
 * Lee el .p12 configurado y resume su estado.
 * Si no se pasa `password` usa la guardada; sirve para refrescar la pantalla
 * después de cada guardado sin volver a escribir la contraseña.
 */
async function leerCertificado(password?: string): Promise<EstadoCertificado> {
    const s = await settingsRow();
    const ruta = s.ecf_cert_path ?? '';
    const base: EstadoCertificado = {
        ruta,
        existe: false,
        vigente: false,
        nif: null,
        serial: '',
        emisor: null,
        valido_desde: '',
        valido_hasta: '',
        aviso_titular: null,
        error: null,
    };

    if (!ruta) return { ...base, error: 'No hay certificado configurado.' };
    if (!fs.existsSync(ruta)) {
        return { ...base, error: 'No se encuentra el archivo del certificado en esa ruta.' };
    }

    let clave = password;
    if (clave === undefined || clave === '') clave = (await ecfService.passwordCertificado()) ?? '';
    if (clave === '') {
        return { ...base, existe: true, error: 'Falta la contraseña del certificado.' };
    }

    try {
        const cert = cargarCertificadoP12(fs.readFileSync(ruta), clave);
        const negocio = String((await settingsRow()).business_tax_id ?? '').replace(/\D/g, '');
        return {
            ruta,
            existe: true,
            vigente: certificadoVigente(cert),
            nif: cert.subjectSerialNumber ?? cert.subjectCommonName ?? null,
            serial: cert.serialNumber,
            emisor: cert.subjectCommonName ?? null,
            valido_desde: cert.notBefore.toISOString(),
            valido_hasta: cert.notAfter.toISOString(),
            aviso_titular: negocio ? verificarTitularCertificado(cert, negocio) : null,
            error: null,
        };
    } catch (err) {
        return {
            ...base,
            existe: true,
            error: err instanceof Error ? err.message : 'No se pudo leer el certificado.',
        };
    }
}

export function registerEcfHandlers() {
    // ── Documentos e-CF ────────────────────────────────────────────────────

    ipcMain.handle('ecf:list', async (_event, limite?) => {
        try {
            requirePermission('ecf:view');
            return { success: true, data: await ecfService.listar(Number(limite) || 200) };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    });

    ipcMain.handle('ecf:stats', async () => {
        try {
            requirePermission('ecf:view');
            return { success: true, data: await ecfService.stats() };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    });

    // ── Emisión / consulta (Fase 3) ───────────────────────────────────────

    /** Firma (si hace falta) y transmite UN comprobante. */
    ipcMain.handle('ecf:emit', async (_event, id) => {
        try {
            requirePermission('ecf:emit');
            const doc = await emitirDocumento(String(id ?? ''));
            auditService.log('ecf:emit', doc.encf, `estado=${doc.estado} via=${doc.via}`);
            // `obtener` devuelve la fila ya guardada por la emisión.
            return { success: true, data: await ecfService.obtener(doc.id) };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    });

    /**
     * Firma y transmite todo lo pendiente vencido (el mismo camino que usa el
     * worker). Responde con un resumen; los detalles quedan en `last_error`.
     */
    ipcMain.handle('ecf:emit-pending', async () => {
        try {
            requirePermission('ecf:emit');
            const resumen = await procesarPendientes(50);
            auditService.log('ecf:emit-pending', 'lote', JSON.stringify(resumen));
            return { success: true, data: resumen };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    });

    /** Consulta el estado de un comprobante ya transmitido. */
    ipcMain.handle('ecf:refresh', async (_event, id) => {
        try {
            requirePermission('ecf:view');
            const doc = await consultarDocumento(String(id ?? ''));
            return { success: true, data: await ecfService.obtener(doc.id) };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    });

    // ── Ajustes e-CF ───────────────────────────────────────────────────────

    ipcMain.handle('ecf:config:get', async (): Promise<{ success: boolean; data?: EcfConfigView; message?: string }> => {
        try {
            requirePermission('settings:view');
            return { success: true, data: await ecfService.obtenerConfig() };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    });

    ipcMain.handle('ecf:config:save', async (_event, data) => {
        try {
            requirePermission('ecf:config');
            const cfg = await ecfService.guardarConfig(data ?? {});
            limpiarToken(); // cambió el certificado y/o el ambiente
            auditService.log('ecf:config:save', cfg.ambiente, `cert=${cfg.cert_path ?? '(sin certificado)'}`);
            return { success: true, data: cfg };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    });

    /** Abre el selector de archivos del SO y devuelve la ruta elegida. */
    ipcMain.handle('ecf:pick-certificate', async () => {
        try {
            requirePermission('ecf:config');
            const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
            const opciones: { title: string; properties: ['openFile']; filters: { name: string; extensions: string[] }[] } = {
                title: 'Seleccionar certificado digital del PSFE',
                properties: ['openFile'],
                filters: [
                    { name: 'Certificado PKCS#12', extensions: EXTENSIONES },
                    { name: 'Todos los archivos', extensions: ['*'] },
                ],
            };
            let res: { canceled: boolean; filePaths: string[] };
            if (win) {
                res = await dialog.showOpenDialog(win, opciones);
            } else {
                res = await dialog.showOpenDialog(opciones);
            }
            if (res.canceled || !res.filePaths[0]) return { success: false, message: 'Selección cancelada' };
            const ruta = res.filePaths[0];
            if (!EXTENSIONES.includes(path.extname(ruta).replace('.', '').toLowerCase())) {
                return { success: false, message: 'El certificado debe ser un archivo .p12 o .pfx.' };
            }
            return { success: true, data: ruta };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    });

    /**
     * Estado del .p12 configurado (vigencia, SN vs RNC del negocio).
     * `password` solo se manda mientras se está escribiendo: nunca se guarda
     * en esta respuesta.
     */
    ipcMain.handle('ecf:certificate-info', async (_event, password?) => {
        try {
            requirePermission('ecf:config');
            return { success: true, data: await leerCertificado(typeof password === 'string' ? password : undefined) };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    });

    /**
     * Prueba de conexión con la DGII:
     *  1. el ambiente elegido responde de verdad (GET de la semilla, sin clave),
     *  2. la lista de estatus de servicios (exige API key de la DGII → 401),
     *  3. si hay certificado, semilla → token (la autenticación real).
     */
    ipcMain.handle('ecf:connection-test', async () => {
        try {
            requirePermission('ecf:config');

            const cfg = await ecfService.obtenerConfig();
            // En paralelo: la semilla es la comprobación que decide si hay
            // conexión; la lista de estatus es informativa (requiere API key).
            const [ambiente, estatus] = await Promise.all([
                probarAmbiente(cfg.ambiente),
                estatusServicios(),
            ]);

            const resultado: {
                ambiente_check: ResultadoRed;
                estatus: ResultadoRed;
                ambiente: Ambiente;
                autenticacion?: { ok: boolean; detalle: string };
            } = { ambiente_check: ambiente, estatus, ambiente: cfg.ambiente };

            if (cfg.cert_path) {
                const estado = await leerCertificado();
                if (estado.error || !estado.existe) {
                    resultado.autenticacion = { ok: false, detalle: estado.error ?? 'Certificado no legible.' };
                } else if (!estado.vigente) {
                    resultado.autenticacion = {
                        ok: false,
                        detalle: `El certificado venció el ${new Date(estado.valido_hasta).toLocaleDateString('es-DO')}.`,
                    };
                } else if (estado.aviso_titular) {
                    resultado.autenticacion = { ok: false, detalle: estado.aviso_titular };
                } else {
                    try {
                        const ruta = estado.ruta;
                        const clave = (await ecfService.passwordCertificado()) ?? '';
                        const cert = cargarCertificadoP12(fs.readFileSync(ruta), clave);
                        const token = await autenticar(cfg.ambiente, cert, true);
                        resultado.autenticacion = {
                            ok: Boolean(token),
                            detalle: `Token de la DGII obtenido para el ambiente ${cfg.ambiente} (vence en 1 hora).`,
                        };
                    } catch (err) {
                        resultado.autenticacion = {
                            ok: false,
                            detalle: err instanceof Error ? err.message : 'Falló la autenticación.',
                        };
                    }
                }
            }

            return { success: true, data: resultado };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    });
}
