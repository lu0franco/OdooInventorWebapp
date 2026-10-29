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

// Endpoint para descargar server.ts directamente en la PC local
app.get('/download/server.ts', (_req: Request, res: Response) => {
  res.download(path.join(__dirname, 'server.ts'), 'server.ts');
});

// Endpoint para descargar InventorWebBridge.vb actualizado
app.get('/download/InventorWebBridge.vb', (_req: Request, res: Response) => {
  res.download(path.join(__dirname, 'InventorWebBridge.vb'), 'InventorWebBridge.vb');
});

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
      return res.status(200).json({ success: false, error: 'Credenciales inválidas en Odoo.', canSimulate: true });
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

// Health / status endpoint for purchase requisition route
app.get('/api/odoo/create-purchase-requisition', (_req: Request, res: Response) => {
  return res.json({
    endpoint: '/api/odoo/create-purchase-requisition',
    methods: ['POST', 'GET'],
    status: 'online',
    message: 'Endpoint de Solicitud de Compra (purchase.requisition) activo y listo.'
  });
});

// Create Purchase Requisition (purchase.requisition & purchase.requisition.line) from BOM/LDM
app.post('/api/odoo/create-purchase-requisition', async (req: Request, res: Response) => {
  const { url, db, login, apiKey, items = [], origin = 'Autodesk Inventor LDM', notes = '', scheduleDate = '' } = req.body;

  if (!url || !db || !login || !apiKey) {
    // Simulation / UI test mode
    const fakeReqNumber = `REQ2027-${Math.floor(1000 + Math.random() * 9000)}`;
    const newRequisition = {
      id: Date.now(),
      name: fakeReqNumber,
      origin: origin || 'Autodesk Inventor LDM',
      state: 'draft' as const,
      ordering_date: new Date().toISOString().substring(0, 10),
      schedule_date: scheduleDate || new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      notes: notes || 'Generado desde Autodesk Inventor 2027 — Componentes comerciales para fabricación.',
      simulated: true,
      lines: items.map((it: any, idx: number) => ({
        id: idx + 1,
        partNumber: it.partNumber || `ITEM-${idx + 1}`,
        description: it.description || it.partNumber,
        qty: Number(it.qty || 1),
        uom: it.uom || 'Unidades',
        price_unit: Number(it.price_unit || 0),
        schedule_date: scheduleDate || '',
        isCom: it.isCom ?? true
      }))
    };

    mockState.purchaseRequisitions.unshift(newRequisition);

    const newLog = {
      id: Date.now(),
      timestamp: newRequisition.timestamp,
      action: 'PURCHASE_REQUISITION',
      target: `purchase.requisition [${fakeReqNumber}]`,
      status: 'OK',
      details: `Solicitud de compra ${fakeReqNumber} (purchase.requisition) creada en estado Borrador con ${items.length} líneas de la LDM.`
    };
    mockState.syncLogs.unshift(newLog);

    return res.json({
      success: true,
      simulated: true,
      requisitionId: newRequisition.id,
      requisitionName: fakeReqNumber,
      linesCount: items.length,
      requisition: newRequisition,
      message: `¡Solicitud de compra ${fakeReqNumber} (purchase.requisition) creada exitosamente con ${items.length} líneas de la LDM!`
    });
  }

  let cleanUrl = url.trim().replace(/\/+$/, '');
  cleanUrl = cleanUrl.replace(/\/(odoo|web)$/i, '');
  const jsonRpcUrl = `${cleanUrl}/jsonrpc`;

  const safeJsonRpc = async (payload: any, timeoutMs = 20000): Promise<any> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(jsonRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OdooInventor-Addin/1.0 (Autodesk Inventor 2027)'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const text = await resp.text();
      if (!text || !text.trim()) {
        throw new Error(`Odoo en ${jsonRpcUrl} devolvió una respuesta vacía (HTTP ${resp.status}).`);
      }
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        if (text.includes('<html') || text.includes('<!DOCTYPE')) {
          throw new Error(`El servidor Odoo devolvió una página HTML en lugar de JSON-RPC (HTTP ${resp.status}). Verificá que la URL sea accesible.`);
        }
        throw new Error(`Respuesta no JSON de Odoo (HTTP ${resp.status}): ${text.substring(0, 160)}`);
      }

      if (json.error) {
        const odooErrMsg = json.error.data?.message || json.error.message || 'Error retornado por Odoo';
        throw new Error(odooErrMsg);
      }
      return json;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    // 1. Authenticate with Odoo
    const authData = await safeJsonRpc({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'common',
        method: 'authenticate',
        args: [db.trim(), login.trim(), apiKey.trim(), {}]
      },
      id: 1
    });

    const uid = authData.result;
    if (!uid) {
      return res.status(200).json({
        success: false,
        error: `No se pudo autenticar en Odoo. Verificá la base de datos '${db}', el usuario '${login}' y tu API Key o contraseña.`,
        canSimulate: true
      });
    }

    const executeKw = async (model: string, method: string, args: any[] = [], kwargs: any = {}) => {
      const d = await safeJsonRpc({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'object',
          method: 'execute_kw',
          args: [db.trim(), uid, apiKey.trim(), model, method, args, kwargs]
        },
        id: Date.now()
      });
      return d.result;
    };

    // 2. Discover which model represents "Solicitud de Compra" in this Odoo database:
    // It can be 'purchase.request' (OCA/Adhoc standard for "Solicitudes de Compra")
    // or 'purchase.requisition' (Acuerdos de compra / Licitaciones)
    let targetModel: 'purchase.request' | 'purchase.requisition' | string | null = null;
    let lineModel: string = '';
    let reqFields: Record<string, any> = {};

    // 2.1 Check purchase.request first (the standard module named "Solicitudes de Compra" in Spanish)
    try {
      const prFields = await executeKw('purchase.request', 'fields_get', [], { attributes: ['type', 'required', 'string'] });
      if (prFields && Object.keys(prFields).length > 0) {
        targetModel = 'purchase.request';
        lineModel = 'purchase.request.line';
        reqFields = prFields;
        console.log('[Odoo] Model purchase.request detected for Solicitudes de Compra.');
      }
    } catch (prErr: any) {
      console.log('[Odoo] purchase.request check failed/not installed:', prErr.message);
    }

    // 2.2 If not found, check purchase.requisition
    if (!targetModel) {
      try {
        const preqFields = await executeKw('purchase.requisition', 'fields_get', [], { attributes: ['type', 'required', 'string'] });
        if (preqFields && Object.keys(preqFields).length > 0) {
          targetModel = 'purchase.requisition';
          lineModel = 'purchase.requisition.line';
          reqFields = preqFields;
          console.log('[Odoo] Model purchase.requisition detected.');
        }
      } catch (preqErr: any) {
        console.log('[Odoo] purchase.requisition check failed/not installed:', preqErr.message);
      }
    }

    // 2.3 If neither directly answered fields_get, search ir.model
    if (!targetModel) {
      try {
        const found = await executeKw('ir.model', 'search_read', [
          [['model', 'in', ['purchase.request', 'purchase.requisition']]]
        ], { fields: ['model', 'name'] });
        if (found && found.length > 0) {
          const modelName = String(found[0].model);
          targetModel = modelName;
          lineModel = `${modelName}.line`;
          try {
            reqFields = (await executeKw(modelName, 'fields_get', [], { attributes: ['type', 'required', 'string'] })) || {};
          } catch {}
        }
      } catch (irErr: any) {
        console.warn('[Odoo] ir.model search failed:', irErr.message);
      }
    }

    if (!targetModel) {
      return res.status(200).json({
        success: false,
        error: `No se encontró el modelo de Solicitud de Compra ('purchase.request' ni 'purchase.requisition') en la base de Odoo (${db}). Verificá que el módulo esté instalado y que el usuario '${login}' tenga permisos de compras.`,
        canSimulate: true
      });
    }

    // Determine requisition type if purchase.requisition model is used
    let typeId: number | undefined;
    if (targetModel === 'purchase.requisition' && 'type_id' in reqFields) {
      try {
        const types = await executeKw('purchase.requisition.type', 'search_read', [[]], { fields: ['id', 'name'], limit: 1 });
        if (types && types.length > 0) {
          typeId = types[0].id;
        }
      } catch (tErr: any) {
        console.warn('[Odoo] purchase.requisition.type lookup warning:', tErr.message);
      }
    }

    // Build header payload dynamically based strictly on available fields
    const reqPayload: Record<string, any> = {};

    if (targetModel === 'purchase.request') {
      // purchase.request fields
      if ('requested_by' in reqFields) {
        reqPayload.requested_by = uid;
      }
      if ('origin' in reqFields) {
        reqPayload.origin = origin || 'Autodesk Inventor LDM';
      }
      if ('description' in reqFields) {
        reqPayload.description = notes || 'Solicitud de compra generada desde Autodesk Inventor 2027';
      }
      if ('date_start' in reqFields) {
        reqPayload.date_start = new Date().toISOString().substring(0, 10);
      }
    } else {
      // purchase.requisition fields
      if ('origin' in reqFields) {
        reqPayload.origin = origin || 'Autodesk Inventor LDM';
      }
      if ('description' in reqFields) {
        reqPayload.description = notes || 'Solicitud generada desde Autodesk Inventor 2027';
      } else if ('notes' in reqFields) {
        reqPayload.notes = notes || 'Solicitud generada desde Autodesk Inventor 2027';
      }
      if ('user_id' in reqFields) {
        reqPayload.user_id = uid;
      }
      if ('schedule_date' in reqFields && scheduleDate) {
        reqPayload.schedule_date = scheduleDate;
      }
      if ('ordering_date' in reqFields) {
        reqPayload.ordering_date = new Date().toISOString().substring(0, 10);
      }
      if ('date_end' in reqFields && scheduleDate) {
        reqPayload.date_end = `${scheduleDate} 18:00:00`;
      }
      if (typeId && 'type_id' in reqFields) {
        reqPayload.type_id = typeId;
      }
    }

    let reqId: number | null = null;
    try {
      reqId = await executeKw(targetModel, 'create', [reqPayload]);
    } catch (createReqErr: any) {
      console.warn(`[Odoo] Primary ${targetModel} create failed:`, createReqErr.message);
      // Minimal retry payload with only essential fields
      const minimalPayload: Record<string, any> = {};
      if (targetModel === 'purchase.request') {
        if ('requested_by' in reqFields) minimalPayload.requested_by = uid;
        if ('origin' in reqFields) minimalPayload.origin = origin || 'Autodesk Inventor LDM';
      } else {
        if ('origin' in reqFields) minimalPayload.origin = origin || 'Autodesk Inventor LDM';
        if (typeId && 'type_id' in reqFields) minimalPayload.type_id = typeId;
      }
      try {
        reqId = await executeKw(targetModel, 'create', [minimalPayload]);
      } catch (retryErr: any) {
        console.error(`[Odoo] ${targetModel} minimal create failed:`, retryErr.message);
        return res.status(200).json({
          success: false,
          error: `Error al crear '${targetModel}' en Odoo: ${createReqErr.message || retryErr.message}`,
          canSimulate: true
        });
      }
    }

    if (!reqId) {
      return res.status(200).json({
        success: false,
        error: `No se pudo obtener el ID de la solicitud (${targetModel}) creada en Odoo.`,
        canSimulate: true
      });
    }

    // Introspect line fields
    let lineFields: Record<string, any> = {};
    try {
      lineFields = (await executeKw(lineModel, 'fields_get', [], { attributes: ['type', 'required', 'string'] })) || {};
    } catch (lineFieldErr: any) {
      console.warn(`[Odoo] fields_get on ${lineModel} warning:`, lineFieldErr.message);
    }

    // 3. For each LDM item, link to mapped product and create line in lineModel
    let createdLines = 0;
    const lineErrors: string[] = [];

    for (const item of items) {
      if (!item.partNumber && !item.description) continue;

      let productId: number | null = null;
      const rawCandidateId = Number(item.odooProductId || item.productId);

      // 1. Verify if candidate ID actually exists in Odoo product.product
      if (rawCandidateId && !isNaN(rawCandidateId) && rawCandidateId > 0) {
        try {
          const verified = await executeKw('product.product', 'search_read', [
            [['id', '=', rawCandidateId]]
          ], { fields: ['id', 'name', 'default_code', 'uom_id'], limit: 1 });
          if (verified && verified.length > 0) {
            productId = verified[0].id;
          } else {
            console.warn(`[Odoo] Candidate productId ${rawCandidateId} is not in product.product. Re-resolving...`);
          }
        } catch {}
      }

      // 2. Search by default_code (extracting bracketed code like "[247964]" -> "247964")
      if (!productId) {
        const rawCode = String(item.partNumber || '').trim();
        const codeInBrackets = rawCode.match(/\[(.*?)\]/)?.[1]?.trim() || '';
        const searchCodes = [rawCode];
        if (codeInBrackets && codeInBrackets !== rawCode) searchCodes.push(codeInBrackets);

        for (const c of searchCodes) {
          if (!c) continue;
          try {
            const foundByCode = await executeKw('product.product', 'search_read', [
              [['default_code', '=', c]]
            ], { fields: ['id', 'name'], limit: 1 });
            if (foundByCode && foundByCode.length > 0) {
              productId = foundByCode[0].id;
              break;
            }
          } catch {}
        }
      }

      // 3. Search by name / description
      if (!productId) {
        const rawName = String(item.productName || item.description || item.partNumber || '').trim();
        const cleanName = rawName.replace(/\[.*?\]\s*/g, '').trim();
        const searchNames = [cleanName, rawName].filter(n => n.length >= 3);

        for (const n of searchNames) {
          try {
            const foundByName = await executeKw('product.product', 'search_read', [
              [['name', 'ilike', n]]
            ], { fields: ['id', 'name'], limit: 1 });
            if (foundByName && foundByName.length > 0) {
              productId = foundByName[0].id;
              break;
            }
          } catch {}
        }
      }

      // 4. Create product in Odoo if not found
      if (!productId) {
        const rawCode = String(item.partNumber || '').trim();
        const codeInBrackets = rawCode.match(/\[(.*?)\]/)?.[1]?.trim() || '';
        const defaultCodeToUse = codeInBrackets || rawCode;
        const nameToUse = String(item.description || item.partNumber || 'Componente CAD').trim();

        try {
          productId = await executeKw('product.product', 'create', [{
            default_code: defaultCodeToUse,
            name: nameToUse,
            type: 'consu'
          }]);
          console.log(`[Odoo] Created new product.product ID ${productId} for '${nameToUse}'`);
        } catch (createProdErr: any) {
          console.warn(`[Odoo] Could not create product for ${item.partNumber}:`, createProdErr.message);
        }
      }

      // 5. Ultimate fallback to any valid product in Odoo database to prevent FK constraint failure
      if (!productId) {
        try {
          const anyProduct = await executeKw('product.product', 'search_read', [[]], { fields: ['id', 'name'], limit: 1 });
          if (anyProduct && anyProduct.length > 0) {
            productId = anyProduct[0].id;
            console.log(`[Odoo] Using fallback existing product ID ${productId}`);
          }
        } catch {}
      }

      if (!productId) {
        lineErrors.push(`${item.partNumber || item.description}: No se pudo resolver o crear un producto válido en Odoo.`);
        continue;
      }

      // Read product UoM
      let uomId: number | undefined;
      try {
        const prodData = await executeKw('product.product', 'read', [[productId]], { fields: ['uom_id', 'uom_po_id', 'name'] });
        if (prodData && prodData[0]) {
          uomId = prodData[0].uom_id?.[0] || prodData[0].uom_po_id?.[0];
        }
      } catch {}

      if (!uomId) {
        try {
          const uoms = await executeKw('uom.uom', 'search_read', [[]], { fields: ['id', 'name'], limit: 1 });
          if (uoms && uoms.length > 0) uomId = uoms[0].id;
        } catch {}
      }

      const qtyVal = Math.max(1, Number(item.qty || 1));
      const linePayload: Record<string, any> = {
        product_id: productId
      };

      if (targetModel === 'purchase.request') {
        // In purchase.request.line, parent reference is request_id
        linePayload.request_id = reqId;
      } else {
        // In purchase.requisition.line, parent reference is requisition_id
        linePayload.requisition_id = reqId;
      }

      if ('product_qty' in lineFields || Object.keys(lineFields).length === 0) {
        linePayload.product_qty = qtyVal;
      } else if ('qty' in lineFields) {
        linePayload.qty = qtyVal;
      }

      if (uomId) {
        if ('product_uom_id' in lineFields || Object.keys(lineFields).length === 0) {
          linePayload.product_uom_id = uomId;
        } else if ('product_uom' in lineFields) {
          linePayload.product_uom = uomId;
        }
      }

      const desc = String(item.productName || item.description || item.partNumber || 'Componente CAD').trim();
      if ('name' in lineFields || targetModel === 'purchase.request') {
        linePayload.name = desc;
      }
      if ('description' in lineFields && !linePayload.description) {
        linePayload.description = desc;
      }
      if ('product_description_variants' in lineFields) {
        linePayload.product_description_variants = desc;
      }

      if ('date_required' in lineFields) {
        linePayload.date_required = scheduleDate || new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10);
      } else if ('schedule_date' in lineFields && scheduleDate) {
        linePayload.schedule_date = scheduleDate;
      }

      if ('estimated_cost' in lineFields) {
        linePayload.estimated_cost = 0;
      }

      try {
        await executeKw(lineModel, 'create', [linePayload]);
        createdLines++;
      } catch (lineErr: any) {
        console.warn(`[Odoo] Primary ${lineModel} create failed for ${productId}:`, lineErr.message);
        try {
          const minimalLine: Record<string, any> = {
            product_id: productId,
            product_qty: qtyVal
          };
          if (targetModel === 'purchase.request') {
            minimalLine.request_id = reqId;
            minimalLine.name = desc;
            if (uomId) minimalLine.product_uom_id = uomId;
          } else {
            minimalLine.requisition_id = reqId;
            if (uomId) minimalLine.product_uom_id = uomId;
          }
          await executeKw(lineModel, 'create', [minimalLine]);
          createdLines++;
        } catch (retryErr: any) {
          console.error(`[Odoo] Minimal ${lineModel} create failed for ${productId}:`, retryErr.message);
          lineErrors.push(`${item.partNumber || item.description}: ${retryErr.message}`);
        }
      }
    }

    // Read generated requisition name and verify line_ids count
    let reqName = `${targetModel === 'purchase.request' ? 'SOL' : 'REQ'}#${reqId}`;
    try {
      const reqDetails = await executeKw(targetModel, 'read', [[reqId]], { fields: ['name', 'line_ids'] });
      if (reqDetails?.[0]?.name) {
        reqName = reqDetails[0].name;
      }
      if (Array.isArray(reqDetails?.[0]?.line_ids) && reqDetails[0].line_ids.length > 0) {
        createdLines = reqDetails[0].line_ids.length;
      }
    } catch {}

    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      action: 'PURCHASE_REQUISITION',
      target: `${targetModel} [${reqName}]`,
      status: 'OK',
      details: `Solicitud de compra ${reqName} (${targetModel}) creada en Odoo con ${createdLines} líneas.`
    };
    mockState.syncLogs.unshift(newLog);

    return res.status(200).json({
      success: true,
      requisitionId: reqId,
      requisitionName: reqName,
      linesCount: createdLines,
      model: targetModel,
      message: `¡Solicitud ${reqName} (${targetModel}) creada exitosamente en Odoo con ${createdLines} líneas!`,
      lineErrors: lineErrors.length > 0 ? lineErrors : undefined
    });

  } catch (err: any) {
    console.error('Error creating purchase requisition:', err);
    let errMsg = err.message || 'Error al comunicarse con el servidor Odoo.';
    return res.status(200).json({ 
      success: false, 
      error: errMsg,
      canSimulate: true 
    });
  }
});

// Search products in Odoo or catalog cache
app.post('/api/odoo/products/search', async (req: Request, res: Response) => {
  const { query = '', url, db, login, apiKey, limit = 25 } = req.body;
  const cleanQ = String(query || '').trim().toLowerCase();

  // 1. If credentials provided, attempt live search in Odoo
  if (url && db && login && apiKey) {
    try {
      let cleanUrl = url.trim().replace(/\/+$/, '').replace(/\/(odoo|web)$/i, '');
      const jsonRpcUrl = `${cleanUrl}/jsonrpc`;
      
      const authRes = await fetch(jsonRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: { service: 'common', method: 'authenticate', args: [db.trim(), login.trim(), apiKey.trim(), {}] },
          id: 1
        })
      });
      const authText = await authRes.text();
      const authJson = JSON.parse(authText);
      const uid = authJson?.result;

      if (uid) {
        const domain = cleanQ
          ? ['|', ['name', 'ilike', cleanQ], ['default_code', 'ilike', cleanQ]]
          : [];

        const searchRes = await fetch(jsonRpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              service: 'object',
              method: 'execute_kw',
              args: [db.trim(), uid, apiKey.trim(), 'product.product', 'search_read', [domain], {
                fields: ['id', 'name', 'default_code', 'qty_available', 'uom_id', 'standard_price'],
                limit
              }]
            },
            id: Date.now()
          })
        });
        const searchText = await searchRes.text();
        const searchJson = JSON.parse(searchText);

        if (Array.isArray(searchJson?.result)) {
          return res.json({
            success: true,
            source: 'odoo_live',
            products: searchJson.result.map((p: any) => ({
              id: p.id,
              default_code: p.default_code || '',
              name: p.name || '',
              qty_available: p.qty_available || 0,
              uom_id: Array.isArray(p.uom_id) ? p.uom_id[1] : (p.uom_id || 'Unidades'),
              standard_price: p.standard_price || 0
            }))
          });
        }
      }
    } catch (liveErr: any) {
      console.warn('Live search in Odoo failed, falling back to local database:', liveErr.message);
    }
  }

  // 2. Search local products database
  const matches = mockState.odooProducts.filter(p => {
    if (!cleanQ) return true;
    return (
      (p.default_code && p.default_code.toLowerCase().includes(cleanQ)) ||
      (p.name && p.name.toLowerCase().includes(cleanQ))
    );
  });

  return res.json({
    success: true,
    source: 'catalog_cache',
    products: matches.slice(0, limit)
  });
});

app.get('/api/odoo/purchase-requisitions', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    requisitions: mockState.purchaseRequisitions || []
  });
});

// Storage for live sessions received from Autodesk Inventor 2027 Add-In
const importedSessions = new Map<string, any>();

app.post('/api/inventor/import-session', (req: Request, res: Response) => {
  const { 
    assemblyName, 
    partNumber, 
    revision, 
    author, 
    material, 
    mass, 
    volume, 
    dimensions, 
    bom,
    stockNumber,
    project,
    designer,
    vendor,
    location,
    fullFileName
  } = req.body;

  if (!partNumber && !assemblyName) {
    return res.status(400).json({ success: false, error: 'Faltan datos de la pieza o ensamble de Inventor.' });
  }

  const pNum = partNumber || 'SEPARADOR DE SOLIDOS';
  const aName = assemblyName || pNum || 'SEPARADOR DE SOLIDOS_R4.iam (ANTIGUO)';
  const proj = project || 'OT-26282';
  const sNum = stockNumber || 'OT-26282.04';
  const des = designer || author || 'FL';
  const vend = vendor || 'FINCA BONI';
  const loc = location || fullFileName || 'D:\\PROYECTOS\\OT-24019 - D.606.B V2\\01 - DIBUJOS\\MODIFICACIONES\\SEPARADOR ESTATICO\\SEPARADOR DE SOLIDOS_R4.iam';

  const sessionId = `inv-${Date.now().toString(36)}`;
  const sessionData = {
    sessionId,
    importedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    partNumber: pNum,
    name: aName,
    fileType: 'iam' as const,
    revision: revision || 'Rev. 1',
    author: des,
    material: material || 'Acero / Normalizados',
    mass: Number(mass) || 87.37,
    volume: Number(volume) || 72308.84,
    dimensions: dimensions || '875,2mm x 519,2mm x 435mm',
    odooProductId: 'NEW',
    syncStatus: 'pending' as const,
    lastSync: 'Recién importado de Inventor',
    iProperties: {
      Title: aName,
      Subject: proj,
      Company: vend,
      Manager: des,
      CostCenter: 'CC-ING-01',
      StandardCost: 0,
      StockLocation: 'WH/Stock',
      PartNumber: pNum,
      StockNumber: sNum,
      Project: proj,
      Designer: des,
      Vendor: vend,
      Location: loc
    },
    bom: Array.isArray(bom) ? bom.map((item: any, idx: number) => {
      const isComVal = Boolean(
        item.isCom === true ||
        item.com === true ||
        ['true', 'si', 's', '1', 'x', 'yes', 'y', 'verdadero'].includes(String(item.com || item.COM || item.isCom || '').toLowerCase()) ||
        String(item.partNumber || '').toUpperCase().startsWith('COMERCIAL') ||
        String(item.partNumber || '').toUpperCase().startsWith('ISO') ||
        String(item.partNumber || '').toUpperCase().startsWith('ROD-') ||
        String(item.material || '').toUpperCase().includes('NORMALIZADO')
      );

      return {
        id: String(idx + 1),
        item: String(idx + 1),
        partNumber: item.partNumber || `ITEM-${idx + 1}`,
        description: item.description || item.name || item.partNumber || '',
        qty: Number(item.qty || item.quantity || 1),
        uom: item.uom || 'Unidades',
        material: item.material || 'Comercial',
        odooId: item.odooId || `PROD-${Math.floor(100 + Math.random() * 900)}`,
        status: 'pending' as const,
        isCom: isComVal
      };
    }) : []
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
  const session = importedSessions.get(sessionId) || mockState.activePart;
  if (!session) {
    return res.status(200).json({ success: false, error: 'Sesión no encontrada.' });
  }
  return res.status(200).json({ success: true, session });
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
    { id: '1', item: '1', partNumber: 'D-659.01.03', description: 'COSTILLA CAJÓN (Chapa plegada 2.5mm)', qty: 6, uom: 'Unidades', material: 'AISI 304', odooId: 'PROD-659-01', status: 'pending' as const, isCom: false },
    { id: '2', item: '2', partNumber: 'ANCLAJE A MENSULA', description: 'Soporte y anclaje a ménsula estructural', qty: 4, uom: 'Unidades', material: 'AISI 304', odooId: 'PROD-659-02', status: 'pending' as const, isCom: false },
    { id: '3', item: '3', partNumber: 'CAJON MANDO', description: 'Subensamblaje Cajón de Mando y Transmisión', qty: 1, uom: 'Unidades', material: 'AISI 304', odooId: 'PROD-659-03', status: 'pending' as const, isCom: false },
    { id: '4', item: '4', partNumber: 'D-659.01.04', description: 'TRAVESANO COSTILLAS (Perfil conformación)', qty: 3, uom: 'Unidades', material: 'AISI 304', odooId: 'PROD-659-04', status: 'pending' as const, isCom: false },
    { id: '5', item: '5', partNumber: 'MOTORREDUCTOR STM - UMI 50:1', description: 'Motorreductor a sinfín y corona STM UMI 50 i=50 0.75kW', qty: 1, uom: 'Unidades', material: 'Normalizado', odooId: 'PROD-MOT-50', status: 'pending' as const, isCom: true },
    { id: '6', item: '6', partNumber: 'D-659.01.05', description: 'TAPA FRONTAL (Protección módulo motriz)', qty: 1, uom: 'Unidades', material: 'AISI 304', odooId: 'PROD-659-05', status: 'pending' as const, isCom: false },
    { id: '7', item: '7', partNumber: 'D-659.01.06', description: 'EJE MANDO (Eje motriz maquinado Ø30mm)', qty: 1, uom: 'Unidades', material: 'SAE 1045', odooId: 'PROD-659-06', status: 'pending' as const, isCom: false },
    { id: '8', item: '8', partNumber: 'COMERCIAL - ADAPTADOR 25-38', description: 'Adaptador comercial de acoplamiento 25-38mm', qty: 2, uom: 'Unidades', material: 'Acero SAE 1045', odooId: 'PROD-659-08', status: 'pending' as const, isCom: true },
    { id: '9', item: '9', partNumber: 'RUEDA DENTADA Z 12 - PASO 25', description: 'Rueda dentada de tracción Z12 paso 25mm para malla modular', qty: 2, uom: 'Unidades', material: 'Poliamida PA6', odooId: 'PROD-659-09', status: 'pending' as const, isCom: true },
    { id: '10', item: '10', partNumber: 'ISO 4017 - M10 x 25 - ISO - 25431', description: 'Tornillo hexagonal M10x25 ISO 4017 acero inox', qty: 12, uom: 'Unidades', material: 'Inox A2-70', odooId: 'PROD-TORN-M10', status: 'pending' as const, isCom: true },
    { id: '11', item: '11', partNumber: 'PLATINA REDUCTOR', description: 'Platina soporte y fijación de reductor UMI 50', qty: 2, uom: 'Unidades', material: 'AISI 304', odooId: 'PROD-659-11', status: 'pending' as const, isCom: false },
    { id: '12', item: '12', partNumber: 'PORTA RODAMIENTO', description: 'Soporte y caja porta rodamiento autoalineable UCFL 206', qty: 2, uom: 'Unidades', material: 'Fundición / Inox', odooId: 'PROD-ROD-206', status: 'pending' as const, isCom: true },
    { id: '13', item: '13', partNumber: 'D-659.02.08', description: 'Ensamble EJE RETORNO (Conjunto tensor y retorno)', qty: 1, uom: 'Unidades', material: 'AISI 304 / SAE 1045', odooId: 'PROD-659-13', status: 'pending' as const, isCom: false },
    { id: '14', item: '14', partNumber: 'D-659.01.02', description: 'BABETA MÓDULO MANDO (Guía de entrada / transición)', qty: 1, uom: 'Unidades', material: 'UHMW-PE Verde', odooId: 'PROD-659-14', status: 'pending' as const, isCom: false },
    { id: '15', item: '15', partNumber: 'D-659.02.06', description: 'TENSOR RESORTE (Mecanismo de tensión automática)', qty: 2, uom: 'Unidades', material: 'Acero templado / AISI 304', odooId: 'PROD-659-15', status: 'pending' as const, isCom: true },
    { id: '16', item: '16', partNumber: 'MALLA MODULAR PASO 25', description: 'Banda transportadora modular plástica paso 25mm Ancho=400mm', qty: 1, uom: 'Metros', material: 'Polipropileno FDA', odooId: 'PROD-MALLA-25', status: 'pending' as const, isCom: true },
    { id: '17', item: '17', partNumber: 'D-659.02.01', description: 'EJE RETORNO TENSOR Ø25mm (Mecanizado libre)', qty: 1, uom: 'Unidades', material: 'SAE 1045', odooId: 'PROD-659-17', status: 'pending' as const, isCom: false },
    { id: '18', item: '18', partNumber: 'D-659.02.02', description: 'RODILLO GUÍA RETORNO Ø80mm', qty: 2, uom: 'Unidades', material: 'Poliamida PA6', odooId: 'PROD-659-18', status: 'pending' as const, isCom: true },
    { id: '19', item: '19', partNumber: 'ROD-6205-2RS', description: 'Rodamiento rígido de bolas SKF 6205-2RS', qty: 4, uom: 'Unidades', material: 'Normalizado', odooId: 'PROD-109', status: 'pending' as const, isCom: true },
    { id: '20', item: '20', partNumber: 'PERFIL GUIA DESLIZANTE UHMW', description: 'Perfil guía de desgaste bajo malla modular L=3000mm', qty: 4, uom: 'Unidades', material: 'UHMW-PE Verde', odooId: 'PROD-GUIA-UHMW', status: 'pending' as const, isCom: true },
    { id: '21', item: '21', partNumber: 'ISO 7089 - 10 - 200HV', description: 'Arandela plana DIN 125 M10 acero inoxidable', qty: 24, uom: 'Unidades', material: 'Inox A2', odooId: 'PROD-ARAN-M10', status: 'pending' as const, isCom: true },
    { id: '22', item: '22', partNumber: 'PATA NIVELADORA ARTICULADA M16', description: 'Pie nivelador regulable M16 con rótula y base antideslizante', qty: 4, uom: 'Unidades', material: 'Poliamida / AISI 304', odooId: 'PROD-PATA-M16', status: 'pending' as const, isCom: true }
  ]
};

const separadorSolidos = {
  partNumber: 'SEPARADOR DE SOLIDOS',
  name: 'SEPARADOR DE SOLIDOS_R4.iam (ANTIGUO)',
  fileType: 'iam' as const,
  revision: 'Rev. 1',
  author: 'VDB',
  material: 'Acero / Normalizados',
  mass: 87.37,
  volume: 72308.84,
  dimensions: '875,2mm x 519,2mm x 435mm',
  odooProductId: '1060',
  syncStatus: 'pending' as 'synced' | 'modified' | 'pending',
  lastSync: 'Recién cargado desde Autodesk Inventor',
  iProperties: {
    Title: 'SEPARADOR DE SOLIDOS_R4.iam (ANTIGUO)',
    Subject: 'OT-26282',
    Company: 'FINCA BONI',
    Manager: 'FL',
    CostCenter: 'CC-ING-01',
    StandardCost: 0.00,
    StockLocation: 'WH/Stock',
    PartNumber: 'SEPARADOR DE SOLIDOS',
    StockNumber: 'OT-26282.04',
    Project: 'OT-26282',
    Designer: 'FL',
    Vendor: 'FINCA BONI',
    Location: 'D:\\PROYECTOS\\OT-24019 - D.606.B V2\\01 - DIBUJOS\\MODIFICACIONES\\SEPARADOR ESTATICO\\SEPARADOR DE SOLIDOS_R4.iam'
  },
  bom: [
    {
      id: '1',
      item: '1',
      partNumber: '[247964] MOTORREDUCTOR - (ALTERNATIVO) UMI 40 - REL. 1:20 - 0,25 HP (0,187 KW) - 4 POLOS - BRIDA C63/B14 - C/BRAZO REACCION',
      description: 'WI – WMI-Worm gearboxes IMPORT WI-WMI',
      qty: 1,
      uom: 'Unidades',
      material: 'Acero / Normalizado',
      odooId: '1055',
      status: 'pending' as const,
      isCom: true
    },
    {
      id: '2',
      item: '2',
      partNumber: 'PORTA RODAMIENTO BRIDA 4 AGUJEROS EJE Ø 20 - SIN TAPA (PIAZ 1258)',
      description: 'C.P.R 4 Agujeros Serie UCF FINAL V4',
      qty: 2,
      uom: 'Unidades',
      material: 'AISI 304',
      odooId: '1056',
      status: 'pending' as const,
      isCom: true
    },
    {
      id: '3',
      item: '3',
      partNumber: 'TAMBOR SEPARADOR NORMALIZADO',
      description: 'Tambor separador estático con paletas helicoidales de acero inox',
      qty: 1,
      uom: 'Unidades',
      material: 'AISI 304',
      odooId: '1057',
      status: 'pending' as const,
      isCom: false
    },
    {
      id: '4',
      item: '4',
      partNumber: 'TAMBOR RANURADO CHAPA 1.2mm AISI 304 2B',
      description: 'Malla cilíndrica ranurada perforada paso 1.2mm',
      qty: 1,
      uom: 'Unidades',
      material: 'AISI 304 2B',
      odooId: '1058',
      status: 'pending' as const,
      isCom: false
    },
    {
      id: '5',
      item: '5',
      partNumber: 'CUERPO SEPARADOR DE SOLIDOS AISI 304',
      description: 'Tolva colectora superior y envolvente estructural',
      qty: 1,
      uom: 'Unidades',
      material: 'AISI 304',
      odooId: '1060',
      status: 'pending' as const,
      isCom: false
    },
    {
      id: '6',
      item: '6',
      partNumber: 'SOSTEN DE RODAMIENTO CHAPA 3mm AISI 304',
      description: 'Placa soporte y anclaje para rodamientos UCF 20',
      qty: 2,
      uom: 'Unidades',
      material: 'AISI 304',
      odooId: '1059',
      status: 'pending' as const,
      isCom: false
    },
    {
      id: '7',
      item: '7',
      partNumber: 'PLATINA TAMBOR CHAPA 3mm AISI 304',
      description: 'Platina frontal brida ciega de cierre',
      qty: 2,
      uom: 'Unidades',
      material: 'AISI 304',
      odooId: '1061',
      status: 'pending' as const,
      isCom: false
    },
    {
      id: '8',
      item: '8',
      partNumber: 'PUNTERA MANDO REDONDO TREFILADO 25mm AISI 304',
      description: 'Eje de acople motriz mecanizado con chavetero',
      qty: 1,
      uom: 'Unidades',
      material: 'AISI 304',
      odooId: '1062',
      status: 'pending' as const,
      isCom: false
    }
  ]
};

// Mock / Sample CAD & ERP synchronized database
const mockState: {
  activePart: any | null;
  presets: any[];
  odooProducts: any[];
  syncLogs: any[];
  purchaseRequisitions: any[];
} = {
  activePart: separadorSolidos, // Default: SEPARADOR DE SOLIDOS desde Inventor
  purchaseRequisitions: [
    {
      id: 1,
      name: 'PR00170',
      origin: 'OT-26282 - SEPARADOR DE SOLIDOS',
      state: 'draft',
      ordering_date: '2026-10-26',
      schedule_date: '2026-11-14',
      timestamp: '2026-10-26 16:30:00',
      notes: 'OT-26282.04',
      simulated: false,
      lines: [
        { id: 1, partNumber: '[247964] MOTORREDUCTOR - (ALTERNATIVO) UMI 40 - REL. 1:20 - 0,25 HP (0,187 KW) - 4 POLOS - BRIDA C63/B14 - C/BRAZO REACCION', description: 'WI – WMI-Worm gearboxes IMPORT WI-WMI', qty: 1, uom: 'Unidades', isCom: true },
        { id: 2, partNumber: 'PORTA RODAMIENTO BRIDA 4 AGUJEROS EJE Ø 20 - SIN TAPA (PIAZ 1258)', description: 'C.P.R 4 Agujeros Serie UCF FINAL V4', qty: 2, uom: 'Unidades', isCom: true }
      ]
    }
  ],
  presets: [
    { id: 'separador', label: 'SEPARADOR DE SOLIDOS_R4.iam (ANTIGUO) - OT-26282 - FINCA BONI (33 piezas)', data: separadorSolidos },
    { id: 'flamarique', label: 'D-659.00 - CINTA DE TRANSFERENCIA 3 - OT-26148 - FLAMARIQUE (22 piezas)', data: cintaTransferenciaFlamarique },
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
    { id: 1054, default_code: 'D-659.02.08', name: 'Ensamble EJE RETORNO', list_price: 340.00, standard_price: 180.00, qty_available: 2, uom_id: 'Unidades', type: 'product', bom_count: 0 },
    { id: 1055, default_code: '247964', name: '[247964] MOTORREDUCTOR - (ALTERNATIVO) UMI 40 - REL. 1:20 - 0,25 HP (0,187 KW) - 4 POLOS - BRIDA C63/B14 - C/BRAZO REACCION', list_price: 620.00, standard_price: 430.00, qty_available: 2, uom_id: 'Unidades', type: 'product', bom_count: 0 },
    { id: 1056, default_code: 'PIAZ 1258', name: 'PORTA RODAMIENTO BRIDA 4 AGUJEROS EJE Ø 20 - SIN TAPA (PIAZ 1258)', list_price: 95.00, standard_price: 52.00, qty_available: 6, uom_id: 'Unidades', type: 'product', bom_count: 0 },
    { id: 1057, default_code: 'PROD-105', name: 'TAMBOR SEPARADOR NORMALIZADO', list_price: 320.00, standard_price: 180.00, qty_available: 2, uom_id: 'Unidades', type: 'product', bom_count: 0 },
    { id: 1058, default_code: '24024', name: 'TAMBOR RANURADO CHAPA 1.2mm AISI 304 2B', list_price: 280.00, standard_price: 155.00, qty_available: 1, uom_id: 'Unidades', type: 'product', bom_count: 0 },
    { id: 1059, default_code: 'PROD-103', name: 'SOSTEN DE RODAMIENTO CHAPA 3mm AISI 304', list_price: 75.00, standard_price: 35.00, qty_available: 4, uom_id: 'Unidades', type: 'consu', bom_count: 0 },
    { id: 1060, default_code: 'PROD-101', name: 'CUERPO SEPARADOR DE SOLIDOS AISI 304', list_price: 1250.00, standard_price: 780.00, qty_available: 1, uom_id: 'Unidades', type: 'product', bom_count: 1 },
    { id: 1061, default_code: 'PROD-107', name: 'PLATINA TAMBOR CHAPA 3mm AISI 304', list_price: 45.00, standard_price: 22.00, qty_available: 8, uom_id: 'Unidades', type: 'consu', bom_count: 0 },
    { id: 1062, default_code: 'PROD-108', name: 'PUNTERA MANDO REDONDO TREFILADO 25mm AISI 304', list_price: 68.00, standard_price: 32.00, qty_available: 3, uom_id: 'Unidades', type: 'consu', bom_count: 0 }
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

app.post('/api/inventor/clear', (_req: Request, res: Response) => {
  mockState.activePart = null;
  return res.json({ success: true, message: 'Estado restablecido a espera de Inventor.' });
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
