# Fuentes oficiales DGII — Facturación electrónica (e-CF)

Todo lo implementado en `src/main/modules/ecf/` se deriva **exclusivamente** de los
documentos listados aquí. Nada se tomó de blogs, librerías de terceros ni de
documentación de otros países.

- **Fecha de verificación de las URLs y de los hashes: 2026-09-26.**
  Re-verificación puntual **2026-09-30**: se volvió a descargar `formato-ecf.pdf` (se borró la
  copia de trabajo en `/tmp`) y el SHA-256 siguió coincidiendo con el de §2 (`c811c91a…`);
  con ese PDF se confirmaron las citas de REQUISITOS §4.16 y §5.10.
- Página de origen de todos los enlaces:
  <https://www.dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/documentacionSobreE-CF.aspx>
- Si un documento cambia, el hash deja de coincidir: eso es la señal de que hay que
  revisar si alguna regla implementada quedó obsoleta.

## Cómo descargar (la DGII devuelve 403 si no se manda User-Agent y Referer)

```bash
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
REF='https://www.dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/documentacionSobreE-CF.aspx'
curl -sL -A "$UA" -e "$REF" -o salida.pdf "<URL>"
```

Sin `-A`/`-e` la DGII responde `HTTP/2 403` con un HTML de "Acceso Denegado" de 6153 bytes.

> Nota: la carpeta `Documentacin sobre eCF` **no lleva tilde** en la ruta (así está en el
> `href` de la página oficial); los subdirectorios sí llevan tildes.

---

## 1. XSD oficiales (los que están en el repo)

Están en `src/main/modules/ecf/schemas/`. La copia en el repositorio es **idéntica byte a
byte** con el archivo descargado de la DGII (verificado el 2026-09-26).

Base: `https://www.dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaci%C3%B3n%20T%C3%A9cnica%20(XSD)/`

| Archivo en repo | Nombre oficial | SHA-256 |
| --- | --- | --- |
| `schemas/ecf-31.xsd` | `e-CF 31 v.1.0.xsd` | `6f2909a93d84919518d2ae3c77fead4b35c3e8c95996b8af67b0040c2e2be298` |
| `schemas/ecf-32.xsd` | `e-CF 32 v.1.0.xsd` | `151676df03c61335b4ac1eca97f99395488d57ea92793b49353602871e651f3c` |
| `schemas/ecf-34.xsd` | `e-CF 34 v.1.0.xsd` | `6c62ebabdea9a6f6d62ae85d9e1c2eb788f44f3f0b61945fe116700c4eaac2da` |
| `schemas/rfce-32.xsd` | `RFCE 32 v.1.0.xsd` | `6aad535875661b05eef072963295202fc94b3b320b257791feb8d3c39a5f8ee6` |
| `schemas/semilla.xsd` | `Semilla v.1.0.xsd` | `bebef2033c930a30c8cef45b513db00403423125a7f3f48e100a73e3e355f67e` |

XSD publicados por la DGII pero **no** incorporados aún (mismo directorio):
`e-CF 33`, `e-CF 41`, `e-CF 43`, `e-CF 44`, `e-CF 45`, `e-CF 46`, `e-CF 47`,
`ARECF v1.0.xsd`, `ANECF v.1.0.xsd`, `ACECF v.1.0.xsd`.

### Regeneración de los archivos embebidos

Los `.xsd` no los copia `tsc` hacia `dist-electron` (que es lo que empaqueta
`electron-builder`), así que se embeben en TypeScript:

```bash
node scripts/gen-xsd.mjs   # genera schemas/xsd.generated.ts y schemas/index.ts
```

Se debe correr cada vez que cambie cualquier `.xsd`. El test de hash falla si los `.xsd`
en disco dejan de coincidir con lo embebido.

### Hallazgo: `e-CF 31 v.1.0.xsd` oficial no compila con validadores XSD externos

Verificado el 2026-09-26 con libxml2 2.15.3: el XSD oficial del tipo 31 falla en la línea 476
con `<xs:simpleType name=" IndicadorServicioTodoIncluidoType">` (espacio inicial en el `name`).
Los XSD oficiales **no se modifican** en el repo. El workaround está en
`src/main/modules/ecf/xml/xsd-model.ts` (`qname()` aplica `trim()`), lo que permite leer el
esquema sin alterar el archivo de la DGII. **Pendiente: reportar el error a la DGII.**

---

## 2. Documentos técnicos y de proceso (PDF)

Todos descargados de `https://www.dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/`
y verificados por SHA-256 contra la copia local en `/tmp/opencode/`.

| Nombre local | Título / versión | URL (relativa a la base anterior) | SHA-256 |
| --- | --- | --- | --- |
| `desc-servicios-dgii.pdf` | Descripción Técnica **Servicios DGII** (bitácora hasta 02-01-2026) | `Documentacin%20sobre%20eCF/Informe%20y%20Descripci%C3%B3n%20T%C3%A9cnica/Descripcion%20Tecnica%20Servicios%20DGII.pdf` | `85a601ffe4af67ad2220e52d669bc673fc8affe02feb464bf04dabd4fe2f67ce` |
| `desc-emisores.pdf` | Descripción Técnica **Emisores Electrónicos** | `Documentacin%20sobre%20eCF/Informe%20y%20Descripci%C3%B3n%20T%C3%A9cnica/Descripcion%20Tecnica%20Emisores%20Electronicos.pdf` | `d532598461fc65bb731d37b32d57af83763649921a91aeb9d5c93359834e41a1` |
| `informe-tecnico.pdf` | Informe Técnico e-CF v1.0 | `Documentacin%20sobre%20eCF/Informe%20y%20Descripci%C3%B3n%20T%C3%A9cnica/Informe%20T%C3%A9cnico%20e-CF%20v1.0.pdf` | `0f1c5dcad895ea81297c5a0a211ea4ce78b56f3ad211dfcfc12cfc729f05b1ff` |
| `ri-modelos.pdf` | Modelos ilustrativos de Representación Impresa | `Documentacin%20sobre%20eCF/Informe%20y%20Descripci%C3%B3n%20T%C3%A9cnica/Representaci%C3%B3n%20Impresa%20(Modelos%20ilustrativos).pdf` | `3f8da8532607d691c1930ccbac097a2ab92743788bd8543ab9d712606748ccb1` |
| `formato-ecf.pdf` | Formato Comprobante Fiscal Electrónico (e-CF) V1.0 (oct-2025) | `Documentacin%20sobre%20eCF/Formatos%20XML/Formato%20Comprobante%20Fiscal%20Electr%C3%B3nico%20(e-CF)%20V1.0.pdf` | `c811c91a9e6a61a65d0637920cea51ef474160d7cd7bc7087fbf895597e17d5a` |
| `formato-rfce.pdf` | Formato Resumen Factura de Consumo Electrónica v1.0 | `Documentacin%20sobre%20eCF/Formatos%20XML/Formato%20Resumen%20Factura%20Consumo%20Electr%C3%B3nica%20v1.0.pdf` | `24f650b527a37fb6a8deb2d985c14dade1db6be62113fa47d2bd0c066565e0e8` |
| `firmado-ecf.pdf` | Firmado de Comprobantes Fiscales Electrónicos (e-CF) | `Documentacin%20sobre%20eCF/Instructivos%20sobre%20Facturaci%C3%B3n%20Electr%C3%B3nica/Firmado%20de%20e-CF.pdf` | `bb32bb04c170ac3e954166414dae583b28c4e3314578acdd532d15119d04b98e` |
| `contingencia.pdf` | Instructivo de Contingencia FE | `Documentacin%20sobre%20eCF/Instructivos%20sobre%20Facturaci%C3%B3n%20Electr%C3%B3nica/Instructivo-Contingencia-FE.pdf` | `46a41222c1723b75012c1565cae919119dafd69438d5021c8d81f65be16bf708` |
| `facturador-gratuito.pdf` | Instructivo Facturador Gratuito de FE v2.0 (jul-2026) | `Documentacin%20sobre%20eCF/Instructivos%20sobre%20Facturaci%C3%B3n%20Electr%C3%B3nica/Instructivo-Facturador-Gratuito-de-FE.pdf` | `692520bf207eb7869e958d75bc70bb8d7de858fc65fdb3723f8a8e9be02cf28a` |
| `proceso-emisor.pdf` | Proceso de Certificación para ser Emisor Electrónico | `Documentacin%20sobre%20eCF/Documentaciones%20Proceso%20de%20Certificaci%C3%B3n%20FE/Proceso%20de%20Certificacion%20para%20ser%20Emisor%20Electronico.pdf` | `1e4e53bde9f87dc9f0852e36b2e8819379e5444ed9a31501c9a8c7c321cbe6c1` |
| `proceso-psfe.pdf` | Proceso de Certificación Emisor Electrónico con PSFE Certificado | `Documentacin%20sobre%20eCF/Documentaciones%20Proceso%20de%20Certificaci%C3%B3n%20FE/Proceso-Certificacion-EmisorElectronico-Proveedor-Servicios-FECertificado.pdf` | `74f2a6542d6a1ec9183d67dba9765d8d6d688206d64f3b0ad9192ef6982a7c3c` |
| `guia-psfe.pdf` | **Guía para ser Proveedores de Servicios de FE Autorizados** (jul-2025) | `https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/facturacion/Documents/Facturaci%C3%B3n%20Electr%C3%B3nica/Guia-Basica-Proveedor-de-Servicios-de-Facturacion-Electronica.pdf` | `e58bd1499ae4351abd6e307f1b5ed03562dcc936ad3be4d648b1d228871ff7a5` |
| `guia-emisor.pdf` | Guía para ser Emisor Electrónico | `https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/facturacion/Documents/Facturaci%C3%B3n%20Electr%C3%B3nica/Guia-Basica-para-ser-Emisor-Electronico.pdf` | `c1e7780240779576fe1400c0d0adfcc6dff397599bf01886faf7777b5ff87d95` |
| `docsoporte-psfe.pdf` | Documentaciones soporte para autorización y certificación de PSFE | `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documents/Autorizacion-certificacion-Proveedores-Servicios-Facturacion-Electronica.pdf` | `80765fa81e445991a701a40d0d358b282db0ec7bfd0dd5d818b255652540d029` |
| `faq-tecnicas.pdf` | Preguntas Técnicas e-CF (FAQ) | `.../Preguntas%20frecuentes/T%C3%A9cnicas/Preguntas%20T%C3%A9cnicas%20e-CF.pdf` | `c2f42079d25ba30c3c2fdef152a85311006d4d1c9153a75b926d95456578626c` |
| `aviso-06-26.pdf` | **Aviso 06-26** — extensión de plazo (pequeños, micros y no clasificados) | `https://www.dgii.gov.do/publicacionesOficiales/avisosInformativos/Documents/2026/06-26.pdf` | `ecaea4a1cb7d253e479ec718c28190789cd51fe98bbeaf9c9ec9a71b5b1bf2c5` |

Otros PDF disponibles en la misma página FAQ:
`Preguntas Frecuentes e-CF Generales`,
`Preguntas Frecuentes Factura Consumo E-2`,
`Preguntas-Frecuentes-Facturador-Gratuito`.

### Marco legal (página `marcoLegal.aspx`)

- Ley 32-23: <https://www.dgii.gov.do/legislacion/leyesTributarias/Documents/Otras%2520Leyes%2520de%2520Inter%C3%A9s/32-23.pdf>
- Decreto 587-24: <https://www.dgii.gov.do/legislacion/decretos/Documents/2024/Decreto587-24.pdf>
- Norma General 01-2020: <https://www.dgii.gov.do/legislacion/normasGenerales/Documents/NG%2520sobre%2520Comprobantes%2520Fiscales/Norma01-20.pdf>
- Norma General 10-2021 (certificación de PSFE): <https://www.dgii.gov.do/legislacion/normasGenerales/Documents/NG%2520sobre%2520Comprobantes%2520Fiscales/Norma10-21.pdf>
- Ley 126-02 (comercio electrónico y firmas digitales): <https://www.dgii.gov.do/legislacion/leyesTributarias/Documents/Otras%2520Leyes%2520de%2520Inter%C3%A9s/126-02.pdf>

---

## 3. Hallazgos sobre la procedencia de los documentos

### 3.1 La "Descripción Técnica de Facturación Electrónica" fue segregada el 02-01-2026

Existía un documento único, **"Descripción Técnica de Facturación Electrónica", Versión 1.5,
Mayo 2023** (`desc-tecnica.txt`, SHA-256 del texto `fce5135cfa02522a0fad0fa548b37ad623ba4380723fd2d3fc0464f801221d4f`).
Su bitácora declara:

> "Actualizaciones al 02-01-2026 — 4) Se segrega en dos documentos la Descripción Técnica de
> Facturación Electrónica: a. Descripción Técnica Servicios DGII b. Descripción Técnica
> Servicios Emisores Electrónicos"

Por lo tanto:

- Lo que antes era un solo PDF hoy son **`Descripcion Tecnica Servicios DGII.pdf`** y
  **`Descripcion Tecnica Emisores Electronicos.pdf`**.
- La copia v1.5/2023 que se usó en fases previas está **desactualizada**. Sus contenidos se
  contrastaron contra los documentos vigentes: los ejemplos de `consultatimbre`, la tabla de
  caracteres reservados, los cuatro puntos de "Firmado de XML" y la nota de "tags vacíos"
  **son idénticos** en la versión vigente. No hubo que cambiar código.
- Bitácora relevante del documento vigente: **03-04-2025** — "Se agregaron nuevos caracteres
  de escape de restricciones de Contenido y/o Caracteres en los XML."

### 3.2 Servicios "no sensitivos a mayúsculas y minúsculas"

Bitácora 18-05-2023 de *Descripción Técnica Servicios DGII*:

> "‐ Servicios no sensitivos a mayúsculas y minúsculas."

Esto resuelve la duda sobre el `case` de los parámetros del QR: la lista de parámetros del
documento aparece en mayúsculas/camelCase (`RncEmisor`, `ENCF`, `CodigoSeguridad`) y el
ejemplo workado los escribe en minúsculas. **Ambas formas son válidas.** El código usa
minúsculas, que reproducen el ejemplo oficial byte a byte.

### 3.3 El servicio "Estatus Servicios" salió de la documentación vigente

El índice de **`Descripcion Tecnica Servicios DGII.pdf`** (vigente, bitácora hasta
02-01-2026) **no incluye** ninguna sección de estatus/ventanas de mantenimiento; se buscó
literalmente `obtenerestatus`, `estatusservicios`, `apikey`, `mantenimiento` y `disponible`
en el texto extraído y no aparece el servicio. Tampoco está en `Informe Técnico e-CF v1.0`
(§4.9 solo lo describe funcionalmente, sin URL).

La definición completa **sí** está en el documento sustituido, *Descripción Técnica de
Facturación Electrónica v1.5 (Mayo 2023)*, sección *Estatus Servicios*:

> "Este servicio cuenta con una clave única (**APIKEY**) para la autorización de su uso, el
> cual es **entregado por la autoridad tributaria cuando se cumplen ciertos requisitos**."
>
> `REQUEST URL  https://statusecf.dgii.gov.do/api/estatusservicios/obtenerestatus`
> `curl … -H 'Authorization: Apikey XXXXXXX-XXXXXXX-XXXX-XXXXXXXXXX'`

**Verificación en vivo el 2026-09-26** (la URL es correcta y el servicio sigue de pie, pero
no responde sin la clave):

| Prueba | Resultado |
| --- | --- |
| `GET …/api/estatusservicios/obtenerestatus` | `HTTP 401`, cuerpo vacío, `Server: Kestrel` |
| …con `Authorization: Bearer`, `Authorization:`, `x-api-key` o `api-key` inventados | `HTTP 401` en los cuatro casos |
| …con el segmento de ambiente (`/testecf`, `/ecf`) añadido | `HTTP 404` (la URL oficial **no** lleva ambiente) |
| `GET https://ecf.dgii.gov.do/{testecf,certecf,ecf}/autenticacion/api/autenticacion/semilla` | `HTTP 200` con `<SemillaModel>` en los tres |

Por eso la prueba de conexión de la app **no** usa este servicio para decidir si hay
conexión: usa el GET de la semilla, que no exige credencial. Ver §5.9 de `REQUISITOS.md`.

---

## 4. Dependencias de npm (solo las que la documentación oficial exige o nombra)

| Paquete | Versión | Justificación |
| --- | --- | --- |
| `@xmldom/xmldom` | 0.9.12 | Parser/serializador XML. La DGII exige control total de la serialización (sin espacios preservados, sin reordenar, sin escapado automático propio). |
| `node-forge` | 1.4.0 | Lectura/empaquetado del `.p12`. Es la librería usada en el **ejemplo oficial** de `Firmado de e-CF.pdf`. |
| `xml-crypto` | 6.3.2 | XMLDSig (RSA-SHA256 + SHA256). Implementa `xmldsig-core2`, que es la "URL de referencias" citada por `Firmado de e-CF.pdf`. |
| `@types/node-forge` | dev | Tipos. |

No se agregó ninguna otra dependencia para este módulo.

---

## 5. Índice de los archivos `.txt` (extracción de texto con `pdftotext`)

Son solo material de trabajo para poder citar texto literal; **la fuente autoritativa es el
PDF**, no el `.txt` (la numeración de línea del `.txt` no corresponde a la página del PDF).

```bash
pdftotext -layout archivo.pdf archivo.txt
```
