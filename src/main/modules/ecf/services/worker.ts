import { procesarPendientes, type ResumenProceso } from "./emision";

/**
 * Worker de facturación electrónica.
 *
 * Cada 30 s hace una pasada sobre `ecf_documents`: construye y firma los
 * `draft`, transmite los `signed`/`queued` vencidos y consulta el estado de los
 * `sent` agendados. Todo lo que falle queda en `last_error` y se reintenta con
 * backoff (`services/emision.ts`), de modo que **una venta nunca se bloquea**
 * porque la DGII no responda.
 *
 * Arranque: `main.ts` llama a {@link iniciarWorkerEcf} después de registrar los
 * handlers IPC.
 */

/** Cadencia de la pasada. El backoff de cada documento manda sobre esto. */
const INTERVALO_MS = 30_000;
/** Primera pasada: deja terminar el arranque (migraciones, roles, ventana). */
const RETRASO_INICIAL_MS = 15_000;
/** Máximo de comprobantes emitidos / consultados por pasada. */
const LOTE = 25;

let intervalo: ReturnType<typeof setInterval> | null = null;

async function pasada(): Promise<void> {
    try {
        const resumen: ResumenProceso = await procesarPendientes(LOTE);
        const total =
            resumen.emitidos + resumen.enviados + resumen.consultados + resumen.fallos;
        if (total > 0) {
            console.log(
                `[e-CF] worker: ${resumen.emitidos} firmado(s)/enviado(s), ` +
                    `${resumen.enviados} reenviado(s), ${resumen.consultados} consultado(s), ` +
                    `${resumen.fallos} fallo(s)`
            );
        }
    } catch (err) {
        console.error("[e-CF] worker:", err instanceof Error ? err.message : err);
    }
}

/** Arranca el worker (idempotente). */
export function iniciarWorkerEcf(): void {
    if (intervalo) return;
    const inicial = setTimeout(pasada, RETRASO_INICIAL_MS);
    inicial.unref?.();
    intervalo = setInterval(() => void pasada(), INTERVALO_MS);
    intervalo.unref?.();
    console.log(`[e-CF] worker iniciado (cada ${INTERVALO_MS / 1000} s).`);
}

/** Detiene el worker. */
export function detenerWorkerEcf(): void {
    if (!intervalo) return;
    clearInterval(intervalo);
    intervalo = null;
}
