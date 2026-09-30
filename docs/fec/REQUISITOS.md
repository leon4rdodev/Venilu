# Requisitos e-CF implementados — con cita de la fuente oficial

Documento de trabajo del módulo `src/main/modules/ecf/`.

Rectora aplicada: **no se implementa nada que no esté dicho textualmente por la DGII.**
Cada regla de abajo indica documento → sección → texto literal. Lo que la DGII **no** dice
está en la sección 5 (Pendientes), aislado y sin resolver por intuición.

Procedencia y hash de cada fuente: [`FUENTES.md`](FUENTES.md).

> Acrónimos de las fuentes:
> **[SDG]** `Descripcion Tecnica Servicios DGII.pdf`
> **[SEM]** `Descripcion Tecnica Emisores Electronicos.pdf`
> **[FIR]** `Firmado de e-CF.pdf`
> **[IT]**  `Informe Técnico e-CF v1.0.pdf`
> **[FE]**  `Formato Comprobante Fiscal Electrónico (e-CF) V1.0.pdf`
> **[FR]**  `Formato Resumen Factura Consumo Electrónica v1.0.pdf`
> **[FAQ]** `Preguntas Técnicas e-CF.pdf`
> **[FG]**  `Instructivo-Facturador-Gratuito-de-FE.pdf`
> **[CT]**  `Instructivo-Contingencia-FE.pdf`
> **[GU]**  `Guia-Basica-Proveedor-de-Servicios-de-Facturacion-Electronica.pdf`
> **[A06]** `Aviso 06-26 — Extensión del plazo de implementación de facturación electrónica`
> **[DT5]** `Descripcion Tecnica de Facturacion Electronica v1.5 (Mayo 2023)` — *documento
> **sustituido** el 02-01-2026 (ver FUENTES §3.1 y §3.3); solo se cita donde la versión
> vigente ya no recoge el contenido*

---

## 1. Estructura del XML

### 1.1 Nombre del archivo XML — `nombreArchivoXml()`

> **[SEM]** → *Estándares como Emisor Electrónico → Nombre de los Archivos XML*:
> "Deberá utilizarse el siguiente estándar para el nombre de los archivos de cada formato XML…
> Formato e-CF → `RNCEmisor+e-NCF` → Ejemplo `101672919E310000000001.xml`"
> "Formato de Resumen Factura de Consumo (32 < 250,000.00) → `RNCEmisor+e-NCF` → `101672919E320000000001.xml`"

Código: `src/main/modules/ecf/dgii/endpoints.ts` → `nombreArchivoXml(rnc, encf)`.

### 1.2 Prohibición de tags vacíos

> **[SEM]** → *Restricciones de Contenido y/o Caracteres en los XML*:
> "Adicionalmente, no deberá incluirse tags vacíos en los XML. Todo tag que no vaya a ser
> utilizado debe excluirse del e-CF, ya que su evaluación sin ningún tipo de valor provoca
> rechazos y afecta el tiempo de validación."

Código: `src/main/modules/ecf/xml/build-ecf.ts`. El builder está **guiado por el XSD**:
recorre la secuencia del esquema y omite todo campo cuyo valor sea `undefined`/`null`.
No existe forma de emitir `<Campo></Campo>` desde la API pública.

### 1.3 Orden de los elementos

El orden lo impone el XSD (`xs:sequence`), no una lista escrita a mano. `build-ecf.ts`
itera la secuencia parseada del esquema oficial; los keys que no existen en el XSD se
descartan en `descartados` en lugar de emitirse.

### 1.4 Escapado de caracteres en XML

> **[SEM]** → *Restricciones de Contenido y/o Caracteres en los XML*:
> "En la información 'ALFANUM' dentro de los XML a generar y enviar, los siguientes caracteres
> no deben emplearse, ya que tienen un significado por sí solos y deberán ser remplazados por
> definiciones estándar especificadas a continuación:"
> (tabla: `"` → `&quot;`/`&#34;`/`&#x22;`, `'` → `&apos;`/`&#39;`/`&#x27;`, `<` → `&lt;`/`&#60;`/`&#x3C;`,
> `>` → `&gt;`/`&#62;`/`&#x3E;`, `&` → `&amp;`/`&#38;`/`&#x26;`, `©` → `&copy;`/`&#169;`/`&#xA9;`,
> `€` → `&euro;`/`&#8364;`, `®` → `&reg;`/`&#174;`/`&#xAE;`)

Código: `src/main/modules/ecf/xml/escape.ts`. Se cubren las **ocho** filas de la
tabla:

- Los cinco metacaracteres (`"`, `'`, `<`, `>`, `&`) se emiten con la **entidad
  nominal** (`&quot;` `&apos;` `&lt;` `&gt;` `&amp;`), que son entidades
  predefinidas de XML y aparecen en la tabla de la DGII.
- `©`, `€` y `®` (agregados el 03-04-2025) se emiten con la **referencia
  numérica** (`&#169;`, `&#8364;`, `&#174;`). La tabla ofrece tres variantes por
  carácter —nominal, decimal y hexa— y se elige la decimal porque `&copy;`,
  `&euro;` y `&reg;` **no son entidades XML**: las ofrece la DGII pero un parser
  XML estricto las rechazaría. No se inventa ninguna variante, se descarta
  solo la que rompería el documento.
- Test: `src/main/modules/ecf/xml/escape.test.ts` (13 tests, una fila de la tabla
  por test).

Nota: una referencia de carácter decodifica al mismo carácter que la literal, así
que esto no cambia el valor validado por el XSD; cumple la exigencia de la DGII
de no incluir esos caracteres "crudos" en el archivo.

### 1.5 Formatos de fecha

El XSD impone el patrón. `formatoFecha()` produce `dd-MM-yyyy` (`FechaValidationType`) y
`formatoFechaHora()` produce `dd-MM-yyyy HH:mm:ss` (`DateTimeValidationType`, máx. 19
caracteres) para `<FechaHoraFirma>`.

Código: `src/main/modules/ecf/dgii/endpoints.ts`.
> La **zona horaria** de `<FechaHoraFirma>` es **GMT-4** → sección 4.16 (antes pendiente).

### 1.6 Redondeo de campos numéricos

Los tipos numéricos se redondean al `fractionDigits` que declara el propio XSD (2 en la
mayoría de los campos monetarios). Los strings pasan sin modificar.

### 1.7 Valores fuera del esquema

Ningún valor se "arregla" para que quepa: si un tipo del XSD lo rechaza, la validación falla
y el error se reporta. Ver `xml/xsd-validator.ts`.

---

## 2. Firma digital

### 2.1 Algoritmo obligatorio: SHA-256

> **[FAQ] #7** — "¿Cuál es el algoritmo de generación de firma? — Se firma mediante el
> algoritmo SHA-256. Ver RFC 2828 y documento 'Firmado de e-CF'."
>
> **[FIR]** → *Descripción*: "El SignatureMethod y el DigestMethod usan como algoritmo de
> encriptación/desencriptación la función criptográfica SHA256 para la firma, es obligatorio
> usar este tipo de función al firmar el XML de la e-CF."
>
> **[SEM]** → *Firmado de XML*: "El protocolo de firmado a utilizar es SHA-256."

Implementado: `SignatureMethod = .../xmldsigmore#rsa-sha256`, `DigestMethod = .../xmlenc#sha256`.

### 2.2 `Reference URI` debe ir en blanco

> **[FIR]** → *Descripción*: "El valor de la propiedad URI dentro de la etiqueta Reference
> tiene que estar en blanco (esto para referencia de que la firma se aplica a todo el
> documento)."
>
> **[FIR]** → ejemplo: `<Reference URI="">`.

Implementado con `isEmptyUri: true` en `xml-crypto`. **No** se inyecta ningún atributo `Id`
en la raíz `<ECF>`: hacerlo cambiaría el documento y rompería la validación de la DGII.

### 2.3 Sin preservación de espacios

> **[SEM]** → *Firmado de XML*: "Debe realizarse la firma sin la preservación de los espacios
> `preservewhitespace = false`."

El builder no emite espacios fuera de los valores, y el parser se configura con
`preserveWhitespace: false`.

### 2.4 El XML no puede alterarse después de firmar

> **[SEM]** → *Firmado de XML*: "Una vez firmado el XML, este no puede ser alterado en
> ninguna circunstancia."

Implementado por diseño: el XML firmado se guarda tal cual en la cola de salida y se
transmite sin reparsear ni re-serializar.

### 2.5 Certificado: el campo `SN` debe ser el RNC/cédula

> **[SEM]** → *Firmado de XML*: "El campo 'SN' de los certificados digitales debe
> corresponder al RNC, Cédula o Pasaporte del propietario del certificado."

Validación en `signing/p12.ts`: se lee el subject y se exige que el identificador fiscal
coincida con el RNC/cédula declarado. **No se firma con un certificado que no cumpla esto.**

### 2.6 C14n y transformaciones

`xml-crypto` aplica exc-c14n inclusivo y la transformación `enveloped-signature`, que es lo
que describe el ejemplo oficial de **[FIR]**. El ejemplo TypeScript que publica la DGII está
**truncado** en el PDF (`<SignatureValue>gQyXO0FFDGIITESTpP5xZjLIRtv/Q7/ixe1lNDLDA5aw...</SignatureValue>`),
por lo que no se copia tal cual: se reproduce la *estructura* declarada, no el código literal.

### 2.7 Verificación de integridad

`verificarFirma()` instancia `new SignedXml({ getCertFromKeyInfo: SignedXml.getCertFromKeyInfo })`.
**Por qué es explícito:** en `xml-crypto` v6 `getCertFromKeyInfo` queda en `noop` por omisión,
lo que haría que la verificación devolviera siempre "válido". Esto solo sirve para comprobar
integridad local; **la confianza en el certificado la da la DGII**, no el emisor.

---

## 3. Timbre / QR de la Representación Impresa

### 3.1 Parámetros del timbre de e-CF

> **[SDG]** → *Consulta timbre (QR)* → PARÁMETROS:
> "Parámetros para concatenar: RncEmisor, RncComprador, ENCF, FechaEmision, MontoTotal,
> FechaFirma, CodigoSeguridad"
>
> **[FAQ] #15** repite la lista y añade los formatos: "FechaEmision (dd-mm-aaaa)",
> "FechaFirma (dd-MM-aaaa HH:mm:ss)".

### 3.2 Ejemplo oficial de URL (e-CF) — el test reproduce esta cadena exacta

> **[SDG]** → *Consulta timbre (QR)* → EJEMPLO:
> `https://ecf.dgii.gov.do/testecf/consultatimbre?rncemisor=130000001&rnccomprador=130000002&encf=e310000000001&fechaemision=10-10-2020&montototal=02.11&fechafirma=10-10-2020%2009:00:00&codigoseguridad=dcp79q`
>
> "Esta URL es la que se espera al leer el QR de la RI de un e-CF."

### 3.3 Ejemplo oficial de URL (RFCE) — el test reproduce esta cadena exacta

> **[SDG]** → *Consulta timbre FC (QR)* → EJEMPLO:
> `https://fc.dgii.gov.do/testecf/consultatimbrefc?rncemisor=131880738&encf=e320000000064&montototal=6225.09&codigoseguridad=uabnyh`
>
> "Esta URL es la que se espera al leer el QR de la RI de un RFCE."

Tests: `src/main/modules/ecf/dgii/qr.test.ts` (9 tests) comparan byte a byte.

### 3.4 Orden de los parámetros

El orden es el del ejemplo oficial: `rncemisor`, `rnccomprador` *(solo si existe)*, `encf`,
`fechaemision`, `montototal`, `fechafirma`, `codigoseguridad`. En el RFCE: `rncemisor`,
`encf`, `montototal`, `codigoseguridad`.

### 3.5 Case de los nombres de parámetro — **resuelto**

> **[SDG]** → *Bitácora → Actualizaciones al 18-05-2023* → 3):
> "‐ Servicios no sensitivos a mayúsculas y minúsculas."

La lista de parámetros aparece en camelCase (`RncEmisor`, `ENCF`, `CodigoSeguridad`) y el
ejemplo workado los escribe en minúsculas. **Ambas formas son válidas.** El código usa
minúsculas para reproducir el ejemplo oficial byte a byte.

### 3.6 Versión del QR

> **[SDG]** → *Consulta timbre (QR)* → SALIDA: "Se utilizará la versión 8 de código QR para
> la representación impresa."

### 3.7 Caracteres reservados en la URL del timbre

> **[SEM]** → *Restricciones de Contenido y/o Caracteres…*:
> "En el caso de los datos del código de seguridad del QR en las representaciones impresas, a
> su vez no deben utilizarse los siguientes caracteres reservados ya que tienen un significado
> especial en la URL y deberán ser reemplazados en esta por su representación hexadecimal."
> (Espacio `%20`, `!` `%21`, `#` `%23`, `$` `%24`, `&` `%26`, `'` `%27`, `(` `%28`, `)` `%29`,
> `*` `%2A`, `+` `%2B`, `,` `%2C`, `/` `%2F`, `:` `%3A`, `;` `%3B`, `=` `%3D`, `?` `%3F`,
> `@` `%40`, `[` `%5B`, `]` `%5D`, `"` `%22`, `-` `%2D`, `.` `%2E`, `<` `%3C`, `>` `%3E`,
> `\` `%5C`, `^` `%5E`, `_` `%5F`, `` ` `` `%60`)

**Cómo está implementado (y por qué):** `codificarParametro()` percent-encoding dejando crudos
`[A-Za-z0-9\-._~:]` y codificando **todo lo demás**, incluida la tabla anterior.

La justificación es doble:

1. Esa es la **única** codificación que reproduce el ejemplo oficial de la DGII byte a byte
   (`09:00:00` con `:` crudo, `10-10-2020` con `-` crudo, `02.11` con `.` crudo). Si se
   aplicara la tabla a la URL completa, la salida sería `09%3A00%3A00` y **no** coincidiría
   con el EJEMPLO que la propia DGII declara como "la que se espera al leer el QR".
2. La tabla está enmarcada explícitamente en "**los datos del código de seguridad**", cuyo
   alfabeto es base64 (`A-Za-z0-9+/=`) o hex (`0-9a-f`). De los caracteres de la tabla, los
   únicos que pueden aparecer son `+`, `/` y `=` — y esos **sí** se codifican. Los que la
   implementación deja crudos (`-`, `.`, `_`, `:`) no pueden aparecer en un código de
   seguridad, así que en la práctica ambas lecturas producen idéntico resultado para ese campo.

Esto es una decisión de implementación documentada, **no** una confirmación de la DGII →
sección 5.3.

---

## 4. Envío, ambientes y estados

### 4.1 Ambientes

> **[SDG]** → *Descripción de Ambientes* y las secciones de cada servicio:
> `testecf` = pre-certificación, `certecf` = certificación, `ecf` = producción.
> Ej.: "TesteCF: Ambiente de pre-certificación: `https://ecf.dgii.gov.do/testecf/autenticacion`".

Código: `dgii/endpoints.ts` → `Ambiente`, `AMBIENTES`.

### 4.2 Servicios implementados

| Constante | Servicio oficial | Fuente |
| --- | --- | --- |
| `AUTENTICACION.semilla` / `.validarSemilla` | Autenticación (semilla → token) | **[SDG]** → *Autenticación* |
| `RECEPCION.ecf` | Recepción de e-CF | **[SDG]** → *Recepción de e-CF* |
| `RECEPCION.rfce` | Recepción de resumen factura de consumo (RFCE) | **[SDG]** → *Recepción de resumen factura de consumo electrónica (RFCE)* |
| `CONSULTAS.porTrackId` | Consulta resultado e-CF | **[SDG]** → *Consulta de resultado e-CF* |
| `CONSULTAS.porNcf` | Consulta estado e-CF | **[SDG]** → *Consulta de estado e-CF* |
| `CONSULTAS.rfce` | Consulta de resumen factura de consumo (RFCE) | **[SDG]** → *Consulta de Resumen de Factura de Consumo Electrónica (RFCE)* |
| `CONSULTAS.trackIds` | Consulta trackId e-CF | **[SDG]** → *Consulta de trackId e-CF* |
| `TIMBRE.general` / `.consumo` | Consulta timbre / Consulta timbre FC | **[SDG]** → secciones homónimas |
| `ESTATUS_SERVICIOS.*` | Consulta estatus servicios | **[DT5]** → *Estatus Servicios* (la versión vigente **[SDG]** ya no lo incluye; ver FUENTES §3.3) |

> **[SDG]** → *Recomendaciones #5*: "Tener en cuenta a la hora de realizar la representación
> impresa de los e-CF, que existen dos consultas timbre con variación de uso para los tipos 32."

### 4.3 E32 menor a RD$250,000 → RFCE, no e-CF

> **[SDG]** → *Recepción de e-CF*:
> "Las Facturas de Consumo Electrónica con un monto inferior a los RD$250,000.00, no serán
> recibidos por este servicio, se deberá remitir un resumen de este al servicio recepción de
> resumen factura de consumo e-CF."
>
> "...los e-CF correspondientes a Factura de Consumo Electrónica con un monto superior o igual
> a los RD$250,000.00 deben ser remitidas en su totalidad (todas las informaciones
> correspondientes a este e-CF) por el servicio de Recepción de e-CF."

### 4.4 Autenticación: token de 1 hora

> **[SDG]** → *Autenticación*: "…deberá enviar firmado para recibir un token con una duración
> determinada (1 hora por el momento)." → `Authorization: Bearer {token}`.
> Respuesta: `{ "token": "string", "expira": "yyyy-MM-ddTHH:mm:ssZ" }`.
>
> **[FAQ] #8**: "La autenticación no es con API Key sino con un token (jwt) que se obtiene por
> medio de la validación de una semilla firmada con un certificado digital…"

### 4.5 Estados de validación

> **[SDG]** → *Consulta de estado / trackId*: `No encontrado (0)`, `Aceptado (1)`,
> `Rechazado (2)`, `En Proceso (3)`, `Aceptado Condicional (4)`.

### 4.6 e-NCF: 13 posiciones

> **[IT]** → sección 7 *Estructura, Formato y Vencimiento de los Números Comprobantes Fiscales
> Electrónicos (e-NCF)*:
> "La secuencia del comprobante fiscal electrónico dispone de una estructura de trece (13)
> posiciones alfanuméricas. La letra E corresponde a la serie del e-CF, los dos dígitos
> siguientes identifican el tipo de e-CF y los últimos diez corresponden al secuencial."

→ `E` + 2 dígitos tipo + 10 secuenciales = 13 caracteres.

### 4.7 Contingencia

> **[CT]**: "una vez se reestablezca la conexión, en un plazo no mayor de setenta y dos (72)
> horas" … "su validez fiscal, a partir de las setenta y dos (72) horas."
> "Una vez superada la contingencia, el contribuyente tiene 30 días calendario para…"
> (emitir los e-CF de reemplazo).

### 4.8 Código de seguridad del QR

> **[FG]** → glosario / **[IT]** 18.2.3 / **[FAQ] #15 y #16** (idénticas en las tres):
> "Código de Seguridad: corresponde a los primeros seis (6) dígitos del hash generado en el
> SignatureValue de la firma digital del e-CF."

Implementado en `signing/security-code.ts`. **La DGII no publica el algoritmo de ese hash ni
su codificación** → sección 5.1.

### 4.9 Validación XSD propia

> **[SDG]** → *Lenguaje Estándar de Comunicación*:
> "Para cada operación que se estará realizando en Facturación Electrónica, la autoridad
> tributaria dispone de un formato preestablecido que describe los datos y validaciones que
> estas operaciones contemplan, adicional a un XSD a modo de referencia estructural de dichos
> XML."

Se usa el XSD **oficial** descargado de la DGII (hash en `FUENTES.md`), no un esquema
reescrito a mano.

---

### 4.10 Tipos de e-CF que emite Venilu (31 / 32 / 34)

> **[XSD]** `e-CF 31/32/34 v.1.0.xsd` → `xs:simpleType name="TipoeCFType"`, comentario literal
> de cada enumeración:
> `31` *Factura de Crédito Fiscal Electrónica* · `32` *Factura de Consumo Electrónica* ·
> `33` *Nota de Débito Electrónica* · `34` *Nota de Crédito Electrónica* ·
> `41` *Compras Electrónico* · `43` *Gastos Menores Electrónico* ·
> `44` *Regímenes Especiales Electrónico* · `45` *Gubernamental Electrónico* ·
> `46` *Comprobante de Exportaciones Electrónico* · `47` *Comprobante para Pagos al Exterior
> Electrónico*.

Venilu emite **31** (al cobrar con RNC/cédula del cliente), **32** (consumo) y **34**
(anulaciones y devoluciones); `33` y los demás tipos no son operación de un POS.

→ `fiscal.service.ts` (`NcfType`), `src/shared/ncf.ts` (etiquetas),
Ajustes → *Fiscal* (secuencias) y el diálogo de cobro.

### 4.11 Retiro de la facturación en papel (secuencias B)

> Calendario de obligatoriedad → §7 (fuente **[A06]** `Aviso 06-26`): las secuencias tipo B
> vencen el **31 oct 2026** y desde el **1 nov / 15 nov 2026** solo se emiten e-CF.

Decisión de implementación (no es una regla de la DGII, es la forma de cumplirla): la
migración `1757450000000-EcfDocuments` **borra** las secuencias `B01/B02/B04` de
`ncf_sequences` y deja el registro de rangos **e-NCF** en Ajustes → Fiscal. Un rango tipo B
autoriza comprobantes en papel (serie B, 8 dígitos) y el e-NCF es otra estructura de 13
posiciones autorizada aparte en la Oficina Virtual: reutilizarlo produciría e-NCF sin
autorización.

Las ventas antiguas con NCF de papel se conservan en la base para lectura e impresión de
recibos históricos (`src/shared/ncf.ts` acepta `B01/B02/B04` **solo** para etiquetarlas), pero
el sistema ya no los emite.

### 4.12 `FechaVencimientoSecuencia` obligatoria en el e-CF 31

> **[XSD]** `e-CF 31 v.1.0.xsd` → `IdDoc`:
> `<xs:element name="FechaVencimientoSecuencia" type="FechaValidationType" minOccurs="1" maxOccurs="1"/>`

→ el elemento es **obligatorio**. Por eso el formulario de secuencias exige la fecha cuando
el tipo es `31` (`fiscal-settings.tsx`) y `FiscalService.saveSequence` la rechaza sin ella.
En los tipos 32 y 34 el XSD lo marca `minOccurs="0"` y no se exige.

### 4.13 Forma exacta de las respuestas de la DGII *(contrato de la Fase 3 — implementado)*

Todas las citas de esta sección son de **[SDG]** → *Descripción de Servicios* → FORMATOS
SALIDA de cada servicio (la bitácora del 18-05-2023 indica: "Se agregaron descripciones de
los **parámetros de salida de todos los servicios** de Impuestos Internos").

> *VALIDAR SEMILLA*:
> `{ "token": "string", "expira": " yyyy-MM-ddTHH:mm:ssZ ", "expedido": " yyyy-MM-ddTHH:mm:ssZ" }`
> (XML `<RespuestaAutenticacion>`) → ver §4.4.

> *Recepción de e‐CF*:
> `{ "trackId": "string", "error": "string", "mensaje": "string" }`
> / XML `<RespuestaRecepcion><trackId/><error/><mensaje/></RespuestaRecepcion>`.
> "Trackid: número único generado por Impuestos Internos a un e-CF recibido."
> "Error: motivo del mensaje de error recibido (Si aplica)."

> *Recepción de resumen factura de consumo electrónica (RFCE)*:
> `{ "codigo": 1, "estado": "string", "mensajes": [{ "codigo": "string", "valor": "string" }], "encf": "string", "secuenciaUtilizada": true }`

> *Consulta de resultado e‐CF*:
> `{ "trackId", "codigo", "estado", "rnc", "eNCF", "secuenciaUtilizada", "fechaRecepcion", "mensajes": [{ "valor", "codigo" }] }`
> **Ojo:** en JSON la clave es `eNCF`; en la respuesta XML es `encf`.

> *Consulta de estado e‐CF*:
> `{ "codigo", "estado", "rncEmisor", "ncfElectronico", "montoTotal", "totalITBIS", "fechaEmision", "fechaFirma", "rncComprador", "codigoSeguridad", "idExtranjero" }`

**Discrepancia detectada entre servicios:** en *RFCE* `mensajes[].codigo` es **string** y en
*Consulta de resultado* es **number**. El parser de la Fase 3 debe tolerar ambos tipos.

Cabeceras de los ejemplos curl oficiales: `accept: application/json` y
`Authorization: bearer <token>` (§4.4). Multipart con `-F 'xml=@RNCEmisor+e-NCF.xml;type=text/xml'`
→ nombre de archivo en §1.1.

### 4.14 `secuenciaUtilizada`: cuándo se puede reusar un e-NCF rechazado

> **[SDG]** → *Consulta de resultado e‐CF* → DESCRIPCIÓN:
> "secuenciaUtilizada permite dar a conocer si el número de secuencia que fue recibido por
> Impuestos Internos puede reutilizarse en otro Comprobante Fiscal Electrónico (e-CF) en el
> escenario de que el resultado de la validación haya sido 'Rechazado' por los siguientes
> motivos: Certificado y/o firma inválida · Estructura del comprobante (XML) no es válida ·
> Firmante del comprobante fiscal electrónico no corresponde a un delegado autorizado para
> hacer transacciones para el RNC Emisor · El e-NCF no está autorizado para el RNC Emisor del
> comprobante fiscal electrónico · El e-NCF autorizado se encuentra vencido a la fecha de envío
> del comprobante fiscal electrónico · El RNC Emisor del comprobante no corresponde a un emisor
> electrónico · El RNC Emisor no existe · El RNC Emisor no se encuentra activo."
>
> "Posibles valores del parámetro: **True = No puede reutilizarse la secuencia.**
> **False = Puede reutilizarse la secuencia.**"

Implicación para la máquina de estados: un documento **rechazado no devuelve por sí solo** el
número al rango; solo se libera cuando la DGII responde `secuenciaUtilizada: false`.

También de **[SDG]** → *Consulta de resultado* → ESTADOS SALIDA: "El promedio estimado de
validación es de **200 ms**" — útil para dimensionar el reintento del worker.

### 4.15 Ciclo de emisión de un comprobante (Fase 3)

Implementado en `src/main/modules/ecf/services/emision.ts` (+ `services/worker.ts`).

**Máquina de estados** (columnas `ecf_documents.estado` / `via`, sin migración nueva):

```
draft ──firmar──▶ signed ──enviar──▶ sent ──consulta──▶ accepted | rejected
  │                 │                  │
  └── last_error ───┴── backoff ───────┘        (el estado NO retrocede)
```

| Paso | Regla | Cita |
| --- | --- | --- |
| `firmar` | `mapearVenta` → XML → XSD **sin firma** → `firmarXml` → XSD **con firma** → código de seguridad | §2.1, §1.4 |
| `enviar` | `POST` multipart, campo `xml`, nombre `RNC+e-NCF.xml`, cabeceras `accept: application/json` y `Authorization: bearer <token>` | §1.1, §4.4, §4.13 |
| `consultar` | e-CF → `?trackid=`; RFCE → `?RNC_Emisor=&ENCF=&Cod_Seguridad_eCF=` | §4.13 |
| `via` | `ecf` si `tipo ≠ 32` **o** `monto ≥ 250,000`; `rfce` solo para 32 < 250,000 | §4.3 |

**Estados de la DGII** (`codigo`) → estado nuestro:

> **[SDG]** → ESTADOS SALIDA: "0 No encontrado · 1 Aceptado · 2 Rechazado ·
> 3 En proceso · 4 Aceptado condicional"

| `codigo` | Texto (`estado`) | Nuestro `estado` |
| --- | --- | --- |
| 1 o 4 | contenga "aceptad" | `accepted` (+ `resolved_at`) |
| 2 | contenga "rechaz" | `rejected` (+ `resolved_at`) |
| 0, 3 o sin código | — | `sent` → se vuelve a consultar con backoff |

El texto se interpreta **primero** porque la recepción RFCE devuelve la frase y el código
puede venir como `string` (§4.13).

**Reintentos** (`programarReintento`): 30 s → 1 min → 2 min … techo 6 h; al llegar a 10
intentos, 24 h. Un fallo solo escribe `last_error` + `proximo_intento`: **nunca rompe la
venta**. Regla de "vencido":

| `estado` | El worker lo toma cuando |
| --- | --- |
| `draft`, `signed`, `queued` | `proximo_intento IS NULL` (nunca intentado) **o** `≤ ahora` |
| `sent` | `proximo_intento IS NOT NULL` **y** `≤ ahora` (evita sondear sin parar) |
| `accepted`, `rejected` | nunca |

**RFCE derivado del e-CF firmado.** `signed_xml` guarda **siempre el e-CF extendido**
(E31/E32/E34) firmado; el RFCE se reconstruye y firma en cada envío leyendo `Emisor`,
`Comprador`, `Totales` e `IdDoc` del propio XML firmado. Razón: así el resumen y el
comprobante coinciden **por construcción**, aunque cambien los Ajustes entre firmar y
transmitir, y no hace falta migrar el esquema. La firma RSA-PKCS#1v1.5 es determinista
(§2.1), por lo que el resultado es reproducible. El RFCE se comprueba contra `rfce-32.xsd`
**también al firmar**, para no dejar en cola un comprobante que no se podrá transmitir.

**`CodigoModificacion`** (XSD `CodigoModificacionType`, citado en §5.10):

| Situación | Código | Literal del XSD |
| --- | --- | --- |
| Anulación de la venta (`sale.status='voided'`) | `1` | "Anula el NCF modificado" |
| Devolución (`SaleReturn` con `credit_note_ncf = doc.encf`) | `3` | "Corrige montos del NCF modificado" |

Además, en una devolución las líneas de la NC son **solo lo devuelto** y el descuento global
que ya se prorrateó al reembolso viaja en `<MontoDescuento>`; así los totales de la NC
cuadran con `SaleReturn.total_refunded`.

**Tags omitidos a propósito** (§1.2): `TablaTelefonoEmisor` se excluye si el teléfono no
admite `\d{3}-\d{3}-\d{4}` (XSD `TelefonoValidationType`) — es opcional (`minOccurs="0"`).
`Municipio`, `Provincia`, `ActividadEconomica`, `NombreComercial` y `TablaFormasPago` (34)
no existen en los Ajustes actuales o no aplica el tipo, y el XSD los marca `minOccurs="0"`.

### 4.16 `<FechaHoraFirma>`: zona horaria **GMT-4** — *resuelto*

> **[FE]** → Formato Comprobante Fiscal Electrónico (e-CF) V1.0 → sección **G. FECHA Y HORA
> DE LA FIRMA DIGITAL**, campo 1 `<FechaHoraFirma>`:
> "Fecha y hora en formato dd-MM-AAAA HH:mm:ss; Zona horaria GMT -4" (Largo Max 19,
> Tipo ALFA NUM, Pág. 57 de 87).

Es una zona **fija**, no la local de la máquina: `formatoFechaHora()` resta 4 h a la marca
de tiempo y lee los campos UTC, así que el valor es idéntico en cualquier equipo.
Cubierto por `src/main/modules/ecf/dgii/endpoints.test.ts`.

Esto **cierra el pendiente 5.2**.

### 4.17 Códigos de obligatoriedad del Formato — qué tags se pueden omitir

> **[FE]** → *2. Detalle por sección* → "Códigos de Obligatoriedad":
> "**0: No corresponde.** Significa que el dato no debe ir en un determinado documento.
> **1: Dato obligatorio.** El dato siempre debe estar en el documento, independiente de las
> características de la transacción. **2: Dato condicional.** El dato no es obligatorio en
> todos los documentos, pero pasa a serlo en determinadas operaciones si se cumple una
> determinada condición. […] **3: Opcional.** El dato es opcional." (Pág. 4 de 87)

Regla de implementación: un código **0** no se emite jamás, un **1** el validador lo exige,
un **2** solo si la condición se cumple y un **3** se emite si tenemos el dato y es válido.
Esto es lo que respalda las omisiones de §4.15 (`TablaTelefonoEmisor`, `Municipio`,
`Provincia`, `ActividadEconomica`, `NombreComercial`, `TablaFormasPago` en el 34), siempre
que el XSD además los marque `minOccurs="0"`.

Ejemplos en la tabla de *Información de referencia* (mismo documento): `CodigoModificacion`
= **2 (condicional)** en 31 y 32 y **1 (obligatorio)** en 33 y 34; `RazonModificacion` =
**3 (opcional)** en 33 y 34 (Largo 90, ALFA, validación "a) Sin validación").


---

## 5. PENDIENTES DE CONFIRMACIÓN CON LA DGII

Nada de esto está **pendiente de que cambie el código por una decisión nuestra**: cada punto
está aislado en su propio módulo con un parámetro/constante para poder cambiarlo en un solo
lugar cuando la DGII lo confirme. El único ya resuelto con cita literal es **5.2** (→ §4.16).

### 5.1 Código de seguridad: algoritmo y codificación del "hash"

**Qué dice la DGII** (ahora confirmado en **dos** documentos):

> **[SDG]** → *Consulta de estado e‐CF* → DESCRIPCION (y lo mismo en *Consulta de resultado e‐CF*):
> "− codigoSeguridad: extraído de los **primeros seis (6) dígitos del hash generado en el
> SignatureValue** de la firma digital del e-CF recibido."

> **[FR]** → campo 31 "Código Seguridad Factura de Consumo DOP$<250 M" → Largo **6**, Tipo
> **ALFA NUM**.

**Qué no dice:** cuál es el algoritmo (`¿MD5? ¿SHA-1? ¿SHA-256?`) ni la codificación
(`¿hex? ¿base64?`), ni si "hash" significa *el valor que ya está dentro de `SignatureValue`*
o *un hash aplicado sobre él*.

**Estado:** aislado en `signing/security-code.ts` con `EstrategiaCodigoSeguridad`:
`'signature-value'` *(por omisión)*, `'sha256-base64'`, `'sha1-base64'`, `'md5-base64'`,
`'md5-hex'`.

**Se resuelve con UN comprobante en pre-certificación (CertECF):**
1. Emitir un E32 < RD$250,000 y leer su QR.
2. Consultar `/consultatimbrefc` con la estrategia por omisión y anotar la respuesta.
3. Repetir con cada alternativa. La que devuelve "Aceptado" es la correcta.

**Cómo se llega a que el valor mide 6 caracteres y no 6 dígitos numéricos:**
> **[FR]** → campo 31 "Código Seguridad Factura de Consumo DOP$<250 M" → Largo **6**, Tipo
> **ALFA NUM**, más los ejemplos oficiales `dcp79q` y `uabnyh` (mezcla de letras y números)
> — los mismos ejemplos que aparecen en las URL de timbre de **[SDG]** (§3.2 y §3.3).

### 5.2 Zona horaria de `<FechaHoraFirma>` — ✅ **RESUELTO → §4.16**

**Resuelto el 2026-09-30** con **[FE]** → sección *G. FECHA Y HORA DE LA FIRMA DIGITAL*:
"Fecha y hora en formato dd-MM-AAAA HH:mm:ss; **Zona horaria GMT -4**". `formatoFechaHora()`
ya emite en GMT-4 fijo (no la zona local) y hay tests que lo verifican. Ver §4.16.

*Se conserva el texto original del pendiente:* "el formato (`dd-MM-yyyy HH:mm:ss`, máx. 19
caracteres). **Qué no dice:** la zona horaria. **Estado:** `formatoFechaHora()` usa la zona
**local** de la máquina."

### 5.3 Caracteres reservados: tabla vs. ejemplo oficial

**Qué dice la DGII:** dos cosas que no cuadran entre sí en la misma documentación:
- La **tabla** de *Restricciones de Contenido y/o Caracteres* lista `:`, `-`, `.` y `_` como
  caracteres que "deberán ser reemplazados en esta por su representación hexadecimal".
- El **ejemplo workado** de *Consulta timbre* los deja crudos:
  `fechafirma=10-10-2020%2009:00:00`, `fechaemision=10-10-2020`, `montototal=02.11`,
  y declara: "Esta URL es la que se espera al leer el QR de la RI de un e-CF."

**Estado:** ver §3.7. Se implementa la lectura que reproduce el ejemplo oficial byte a byte
y que es equivalente a la tabla para todo carácter que puede aparecer en un código de
seguridad. **Confirmar en pre-certificación** escaneando el QR generado y comparando la
respuesta del servicio de timbre.

### 5.4 MontoTotal en el QR

**Qué dice la DGII:** `MontoTotal` entre los parámetros; el ejemplo muestra `02.11` y
`6225.09` (siempre 2 decimales).
**Qué no dice:** si la cadena debe coincidir **exactamente** con el texto de `<MontoTotal>` del
XML o si admite otro formato de redondeo.

**Estado:** se emite `toFixed(2)`. Pendiente de confirmación (afecta si el total tiene más de
2 decimales de origen).

### 5.5 Autorización de emisor electrónico para los clientes de Venilu

**Pregunta abierta:** si Venilu actúa como PSFE, ¿cada cliente necesita su propia autorización
como emisor electrónico y sus propios rangos e-NCF, o los emite Venilu bajo su RNC?

> **[GU]** → *Modelos operativos de los Proveedores de Servicios de FE* describe DOS modelos:
> "Proveedores que prestan servicio de desarrollo, y el uso de los certificados digitales y
> las firmas reside en la infraestructura tecnológica **del propietario del certificado**" /
> "Proveedores que ofrecen su software como servicio, y el uso y la custodia de los
> certificados digitales y las firmas reside en la infraestructura tecnológica **del
> proveedor**."

**Estado:** sin implementar. Es una decisión de modelo de negocio con impacto directo en
quién guarda el `.p12` y quién firma. No se toca nada hasta confirmarlo con la DGII.

### 5.6 XSD oficial `e-CF 31 v.1.0.xsd` no compila con validadores externos

**Qué se verificó:** con libxml2 2.15.3 el XSD oficial del tipo 31 falla en la línea 476
(`<xs:simpleType name=" IndicadorServicioTodoIncluidoType">`, espacio inicial).

**Mitigación actual:** `qname()` aplica `trim()` al leer el esquema. Los archivos oficiales
**no** se modifican en el repo.

**Pendiente:** decidir si se reporta a la DGII y/o se envía un XSD corregido durante la
certificación.

### 5.7 Equivalencia entre los tipos de papel retirados y los e-CF

**Qué dice la DGII:** el XSD `TipoeCFType` nombra a `31` *Factura de Crédito Fiscal
Electrónica*, `32` *Factura de Consumo Electrónica* y `34` *Nota de Crédito Electrónica*.
**Qué no dice (en las fuentes de `FUENTES.md`):** una tabla que diga literalmente
"B01 → 31, B02 → 32, B04 → 34".

**Supuesto en uso:** la correspondencia se establece **por el nombre del comprobante**, que
es idéntico en ambos casos (`B01` Crédito Fiscal · `B02` Consumo · `B04` Nota de Crédito).

**Dónde está aislado:** `src/shared/ncf.ts` — el único sitio que traduce un tipo a una
etiqueta; cambiar la regla ahí cambia toda la interfaz.

**Pendiente:** confirmarlo con la DGII durante la certificación (o con el Anexo de
Resolencias Normativas que define las series B).

### 5.8 Nombre del archivo multipart de la semilla

**Qué dice la DGII:** la recepción de e-CF exige `RNCEmisor+e-NCF.xml`
(`nombreArchivoXml()` → §1.1) y el contrato del servicio de autenticación es `POST` con
`-F 'xml=@…'`.
**Qué no dice:** el nombre de archivo que debe llevar el `xml` de la **semilla firmada**.

**Supuesto en uso:** `semilla.xml` (literal en `dgii/client.ts`).

**Pendiente:** verificarlo en la pre-certificación; si la DGII lo rechaza, es un solo literal.

### 5.9 API key del servicio "Estatus Servicios" y su desaparición del documento vigente

**Qué dice la DGII** (fuente **[DT5]**, *Estatus Servicios* → OBTENER ESTATUS):

> "Este servicio cuenta con una clave única (**APIKEY**) para la autorización de su uso, el
> cual es **entregado por la autoridad tributaria cuando se cumplen ciertos requisitos**."
>
> `REQUEST URL  https://statusecf.dgii.gov.do/api/estatusservicios/obtenerestatus`
> `-H 'Authorization: Apikey XXXXXXX-XXXXXXX-XXXX-XXXXXXXXXX'`

**Qué no dice la versión vigente:** nada. El índice de **[SDG]** (bitácora hasta 02-01-2026)
**no incluye** este servicio — ver FUENTES §3.3.

**Verificado en vivo el 2026-09-26:** la URL es correcta y el servicio responde, pero siempre
`HTTP 401` con cuerpo vacío (con y sin encabezados inventados; añadiendo el segmento de
ambiente devuelve `404`). Por tanto:

**Estado en el código:** `estatusServicios()` se conserva en `dgii/client.ts`, se muestra como
**informativo** y su `401` se marca `credencialRequerida: true`. **No decide** si hay conexión.
La prueba de conexión real es `probarAmbiente()`, que hace `GET` de la semilla del ambiente
elegido (`testecf` / `certecf` / `ecf`) y exige `HTTP 200` con `<SemillaModel>` — verificado el
2026-09-26 en los tres ambientes, sin token ni API key.

**Pendiente:** confirmar en pre-certificación si el servicio sigue publicado y cómo se solicita
la API key.

### 5.10 `CodigoModificacion` de una **devolución**: ¿3 o 1?

**Qué dice la DGII** (**[FE]** → área *INFORMACIÓN DE REFERENCIA*, campo 4
`<CodigoModificacion>`, enumeración literal de la columna):

> `1` "Anula el NCF modificado" · `2` "Corrige Texto del NCF modificado" ·
> `3` "Corrige montos del NCF modificado" · `4` "Reemplazo NCF emitido en contingencia" ·
> `5` "Referencia Factura de Consumo Electrónica."
>
> Validación: "a), b) y c) solo aplican para Nota de Crédito o Débito Electrónica."
> Condicional a que el código de modificación sea igual a 4 (para `RazonModificacion`).

Y la nota al pie de esa misma tabla (nota 80, Pág. 57 de 87):

> "Códigos de modificación 1, 2 y 3 aplican solo cuando se trate de la emisión de una nota
> de crédito o débito electrónica, según corresponda."

La obligatoriedad de `CodigoModificacion` para el tipo **34** es **1 = dato obligatorio**
(ver §4.17); `RazonModificacion` es **3 = opcional** en 33 y 34.

**Qué no dice:** si una **devolución total** (que anula de hecho la factura original) debe
reportarse con `1` "Anula el NCF modificado" en lugar de `3` "Corrige montos". Tampoco qué
código corresponde a una **devolución parcial** cuando el e-NCF original sigue vigente.

**Estado en el código:** `services/emision.ts` → anulación de venta = `1`, devolución = `3`,
detectando la devolución por `SaleReturn.credit_note_ncf = doc.encf`. Cada caso está en su
propio `if` con su literal del XSD comentado; cambiarlo es una línea.

**Pendiente:** confirmar en pre-certificación (con una devolución real) qué código espera la
DGII y si exige alguna redacción concreta en `RazonModificacion`.


---

## 6. Requisitos de la certificación PSFE (aún no implementados)

> **[GU]** → *Requisitos de autorización para ser Proveedor de Servicios de FE*:
> - "Estar incorporado y activo en el Registro Nacional de Contribuyentes (RNC)."
> - "Poseer clave de acceso a la Oficina Virtual (OFV)."
> - "Estar autorizado y certificado por la DGII para ser Emisor de Comprobantes Fiscales
>   Electrónicos (e-CF)."
> - "Tener un Certificado Digital de Personas Físicas para procedimientos tributarios,
>   emitido por una entidad de certificación autorizada conforme a la Ley Núm. 126-02…"
> - "Tener una actividad económica relacionada con la venta y/o desarrollo de aplicaciones
>   informáticas."
> - "Estar al día en el cumplimiento de sus obligaciones formales y sustantivas."
> - "Cumplir con las exigencias técnicas dispuestas por la DGII."
> - "Anexar los documentos solicitados en el archivo 'Documentaciones soporte para la
>   autorización y certificación de Proveedores de Servicios de Facturación Electrónica.'"

> **[GU]** → *Responsabilidades que debe cumplir todo Proveedor de Servicios de FE*:
> - "Asegurar la confidencialidad del manejo de las informaciones contenidas en los e-CF."
> - "Proporcionar a la DGII todas las informaciones digitales o físicas que le sean requeridas…"
> - "Disponer de mecanismos seguros para el almacenamiento de los datos fiscales, de los
>   comprobantes fiscales y de los certificados digitales."
> - "Garantizar el compromiso de niveles de servicio que avalen la disponibilidad mínima de
>   los mismos."
> - "Disponer de una mesa de ayuda…"
> - "Responder conforme a la Ley Núm. 32-23 por el uso indebido de las informaciones a las
>   que tiene acceso."
> - "Proporcionar el acceso para que el contribuyente firme el Comprobante Fiscal Electrónico
>   (e-CF) con su certificado digital para procedimiento tributario, cuando las operaciones de
>   firmado son realizadas en su sistema."

> **[GU]** → *Condiciones del software de los PSFE*: software que permita "la elaboración,
> emisión, consulta y uso de Comprobantes Fiscales Electrónicos (e-CF)"; garantizar criptografía
> para "proteger la confidencialidad, integridad, autenticidad y disponibilidad"; "crear y
> estructurar los sistemas o soluciones a ser utilizados por sus clientes, conforme a lo
> establecido en los formatos de especificación y sus anexos de Facturación Electrónica".

Etapas (**[GU]**): **1. Solicitud** (formulario + declaración jurada) → **Sets de pruebas**
→ **2. Certificación**. Proceso detallado en `proceso-psfe.pdf`. Documentación a anexar en
`docsoporte-psfe.pdf` (Anexo 1.1 Política de Seguridad, Anexo 1.2 Política de Contingencia, …).

---

## 7. Calendario de obligatoriedad

- **31 oct 2026** — vencen las secuencias tipo B.
- **1 nov 2026** — solo e-CF para grandes y medianos *(verificar con la DGII el grupo exacto)*.
- **15 nov 2026** — pequeños, micros, no clasificados.
  Fuente: **Aviso 06-26** (6 de mayo de 2026), "Extensión del plazo de implementación de
  facturación electrónica para contribuyentes pequeños, micros y no clasificados".
- **Certificación DGII**: estimación de 2 a 6 semanas *(no es dato oficial → no planificar
  en torno a ella como si lo fuera)*.
