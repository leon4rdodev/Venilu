# Modulo: layout y UI

## Responsabilidad

Define shell visual, navegacion, header, sidebar, paginas animadas, tema y componentes compartidos.

## Archivos principales

| Archivo | Rol |
| --- | --- |
| `src/renderer/features/layout/components/main-layout.tsx` | Layout autenticado |
| `src/renderer/features/layout/components/sidebar.tsx` | Navegacion lateral |
| `src/renderer/features/layout/components/header.tsx` | Header |
| `src/renderer/features/layout/components/animated-page.tsx` | Transiciones |
| `src/renderer/shared/components/ui` | Componentes base |
| `src/renderer/index.css` | Tema Tailwind y tokens |

## Navegacion por rol

Employee ve:

- Inicio
- Punto de Venta
- Clientes

Admin ve:

- Inicio
- Punto de Venta
- Inventario
- Clientes
- Reportes
- Ajustes

## Tema

La app usa variables CSS en OKLCH para light/dark mode y mapeo a Tailwind mediante `@theme inline`.

