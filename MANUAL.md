# Manual de Venilu — Guía para el dueño del negocio

Bienvenido a Venilu, su punto de venta. Este manual le explica, paso a paso, cómo usar el sistema en el día a día de su colmado o tienda: abrir la caja, vender, fiar, manejar el inventario, cerrar la caja y sacar sus reportes. No necesita saber de computadoras — solo siga los pasos.

> **Consejo rápido**: casi todo en Venilu se hace con el ratón, pero en el mostrador las teclas **F1** (buscar), **F2** (cobrar), **F3** (poner en espera) y **F4** (reanudar) le ahorran mucho tiempo.

---

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [Abrir la caja](#2-abrir-la-caja)
3. [Vender](#3-vender)
4. [Fiao / crédito](#4-fiao--crédito)
5. [Inventario](#5-inventario)
6. [Clientes](#6-clientes)
6b. [Suplidores y compras](#6b-suplidores-y-compras)
7. [Cierre de caja](#7-cierre-de-caja)
8. [Reportes](#8-reportes)
9. [Ajustes](#9-ajustes)
10. [Preguntas frecuentes](#10-preguntas-frecuentes)

---

## 1. Primeros pasos

### Su licencia

Cuando instala Venilu por primera vez, tiene **15 días de prueba** con todas las funciones. Para activar su licencia:

1. Su vendedor le envía una **clave** que empieza por `VNL-...` (por WhatsApp o correo).
2. Si la prueba ya venció, la app le muestra la pantalla de activación al abrir: pegue la clave ahí y pulse **"Activar Licencia"**.
3. Si la app todavía funciona, vaya a **Ajustes → Acerca de → "Activar / cambiar licencia"**, pegue la clave y active.

Listo. En **Ajustes → Acerca de** siempre puede ver el estado de su licencia (tipo, fecha de vencimiento). Si es anual, la app le avisa con un letrero en la parte de arriba cuando faltan 30 días o menos para vencer.

### Configurar su negocio (la primera vez)

Al abrir Venilu por primera vez, un asistente de **4 pasos** lo guía:

1. **Bienvenida** — le explica lo que va a configurar.
2. **Administrador** — cree su cuenta: nombre, usuario y contraseña (mínimo 4 caracteres). **Guarde bien esa contraseña**: esa cuenta manda en todo el sistema.
3. **Negocio** — nombre del negocio, **RNC / Tax ID**, dirección, teléfono, correo y logo (opcional). El **RNC es obligatorio si va a emitir comprobantes fiscales** — si no lo tiene a mano ahora, puede ponerlo después en **Ajustes → Negocio**.
4. **Impresora** — elija su impresora de tickets y el tamaño de papel (80mm o 58mm), o pulse **"Configurar después"**. Puede probar con **"Imprimir ticket de prueba"**.

Al pulsar **"Finalizar"**, entra al sistema.

### Entrar al sistema cada día

1. En la pantalla de entrada, toque su usuario (el que usó la última vez sale marcado como **"Último acceso"**).
2. Escriba su contraseña y pulse **"Iniciar Sesión"**.

Si se aleja del mostrador un momento, puede **bloquear la caja** con **Ctrl+L** (o el botoncito del candado arriba). Para volver, solo escribe su contraseña — no pierde nada de lo que estaba haciendo.

---

## 2. Abrir la caja

Antes de vender hay que abrir un **turno** de caja. Si entra al **Punto de Venta** sin turno abierto, la app se lo pide.

1. Vaya a **Punto de Venta** y pulse **"Abrir Turno de Trabajo"**.
2. En la ventana **"Abrir Caja"**, escriba el **"Fondo de caja inicial"**: el efectivo con el que arranca el día (el menudo para dar cambio).
   - Si ayer cerró caja, la app le sugiere el **"Efectivo del último cierre"** — tóquelo y el monto se llena solo.
   - También hay botones de **selección rápida** (0, 500, 1000, 2000, 5000).
3. Pulse **"Iniciar Turno"**.

Ese fondo inicial queda registrado y se usa para el cuadre cuando cierre el turno. Arriba, en la barra, verá el letrero **"Caja abierta"** con el efectivo que debe haber en caja.

> Cada cajero abre y cierra su propio turno. Así usted sabe quién estaba en caja en cada venta.

---

## 3. Vender

La pantalla de **Punto de Venta** tiene dos partes: los productos a la izquierda y el **"Pedido Actual"** (el carrito) a la derecha.

### Agregar productos al carrito

- **Con escáner**: simplemente pase el producto por el escáner — se agrega solo al carrito.
- **Buscando**: pulse **F1** (o toque el buscador **"Buscar o escanear · F1"**), escriba el nombre o el código y toque el producto.
- **Por categoría**: use los botones de categorías arriba de los productos.

En el carrito puede cambiar cantidades, quitar artículos o vaciarlo completo. Si tiene permiso, también puede poner un **descuento** en pesos en la casilla **"Descuento"**.

### Cobrar

1. Pulse **F2** o el botón **"Proceder al Pago"**.
2. Se abre la ventana **"Procesar Pago"**:
   - **Cliente** (opcional): toque **"Sin cliente asignado"** para buscar y asignar un cliente. Obligatorio solo si va a fiar.
   - **Comprobante Fiscal** (si tiene la facturación activada): elija **"Sin comprobante"** (lo normal en mostrador), **"Consumo (B02)"** o **"Crédito Fiscal (B01)"**. Con B01, el sistema le pide el **RNC o cédula** del cliente (una empresa que necesita factura con valor fiscal) y opcionalmente la razón social.
   - **Método de Pago**: **Efectivo**, **Tarjeta**, **Transferencia** o **Crédito** (fiao).
   - Si es **efectivo**, escriba el **"Monto Recibido"** y la app le muestra el **"Cambio"** que debe devolver.
3. Pulse **"Confirmar Pago"**.

Sale la pantalla **"Venta Completada"** con el resumen (y el número de NCF si emitió comprobante). Desde ahí puede pulsar **"Imprimir Ticket"** — o, si activó la impresión automática en Ajustes, el ticket sale solo.

### Ventas en espera

¿Un cliente fue a buscar algo que le faltó y hay fila? No pierda la venta:

- Pulse **F3** (o el botón de pausa del carrito) para **poner la venta en espera**. El carrito queda libre para atender al siguiente.
- Cuando el cliente vuelva, pulse **F4** para abrir **"Ventas en Espera"** y toque **"Reanudar"** en su ticket. Todo vuelve tal como estaba, con su cliente y su descuento.

### Historial, reimpresión y anulaciones

En el **"Historial de Ventas"** (botón en la pantalla del POS) puede ver todas las transacciones y turnos, **reimprimir** cualquier ticket y, si tiene permiso, **anular una venta**:

- Abra la venta, pulse **"Anular esta venta"** y confirme.
- Los productos **vuelven al inventario** automáticamente.
- Si la venta llevaba comprobante fiscal, Venilu emite solo la **Nota de Crédito (B04)** que exige la DGII.
- **Ojo**: anular no se puede deshacer.

**¿El cliente solo devuelve UN producto?** No anule la venta completa — use **"Devolver artículos"** dentro del detalle de la venta:

- Elija qué artículos y cuántas unidades devuelve el cliente.
- El sistema le dice cuánto **reembolsar en efectivo** (con el descuento de la venta prorrateado), repone el stock y lo anota en el historial del producto.
- Ese dinero sale de **su caja**: se descuenta solo en el cuadre del turno.
- Si la venta llevaba comprobante, se emite su **Nota de Crédito (B04)** automáticamente.
- Una venta fiada con deuda pendiente **no se devuelve** — se anula (o cobre la deuda primero).

---

## 4. Fiao / crédito

Venilu maneja el fiao de forma ordenada: cada peso fiado queda anotado con nombre y fecha.

### Fiar una venta

1. En la ventana de pago, **asigne el cliente** (el botón de **Crédito** está apagado hasta que elija uno).
2. Elija **Crédito** como método de pago. La app le avisa: *"Se registrará una deuda de X a nombre de..."*.
3. Pulse **"Confirmar Crédito"**.

La venta queda como **"Pendiente de pago"** y la deuda se suma en la ficha del cliente.

### Límite de crédito

A cada cliente le puede poner un **"Límite de Crédito"** en su ficha (o dejarlo vacío para no aplicar límite). En el perfil del cliente ve una barra con el crédito **usado** y el **disponible**, y un aviso de **"Límite excedido"** cuando se pasó. Así decide hasta dónde fiarle a cada quien.

### Cobrar un abono

Cuando el cliente venga a pagar (completo o en parte):

1. Vaya a **Clientes**, busque al cliente y toque el botón **"Abonar"**.
2. En **"Abonar a Deuda"** verá la **deuda actual**. Escriba el **"Monto a Abonar"** (o toque **"Pagar todo"**) y elija **Efectivo** o **Transferencia**.
3. Pulse **"Registrar Abono"**. La app le muestra la **deuda restante**.

> **Importante**: para registrar un abono debe haber un **turno abierto** en el POS — así ese dinero entra al cuadre de la caja.

### Si se anula una venta fiada

La venta queda marcada como **"Anulada"**, los productos vuelven al inventario y, si llevaba comprobante, se emite la Nota de Crédito (B04). Si era una venta **fiada**, la deuda pendiente del cliente se elimina automáticamente; y si el cliente ya había abonado dinero a esa venta, el sistema registra un **reembolso** que se descuenta de sus ingresos y del cuadre de caja — devuélvale ese dinero al cliente en efectivo.

---

## 5. Inventario

En **Inventario** maneja sus productos, precios y existencias.

### Crear o editar un producto

1. Pulse **"Nuevo Producto"** (o el lápiz de **"Editar"** en un producto existente).
2. Llene la ficha:
   - **Foto del Producto** (opcional): pulse **"Subir foto"** — la app la comprime sola.
   - **Nombre del Producto** y **SKU / Código** (el código de barras o el código que usted use).
   - **Categoría** (puede crear categorías con el botón **+**).
   - **Precio de Compra** (lo que a usted le cuesta) y **Precio de Venta**.
   - **Stock** (cuántas unidades tiene) y **Alerta de Stock Bajo** (la app le avisa cuando quedan menos de esa cantidad).
   - **Exento de ITBIS**: active este interruptor **solo** para productos exentos según la DGII (víveres básicos, medicinas...). Los demás quedan con ITBIS normal.
3. Pulse **"Agregar Producto"** o **"Guardar Cambios"**.

### Ajustar el stock

Cuando cuadre físicamente la mercancía (conteo, merma, daño):

1. En la lista, toque **"Ajustar stock"** en el producto.
2. Ponga la cantidad real que hay (use los botones **−10 / −1 / +1 / +10** o escriba el número). La app le muestra la **diferencia**.
3. Pulse **"Aplicar Ajuste"**.

### Kardex (historial de movimientos)

Toque **"Movimientos de stock"** en cualquier producto para ver su kardex: cada **Venta**, **Anulación**, **Ajuste** y **Devolución**, con fecha, cantidad y el stock que quedó. Ideal para saber "¿qué pasó con esta mercancía?".

### Etiquetas y exportar

- **"Imprimir etiquetas"**: imprime etiquetas con el código de barras y el precio del producto en su impresora de tickets (elija cuántas, de 1 a 50). El producto debe tener código o SKU.
- **Exportar a CSV**: el botón de exportar en la cabecera de la lista guarda todo su inventario en un archivo que abre en Excel.

Arriba de la lista tiene los filtros **"Bajo stock"** y **"Agotados"**, y tarjetas con el total de productos, la inversión y el valor de venta de su mercancía.

---

## 6. Clientes

En **Clientes** tiene su lista de clientes con todo su historial.

- **"Nuevo Cliente"**: nombre (obligatorio), teléfono, correo, dirección, notas y **límite de crédito** si le va a fiar.
- **"Ver Perfil"**: abre la ficha completa — total gastado, compras, última compra, la barra de crédito, el **historial de compras** y el **historial de pagos** (abonos).
- Filtros útiles: **"Con deuda"** (para saber quién le debe), **"Con crédito"** e **"Inactivos 30d"** (clientes que hace un mes no compran — para darles seguimiento).
- También puede **exportar la lista a CSV**.

---

## 6b. Suplidores y compras

En **Suplidores** lleva el control de a quién le compra la mercancía, cuánto le debe y qué entró al inventario.

### Registrar un suplidor

1. Pulse **"Nuevo Suplidor"**: nombre o empresa (obligatorio), RNC, contacto o vendedor, teléfono, correo, dirección y notas.
2. **Días de crédito**: si el suplidor le fía, ponga los días que le da para pagar (0 = paga de contado). Con eso la app calcula cuándo vence cada compra.

### Registrar una compra (entrada de mercancía)

Cuando llega el camión, pulse **"Nueva Compra"** (desde la lista de suplidores, la pestaña **Compras** o la ficha del suplidor):

1. Elija el suplidor y, si quiere, anote el número de factura.
2. Busque cada producto y agréguelo: ponga la **cantidad** que recibió y el **costo unitario** de la factura. La app le muestra cómo queda el stock y si el costo cambió.
3. **Actualizar costo de los productos** viene activado: el costo de esta compra pasa a ser el costo del producto (así sus márgenes en Reportes son reales). Apáguelo si fue un precio excepcional.
4. Forma de pago:
   - **Efectivo**: sale de la caja de su turno (queda como salida de caja en el arqueo). Necesita un turno abierto.
   - **Transferencia**: no afecta la caja.
   - **A crédito**: no paga nada ahora; el total queda como **cuenta por pagar** con su fecha de vencimiento.
   - También puede pagar una parte ahora y dejar el resto a crédito.
5. Pulse **"Registrar compra"**. La mercancía entra al inventario y queda anotada en el kardex de cada producto como **Compra**.

### Cuentas por pagar y pagos

- Las tarjetas de arriba muestran lo que debe en total, lo **vencido**, las compras y los pagos del mes.
- Para abonarle a un suplidor pulse **"Pagar"** en su fila o en su ficha: elija **Efectivo** (sale de su caja; necesita turno abierto) o **Transferencia**, y el monto. El pago se aplica a las compras más antiguas primero.
- En la ficha del suplidor ve sus compras, sus pagos y el saldo.

### Anular una compra

Si registró una compra por error, ábrala desde la pestaña **Compras** y pulse **"Anular compra"**: la mercancía sale del inventario, el costo vuelve al anterior y la cuenta por pagar se elimina. **Solo se puede anular si aún no le ha hecho ningún pago y no ha vendido esa mercancía**; en ese caso corrija con un ajuste de stock.

### Eliminar o desactivar

Un suplidor sin compras se puede eliminar. Si ya tiene compras, al eliminarlo la app lo **desactiva** (deja de aparecer al comprar) para conservar el historial. No se puede eliminar un suplidor al que todavía le debe dinero.

---

## 7. Cierre de caja

Al final del turno, cierre la caja para cuadrarla:

1. En el POS (o tocando el letrero **"Caja abierta"** arriba), abra **"Cerrar Caja"**.
2. La app le muestra el **"Resumen de Ventas"** del turno y el **"Arqueo de Caja"**: fondo inicial + ventas en efectivo + abonos en efectivo − salidas de caja = **"Efectivo esperado"**.
3. Cuente el dinero de la caja. Para no equivocarse, pulse **"Contar efectivo"**: escriba cuántos billetes de 2000, de 1000, de 500... tiene, y cuántas monedas. La app suma solo — pulse **"Usar este total"**.
4. La app compara lo contado con lo esperado:
   - **"Cuadre perfecto"** — todo bien.
   - **"Faltante de caja"** — hay menos dinero del esperado.
   - **"Sobrante de caja"** — hay más del esperado.
5. Pulse **"Cerrar Turno"**. El cuadre queda guardado con fecha, cajero y diferencia — lo puede revisar después en el historial, pestaña **"Turnos"**.

### Salidas de efectivo (gastos del turno)

Si durante el día saca dinero de la caja (pagar un delivery, comprar algo, un retiro parcial), **regístrelo** con el botón **"Registrar gasto de caja"** del POS: monto y motivo. Ese dinero se descuenta solo del cuadre — así el faltante no lo sorprende al cierre. Guarde el recibo físico si lo hay.

---

## 8. Reportes

En **Reportes** ve cómo va su negocio:

- Elija el período con los botones **"Hoy"**, **"Ayer"**, **"7 días"**, **"30 días"**, **"Este mes"**, **"Mes anterior"**, o escoja fechas exactas.
- Verá el total de ventas, la **ganancia neta**, el margen, las transacciones, los productos que más (y menos) se venden, sus mejores clientes y el desglose por método de pago.

### Exportar

El botón **"Exportar"** le da tres opciones:

- **"Exportar PDF"** — un reporte bonito para imprimir o guardar.
- **"Exportar CSV"** — los datos en crudo, para abrir en Excel.
- **"Reporte 607 (DGII)"** — el reporte de ventas para su **contador**.

### El reporte 607 (para el contador)

Cada mes, su contador necesita el detalle de las ventas con comprobante fiscal para la declaración en la DGII:

1. Pulse **"Exportar" → "Reporte 607 (DGII)"**.
2. Elija el **mes** y el **año** (la app le propone el mes anterior, que es el que se declara).
3. Pulse **"Exportar 607"** y guarde el archivo.
4. Envíele ese archivo a su contador. Ahí van todas las ventas con NCF del mes, con RNC/cédula, monto e ITBIS, incluyendo las notas de crédito de las anulaciones.

---

## 9. Ajustes

En **Ajustes** (menú lateral izquierdo) está toda la configuración, organizada en secciones:

### Negocio

Nombre, **RNC / Cédula**, teléfono, dirección, correo y **logo** (sale en sus tickets). El RNC es obligatorio para emitir comprobantes fiscales.

### Fiscal (comprobantes NCF)

Aquí se configura la facturación con comprobantes de la DGII:

1. Active el interruptor **"Emitir comprobantes fiscales"**.
2. Revise la **"Tasa de ITBIS (%)"** — en RD es 18% y ya viene así. Sus precios de venta **ya incluyen** el ITBIS; la app calcula el desglose sola.
3. Registre sus **"Secuencias de NCF"** con el botón **"Nueva Secuencia"**. Las secuencias son los rangos de números que la DGII le autorizó (se solicitan en la Oficina Virtual de la DGII). Para cada una indique el tipo, el rango **"Desde" – "Hasta"** y la fecha de vencimiento:
   - **B02 · Factura de Consumo** — la del mostrador, consumidor final.
   - **B01 · Factura de Crédito Fiscal** — para empresas que piden factura con su RNC.
   - **B04 · Nota de Crédito** — la usa Venilu automáticamente al anular ventas con comprobante.

> **Muy importante — la B04**: registre una secuencia B04 desde el principio. **Sin secuencia B04 activa no podrá anular ventas que llevaron comprobante.** La propia app se lo recuerda con un aviso.

La tabla de secuencias le muestra cuántos números le quedan (**se pone en amarillo cuando quedan menos de 50** y en rojo cuando se agotan) y cuándo vence cada autorización.

### Apariencia

Tema **Claro**, **Oscuro** o **Sistema** (sigue el del equipo).

### Usuarios

Cree una cuenta para cada persona que use la caja: **"Agregar Usuario"** → nombre, usuario, contraseña y **rol**. Así cada venta queda con el nombre de quien la hizo.

### Roles y Permisos

Los roles definen qué puede hacer cada quien. Viene el rol **Administrador** (todo) y **Empleado Base** (vender, abrir/cerrar su turno, ver inventario y cobrar abonos). Los permisos de **Suplidores y Compras** (ver, gestionar suplidores, registrar y anular compras, pagar) se asignan por rol. Con **"Crear Nuevo Rol"** puede armar roles a su medida — por ejemplo, un cajero que no vea los costos ni pueda anular ventas, o un encargado que sí pueda ajustar stock.

### Impresora

Elija la **impresora** de tickets, el **tamaño de papel** (58mm u 80mm) y el **"Mensaje del ticket"** — el textito que sale al pie de cada recibo (por ejemplo: *"Gracias por su compra"*). Active la **"Impresión automática"** si quiere que el ticket salga solo en cada venta. Use **"Probar"** para verificar.

### Copias de Seguridad

Sus datos son su negocio — protéjalos:

- **Backup Automático**: elija la **frecuencia** (**Diario** o **Semanal**) y cuántas copias conservar. La copia se crea sola al abrir la aplicación.
- **"Crear Copia de Seguridad"**: haga una copia manual cuando quiera. Con **"Exportar"** puede guardarla en una memoria USB — hágalo de vez en cuando, por si algo le pasa a la computadora.
- **"Restaurar"**: vuelve a los datos de una copia anterior. Antes de restaurar, la app crea sola un respaldo de los datos actuales, y al terminar le pedirá iniciar sesión de nuevo.

### Actividad

El **registro de actividad**: quién anuló una venta, quién cambió un precio, quién ajustó stock... Todas las acciones delicadas quedan anotadas con usuario y fecha.

### Acerca de

La versión de la app y el estado de su **licencia**, con el enlace **"Activar / cambiar licencia"**.

---

## 10. Preguntas frecuentes

**¿Qué pasa si se vence mi licencia (o la prueba)?**
La app le muestra la pantalla de activación y no podrá seguir cobrando hasta activar una licencia nueva. **Sus datos no se pierden**: todo — ventas, clientes, deudas, inventario — queda intacto y guardado, y al activar la clave todo vuelve exactamente como estaba. Si compró la licencia **perpetua**, nunca vence.

**¿Cómo renuevo la licencia anual?**
Contacte a su vendedor y le enviará una clave nueva (`VNL-...`). Péguela en la pantalla de activación, o en **Ajustes → Acerca de → "Activar / cambiar licencia"**. No hay que reinstalar nada ni se pierde nada. La app le avisa con 30 días de anticipación.

**¿Se me acabaron los NCF, qué hago?**
Solicite un rango nuevo a la DGII (por la Oficina Virtual) y regístrelo en **Ajustes → Fiscal → "Nueva Secuencia"**. No espere a que se agoten: la app le avisa en amarillo cuando quedan menos de 50 comprobantes. Mientras no tenga secuencia activa de un tipo, puede seguir vendiendo **"Sin comprobante"**.

**¿La app necesita internet?**
**No.** Venilu funciona 100% sin internet: las ventas, el inventario, los reportes y hasta la activación de la licencia — todo trabaja en su computadora. Si se va la luz del router o no tiene wifi, usted sigue vendiendo normal.

**¿Puedo anular una venta que ya cobré?**
Sí, desde el **Historial de Ventas**, si su usuario tiene permiso. Los productos vuelven al inventario y, si la venta llevó comprobante, se emite la Nota de Crédito (B04) automáticamente. La anulación no se puede deshacer y queda registrada en la Actividad.

**¿Cada empleado necesita su usuario?**
Es lo recomendado. Así cada venta, anulación y cuadre queda con nombre y apellido, y usted decide con los **roles** qué puede hacer cada quien.

**Me equivoqué en el fondo inicial al abrir la caja, ¿qué hago?**
Cierre el turno (quedará la diferencia registrada con su explicación en el cuadre) y abra uno nuevo con el monto correcto.

**¿Dónde veo cuánto me deben en total?**
En **Clientes**, use el filtro **"Con deuda"**: ahí están todos los clientes con balance pendiente y cuánto debe cada uno.

---

*Venilu · Sistema POS — Si tiene alguna duda que este manual no responde, contacte a su vendedor.*
