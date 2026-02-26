/**
 * SCRIPT DE DESARROLLO — Poblar Base de Datos
 * ============================================
 * Inserta 10 categorías y 100 productos típicos de una tienda de celulares y accesorios.
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
// En Linux Electron usa: ~/.config/<appName>/database.sqlite
// En Windows: C:\Users\<user>\AppData\Roaming\<appName>\database.sqlite
// En macOS:  ~/Library/Application Support/<appName>/database.sqlite
function getDevDbPath(): string {
  const appName = 'Electron'; // debe coincidir con el productName en package.json
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
  'Smartphones',
  'Fundas y Protectores',
  'Cargadores y Cables',
  'Audífonos y Bocinas',
  'Baterías y Power Banks',
  'Accesorios iPad / Tablet',
  'Smartwatches y Wearables',
  'Lentes de Cámara y Fotografía',
  'Memoria y Almacenamiento',
  'Repuestos y Reparación',
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
  categoryIndex: number; // 0-based index into categoryData
}

const productData: ProductSeed[] = [
  // ── Smartphones (0) ───────────────────────────────────────────────────────
  { name: 'iPhone 15 128GB Negro', description: 'Apple iPhone 15, pantalla Super Retina XDR 6.1", chip A16', sale_price: 899.99, cost_price: 750.00, stock: 8, min_stock: 2, sku: 'APL-IP15-128-BK', categoryIndex: 0 },
  { name: 'iPhone 15 Pro 256GB Titanio', description: 'Apple iPhone 15 Pro, chip A17 Pro, cámara 48MP', sale_price: 1199.99, cost_price: 980.00, stock: 5, min_stock: 2, sku: 'APL-IP15P-256-TI', categoryIndex: 0 },
  { name: 'Samsung Galaxy S24 256GB', description: 'Samsung Galaxy S24, pantalla 6.2" Dynamic AMOLED 2X, Snapdragon 8 Gen 3', sale_price: 799.99, cost_price: 650.00, stock: 10, min_stock: 3, sku: 'SAM-S24-256', categoryIndex: 0 },
  { name: 'Samsung Galaxy A54 128GB Negro', description: 'Samsung Galaxy A54 5G, pantalla 6.4" Super AMOLED, cámara 50MP', sale_price: 399.99, cost_price: 310.00, stock: 15, min_stock: 5, sku: 'SAM-A54-128-BK', categoryIndex: 0 },
  { name: 'Xiaomi Redmi Note 13 128GB', description: 'Xiaomi Redmi Note 13, pantalla AMOLED 120Hz, cámara 108MP', sale_price: 249.99, cost_price: 180.00, stock: 20, min_stock: 5, sku: 'XMI-RN13-128', categoryIndex: 0 },
  { name: 'Motorola Moto G84 256GB', description: 'Motorola Moto G84 5G, pantalla pOLED 6.55", 50MP', sale_price: 299.99, cost_price: 220.00, stock: 12, min_stock: 4, sku: 'MOT-G84-256', categoryIndex: 0 },
  { name: 'Realme 12 Pro+ 256GB', description: 'Realme 12 Pro+, diseño tipo telescopio periscópico, Snapdragon 7s Gen 2', sale_price: 349.99, cost_price: 265.00, stock: 8, min_stock: 3, sku: 'RLM-12PP-256', categoryIndex: 0 },
  { name: 'Huawei Nova 11 128GB', description: 'Huawei Nova 11, pantalla OLED 6.7", cámara frontal 60MP', sale_price: 329.99, cost_price: 250.00, stock: 6, min_stock: 2, sku: 'HUW-NOV11-128', categoryIndex: 0 },
  { name: 'OnePlus 12 256GB Verde', description: 'OnePlus 12, Snapdragon 8 Gen 3, carga rápida 100W', sale_price: 799.99, cost_price: 640.00, stock: 4, min_stock: 2, sku: 'OPL-12-256-GR', categoryIndex: 0 },
  { name: 'iPhone 14 128GB Medianoche', description: 'Apple iPhone 14, chip A15 Bionic, pantalla 6.1"', sale_price: 749.99, cost_price: 600.00, stock: 7, min_stock: 2, sku: 'APL-IP14-128-MD', categoryIndex: 0 },

  // ── Fundas y Protectores (1) ───────────────────────────────────────────────
  { name: 'Funda Silicona iPhone 15 Azul', description: 'Funda de silicona oficial compatible con iPhone 15, interior de microfibra', sale_price: 19.99, cost_price: 8.00, stock: 30, min_stock: 10, sku: 'FND-SIL-IP15-AZ', categoryIndex: 1 },
  { name: 'Funda Cuero Samsung S24 Negro', description: 'Funda tipo billetera en cuero vegano para Samsung Galaxy S24', sale_price: 24.99, cost_price: 10.00, stock: 25, min_stock: 8, sku: 'FND-CUE-S24-BK', categoryIndex: 1 },
  { name: 'Vidrio Templado iPhone 15 Pro', description: 'Protector de pantalla vidrio templado 9H ultra delgado para iPhone 15 Pro', sale_price: 12.99, cost_price: 3.50, stock: 50, min_stock: 15, sku: 'VID-IP15P', categoryIndex: 1 },
  { name: 'Funda MagSafe iPhone 14/15 Transparente', description: 'Funda transparente con soporte MagSafe para iPhone 14 y 15', sale_price: 22.99, cost_price: 9.00, stock: 35, min_stock: 10, sku: 'FND-MSF-IP1415-TR', categoryIndex: 1 },
  { name: 'Funda Antigolpes Xiaomi Redmi Note 13', description: 'Funda robusta con esquinas reforzadas para Redmi Note 13', sale_price: 14.99, cost_price: 5.00, stock: 40, min_stock: 10, sku: 'FND-AG-RN13', categoryIndex: 1 },
  { name: 'Vidrio Privacidad Samsung A54', description: 'Protector de pantalla anti-espías para Samsung Galaxy A54', sale_price: 15.99, cost_price: 5.50, stock: 45, min_stock: 12, sku: 'VID-PRV-A54', categoryIndex: 1 },
  { name: 'Funda Ring Holder Universal', description: 'Funda con anillo giratorio 360°, compatible con la mayoría de smartphones', sale_price: 11.99, cost_price: 4.00, stock: 60, min_stock: 15, sku: 'FND-RNG-UNV', categoryIndex: 1 },
  { name: 'Funda Cartera Motorola G84', description: 'Funda tipo cartera con 3 ranuras para tarjetas, Motorola G84', sale_price: 18.99, cost_price: 7.00, stock: 20, min_stock: 6, sku: 'FND-CAR-MOT-G84', categoryIndex: 1 },
  { name: 'Hidrogel de Privacidad iPhone 15', description: 'Lamina de hidrogel con filtro de privacidad, auto-reparable', sale_price: 9.99, cost_price: 3.00, stock: 55, min_stock: 15, sku: 'HID-PRV-IP15', categoryIndex: 1 },
  { name: 'Funda Cuero Universal 6.7"', description: 'Funda horizontal multifuncional para smartphones hasta 6.7"', sale_price: 13.99, cost_price: 5.00, stock: 30, min_stock: 8, sku: 'FND-CUE-67-UNV', categoryIndex: 1 },

  // ── Cargadores y Cables (2) ────────────────────────────────────────────────
  { name: 'Cargador Apple 20W USB-C', description: 'Cargador de pared original Apple, 20W carga rápida', sale_price: 29.99, cost_price: 15.00, stock: 25, min_stock: 8, sku: 'CAR-APL-20W-UC', categoryIndex: 2 },
  { name: 'Cable USB-C a Lightning 1m', description: 'Cable trenzado USB-C a Lightning, carga rápida certificado MFi', sale_price: 18.99, cost_price: 7.00, stock: 40, min_stock: 12, sku: 'CAB-UCL-1M', categoryIndex: 2 },
  { name: 'Cargador Inalámbrico Qi 15W', description: 'Cargador inalámbrico Qi, compatible con iPhone y Android, 15W máx', sale_price: 24.99, cost_price: 10.00, stock: 20, min_stock: 6, sku: 'CAR-QI-15W', categoryIndex: 2 },
  { name: 'Cable USB-C a USB-C 2m', description: 'Cable USB-C trenzado nylon 2 metros, hasta 60W, datos 480 Mbps', sale_price: 14.99, cost_price: 5.00, stock: 50, min_stock: 15, sku: 'CAB-UCC-2M', categoryIndex: 2 },
  { name: 'Cargador Samsung 25W Super Fast', description: 'Adaptador de carga rápida Samsung 25W, compatible con Galaxy S/A series', sale_price: 27.99, cost_price: 13.00, stock: 18, min_stock: 5, sku: 'CAR-SAM-25W', categoryIndex: 2 },
  { name: 'Cable Lightning 1m Original Apple', description: 'Cable Lightning a USB-A de 1m, certificado Apple', sale_price: 22.99, cost_price: 10.00, stock: 30, min_stock: 10, sku: 'CAB-LTN-1M-APL', categoryIndex: 2 },
  { name: 'Cargador de Auto 36W Dual QC3.0', description: 'Cargador para auto con 2 puertos USB-A QC3.0, 36W total', sale_price: 19.99, cost_price: 7.50, stock: 25, min_stock: 8, sku: 'CAR-AUTO-36W', categoryIndex: 2 },
  { name: 'Cargador MagSafe iPhone 15W', description: 'Cargador magnético MagSafe para iPhone 12 o superior, 15W', sale_price: 39.99, cost_price: 20.00, stock: 15, min_stock: 5, sku: 'CAR-MSF-15W', categoryIndex: 2 },
  { name: 'Cable Micro-USB a USB-A 1m', description: 'Cable Micro-USB trenzado nylon 1m, carga y datos', sale_price: 8.99, cost_price: 2.50, stock: 60, min_stock: 20, sku: 'CAB-MUS-1M', categoryIndex: 2 },
  { name: 'Cargador GaN 65W 3 puertos', description: 'Cargador GaN compacto 65W, 2× USB-C PD + 1× USB-A QC3.0', sale_price: 44.99, cost_price: 22.00, stock: 10, min_stock: 4, sku: 'CAR-GAN-65W', categoryIndex: 2 },

  // ── Audífonos y Bocinas (3) ────────────────────────────────────────────────
  { name: 'AirPods Pro 2da Generación', description: 'Apple AirPods Pro con cancelación activa de ruido, chip H2', sale_price: 249.99, cost_price: 190.00, stock: 8, min_stock: 2, sku: 'APL-AIRP-PRO2', categoryIndex: 3 },
  { name: 'Samsung Galaxy Buds2 Pro', description: 'Auriculares true wireless con ANC, sonido 360°, Android y iOS', sale_price: 189.99, cost_price: 140.00, stock: 10, min_stock: 3, sku: 'SAM-GBP2', categoryIndex: 3 },
  { name: 'Bocina JBL GO 4 Bluetooth', description: 'Bocina portátil JBL GO 4, resistente al agua IP67, 7h batería', sale_price: 59.99, cost_price: 35.00, stock: 15, min_stock: 5, sku: 'JBL-GO4', categoryIndex: 3 },
  { name: 'Audífonos Sony WH-1000XM5', description: 'Auriculares over-ear Sony con la mejor cancelación de ruido del mercado', sale_price: 349.99, cost_price: 270.00, stock: 5, min_stock: 2, sku: 'SNY-WH1XM5', categoryIndex: 3 },
  { name: 'Bocina Bluetooth Anker Soundcore 3', description: 'Anker Soundcore 3 con ecualizador BassUp, 24h batería, IP67', sale_price: 49.99, cost_price: 28.00, stock: 12, min_stock: 4, sku: 'ANK-SC3', categoryIndex: 3 },
  { name: 'Audífonos In-Ear Xiaomi Basic', description: 'Audífonos alámbricos USB-C Xiaomi, micrófono integrado, plug and play', sale_price: 12.99, cost_price: 4.50, stock: 40, min_stock: 10, sku: 'XMI-INE-UC', categoryIndex: 3 },
  { name: 'AirPods 3ra Generación', description: 'Apple AirPods 3, audio espacial, resistente al sudor y agua', sale_price: 179.99, cost_price: 130.00, stock: 8, min_stock: 2, sku: 'APL-AIRP3', categoryIndex: 3 },
  { name: 'Audífonos Bluetooth Motorola Moto Buds', description: 'Audífonos TWS Motorola con carga rápida y 32h de batería total', sale_price: 49.99, cost_price: 25.00, stock: 15, min_stock: 5, sku: 'MOT-MTBDS', categoryIndex: 3 },
  { name: 'Bocina JBL Charge 5 Bluetooth', description: 'JBL Charge 5, potente bass, IP67, cargador integrado para dispositivos', sale_price: 179.99, cost_price: 120.00, stock: 7, min_stock: 2, sku: 'JBL-CHG5', categoryIndex: 3 },
  { name: 'Audífonos Alámbricos 3.5mm Baseus', description: 'Baseus in-ear con micrófono, alta fidelidad, control de volumen', sale_price: 9.99, cost_price: 3.00, stock: 50, min_stock: 15, sku: 'BAS-INE-3.5', categoryIndex: 3 },

  // ── Baterías y Power Banks (4) ─────────────────────────────────────────────
  { name: 'Batería Portátil Anker 20000mAh', description: 'Anker PowerCore III 20000, carga rápida 18W, 2× USB-A + USB-C', sale_price: 59.99, cost_price: 35.00, stock: 15, min_stock: 5, sku: 'ANK-PB20K', categoryIndex: 4 },
  { name: 'Power Bank 10000mAh USB-C PD', description: 'Batería portátil 10000mAh con USB-C PD 22.5W, pantalla LED', sale_price: 34.99, cost_price: 16.00, stock: 20, min_stock: 6, sku: 'PB-10K-PD', categoryIndex: 4 },
  { name: 'Power Bank MagSafe 5000mAh', description: 'Batería magnética MagSafe 5000mAh para iPhone 12/13/14/15, ultra delgada', sale_price: 49.99, cost_price: 25.00, stock: 12, min_stock: 4, sku: 'PB-MSF-5K', categoryIndex: 4 },
  { name: 'Power Bank Solar 20000mAh', description: 'Batería portátil con panel solar, linterna LED, resistente a polvo y agua', sale_price: 44.99, cost_price: 22.00, stock: 10, min_stock: 3, sku: 'PB-SOL-20K', categoryIndex: 4 },
  { name: 'Batería de Repuesto iPhone 15', description: 'Batería compatible con iPhone 15, 3877 mAh, herramientas incluidas', sale_price: 29.99, cost_price: 12.00, stock: 8, min_stock: 3, sku: 'BAT-IP15-REP', categoryIndex: 4 },
  { name: 'Batería de Repuesto Samsung S24', description: 'Batería compatible con Samsung Galaxy S24, certificado CE', sale_price: 24.99, cost_price: 9.00, stock: 10, min_stock: 3, sku: 'BAT-S24-REP', categoryIndex: 4 },
  { name: 'Power Bank Xiaomi 33W 10000mAh', description: 'Xiaomi Redmi Power Bank 33W, carga bidireccional, pantalla digital', sale_price: 29.99, cost_price: 14.00, stock: 18, min_stock: 5, sku: 'XMI-PB33-10K', categoryIndex: 4 },
  { name: 'Power Bank 30000mAh 4 Puertos', description: 'Batería de gran capacidad con 2× USB-A + 2× USB-C, indicador de batería', sale_price: 54.99, cost_price: 28.00, stock: 8, min_stock: 3, sku: 'PB-30K-4P', categoryIndex: 4 },
  { name: 'Batería de Repuesto Redmi Note 13', description: 'Batería de reemplazo para Xiaomi Redmi Note 13, 5000mAh', sale_price: 19.99, cost_price: 7.00, stock: 12, min_stock: 4, sku: 'BAT-RN13-REP', categoryIndex: 4 },
  { name: 'Mini Power Bank 5000mAh Llavero', description: 'Batería portátil tipo llavero con cable integrado USB-C + Lightning', sale_price: 19.99, cost_price: 7.50, stock: 25, min_stock: 8, sku: 'PB-5K-MINI', categoryIndex: 4 },

  // ── Accesorios iPad / Tablet (5) ──────────────────────────────────────────
  { name: 'Teclado Bluetooth iPad Universal', description: 'Teclado inalámbrico BT 5.0, compatible con iPad, iPad Air y Pro', sale_price: 49.99, cost_price: 22.00, stock: 10, min_stock: 3, sku: 'TBL-KBD-BT', categoryIndex: 5 },
  { name: 'Funda iPad 10ma Gen con Teclado', description: 'Funda tipo libro con teclado integrado para iPad 10.9" (10ª gen)', sale_price: 64.99, cost_price: 30.00, stock: 8, min_stock: 2, sku: 'FND-IPAD10-KBD', categoryIndex: 5 },
  { name: 'Apple Pencil 2da Gen Compatible', description: 'Lápiz capacitivo compatible con Apple Pencil 2, carga magnética', sale_price: 39.99, cost_price: 16.00, stock: 12, min_stock: 4, sku: 'PEN-IPAD-2G', categoryIndex: 5 },
  { name: 'Soporte Tablet Escritorio Ajustable', description: 'Soporte de aluminio para tablets 7"-13", ángulo e inclinación ajustables', sale_price: 27.99, cost_price: 11.00, stock: 15, min_stock: 5, sku: 'SOP-TBL-DESK', categoryIndex: 5 },
  { name: 'Vidrio Templado iPad Air M2 11"', description: 'Protector de pantalla vidrio templado 9H anti-huella para iPad Air M2 11"', sale_price: 17.99, cost_price: 6.00, stock: 20, min_stock: 6, sku: 'VID-IPAD-AIR-M2', categoryIndex: 5 },
  { name: 'Hub USB-C para iPad Pro 7 en 1', description: 'Hub multiport 7-en-1: HDMI 4K, USB-A×3, SD, microSD, USB-C PD', sale_price: 54.99, cost_price: 25.00, stock: 8, min_stock: 3, sku: 'HUB-UC-7P1', categoryIndex: 5 },
  { name: 'Funda iPad Mini 6 Silicona', description: 'Funda de silicona líquida para iPad Mini 6, cierre magnético Smart Cover', sale_price: 19.99, cost_price: 8.00, stock: 18, min_stock: 5, sku: 'FND-IPADMN6-SIL', categoryIndex: 5 },
  { name: 'Teclado Folio iPad Pro 12.9"', description: 'Teclado folio plegable con retroiluminación para iPad Pro 12.9"', sale_price: 89.99, cost_price: 45.00, stock: 5, min_stock: 2, sku: 'TBL-FOL-PRO129', categoryIndex: 5 },
  { name: 'Adaptador Lightning a 3.5mm', description: 'Adaptador oficial para conectar audífonos 3.5mm al iPhone/iPad', sale_price: 9.99, cost_price: 4.00, stock: 40, min_stock: 12, sku: 'ADP-LTN-3.5', categoryIndex: 5 },
  { name: 'Cable USB-C a HDMI 2m 4K', description: 'Cable USB-C a HDMI, resolución 4K@60Hz, para iPad Pro, MacBook, etc.', sale_price: 22.99, cost_price: 9.00, stock: 15, min_stock: 5, sku: 'CAB-UC-HDMI-2M', categoryIndex: 5 },

  // ── Smartwatches y Wearables (6) ──────────────────────────────────────────
  { name: 'Apple Watch Series 9 41mm GPS', description: 'Apple Watch S9, chip S9 SiP, pantalla Always-On 2000 nits, 41mm', sale_price: 399.99, cost_price: 310.00, stock: 6, min_stock: 2, sku: 'APL-WS9-41', categoryIndex: 6 },
  { name: 'Samsung Galaxy Watch6 44mm LTE', description: 'Samsung Galaxy Watch 6, monitor avanzado de salud, LTE, 44mm', sale_price: 299.99, cost_price: 220.00, stock: 5, min_stock: 2, sku: 'SAM-GW6-44', categoryIndex: 6 },
  { name: 'Xiaomi Smart Band 8', description: 'Xiaomi Smart Band 8, AMOLED 1.62", 150+ modos deporte, 16 días batería', sale_price: 49.99, cost_price: 25.00, stock: 20, min_stock: 6, sku: 'XMI-SB8', categoryIndex: 6 },
  { name: 'Amazfit GTR 4 Smartwatch', description: 'Amazfit GTR 4, GPS dual-band, 150 modos deporte, llamadas Bluetooth', sale_price: 149.99, cost_price: 95.00, stock: 8, min_stock: 3, sku: 'AMZ-GTR4', categoryIndex: 6 },
  { name: 'Correa Deportiva Apple Watch 42-45mm', description: 'Correa de fluoroelastómero para Apple Watch 42/44/45/49mm, varios colores', sale_price: 19.99, cost_price: 7.00, stock: 30, min_stock: 10, sku: 'CRR-AW-DEP-454', categoryIndex: 6 },
  { name: 'Fitbit Inspire 3', description: 'Fitbit Inspire 3, rastreador de actividad 24/7, SpO2, hasta 10 días', sale_price: 99.99, cost_price: 65.00, stock: 10, min_stock: 3, sku: 'FTB-INS3', categoryIndex: 6 },
  { name: 'Smartwatch HW12 Series 7 Clone', description: 'Smartwatch económico compatible con iOS/Android, llamadas, notificaciones', sale_price: 24.99, cost_price: 9.00, stock: 25, min_stock: 8, sku: 'SW-HW12-S7', categoryIndex: 6 },
  { name: 'Cargador Magnético Apple Watch', description: 'Cable de carga magnético USB-C para Apple Watch Series 1-9 y Ultra', sale_price: 29.99, cost_price: 12.00, stock: 15, min_stock: 5, sku: 'CAR-AW-MAGN', categoryIndex: 6 },
  { name: 'Correa Milanese Samsung Galaxy Watch 46mm', description: 'Correa acero milanesa magnética para Samsung Galaxy Watch 46mm', sale_price: 22.99, cost_price: 8.00, stock: 18, min_stock: 6, sku: 'CRR-SAM-MIL-46', categoryIndex: 6 },
  { name: 'Garmin Vívoactive 5 GPS', description: 'Garmin Vívoactive 5, GPS, AMOLED, más de 30 apps de deporte', sale_price: 249.99, cost_price: 185.00, stock: 4, min_stock: 2, sku: 'GRM-VA5', categoryIndex: 6 },

  // ── Lentes de Cámara y Fotografía (7) ─────────────────────────────────────
  { name: 'Kit Lentes Clip Celular 3en1', description: 'Kit de lentes clip: ojo de pez, gran angular, macro — compatible universalmente', sale_price: 19.99, cost_price: 7.00, stock: 25, min_stock: 8, sku: 'LNS-KIT3-CLIP', categoryIndex: 7 },
  { name: 'Lente Teleobjetivo 2X Clip', description: 'Lente teleobjetivo clip 2X para smartphones, vidrio óptico multicapa', sale_price: 24.99, cost_price: 9.00, stock: 20, min_stock: 6, sku: 'LNS-TELE2X', categoryIndex: 7 },
  { name: 'Tripié 50cm para Celular', description: 'Tripié compacto de aluminio con cabeza giratoria 360° y clip universal', sale_price: 14.99, cost_price: 5.00, stock: 30, min_stock: 10, sku: 'TRP-50CM', categoryIndex: 7 },
  { name: 'Selfie Ring Light 26cm USB', description: 'Aro de luz LED 26cm, 3 tonos, intensidad ajustable, soporte para celular', sale_price: 29.99, cost_price: 12.00, stock: 15, min_stock: 5, sku: 'RNG-26CM-USB', categoryIndex: 7 },
  { name: 'Gimbal Estabilizador DJI Osmo Mobile SE', description: 'DJI Osmo Mobile SE, estabilización de 3 ejes, seguimiento de sujeto', sale_price: 119.99, cost_price: 80.00, stock: 5, min_stock: 2, sku: 'DJI-OM-SE', categoryIndex: 7 },
  { name: 'Lente Macro 15X Clip Celular', description: 'Lente macro 15X con LED integrado para fotografía de detalle', sale_price: 16.99, cost_price: 5.50, stock: 22, min_stock: 7, sku: 'LNS-MAC15X', categoryIndex: 7 },
  { name: 'Control Bluetooth para Selfie y Presentaciones', description: 'Control remoto BT para disparar fotos y controlar presentaciones', sale_price: 12.99, cost_price: 4.00, stock: 35, min_stock: 10, sku: 'BTN-SLFI-BT', categoryIndex: 7 },
  { name: 'Micrófono Lavalier para Celular', description: 'Micrófono de solapa con cable 1.5m y jack 3.5mm/USB-C, para vlogging', sale_price: 22.99, cost_price: 8.00, stock: 18, min_stock: 5, sku: 'MIC-LAV-3.5', categoryIndex: 7 },
  { name: 'Micrófono de Condensador USB-C Portátil', description: 'Micrófono cardioide USB-C para smartphones, calidad estudio', sale_price: 39.99, cost_price: 17.00, stock: 8, min_stock: 3, sku: 'MIC-COND-UC', categoryIndex: 7 },
  { name: 'Mini Trípode Flexible Gorilla Pod', description: 'Trípode flexible octopus de 20cm, cabeza con clip universal', sale_price: 11.99, cost_price: 4.00, stock: 30, min_stock: 10, sku: 'TRP-FLEX-20', categoryIndex: 7 },

  // ── Memoria y Almacenamiento (8) ───────────────────────────────────────────
  { name: 'MicroSD SanDisk 128GB Extreme A2', description: 'Tarjeta microSD Clase 10 A2, lectura hasta 190MB/s — incluye adaptador SD', sale_price: 24.99, cost_price: 11.00, stock: 30, min_stock: 10, sku: 'MSD-SND-128', categoryIndex: 8 },
  { name: 'MicroSD Samsung 256GB PRO Plus', description: 'Tarjeta microSD 256GB Samsung PRO Plus, UHS-I U3, 180MB/s lectura', sale_price: 44.99, cost_price: 22.00, stock: 20, min_stock: 6, sku: 'MSD-SAM-256', categoryIndex: 8 },
  { name: 'MicroSD Lexar 64GB U1 A1', description: 'Tarjeta microSD 64GB Lexar, Clase 10 A1, para cámaras y Android', sale_price: 12.99, cost_price: 5.00, stock: 40, min_stock: 12, sku: 'MSD-LEX-64', categoryIndex: 8 },
  { name: 'OTG USB-C a USB-A Adapter', description: 'Adaptador OTG USB-C macho a USB-A hembra, para conectar USB al celular', sale_price: 7.99, cost_price: 2.50, stock: 60, min_stock: 20, sku: 'ADP-OTG-UCA', categoryIndex: 8 },
  { name: 'OTG Lightning a USB-A Adapter', description: 'Adaptador OTG Lightning a USB-A para iPhone/iPad, transferencia y carga', sale_price: 9.99, cost_price: 3.50, stock: 45, min_stock: 15, sku: 'ADP-OTG-LTN', categoryIndex: 8 },
  { name: 'Pendrive USB-C + USB-A 128GB Kingston', description: 'Flash drive doble conector Kingston DataTraveler Duo 128GB', sale_price: 22.99, cost_price: 10.00, stock: 20, min_stock: 6, sku: 'USB-KNG-DUO-128', categoryIndex: 8 },
  { name: 'Lector de Tarjetas SD/MicroSD USB-C', description: 'Lector compacto de tarjetas SD y microSD con conector USB-C', sale_price: 12.99, cost_price: 4.50, stock: 25, min_stock: 8, sku: 'LEC-SD-UC', categoryIndex: 8 },
  { name: 'SSD Externo 500GB USB-C Samsung T7', description: 'Samsung T7 SSD portátil 500GB, 1050 MB/s, compacto y resistente a golpes', sale_price: 69.99, cost_price: 45.00, stock: 8, min_stock: 3, sku: 'SSD-SAM-T7-500', categoryIndex: 8 },
  { name: 'MicroSD SanDisk Ultra 512GB', description: 'MicroSD 512GB SanDisk Ultra, lectura hasta 150MB/s, A1 Clase 10', sale_price: 59.99, cost_price: 32.00, stock: 10, min_stock: 3, sku: 'MSD-SND-512', categoryIndex: 8 },
  { name: 'Pendrive 64GB USB 3.0 Kingston', description: 'Unidad flash Kingston DataTraveler 64GB USB 3.0, pequeño y rápido', sale_price: 10.99, cost_price: 4.00, stock: 35, min_stock: 10, sku: 'USB-KNG-64', categoryIndex: 8 },

  // ── Repuestos y Reparación (9) ─────────────────────────────────────────────
  { name: 'Pantalla iPhone 12 OLED (Original Quality)', description: 'Módulo pantalla OLED de alta calidad para iPhone 12, touch y glass incluidos', sale_price: 79.99, cost_price: 40.00, stock: 5, min_stock: 2, sku: 'PAN-IP12-OLED', categoryIndex: 9 },
  { name: 'Pantalla Samsung A54 AMOLED', description: 'Display AMOLED de reemplazo para Samsung Galaxy A54, incluye marcos', sale_price: 64.99, cost_price: 32.00, stock: 5, min_stock: 2, sku: 'PAN-A54-AMOL', categoryIndex: 9 },
  { name: 'Kit Herramientas Reparación 30 piezas', description: 'Set completo: destornilladores Pentalobe, torx, spudger, pincetas, pinzas', sale_price: 19.99, cost_price: 7.00, stock: 15, min_stock: 5, sku: 'KIT-REP-30', categoryIndex: 9 },
  { name: 'Conector de Carga iPhone 15 (USB-C)', description: 'Puerto de carga de repuesto USB-C para iPhone 15 / 15 Plus / 15 Pro', sale_price: 14.99, cost_price: 5.00, stock: 8, min_stock: 3, sku: 'CON-IP15-UC', categoryIndex: 9 },
  { name: 'Conector de Carga Samsung A54', description: 'Puerto USB-C de reemplazo para Samsung Galaxy A54, con flex', sale_price: 9.99, cost_price: 3.50, stock: 10, min_stock: 3, sku: 'CON-A54-UC', categoryIndex: 9 },
  { name: 'Cámara Trasera iPhone 13 Pro', description: 'Módulo cámara principal de reemplazo para iPhone 13 Pro (12MP+12MP+12MP)', sale_price: 59.99, cost_price: 28.00, stock: 4, min_stock: 2, sku: 'CAM-IP13P-TRS', categoryIndex: 9 },
  { name: 'Pasta Térmica Procesador CPU', description: 'Pasta térmica conductora de alta calidad para CPU de smartphones y laptops', sale_price: 8.99, cost_price: 2.50, stock: 20, min_stock: 5, sku: 'PST-TRM-CPU', categoryIndex: 9 },
  { name: 'Adhesivo Marco Pantalla (Varios modelos)', description: 'Cinta adhesiva de doble cara preformada para pegado de pantalla', sale_price: 3.99, cost_price: 1.00, stock: 50, min_stock: 15, sku: 'ADH-MRC-PAN', categoryIndex: 9 },
  { name: 'Botón Home iPhone 7/8 con Flex', description: 'Botón home de reemplazo con cable flex para iPhone 7 y 8 (no TouchID)', sale_price: 11.99, cost_price: 4.00, stock: 10, min_stock: 3, sku: 'BTN-HOME-IP78', categoryIndex: 9 },
  { name: 'Altavoz Auricular iPhone 11', description: 'Auricular (speaker) de repuesto para iPhone 11, con flex de sensor proximidad', sale_price: 12.99, cost_price: 4.50, stock: 8, min_stock: 3, sku: 'SPK-EAR-IP11', categoryIndex: 9 },
];

// ─── Main ───────────────────────────────────────────────────────────────────
async function seed() {
  console.log('🌱  Iniciando seed de base de datos...');
  console.log(`📂  DB path: ${getDevDbPath()}`);

  await SeedDataSource.initialize();
  console.log('✅  Conexión establecida.\n');

  const categoryRepo = SeedDataSource.getRepository(Category);
  const productRepo = SeedDataSource.getRepository(Product);

  // ── Limpiar datos previos (opcional — comenta si no quieres esto) ──────────
  const existingProducts = await productRepo.count();
  const existingCategories = await categoryRepo.count();

  if (existingCategories > 0 || existingProducts > 0) {
    console.log(`⚠️  La DB ya contiene ${existingCategories} categorías y ${existingProducts} productos.`);
    // Deshabilitar temporariamente FK checks en SQLite para limpiar
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
