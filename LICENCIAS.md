# Venilu — Guía de licencias (para el vendedor)

Venilu se vende con dos modalidades:

| Modalidad | Precio sugerido | Comportamiento |
|---|---|---|
| **Perpetua** (pago único) | RD$10,000 | Nunca vence |
| **Anual** | (definir) | Vence en la fecha emitida; avisa 30 días antes |

Toda instalación nueva incluye **15 días de prueba completa** (ideal para demos:
instala, deja que el cliente lo use, y vende antes de que venza). Al vencer la
prueba o una licencia anual, la app **bloquea el cobro** (procesar ventas) pero
nunca secuestra los datos: todo sigue visible y exportable.

## Cómo funciona (resumen técnico)

- Las licencias son claves **firmadas con Ed25519**. La app solo lleva la clave
  pública: sin tu clave privada nadie puede fabricar una licencia válida.
- No requiere internet ni servidor: la activación es 100% offline.
- La clave activada se guarda en `userData/license.json`; el inicio de la
  prueba se ancla en la base de datos (borrar archivos no reinicia la prueba).

## Protecciones anti-trampa

Son disuasivos para el usuario común, no DRM (nada que corra en la máquina del
cliente es inviolable):

- **Reloj atrasado:** la app guarda la última fecha que ha visto. Si la fecha
  del equipo retrocede más de 24 h, bloquea el cobro con el aviso "La fecha del
  equipo está atrasada" hasta que se corrija. Mientras la app está abierta el
  tiempo de licencia corre igual, aunque el reloj siga atrasado. Las licencias
  **perpetuas están exentas** (no ganan nada con el reloj).
- **Ancla redundante:** el inicio de la prueba y la última fecha vista se
  guardan en la base de datos **y** en un archivo firmado fuera de `userData`
  (`%LOCALAPPDATA%\.vnl-state\anchor.dat` en Windows,
  `~/.local/share/.vnl-state/anchor.dat` en Linux). Borrar los datos de la app
  o reinstalar no reinicia la prueba; gana siempre el valor más restrictivo.
- **Integridad del paquete:** los *fuses* de Electron (`electronFuses` en
  `package.json`) validan el `app.asar` en Windows, impiden cargar código fuera
  de él y desactivan `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` y `--inspect`.

**Soporte — cliente bloqueado con la fecha correcta:** pasa si alguna vez abrió
la app con el reloj adelantado (p. ej. año 2028). Emítele una clave nueva: una
clave **nunca activada en ese equipo y emitida hace menos de 30 días**
re-sincroniza la guarda. En la pantalla de aviso: "Tengo una clave nueva".

## Tu clave privada (CRÍTICO)

Vive en `~/.venilu-licencias/private.pem` en TU máquina.

- **Haz copia de seguridad segura** (USB cifrado, gestor de contraseñas). Si la
  pierdes, no podrás emitir más licencias para las apps ya distribuidas.
- **Nunca** la subas al repositorio ni la envíes por chat/correo.
- En `~/.venilu-licencias/emitidas.jsonl` queda el registro de cada licencia
  que generes (cliente, tipo, fecha, clave).

## Emitir una licencia

```bash
# Pago único (perpetua)
node scripts/generar-licencia.mjs --cliente "Juan Pérez" --tipo perpetua --negocio "Colmado La Fe"

# Anual (vence en 1 año exacto por defecto)
node scripts/generar-licencia.mjs --cliente "Ana Gómez" --tipo anual

# Anual con fecha específica
node scripts/generar-licencia.mjs --cliente "Ana Gómez" --tipo anual --vence 2027-12-31
```

El script imprime la clave (`VNL-...`). Envíasela al cliente por WhatsApp o
correo; él la pega en la pantalla de activación (o en Ajustes → Acerca de →
Licencia) y listo.

## Renovar una anual

Genera una licencia anual nueva con la fecha extendida y envíala — al activarla
reemplaza la vencida. No hay que reinstalar nada.

## Flujo de venta sugerido

1. Instala Venilu en la máquina del cliente → arranca la prueba de 15 días.
2. Configura su negocio (nombre, logo, impresora) y déjalo operando.
3. Antes del día 15, cobra y emite su licencia en tu máquina.
4. Le envías la clave; el cliente la pega y sigue trabajando sin interrupciones.
