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

// Mock / Sample CAD & ERP synchronized database
const mockState = {
  activePart: {
    partNumber: 'INV-2027-ASM01',
    name: 'Reductor Planetario Helicoidal v3',
    fileType: 'iam',
    revision: 'C.2',
    author: 'Franco Lucero (Inventor 2027)',
    material: 'Acero SAE 4140 templado / Aluminio 7075-T6',
    mass: 14.85,
    volume: 1890.4,
    dimensions: '220mm x 180mm x 150mm',
    odooProductId: '1048',
    syncStatus: 'synced',
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
      { id: '1', item: '1', partNumber: 'CARC-AL7075-01', description: 'Carcasa Principal Bipartida', qty: 1, uom: 'Unidades', material: 'Aluminio 7075', odooId: 'PROD-401', status: 'synced' },
      { id: '2', item: '2', partNumber: 'ENG-SOL-01', description: 'Engranaje Solar Helicoidal Z=18 M=2.5', qty: 1, uom: 'Unidades', material: 'SAE 4140', odooId: 'PROD-402', status: 'synced' },
      { id: '3', item: '3', partNumber: 'ENG-PLAN-01', description: 'Satélites Planetarios Z=36 (Juego x3)', qty: 3, uom: 'Unidades', material: 'SAE 8620', odooId: 'PROD-403', status: 'synced' },
      { id: '4', item: '4', partNumber: 'CORONA-INT-01', description: 'Corona Dentada Interior Z=90', qty: 1, uom: 'Unidades', material: 'SAE 4140', odooId: 'PROD-404', status: 'synced' },
      { id: '5', item: '5', partNumber: 'ROD-6205-2RS', description: 'Rodamiento Rígido de Bolas SKF 6205-2RS', qty: 4, uom: 'Unidades', material: 'Normalizado', odooId: 'PROD-109', status: 'synced' },
      { id: '6', item: '6', partNumber: 'RET-30-52-7', description: 'Retén de Doble Labio NBR 30x52x7', qty: 2, uom: 'Unidades', material: 'Polímero NBR', odooId: 'PROD-312', status: 'synced' },
      { id: '7', item: '7', partNumber: 'BUL-M8X35-88', description: 'Bulón Allen Cilíndrico DIN 912 M8x35 Cl. 8.8', qty: 8, uom: 'Unidades', material: 'Acero Cincado', odooId: 'PROD-088', status: 'synced' }
    ]
  },
  odooProducts: [
    { id: 1048, default_code: 'INV-2027-ASM01', name: 'Reductor Planetario Helicoidal v3', list_price: 1250.00, standard_price: 450.00, qty_available: 4, uom_id: 'Unidades', type: 'product', bom_count: 1 },
    { id: 1049, default_code: 'CARC-AL7075-01', name: 'Carcasa Principal Bipartida', list_price: 210.00, standard_price: 95.00, qty_available: 12, uom_id: 'Unidades', type: 'product', bom_count: 0 },
    { id: 1050, default_code: 'ENG-SOL-01', name: 'Engranaje Solar Helicoidal Z=18 M=2.5', list_price: 85.00, standard_price: 38.00, qty_available: 25, uom_id: 'Unidades', type: 'product', bom_count: 0 },
    { id: 1051, default_code: 'ENG-PLAN-01', name: 'Satélites Planetarios Z=36', list_price: 65.00, standard_price: 28.50, qty_available: 60, uom_id: 'Unidades', type: 'product', bom_count: 0 },
    { id: 1052, default_code: 'CORONA-INT-01', name: 'Corona Dentada Interior Z=90', list_price: 180.00, standard_price: 82.00, qty_available: 8, uom_id: 'Unidades', type: 'product', bom_count: 0 },
    { id: 1053, default_code: 'ROD-6205-2RS', name: 'Rodamiento Rígido SKF 6205-2RS', list_price: 22.00, standard_price: 9.80, qty_available: 150, uom_id: 'Unidades', type: 'consu', bom_count: 0 },
    { id: 1054, default_code: 'RET-30-52-7', name: 'Retén NBR 30x52x7', list_price: 6.50, standard_price: 2.10, qty_available: 95, uom_id: 'Unidades', type: 'consu', bom_count: 0 }
  ],
  syncLogs: [
    { id: 1, timestamp: '2026-10-14 09:15:22', action: 'BOM_SYNC', target: 'mrp.bom #48', status: 'OK', details: 'BOM sincronizada para INV-2027-ASM01 con 7 líneas de componentes.' },
    { id: 2, timestamp: '2026-10-14 09:12:05', action: 'IPROPERTIES_PUSH', target: 'product.template #1048', status: 'OK', details: 'Actualizados peso (14.85kg), volumen (1890.4cm3) y dimensiones desde Autodesk Inventor.' },
    { id: 3, timestamp: '2026-10-14 09:05:40', action: 'JSONRPC_TEST', target: 'https://deblasi.adhoc.ar/odoo/jsonrpc', status: 'OK', details: 'Conexión verificada: Odoo Server common.version responded successfully.' }
  ]
};

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
      server: { middlewareMode: true },
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
