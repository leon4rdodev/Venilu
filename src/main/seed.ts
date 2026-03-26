/**
 * SCRIPT DE DESARROLLO — Poblar Base de Datos
 * ============================================
 * Inserta 10 categorías y 100 productos típicos de un colmado dominicano.
 *
 * Uso:
 *   node -e "
 *     require('tsconfig-paths/register');
 *     require('ts-node').register({ project: 'tsconfig.electron.json', transpileOnly: true });
 *     require('./src/main/seed.ts');
 *   "
 *
 * O via el script de npm agregado en package.json:
 *   npm run seed
 */

import 'reflect-metadata';
import path from 'path';
import os from 'os';
import { DataSource } from 'typeorm';

import { Category } from '@main/modules/categories/entities/category.entity';
import { Product } from '@main/modules/products/entities/product.entity';

// ─── Ruta a la DB de desarrollo ────────────────────────────────────────────
function getDevDbPath(): string {
  const appName = 'Electron';
  const platform = process.platform;

  if (platform === 'win32') {
    return path.join(process.env.APPDATA || os.homedir(), appName, 'database.sqlite');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName, 'database.sqlite');
  } else {
    return path.join(os.homedir(), '.config', appName, 'database.sqlite');
  }
}

// ─── DataSource independiente (sin Electron) ───────────────────────────────
const SeedDataSource = new DataSource({
  type: 'sqlite',
  database: getDevDbPath(),
  synchronize: true,
  logging: false,
  entities: [Category, Product],
});

// ─── Datos de Categorías ───────────────────────────────────────────────────
const categoryData: string[] = [
  'Víveres y Granos',
  'Lácteos y Huevos',
  'Carnes y Embutidos',
  'Bebidas y Refrescos',
  'Snacks y Dulces',
  'Productos de Limpieza',
  'Cuidado Personal',
  'Cigarrillos y Tabaco',
  'Panadería y Repostería',
  'Condimentos y Salsas',
];

// ─── Datos de Productos ────────────────────────────────────────────────────
interface ProductSeed {
  name: string;
  description: string;
  sale_price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  sku: string;
  categoryIndex: number;
}

const productData: ProductSeed[] = [
  // ── Víveres y Granos (0) ──────────────────────────────────────────────────
  { name: 'Arroz Molina 5lb', description: 'Arroz blanco de grano largo Molina, bolsa de 5 libras', sale_price: 130.00, cost_price: 100.00, stock: 40, min_stock: 10, sku: 'VIV-ARR-MOL-5', categoryIndex: 0 },
  { name: 'Arroz Molina 25lb', description: 'Arroz blanco de grano largo Molina, saco de 25 libras', sale_price: 580.00, cost_price: 460.00, stock: 15, min_stock: 5, sku: 'VIV-ARR-MOL-25', categoryIndex: 0 },
  { name: 'Habichuelas Rojas Iberia 1lb', description: 'Habichuelas rojas secas marca Iberia, bolsa de 1 libra', sale_price: 60.00, cost_price: 45.00, stock: 35, min_stock: 10, sku: 'VIV-HAB-IBE-1', categoryIndex: 0 },
  { name: 'Espagueti Don Victorio 400g', description: 'Pasta espagueti Don Victorio, paquete de 400 gramos', sale_price: 45.00, cost_price: 32.00, stock: 30, min_stock: 8, sku: 'VIV-ESP-DV-400', categoryIndex: 0 },
  { name: 'Avena Quaker 400g', description: 'Avena en hojuelas Quaker, lata de 400 gramos', sale_price: 85.00, cost_price: 62.00, stock: 20, min_stock: 6, sku: 'VIV-AVE-QKR-400', categoryIndex: 0 },
  { name: 'Maíz Molido Amarillo 5lb', description: 'Maíz molido amarillo para mangú y polenta, bolsa de 5 libras', sale_price: 90.00, cost_price: 68.00, stock: 20, min_stock: 5, sku: 'VIV-MAZ-5', categoryIndex: 0 },
  { name: 'Aceite Mazola 1 Litro', description: 'Aceite vegetal de maíz Mazola, botella de 1 litro', sale_price: 175.00, cost_price: 140.00, stock: 24, min_stock: 8, sku: 'VIV-ACE-MAZ-1L', categoryIndex: 0 },
  { name: 'Aceite Iberia 500ml', description: 'Aceite vegetal Iberia, botella de 500ml', sale_price: 95.00, cost_price: 72.00, stock: 30, min_stock: 8, sku: 'VIV-ACE-IBE-500', categoryIndex: 0 },
  { name: 'Azúcar Azucarera Romana 2lb', description: 'Azúcar blanca refinada Azucarera Romana, bolsa de 2 libras', sale_price: 70.00, cost_price: 52.00, stock: 30, min_stock: 10, sku: 'VIV-AZU-AR-2', categoryIndex: 0 },
  { name: 'Sal Yodada La Famosa 500g', description: 'Sal de mesa yodada La Famosa, paquete de 500 gramos', sale_price: 25.00, cost_price: 15.00, stock: 40, min_stock: 10, sku: 'VIV-SAL-LF-500', categoryIndex: 0 },

  // ── Lácteos y Huevos (1) ──────────────────────────────────────────────────
  { name: 'Leche Entera Parmalat 1L', description: 'Leche entera UHT Parmalat, caja de 1 litro', sale_price: 95.00, cost_price: 72.00, stock: 30, min_stock: 10, sku: 'LAC-LEC-PAR-1L', categoryIndex: 1 },
  { name: 'Leche en Polvo Nido 400g', description: 'Leche en polvo Nestlé Nido, lata de 400 gramos', sale_price: 320.00, cost_price: 255.00, stock: 15, min_stock: 4, sku: 'LAC-NID-400', categoryIndex: 1 },
  { name: 'Leche Condensada La Lechera 397g', description: 'Leche condensada azucarada La Lechera, lata de 397g', sale_price: 130.00, cost_price: 98.00, stock: 20, min_stock: 6, sku: 'LAC-CON-LL-397', categoryIndex: 1 },
  { name: 'Queso Amarillo en Barra (por libra)', description: 'Queso amarillo americano para cortar, precio por libra', sale_price: 200.00, cost_price: 155.00, stock: 10, min_stock: 3, sku: 'LAC-QUE-AMA-LB', categoryIndex: 1 },
  { name: 'Queso de Mano Blanco (por libra)', description: 'Queso blanco dominicano fresco, precio por libra', sale_price: 180.00, cost_price: 140.00, stock: 8, min_stock: 3, sku: 'LAC-QUE-BLA-LB', categoryIndex: 1 },
  { name: 'Mantequilla President 200g', description: 'Mantequilla sin sal President, paquete de 200 gramos', sale_price: 185.00, cost_price: 145.00, stock: 15, min_stock: 4, sku: 'LAC-MAN-PRE-200', categoryIndex: 1 },
  { name: 'Yogur Yoplait Fresa 150g', description: 'Yogur de fresa Yoplait, vasito de 150 gramos', sale_price: 55.00, cost_price: 38.00, stock: 24, min_stock: 8, sku: 'LAC-YOG-YOP-150', categoryIndex: 1 },
  { name: 'Huevos Criollos (cartón x12)', description: 'Huevos criollos frescos, cartón de 12 unidades', sale_price: 150.00, cost_price: 115.00, stock: 20, min_stock: 5, sku: 'LAC-HUE-12', categoryIndex: 1 },
  { name: 'Huevos Blancos (cartón x30)', description: 'Huevos blancos de granja, cartón de 30 unidades', sale_price: 340.00, cost_price: 270.00, stock: 10, min_stock: 3, sku: 'LAC-HUE-30', categoryIndex: 1 },
  { name: 'Crema de Leche Nestlé 250ml', description: 'Crema de leche para cocinar Nestlé, caja de 250ml', sale_price: 85.00, cost_price: 63.00, stock: 18, min_stock: 5, sku: 'LAC-CRE-NES-250', categoryIndex: 1 },

  // ── Carnes y Embutidos (2) ────────────────────────────────────────────────
  { name: 'Salami El Toro (por libra)', description: 'Salami El Toro dominicano, cortado al momento, precio por libra', sale_price: 160.00, cost_price: 120.00, stock: 5, min_stock: 2, sku: 'CAR-SAL-ET-LB', categoryIndex: 2 },
  { name: 'Salchichón Buen Provecho (por libra)', description: 'Salchichón cocido Buen Provecho, precio por libra', sale_price: 140.00, cost_price: 105.00, stock: 5, min_stock: 2, sku: 'CAR-SLC-BP-LB', categoryIndex: 2 },
  { name: 'Mortadela Rica (por libra)', description: 'Mortadela Rica en tajadas, precio por libra', sale_price: 130.00, cost_price: 98.00, stock: 5, min_stock: 2, sku: 'CAR-MOR-RIC-LB', categoryIndex: 2 },
  { name: 'Salchichas Buen Provecho 400g', description: 'Salchichas en lata Buen Provecho, 400 gramos', sale_price: 110.00, cost_price: 82.00, stock: 20, min_stock: 6, sku: 'CAR-SLC-BP-400', categoryIndex: 2 },
  { name: 'Sardinas en Tomate Iberia 155g', description: 'Sardinas en salsa de tomate Iberia, lata de 155g', sale_price: 75.00, cost_price: 55.00, stock: 25, min_stock: 8, sku: 'CAR-SAR-IBE-155', categoryIndex: 2 },
  { name: 'Atún en Aceite Rico 170g', description: 'Atún en aceite vegetal Rico, lata de 170 gramos', sale_price: 80.00, cost_price: 58.00, stock: 25, min_stock: 8, sku: 'CAR-ATU-RIC-170', categoryIndex: 2 },
  { name: 'Corned Beef Exeter 340g', description: 'Carne enlatada Corned Beef Exeter, lata de 340g', sale_price: 145.00, cost_price: 110.00, stock: 15, min_stock: 5, sku: 'CAR-CB-EXE-340', categoryIndex: 2 },
  { name: 'Spam Classic 340g', description: 'Carne de cerdo enlatada Spam, 340 gramos', sale_price: 155.00, cost_price: 118.00, stock: 12, min_stock: 4, sku: 'CAR-SPAM-340', categoryIndex: 2 },
  { name: 'Pollo Entero Congelado (por libra)', description: 'Pollo entero congelado fresco, precio por libra', sale_price: 65.00, cost_price: 48.00, stock: 20, min_stock: 5, sku: 'CAR-POL-LB', categoryIndex: 2 },
  { name: 'Longaniza Dominicana (por libra)', description: 'Longaniza criolla dominicana fresca, precio por libra', sale_price: 150.00, cost_price: 112.00, stock: 8, min_stock: 3, sku: 'CAR-LON-LB', categoryIndex: 2 },

  // ── Bebidas y Refrescos (3) ───────────────────────────────────────────────
  { name: 'Agua Bonaqua 500ml', description: 'Agua purificada Bonaqua, botella de 500ml', sale_price: 35.00, cost_price: 22.00, stock: 48, min_stock: 15, sku: 'BEB-H2O-BON-500', categoryIndex: 3 },
  { name: 'Agua Bonaqua 1.5L', description: 'Agua purificada Bonaqua, botella de 1.5 litros', sale_price: 55.00, cost_price: 38.00, stock: 30, min_stock: 10, sku: 'BEB-H2O-BON-1500', categoryIndex: 3 },
  { name: 'Coca-Cola 355ml (lata)', description: 'Refresco Coca-Cola, lata de 355ml', sale_price: 80.00, cost_price: 58.00, stock: 48, min_stock: 12, sku: 'BEB-CC-355-L', categoryIndex: 3 },
  { name: 'Coca-Cola 2L', description: 'Refresco Coca-Cola, botella de 2 litros', sale_price: 140.00, cost_price: 105.00, stock: 24, min_stock: 8, sku: 'BEB-CC-2L', categoryIndex: 3 },
  { name: 'Presidente 650ml (cerveza)', description: 'Cerveza Presidente, botella de 650ml', sale_price: 120.00, cost_price: 88.00, stock: 24, min_stock: 6, sku: 'BEB-PRE-650', categoryIndex: 3 },
  { name: 'Brugal Ron Añejo 375ml', description: 'Ron Brugal Añejo, media botella 375ml', sale_price: 380.00, cost_price: 295.00, stock: 8, min_stock: 2, sku: 'BEB-BRU-375', categoryIndex: 3 },
  { name: 'Jugo Tampico 250ml', description: 'Jugo de frutas Tampico, funda de 250ml', sale_price: 30.00, cost_price: 20.00, stock: 40, min_stock: 12, sku: 'BEB-TAM-250', categoryIndex: 3 },
  { name: 'Café Santo Domingo Molido 200g', description: 'Café molido Santo Domingo, paquete de 200 gramos', sale_price: 130.00, cost_price: 98.00, stock: 20, min_stock: 6, sku: 'BEB-CAF-SD-200', categoryIndex: 3 },
  { name: 'Jugo Tropical 1L', description: 'Jugo de frutas tropicales, caja de 1 litro', sale_price: 90.00, cost_price: 66.00, stock: 20, min_stock: 6, sku: 'BEB-JUG-TRO-1L', categoryIndex: 3 },
  { name: 'Pepsi 2L', description: 'Refresco Pepsi-Cola, botella de 2 litros', sale_price: 135.00, cost_price: 100.00, stock: 20, min_stock: 6, sku: 'BEB-PEP-2L', categoryIndex: 3 },

  // ── Snacks y Dulces (4) ───────────────────────────────────────────────────
  { name: 'Galletas Hatuey Soda x12', description: 'Galletas de soda Hatuey, paquete de 12 unidades', sale_price: 50.00, cost_price: 36.00, stock: 30, min_stock: 10, sku: 'SNA-GAL-HAT-12', categoryIndex: 4 },
  { name: 'Papitas Lays Classic 45g', description: 'Papas fritas Lay\'s sabor original, bolsa de 45g', sale_price: 55.00, cost_price: 38.00, stock: 35, min_stock: 10, sku: 'SNA-LAY-45', categoryIndex: 4 },
  { name: 'Cheetos Torciditos 50g', description: 'Frituras de maíz Cheetos Torciditos, bolsa de 50g', sale_price: 50.00, cost_price: 35.00, stock: 35, min_stock: 10, sku: 'SNA-CHE-50', categoryIndex: 4 },
  { name: 'Caramelos Halls Mentol x9', description: 'Caramelos Halls sabor menta, bolsa de 9 unidades', sale_price: 40.00, cost_price: 28.00, stock: 40, min_stock: 12, sku: 'SNA-HAL-MEN-9', categoryIndex: 4 },
  { name: 'Chiclets Adams x10', description: 'Chicles Adams de menta, paquete de 10 unidades', sale_price: 25.00, cost_price: 15.00, stock: 50, min_stock: 15, sku: 'SNA-CHI-ADA-10', categoryIndex: 4 },
  { name: 'Chocolate Snickers 52g', description: 'Barra de chocolate Snickers, 52 gramos', sale_price: 85.00, cost_price: 60.00, stock: 20, min_stock: 6, sku: 'SNA-SNI-52', categoryIndex: 4 },
  { name: 'Galletas Oreo x6', description: 'Galletas de chocolate Oreo, paquete de 6 unidades', sale_price: 45.00, cost_price: 32.00, stock: 30, min_stock: 10, sku: 'SNA-ORE-6', categoryIndex: 4 },
  { name: 'Yaniqueque (unidad)', description: 'Yaniqueque criollo casero, precio por unidad', sale_price: 25.00, cost_price: 12.00, stock: 20, min_stock: 5, sku: 'SNA-YAN-1', categoryIndex: 4 },
  { name: 'Paletas Payaso x5', description: 'Paletas de dulce con chicle Payaso, bolsa de 5 unidades', sale_price: 30.00, cost_price: 18.00, stock: 40, min_stock: 12, sku: 'SNA-PAL-5', categoryIndex: 4 },
  { name: 'Rosquillas La Fe 200g', description: 'Rosquillas de anís La Fe, bolsa de 200 gramos', sale_price: 65.00, cost_price: 46.00, stock: 20, min_stock: 6, sku: 'SNA-ROS-LF-200', categoryIndex: 4 },

  // ── Productos de Limpieza (5) ─────────────────────────────────────────────
  { name: 'Cloro Clorox 900ml', description: 'Blanqueador líquido Clorox original, 900ml', sale_price: 95.00, cost_price: 70.00, stock: 20, min_stock: 6, sku: 'LIM-CLO-900', categoryIndex: 5 },
  { name: 'Jabón en Polvo Mama Limón 500g', description: 'Detergente en polvo Mamá Limón, bolsa de 500 gramos', sale_price: 75.00, cost_price: 55.00, stock: 25, min_stock: 8, sku: 'LIM-JAB-ML-500', categoryIndex: 5 },
  { name: 'Jabón de Lavar Campeón x3', description: 'Jabón en barra para ropa Campeón, paquete de 3 barras', sale_price: 80.00, cost_price: 58.00, stock: 20, min_stock: 6, sku: 'LIM-CAM-3', categoryIndex: 5 },
  { name: 'Jabón de Platos Axion 450g', description: 'Crema lavaplatos Axion lima-limón, tarro de 450g', sale_price: 80.00, cost_price: 58.00, stock: 20, min_stock: 6, sku: 'LIM-AXI-450', categoryIndex: 5 },
  { name: 'Desinfectante Fabuloso 1L', description: 'Limpiador multiusos Fabuloso lavanda, 1 litro', sale_price: 120.00, cost_price: 88.00, stock: 15, min_stock: 5, sku: 'LIM-FAB-1L', categoryIndex: 5 },
  { name: 'Papel Higiénico Scott x4', description: 'Papel higiénico Scott doble hoja, paquete de 4 rollos', sale_price: 130.00, cost_price: 98.00, stock: 20, min_stock: 6, sku: 'LIM-SCO-4', categoryIndex: 5 },
  { name: 'Suavitel Concentrado 500ml', description: 'Suavizante de ropa Suavitel campo de flores, 500ml', sale_price: 90.00, cost_price: 66.00, stock: 18, min_stock: 5, sku: 'LIM-SUA-500', categoryIndex: 5 },
  { name: 'Insecticida Raid Volador 270ml', description: 'Aerosol insecticida Raid para insectos voladores, 270ml', sale_price: 145.00, cost_price: 108.00, stock: 12, min_stock: 4, sku: 'LIM-RAI-270', categoryIndex: 5 },
  { name: 'Bolsas de Basura Grandes x10', description: 'Bolsas plásticas negras de basura 55 galones, paquete x10', sale_price: 60.00, cost_price: 42.00, stock: 25, min_stock: 8, sku: 'LIM-BOL-BAS-10', categoryIndex: 5 },
  { name: 'Esponja Scotch-Brite Doble Uso', description: 'Esponja con estropajo Scotch-Brite para lavar platos', sale_price: 45.00, cost_price: 30.00, stock: 30, min_stock: 10, sku: 'LIM-ESP-SCO', categoryIndex: 5 },

  // ── Cuidado Personal (6) ──────────────────────────────────────────────────
  { name: 'Jabón Palmolive Antibacterial x3', description: 'Jabón de tocador Palmolive antibacterial, paquete de 3 barras', sale_price: 130.00, cost_price: 96.00, stock: 20, min_stock: 6, sku: 'CUI-PAL-3', categoryIndex: 6 },
  { name: 'Shampoo Head & Shoulders 375ml', description: 'Shampoo anticaspa Head & Shoulders, botella de 375ml', sale_price: 260.00, cost_price: 200.00, stock: 15, min_stock: 4, sku: 'CUI-H&S-375', categoryIndex: 6 },
  { name: 'Pasta de Dientes Colgate Triple 75ml', description: 'Pasta dental Colgate Triple Acción, tubo de 75ml', sale_price: 90.00, cost_price: 65.00, stock: 25, min_stock: 8, sku: 'CUI-COL-75', categoryIndex: 6 },
  { name: 'Desodorante Rexona Roll-On 50ml', description: 'Desodorante Roll-On Rexona hombre/mujer, 50ml', sale_price: 145.00, cost_price: 108.00, stock: 18, min_stock: 5, sku: 'CUI-REX-50', categoryIndex: 6 },
  { name: 'Papel Toalla Scott x2', description: 'Toallas absorbentes de cocina Scott, paquete de 2 rollos', sale_price: 85.00, cost_price: 62.00, stock: 20, min_stock: 6, sku: 'CUI-SCO-PT-2', categoryIndex: 6 },
  { name: 'Preservativos Trojan x3', description: 'Condones Trojan Ultra Thin, caja de 3 unidades', sale_price: 120.00, cost_price: 88.00, stock: 15, min_stock: 5, sku: 'CUI-TRO-3', categoryIndex: 6 },
  { name: 'Algodón absorbente 50g', description: 'Algodón absorbente higiénico en bola, bolsa de 50 gramos', sale_price: 40.00, cost_price: 25.00, stock: 20, min_stock: 6, sku: 'CUI-ALG-50', categoryIndex: 6 },
  { name: 'Servilletas Kleenex x50', description: 'Servilletas de papel Kleenex, paquete de 50 unidades', sale_price: 55.00, cost_price: 38.00, stock: 25, min_stock: 8, sku: 'CUI-KLE-50', categoryIndex: 6 },
  { name: 'Toallas Sanitarias Siemprefresh x8', description: 'Toallas sanitarias con alas Siemprefresh, paquete de 8', sale_price: 95.00, cost_price: 70.00, stock: 15, min_stock: 5, sku: 'CUI-SFR-8', categoryIndex: 6 },
  { name: 'Vaselina Intensiva 50ml', description: 'Crema hidratante Vaselina Intensive Care, 50ml', sale_price: 70.00, cost_price: 50.00, stock: 18, min_stock: 5, sku: 'CUI-VAS-50', categoryIndex: 6 },

  // ── Cigarrillos y Tabaco (7) ──────────────────────────────────────────────
  { name: 'Marlboro Rojo (cajetilla)', description: 'Cigarrillos Marlboro Red, cajetilla de 20 unidades', sale_price: 230.00, cost_price: 180.00, stock: 20, min_stock: 5, sku: 'TAB-MAR-20', categoryIndex: 7 },
  { name: 'Lucky Strike (cajetilla)', description: 'Cigarrillos Lucky Strike Original, cajetilla de 20 unidades', sale_price: 210.00, cost_price: 162.00, stock: 15, min_stock: 5, sku: 'TAB-LUC-20', categoryIndex: 7 },
  { name: 'Viceroy (cajetilla)', description: 'Cigarrillos Viceroy, cajetilla de 20 unidades', sale_price: 190.00, cost_price: 145.00, stock: 15, min_stock: 5, sku: 'TAB-VIC-20', categoryIndex: 7 },
  { name: 'Cigarrillo suelto', description: 'Cigarrillo vendido por unidad (marca variable)', sale_price: 15.00, cost_price: 9.00, stock: 100, min_stock: 20, sku: 'TAB-SUE-1', categoryIndex: 7 },
  { name: 'Tabaco Cibaense (unidad)', description: 'Tabaco artesanal Cibaense, precio por unidad', sale_price: 80.00, cost_price: 55.00, stock: 20, min_stock: 5, sku: 'TAB-CIB-1', categoryIndex: 7 },
  { name: 'Encendedor Bic (unidad)', description: 'Encendedor desechable BIC, colores surtidos', sale_price: 40.00, cost_price: 25.00, stock: 30, min_stock: 10, sku: 'TAB-BIC-1', categoryIndex: 7 },
  { name: 'Fósforos La Chispa x10', description: 'Caja de fósforos La Chispa, paquete de 10 cajas pequeñas', sale_price: 30.00, cost_price: 18.00, stock: 25, min_stock: 8, sku: 'TAB-FOS-10', categoryIndex: 7 },
  { name: 'Mentolado Kool (cajetilla)', description: 'Cigarrillos mentolados Kool, cajetilla de 20 unidades', sale_price: 215.00, cost_price: 165.00, stock: 10, min_stock: 3, sku: 'TAB-KOO-20', categoryIndex: 7 },
  { name: 'Winston (cajetilla)', description: 'Cigarrillos Winston Rojo, cajetilla de 20 unidades', sale_price: 200.00, cost_price: 153.00, stock: 12, min_stock: 4, sku: 'TAB-WIN-20', categoryIndex: 7 },
  { name: 'Pipa de tabaco suelto (10g)', description: 'Tabaco de pipa a granel, precio por 10 gramos', sale_price: 60.00, cost_price: 38.00, stock: 15, min_stock: 4, sku: 'TAB-PIP-10G', categoryIndex: 7 },

  // ── Panadería y Repostería (8) ────────────────────────────────────────────
  { name: 'Pan de Agua (unidad)', description: 'Pan de agua criollo horneado, precio por unidad', sale_price: 10.00, cost_price: 5.00, stock: 50, min_stock: 10, sku: 'PAN-AGU-1', categoryIndex: 8 },
  { name: 'Pan Sobao (unidad)', description: 'Pan sobao esponjoso, precio por unidad', sale_price: 15.00, cost_price: 8.00, stock: 40, min_stock: 10, sku: 'PAN-SOB-1', categoryIndex: 8 },
  { name: 'Pan Molde Wonder 400g', description: 'Pan de molde blando Wonder, bolsa de 400 gramos', sale_price: 120.00, cost_price: 88.00, stock: 15, min_stock: 5, sku: 'PAN-WON-400', categoryIndex: 8 },
  { name: 'Galletas de Anís El Artesano 200g', description: 'Galletas de anís El Artesano, paquete de 200 gramos', sale_price: 60.00, cost_price: 42.00, stock: 20, min_stock: 6, sku: 'PAN-ART-200', categoryIndex: 8 },
  { name: 'Bizcocho de Libra (trozo)', description: 'Bizcocho blanco dominicano con merengue, precio por trozo', sale_price: 80.00, cost_price: 45.00, stock: 10, min_stock: 3, sku: 'PAN-BIZ-TRO', categoryIndex: 8 },
  { name: 'Harina de Trigo Brugal 2lb', description: 'Harina de trigo todo uso Brugal, bolsa de 2 libras', sale_price: 70.00, cost_price: 50.00, stock: 20, min_stock: 6, sku: 'PAN-HAR-BR-2', categoryIndex: 8 },
  { name: 'Levadura Fleischmann 7g', description: 'Levadura instantánea Fleischmann, sobre de 7 gramos', sale_price: 25.00, cost_price: 15.00, stock: 30, min_stock: 10, sku: 'PAN-LEV-7', categoryIndex: 8 },
  { name: 'Manteca Ifa 500g', description: 'Manteca vegetal Ifa para fritura y repostería, 500g', sale_price: 95.00, cost_price: 70.00, stock: 15, min_stock: 5, sku: 'PAN-MAN-IFA-500', categoryIndex: 8 },
  { name: 'Coco rallado seco 100g', description: 'Coco rallado deshidratado para repostería, bolsa de 100g', sale_price: 40.00, cost_price: 26.00, stock: 20, min_stock: 6, sku: 'PAN-COC-100', categoryIndex: 8 },
  { name: 'Canela en Polvo 50g', description: 'Canela molida para postres y bebidas, bolsa de 50 gramos', sale_price: 35.00, cost_price: 22.00, stock: 20, min_stock: 6, sku: 'PAN-CAN-50', categoryIndex: 8 },

  // ── Condimentos y Salsas (9) ──────────────────────────────────────────────
  { name: 'Sazón Loísa 200g', description: 'Sazón con culantro y achiote Loísa, sobre de 200 gramos', sale_price: 80.00, cost_price: 58.00, stock: 25, min_stock: 8, sku: 'CON-LOI-200', categoryIndex: 9 },
  { name: 'Ajo en Polvo Goya 42g', description: 'Ajo granulado Goya, frasco de 42 gramos', sale_price: 65.00, cost_price: 46.00, stock: 20, min_stock: 6, sku: 'CON-GOY-AJO-42', categoryIndex: 9 },
  { name: 'Ketchup Heinz 397g', description: 'Salsa de tomate Heinz, frasco de 397 gramos', sale_price: 130.00, cost_price: 96.00, stock: 15, min_stock: 5, sku: 'CON-HEI-397', categoryIndex: 9 },
  { name: 'Mayonesa Kraft 445g', description: 'Mayonesa real Kraft, frasco de 445 gramos', sale_price: 150.00, cost_price: 112.00, stock: 15, min_stock: 5, sku: 'CON-KRA-445', categoryIndex: 9 },
  { name: 'Mostaza French\'s 255g', description: 'Mostaza amarilla French\'s, frasco de 255 gramos', sale_price: 95.00, cost_price: 70.00, stock: 15, min_stock: 5, sku: 'CON-FRE-255', categoryIndex: 9 },
  { name: 'Vinagre Blanco Loísa 750ml', description: 'Vinagre de mesa blanco Loísa, botella de 750ml', sale_price: 60.00, cost_price: 42.00, stock: 20, min_stock: 6, sku: 'CON-LOI-VIN-750', categoryIndex: 9 },
  { name: 'Pimienta Negra Molida 50g', description: 'Pimienta negra molida fina, sobre de 50 gramos', sale_price: 45.00, cost_price: 30.00, stock: 20, min_stock: 6, sku: 'CON-PIE-50', categoryIndex: 9 },
  { name: 'Cubitos Maggi x10', description: 'Cubitos de caldo Maggi, paquete de 10 unidades', sale_price: 50.00, cost_price: 35.00, stock: 30, min_stock: 10, sku: 'CON-MAG-10', categoryIndex: 9 },
  { name: 'Salsa Worcestershire Lea & Perrins 142ml', description: 'Salsa inglesa Lea & Perrins, botella de 142ml', sale_price: 120.00, cost_price: 88.00, stock: 12, min_stock: 4, sku: 'CON-LEA-142', categoryIndex: 9 },
  { name: 'Orégano Seco 30g', description: 'Orégano molido seco para sazón criolla, sobre de 30g', sale_price: 30.00, cost_price: 18.00, stock: 25, min_stock: 8, sku: 'CON-ORE-30', categoryIndex: 9 },
];

// ─── Main ───────────────────────────────────────────────────────────────────
async function seed() {
  console.log('🌱  Iniciando seed de base de datos...');
  console.log(`📂  DB path: ${getDevDbPath()}`);

  await SeedDataSource.initialize();
  console.log('✅  Conexión establecida.\n');

  const categoryRepo = SeedDataSource.getRepository(Category);
  const productRepo = SeedDataSource.getRepository(Product);

  // ── Limpiar datos previos ─────────────────────────────────────────────────
  const existingProducts = await productRepo.count();
  const existingCategories = await categoryRepo.count();

  if (existingCategories > 0 || existingProducts > 0) {
    console.log(`⚠️  La DB ya contiene ${existingCategories} categorías y ${existingProducts} productos.`);
    await SeedDataSource.query('PRAGMA foreign_keys = OFF;');
    await productRepo.clear();
    await categoryRepo.clear();
    await SeedDataSource.query('PRAGMA foreign_keys = ON;');
  }

  // ── Insertar Categorías ────────────────────────────────────────────────────
  console.log('📂  Insertando categorías...');
  const categories: Category[] = [];

  for (const name of categoryData) {
    const cat = categoryRepo.create({ name });
    const saved = await categoryRepo.save(cat);
    categories.push(saved);
    console.log(`   ✔  ${saved.name} (${saved.id})`);
  }

  console.log(`\n✅  ${categories.length} categorías insertadas.\n`);

  // ── Insertar Productos ─────────────────────────────────────────────────────
  console.log('📦  Insertando productos...');
  let productCount = 0;

  for (const p of productData) {
    const category = categories[p.categoryIndex];
    const product = productRepo.create({
      name: p.name,
      description: p.description,
      sale_price: p.sale_price,
      cost_price: p.cost_price,
      stock: p.stock,
      min_stock: p.min_stock,
      sku: p.sku,
      category_id: category.id,
    });
    await productRepo.save(product);
    productCount++;
    process.stdout.write(`\r   Productos insertados: ${productCount}/${productData.length}`);
  }

  console.log(`\n\n✅  ${productCount} productos insertados exitosamente.`);
  console.log('\n🎉  Seed completado!\n');

  await SeedDataSource.destroy();
}

seed().catch((err) => {
  console.error('\n❌  Error durante el seed:', err);
  process.exit(1);
});