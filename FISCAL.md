# Venilu — Facturación fiscal (República Dominicana)

Guía rápida para configurar un negocio que emite comprobantes fiscales (NCF).

## Puesta en marcha (una vez por cliente)

1. **RNC del negocio**: Ajustes → Negocio → RNC (obligatorio en los comprobantes).
2. **Activar facturación**: Ajustes → Fiscal → interruptor "Facturación con Comprobantes".
3. **Registrar las secuencias autorizadas por la DGII** (el cliente las solicita
   en la Oficina Virtual de la DGII y recibe rangos por tipo):
   - **B02 — Factura de Consumo**: la de mostrador, consumidor final.
   - **B01 — Factura de Crédito Fiscal**: cuando el cliente es una empresa y
     necesita el ITBIS como crédito (pide su RNC).
   - **B04 — Nota de Crédito**: la emite Venilu automáticamente al ANULAR una
     venta que llevaba comprobante. **Sin secuencia B04 activa no se pueden
     anular ventas con NCF** — regístrala desde el inicio.

   Cada secuencia lleva su rango (desde–hasta) y la fecha de vencimiento de la
   autorización. Venilu avisa cuando quedan pocos números o están por vencer.

## Operación diaria

- En el cobro, el cajero elige: **Sin comprobante** (default), **Consumo (B02)**
  o **Crédito Fiscal (B01)** — B01 pide el RNC/cédula del cliente.
- El ticket imprime el RNC del negocio, el NCF, y el desglose de ITBIS incluido.
- Los números de NCF se asignan de forma atómica: si una venta falla, el número
  no se pierde ni se salta.

## ITBIS

- Tasa configurable en Ajustes → Fiscal (18% por defecto). Los precios de venta
  **ya incluyen** el ITBIS (estándar dominicano); Venilu calcula el desglose.
- Productos **exentos** (víveres básicos, medicinas...): marca "Exento de ITBIS"
  en la ficha del producto. Todo producto nuevo nace gravado.
- Con descuento a nivel de venta, el ITBIS se prorratea proporcionalmente.

## Reporte 607 (ventas)

Reportes → Exportar → **Reporte 607 (DGII)**: elige mes y año y obtienes un CSV
con todas las ventas con comprobante del período (RNC/cédula, tipo de
identificación, NCF, fecha, monto e ITBIS facturado), incluyendo las Notas de
Crédito B04 con su NCF modificado. Se lo entregas al contador del cliente para
su declaración mensual.

## Fuera del alcance (fase 2)

- **Facturación electrónica (e-CF, Ley 32-23)**: requiere certificado digital
  del contribuyente e integración con la API de la DGII. Verificar los plazos
  vigentes de la DGII antes de vender a contribuyentes ya obligados.
- Reporte 606 (compras) — Venilu no registra compras a proveedores todavía.
