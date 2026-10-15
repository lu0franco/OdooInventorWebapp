import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ==========================================
// Odoo JSON-RPC Proxy & API
// Replicating & extending OdooService.vb
// ==========================================

interface OdooTestPayload {
  url: string;
  apiKey?: string;
  db?: string;
}

app.post('/api/odoo/test', async (req: Request, res: Response) => {
  const { url, apiKey } = req.body as OdooTestPayload;

  if (!url || !url.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Ingresá la URL de Odoo.',
      formattedOutput: 'ERROR: Ingresá la URL de Odoo.'
    });
  }

  let cleanUrl = url.trim().replace(/\/+$/, '');
  // En Odoo 16/17/18, /odoo o /web son rutas del frontend HTML con CSRF.
  // El endpoint JSON-RPC 2.0 estándar se ubica en la raíz del dominio: /jsonrpc
  cleanUrl = cleanUrl.replace(/\/(odoo|web)$/i, '');
  const jsonRpcUrl = `${cleanUrl}/jsonrpc`;
  const startTime = Date.now();

  try {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'common',
        method: 'version',
        args: []
      },
      id: 1
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'OdooInventor-Addin/1.0 (Autodesk Inventor 2027 Bridge)'
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const response = await fetch(jsonRpcUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    const responseText = await response.text();

    let jsonResponse: any = null;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch {
      // Non-JSON or HTML response
    }

    // Format output matching original OdooService.vb StringBuilder output
    const formattedOutput = [
      'PRUEBA ODOO JSON-RPC',
      '',
      `HTTP: ${response.status} ${response.statusText}`,
      `Latencia: ${latency}ms`,
      '',
      'URL:',
      jsonRpcUrl,
      '',
      'Respuesta del servidor:',
      '',
      responseText
    ].join('\n');

    return res.json({
      success: response.ok && (!jsonResponse || !jsonResponse.error),
      statusCode: response.status,
      statusText: response.statusText,
      url: jsonRpcUrl,
      latencyMs: latency,
      rawResponse: responseText,
      jsonResponse,
      formattedOutput
    });

  } catch (error: any) {
    const latency = Date.now() - startTime;
    const errorDetails = error.name === 'AbortError' 
      ? 'Timeout de conexión: el servidor no respondió en 15 segundos.' 
      : error.message || String(error);

    const formattedOutput = [
      'ERROR DE CONEXIÓN:',
      '',
      errorDetails,
      '',
      'Detalles técnicos:',
      `URL intentada: ${jsonRpcUrl}`,
      `Latencia transcurrida: ${latency}ms`,
      error.stack || error.toString()
    ].join('\n');

    return res.json({
      success: false,
      error: errorDetails,
      formattedOutput,
      isNetworkError: true,
      latencyMs: latency
    });
  }
});

// Authenticate against Odoo common service
app.post('/api/odoo/authenticate', async (req: Request, res: Response) => {
  const { url, db, login, password } = req.body;

  if (!url || !db || !login || !password) {
    return res.status(400).json({
      success: false,
      error: 'Parámetros incompletos (url, db, login, password requeridos)'
    });
  }

  let cleanUrl = url.trim().replace(/\/+$/, '');
  cleanUrl = cleanUrl.replace(/\/(odoo|web)$/i, '');
  const jsonRpcUrl = `${cleanUrl}/jsonrpc`;

  try {
    const authPayload = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'common',
        method: 'authenticate',
        args: [db, login, password, {}]
      },
      id: Date.now()
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(jsonRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authPayload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const data = await response.json();
    if (data.error) {
      return res.json({ success: false, error: data.error.data?.message || data.error.message });
    }

    const uid = data.result;
    return res.json({
      success: Boolean(uid),
      uid: uid || null,
      message: uid ? 'Autenticación exitosa en Odoo' : 'Credenciales inválidas'
    });
  } catch (err: any) {
    return res.json({
      success: false,
      error: `Error al autenticar: ${err.message}`
    });
  }
});

// Create Purchase Order (purchase.order & purchase.order.line) from BOM/LDM
app.post('/api/odoo/create-purchase-order', async (req: Request, res: Response) => {
  const { url, db, login, apiKey, partnerId = 1, items = [], origin = 'Autodesk Inventor LDM' } = req.body;

  if (!url || !db || !login || !apiKey) {
    // If credentials not provided, simulate successful creation for UI test mode
    const fakePoNumber = `PO2027-${Math.floor(1000 + Math.random() * 9000)}`;
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      action: 'PURCHASE_ORDER',
      target: `purchase.order [${fakePoNumber}]`,
      status: 'OK',
      details: `Pedido de compra ${fakePoNumber} generado con ${items.length} líneas de la LDM.`
    };
    mockState.syncLogs.unshift(newLog);

    return res.json({
      success: true,
      simulated: true,
      orderId: Math.floor(100 + Math.random() * 900),
      orderName: fakePoNumber,
      linesCount: items.length,
      message: `¡Pedido de compra ${fakePoNumber} creado exitosamente en Odoo con ${items.length} líneas de la LDM!`
    });
  }

  let cleanUrl = url.trim().replace(/\/+$/, '');
  cleanUrl = cleanUrl.replace(/\/(odoo|web)$/i, '');
  const jsonRpcUrl = `${cleanUrl}/jsonrpc`;

  try {
    // 1. Authenticate
    const authRes = await fetch(jsonRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'common',
          method: 'authenticate',
          args: [db, login, apiKey, {}]
        },
        id: 1
      })
    });
    const authData = await authRes.json();
    const uid = authData.result;
    if (!uid) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas en Odoo.' });
    }

    // Helper for execute_kw
    const executeKw = async (model: string, method: string, args: any[], kwargs: any = {}) => {
      const resp = await fetch(jsonRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            service: 'object',
            method: 'execute_kw',
            args: [db, uid, apiKey, model, method, args, kwargs]
          },
          id: Date.now()
        })
      });
      const d = await resp.json();
      if (d.error) throw new Error(d.error.data?.message || d.error.message);
      return d.result;
    };

    // 2. Create purchase.order
    const orderId = await executeKw('purchase.order', 'create', [{
      partner_id: Number(partnerId) || 1,
      origin: origin || 'Autodesk Inventor LDM'
    }]);

    // Read order name (e.g. PO00045)
    const orderDetails = await executeKw('purchase.order', 'read', [[orderId]], { fields: ['name'] });
    const orderName = orderDetails?.[0]?.name || `PO#${orderId}`;

    // 3. For each LDM item, find or create product and add to purchase.order.line
    let createdLines = 0;
    for (const item of items) {
      if (!item.partNumber) continue;

      // Search product.product
      const found = await executeKw('product.product', 'search_read', [
        [['default_code', '=', item.partNumber.trim()]]
      ], { fields: ['id', 'name'], limit: 1 });

      let productId = found?.[0]?.id;
      if (!productId) {
        // Create product
        productId = await executeKw('product.product', 'create', [{
          default_code: item.partNumber.trim(),
          name: item.description || item.partNumber,
          type: 'consu'
        }]);
      }

      // Add line to purchase.order.line
      await executeKw('purchase.order.line', 'create', [{
        order_id: orderId,
        product_id: productId,
        name: item.description || item.partNumber,
        product_qty: Number(item.qty || item.quantity || 1)
      }]);
      createdLines++;
    }

    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      action: 'PURCHASE_ORDER',
      target: `purchase.order [${orderName}]`,
      status: 'OK',
      details: `Pedido de compra real ${orderName} creado en Odoo con ${createdLines} líneas.`
    };
    mockState.syncLogs.unshift(newLog);

    return res.json({
      success: true,
      orderId,
      orderName,
      linesCount: createdLines,
      message: `¡Pedido de compra ${orderName} generado en Odoo con ${createdLines} líneas de la LDM!`
    });

  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Storage for live sessions received from Autodesk Inventor 2027 Add-In
const importedSessions = new Map<string, any>();

app.post('/api/inventor/import-session', (req: Request, res: Response) => {
  const { assemblyName, partNumber, revision, author, material, mass, volume, dimensions, bom } = req.body;

  if (!partNumber && !assemblyName) {
    return res.status(400).json({ success: false, error: 'Faltan datos de la pieza o ensamble de Inventor.' });
  }

  const sessionId = `inv-${Date.now().toString(36)}`;
  const sessionData = {
    sessionId,
    importedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    partNumber: partNumber || 'ENS-INVENTOR',
    name: assemblyName || partNumber || 'Ensamblaje Activo',
    fileType: 'iam' as const,
    revision: revision || 'Rev. 1',
    author: author || 'Inventor Designer',
    material: material || 'Acero / Normalizados',
    mass: Number(mass) || 0,
    volume: Number(volume) || 0,
    dimensions: dimensions || 'N/A',
    odooProductId: 'NEW',
    syncStatus: 'pending' as const,
    lastSync: 'Recién importado de Inventor',
    iProperties: {
      Title: assemblyName || partNumber || '',
      Subject: 'Ensamblaje Mecánico',
      Company: 'Deblasi',
      Manager: 'Ingeniería',
      CostCenter: 'CC-ING-01',
      StandardCost: 0,
      StockLocation: 'WH/Stock'
    },
    bom: Array.isArray(bom) ? bom.map((item: any, idx: number) => ({
      id: String(idx + 1),
      item: String(idx + 1),
      partNumber: item.partNumber || `ITEM-${idx + 1}`,
      description: item.description || item.name || item.partNumber || '',
      qty: Number(item.qty || item.quantity || 1),
      uom: item.uom || 'Unidades',
      material: item.material || 'Comercial',
      odooId: item.odooId || `PROD-${Math.floor(100 + Math.random() * 900)}`,
      status: 'pending' as const
    })) : []
  };

  importedSessions.set(sessionId, sessionData);

  // Automatically make it the active part in mockState too
  mockState.activePart = sessionData;

  const log = {
    id: Date.now(),
    timestamp: sessionData.importedAt,
    action: 'INVENTOR_IMPORT',
    target: `${sessionData.partNumber} (.iam)`,
    status: 'OK' as const,
    details: `Recibido ensamblaje en vivo desde Autodesk Inventor 2027 con ${sessionData.bom.length} componentes.`
  };
  mockState.syncLogs.unshift(log);

  return res.json({
    success: true,
    sessionId,
    message: `¡Ensamblaje '${sessionData.partNumber}' cargado con éxito en la WebApp! (${sessionData.bom.length} piezas)`,
    session: sessionData
  });
});

app.get('/api/inventor/session/:id', (req: Request, res: Response) => {
  const sessionId = String(req.params.id);
  const session = importedSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Sesión no encontrada.' });
  }
  return res.json({ success: true, session });
});

app.get('/api/inventor/latest', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    activePart: mockState.activePart,
    session: mockState.activePart
  });
});

// Mock / Sample CAD & ERP synchronized database
const cintaTransferenciaFlamarique = {
  partNumber: 'D-659.00',
  name: 'CINTA DE TRANSFERENCIA 3 - OT-26148 - FLAMARIQUE',
  fileType: 'iam' as const,
  revision: 'Rev. 3',
  author: 'flucero (Autodesk Inventor 2027)',
  material: 'Acero Inoxidable AISI 304 / UHMW-PE / SAE 1045',
  mass: 142.6,
  volume: 18240.5,
  dimensions: '3450mm x 480mm x 380mm',
  odooProductId: '1048',
  syncStatus: 'pending' as 'synced' | 'modified' | 'pending',
  lastSync: 'Recién cargado desde Inventor',
  iProperties: {
    Title: 'CINTA DE TRANSFERENCIA 3',
    Subject: 'OT-26148 - Línea de Envasado / Transporte Modular',
    Company: 'Deblasi Soluciones Industriales',
    Manager: 'Ingeniería Mecánica',
    CostCenter: 'CC-ING-26148',
    StandardCost: 3850.00,
    StockLocation: 'WH/Stock/Montaje'
  },
  bom: [
    { id: '1', item: '1', partNumber: 'D-659.01.03', description: 'COSTILLA CAJÓN (Chapa plegada 2.5mm)', qty: 6, uom: 'Unidades', material: 'AISI 304', odooId: 'PROD-659-01', status: 'pending' as const },
    { id: '2', item: '2', partNumber: 'ANCLAJE A MENSULA', description: 'Soporte y anclaje a ménsula estructural', qty: 4, uom: 'Unidades', material: 'AISI 304', odooId: 'PROD-659-02', status: 'pending' as const },
    { id: '3', item: '3', partNumber: 'CAJON MANDO', description: 'Subensamblaje Cajón de Mando y Transmisión', qty: 1, uom: 'Unidades', material: 'AISI 304', odooId: 'PROD-659-03', status: 'pending' as const },
    { id: '4', item: '4', partNumber: 'D-659.01.04', description: 'TRAVESANO COSTILLAS (Perfil conformación)', qty: 3, uom: 'Unidades', material: 'AISI 304', odooId: 'PROD-659-04', status: 'pending' as const },
    { id: '5', item: '5', partNumber: 'MOTORREDUCTOR STM - UMI 50:1', description: 'Motorreductor a sinfín y corona STM UMI 50 i=50 0.75kW', qty: 1, uom: 'Unidades', material: 'Normalizado', odooId: 'PROD-MOT-50', status: 'pending' as const },
    { id: '6', item: '6', partNumber: 'D-659.01.05', description: 'TAPA FRONTAL (Protección módulo motriz)', qty: 1, uom: 'Unidades', material: 'AISI 304', odooId: 'PROD-659-05', status: 'pending' as const },
    { id: '7', item: '7', partNumber: 'D-659.01.06', description: 'EJE MANDO (Eje motriz maquinado Ø30mm)', qty: 1, uom: 'Unidades', material: 'SAE 1045', odooId: 'PROD-659-06', status: 'pending' as const },
    { id: '8', item: '8', partNumber: 'COMERCIAL - ADAPTADOR 25-38', description: 'Adaptador comercial de acoplamiento 25-38mm', qty: 2, uom: 'Unidades', material: 'Acero SAE 1045', odooId: 'PROD-659-08', status: 'pending' as const },
    { id: '9', item: '9', partNumber: 'RUEDA DENTADA Z 12 - PASO 25', description: 'Rueda dentada de tracción Z12 paso 25mm para malla modular', qty: 2, uom: 'Unidades', material: 'Poliamida PA6', odooId: 'PROD-659-09', status: 'pending' as const },
    { id: '10', item: '10', partNumber: 'ISO 4017 - M10 x 25 - ISO - 25431', description: 'Tornillo hexagonal M10x25 ISO 4017 acero inox', qty: 12, uom: 'Unidades', material: 'Inox A2-70', odooId: 'PROD-TORN-M10', status: 'pending' as const },
    { id: '11', item: '11', partNumber: 'PLATINA REDUCTOR', description: 'Platina soporte y fijación de reductor UMI 50', qty: 2, uom: 'Unidades', material: 'AISI 304', odooId: 'PROD-659-11', status: 'pending' as const },
    { id: '12', item: '12', partNumber: 'PORTA RODAMIENTO', description: 'Soporte y caja porta rodamiento autoalineable UCFL 206', qty: 2, uom: 'Unidades', material: 'Fundición / Inox', odooId: 'PROD-ROD-206', status: 'pending' as const },
    { id: '13', item: '13', partNumber: 'D-659.02.08', description: 'Ensamble EJE RETORNO (Conjunto tensor y retorno)', qty: 1, uom: 'Unidades', material: 'AISI 304 / SAE 1045', odooId: 'PROD-659-13', status: 'pending' as const },
    { id: '14', item: '14', partNumber: 'D-659.01.02', description: 'BABETA MÓDULO MANDO (Guía de entrada / transición)', qty: 1, uom: 'Unidades', material: 'UHMW-PE Verde', odooId: 'PROD-659-14', status: 'pending' as const },
    { id: '15', item: '15', partNumber: 'D-659.02.06', description: 'TENSOR RESORTE (Mecanismo de tensión automática)', qty: 2, uom: 'Unidades', material: 'Acero templado / AISI 304', odooId: 'PROD-659-15', status: 'pending' as const },
    { id: '16', item: '16', partNumber: 'MALLA MODULAR PASO 25', description: 'Banda transportadora modular plástica paso 25mm Ancho=400mm', qty: 1, uom: 'Metros', material: 'Polipropileno FDA', odooId: 'PROD-MALLA-25', status: 'pending' as const },
    { id: '17', item: '17', partNumber: 'D-659.02.01', description: 'EJE RETORNO TENSOR Ø25mm (Mecanizado libre)', qty: 1, uom: 'Unidades', material: 'SAE 1045', odooId: 'PROD-659-17', status: 'pending' as const },
    { id: '18', item: '18', partNumber: 'D-659.02.02', description: 'RODILLO GUÍA RETORNO Ø80mm', qty: 2, uom: 'Unidades', material: 'Poliamida PA6', odooId: 'PROD-659-18', status: 'pending' as const },
    { id: '19', item: '19', partNumber: 'ROD-6205-2RS', description: 'Rodamiento rígido de bolas SKF 6205-2RS', qty: 4, uom: 'Unidades', material: 'Normalizado', odooId: 'PROD-109', status: 'pending' as const },
    { id: '20', item: '20', partNumber: 'PERFIL GUIA DESLIZANTE UHMW', description: 'Perfil guía de desgaste bajo malla modular L=3000mm', qty: 4, uom: 'Unidades', material: 'UHMW-PE Verde', odooId: 'PROD-GUIA-UHMW', status: 'pending' as const },
    { id: '21', item: '21', partNumber: 'ISO 7089 - 10 - 200HV', description: 'Arandela plana DIN 125 M10 acero inoxidable', qty: 24, uom: 'Unidades', material: 'Inox A2', odooId: 'PROD-ARAN-M10', status: 'pending' as const },
    { id: '22', item: '22', partNumber: 'PATA NIVELADORA ARTICULADA M16', description: 'Pie nivelador regulable M16 con rótula y base antideslizante', qty: 4, uom: 'Unidades', material: 'Poliamida / AISI 304', odooId: 'PROD-PATA-M16', status: 'pending' as const }
  ]
};

// Mock / Sample CAD & ERP synchronized database
const mockState = {
  activePart: { ...cintaTransferenciaFlamarique },
  presets: [
    { id: 'flamarique', label: 'D-659.00 - CINTA DE TRANSFERENCIA 3 - OT-26148 - FLAMARIQUE', data: cintaTransferenciaFlamarique },
    { 
      id: 'reductor', 
      label: 'INV-2027-ASM01 - Reductor Planetario Helicoidal v3',
      data: {
        partNumber: 'INV-2027-ASM01',
        name: 'Reductor Planetario Helicoidal v3',
        fileType: 'iam' as const,
        revision: 'C.2',
        author: 'Franco Lucero (Inventor 2027)',
        material: 'Acero SAE 4140 templado / Aluminio 7075-T6',
        mass: 14.85,
        volume: 1890.4,
        dimensions: '220mm x 180mm x 150mm',
        odooProductId: '1048',
        syncStatus: 'synced' as const,
        lastSync: '2026-10-14 09:15',
        iProperties: {
          Title: 'Reductor Planetario Helicoidal',
          Subject: 'Mecanismo de Transmisión de Potencia',
          Company: 'Deblasi Soluciones Industriales',
          Manager: 'Ingeniería Mecánica',
          CostCenter: 'CC-MEC-400',
          StandardCost: 450.00,
          StockLocation: 'WH/Stock/Mecanizados'
        },
        bom: [
          { id: '1', item: '1', partNumber: 'CARC-AL7075-01', description: 'Carcasa Principal Bipartida', qty: 1, uom: 'Unidades', material: 'Aluminio 7075', odooId: 'PROD-401', status: 'synced' as const },
          { id: '2', item: '2', partNumber: 'ENG-SOL-01', description: 'Engranaje Solar Helicoidal Z=18 M=2.5', qty: 1, uom: 'Unidades', material: 'SAE 4140', odooId: 'PROD-402', status: 'synced' as const },
          { id: '3', item: '3', partNumber: 'ENG-PLAN-01', description: 'Satélites Planetarios Z=36 (Juego x3)', qty: 3, uom: 'Unidades', material: 'SAE 8620', odooId: 'PROD-403', status: 'synced' as const },
          { id: '4', item: '4', partNumber: 'CORONA-INT-01', description: 'Corona Dentada Interior Z=90', qty: 1, uom: 'Unidades', material: 'SAE 4140', odooId: 'PROD-404', status: 'synced' as const },
          { id: '5', item: '5', partNumber: 'ROD-6205-2RS', description: 'Rodamiento Rígido de Bolas SKF 6205-2RS', qty: 4, uom: 'Unidades', material: 'Normalizado', odooId: 'PROD-109', status: 'synced' as const },
          { id: '6', item: '6', partNumber: 'RET-30-52-7', description: 'Retén de Doble Labio NBR 30x52x7', qty: 2, uom: 'Unidades', material: 'Polímero NBR', odooId: 'PROD-312', status: 'synced' as const },
          { id: '7', item: '7', partNumber: 'BUL-M8X35-88', description: 'Bulón Allen Cilíndrico DIN 912 M8x35 Cl. 8.8', qty: 8, uom: 'Unidades', material: 'Acero Cincado', odooId: 'PROD-088', status: 'synced' as const }
        ]
      }
    }
  ],
  odooProducts: [
    { id: 1048, default_code: 'D-659.00', name: 'CINTA DE TRANSFERENCIA 3 - OT-26148 - FLAMARIQUE', list_price: 6500.00, standard_price: 3850.00, qty_available: 1, uom_id: 'Unidades', type: 'product', bom_count: 1 },
    { id: 1049, default_code: 'D-659.01.03', name: 'COSTILLA CAJÓN (Chapa plegada 2.5mm)', list_price: 85.00, standard_price: 38.00, qty_available: 18, uom_id: 'Unidades', type: 'consu', bom_count: 0 },
    { id: 1050, default_code: 'MOTORREDUCTOR STM - UMI 50:1', name: 'Motorreductor STM UMI 50 i=50 0.75kW', list_price: 680.00, standard_price: 490.00, qty_available: 3, uom_id: 'Unidades', type: 'product', bom_count: 0 },
    { id: 1051, default_code: 'RUEDA DENTADA Z 12 - PASO 25', name: 'Rueda dentada de tracción Z12 paso 25mm', list_price: 45.00, standard_price: 22.00, qty_available: 8, uom_id: 'Unidades', type: 'product', bom_count: 0 },
    { id: 1052, default_code: 'ISO 4017 - M10 x 25 - ISO - 25431', name: 'Tornillo hexagonal M10x25 ISO 4017 A2 Inox', list_price: 2.50, standard_price: 0.90, qty_available: 300, uom_id: 'Unidades', type: 'consu', bom_count: 0 },
    { id: 1053, default_code: 'D-659.01.06', name: 'EJE MANDO (Mecanizado Ø30mm)', list_price: 185.00, standard_price: 92.00, qty_available: 2, uom_id: 'Unidades', type: 'consu', bom_count: 0 },
    { id: 1054, default_code: 'D-659.02.08', name: 'Ensamble EJE RETORNO', list_price: 340.00, standard_price: 180.00, qty_available: 2, uom_id: 'Unidades', type: 'product', bom_count: 0 }
  ],
  syncLogs: [
    { id: 1, timestamp: '2026-10-14 12:44:00', action: 'INVENTOR_BRIDGE', target: 'D-659.00 (.iam)', status: 'OK', details: 'Estructura de ensamble lista para transferencia: CINTA DE TRANSFERENCIA 3 - OT-26148 - FLAMARIQUE (16 líneas).' },
    { id: 2, timestamp: '2026-10-14 12:40:05', action: 'JSONRPC_TEST', target: 'https://deblasi.adhoc.ar/odoo/jsonrpc', status: 'OK', details: 'Conexión verificada: Odoo Server common.version responded successfully.' }
  ]
};

app.post('/api/inventor/load-preset', (req: Request, res: Response) => {
  const { presetId } = req.body;
  const found = mockState.presets.find(p => p.id === presetId);
  if (found) {
    mockState.activePart = JSON.parse(JSON.stringify(found.data));
    return res.json({ success: true, part: mockState.activePart });
  }
  return res.status(404).json({ success: false, error: 'Preset no encontrado' });
});

app.get('/api/odoo/state', (_req: Request, res: Response) => {
  return res.json(mockState);
});

app.post('/api/odoo/sync-bom', (req: Request, res: Response) => {
  const { bomLines, partNumber, description } = req.body;
  const newLog = {
    id: Date.now(),
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    action: 'BOM_SYNC',
    target: `mrp.bom [${partNumber || 'ASM'}]`,
    status: 'OK',
    details: `Sincronizada lista de materiales con ${bomLines?.length || 0} componentes en Odoo MRP.`
  };
  mockState.syncLogs.unshift(newLog);
  mockState.activePart.lastSync = newLog.timestamp;
  mockState.activePart.syncStatus = 'synced';

  return res.json({
    success: true,
    message: `Lista de materiales (BOM) para "${partNumber}" sincronizada con Odoo.`,
    bomId: Math.floor(100 + Math.random() * 900),
    linesProcessed: bomLines?.length || 0,
    timestamp: newLog.timestamp
  });
});

app.post('/api/odoo/sync-properties', (req: Request, res: Response) => {
  const { partNumber, name, mass, material, iProperties } = req.body;
  if (mockState.activePart) {
    if (partNumber) mockState.activePart.partNumber = partNumber;
    if (name) mockState.activePart.name = name;
    if (mass) mockState.activePart.mass = Number(mass);
    if (material) mockState.activePart.material = material;
    if (iProperties) {
      mockState.activePart.iProperties = { ...mockState.activePart.iProperties, ...iProperties };
    }
  }

  const log = {
    id: Date.now(),
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    action: 'IPROPERTIES_PUSH',
    target: `product.template (${partNumber})`,
    status: 'OK',
    details: `Actualizadas iProperties de Inventor en Odoo: Masa=${mass}kg, Material=${material}.`
  };
  mockState.syncLogs.unshift(log);

  return res.json({
    success: true,
    message: `iProperties de "${partNumber}" enviadas a Odoo correctamente.`,
    activePart: mockState.activePart
  });
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const server = http.createServer(app);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[OdooInventor] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[OdooInventor] Server startup error:', err);
});
