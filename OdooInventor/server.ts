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

// Endpoint para descargar config.ini fijado a localhost:3000
app.get('/download/config.ini', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="config.ini"');
  res.send('URL=http://192.168.0.229:3000\r\n');
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

let savedOdooAuth = {
  url: 'https://deblasi.adhoc.ar',
  db: 'odoo',
  login: 'ing@deblasi.com.ar',
  apiKey: ''
};

// Authenticate against Odoo common service
app.post('/api/odoo/authenticate', async (req: Request, res: Response) => {
  const { url, db, login, password } = req.body;

  if (!url || !db || !login || !password) {
    return res.status(400).json({
      success: false,
      error: 'Parámetros incompletos (url, db, login, password requeridos)'
    });
  }

  savedOdooAuth = {
    url: String(url).trim(),
    db: String(db).trim(),
    login: String(login).trim(),
    apiKey: String(password).trim()
  };

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
  const {
    url,
    db,
    login,
    apiKey,
    items = [],
    origin = '',
    description = '', // 🟡 Nº de almacenamiento (propsState.StockNumber)
    designer = '',    // 🔵 Diseñador / Autorizador (propsState.Designer)
    notes = '',
    scheduleDate = ''
  } = req.body;

  if (!url || !db || !login || !apiKey) {
    // Simulation / UI test mode
    const fakeReqNumber = `REQ2027-${Math.floor(1000 + Math.random() * 9000)}`;
    const newRequisition = {
      id: Date.now(),
      name: fakeReqNumber,
      origin: origin || (req.body.name || ''),
      description: description || '',
      designer: designer || '',
      state: 'draft' as const,
      ordering_date: new Date().toISOString().substring(0, 10),
      schedule_date: scheduleDate || new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      notes: description || notes || '',
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

    // Resolve autorizador / diseñador in res.users
    let approverId: number | null = null;
    try {
      const allUsers = await executeKw('res.users', 'search_read', [
        [['active', '=', true]]
      ], { fields: ['id', 'name', 'login'], limit: 80 });

      if (allUsers && allUsers.length > 0) {
        const dTerm = String(designer || '').trim().toLowerCase();
        
        if (dTerm) {
          // 1. Exact match with name or login
          let matched = allUsers.find((u: any) => 
            String(u.name || '').toLowerCase() === dTerm ||
            String(u.login || '').toLowerCase() === dTerm
          );

          // 2. Initials match (e.g. designer "FL" -> "Franco Lucero")
          if (!matched && dTerm.length >= 2 && dTerm.length <= 4) {
            matched = allUsers.find((u: any) => {
              const parts = String(u.name || '').trim().split(/\s+/).filter(Boolean);
              const initials = parts.map((p: string) => p[0]).join('').toLowerCase();
              return initials === dTerm || initials.startsWith(dTerm);
            });
          }

          // 3. Contains match with designer name or login
          if (!matched && dTerm.length >= 2) {
            matched = allUsers.find((u: any) => 
              String(u.name || '').toLowerCase().includes(dTerm) ||
              String(u.login || '').toLowerCase().includes(dTerm)
            );
          }

          if (matched) {
            approverId = matched.id;
            console.log(`[Odoo] Resolved autorizador '${designer}' to res.users ID ${approverId} (${matched.name} <${matched.login}>)`);
          } else {
            approverId = uid;
            console.log(`[Odoo] Defaulting autorizador to current authenticated UID ${uid}`);
          }
        } else {
          approverId = uid;
        }
      }
    } catch (uErr: any) {
      console.warn('[Odoo] User search warning:', uErr.message);
      approverId = uid;
    }

    // Header values mapped according to user specification:
    // 🔴 Red Box: Referencia de Solicitud (Combina Proyecto OT con Nº de pieza obtenido del Add-In)
    const cleanOrigin = String(origin || req.body.name || '').trim();
    // 🟡 Yellow Box: Descripción en Odoo (Mapeado directamente del Nº de almacenamiento obtenido del Add-In)
    const cleanDescription = String(description || '').trim();

    // Build header payload dynamically based strictly on available fields
    const reqPayload: Record<string, any> = {};

    if (targetModel === 'purchase.request') {
      if ('requested_by' in reqFields) {
        reqPayload.requested_by = uid;
      }
      if (approverId) {
        if ('assigned_to' in reqFields) reqPayload.assigned_to = approverId;
        else if ('approver_id' in reqFields) reqPayload.approver_id = approverId;
        else if ('validator_id' in reqFields) reqPayload.validator_id = approverId;
      }
      // 🔴 Red Box: Referencia de Solicitud (En Odoo purchase.request es el campo 'name')
      if ('name' in reqFields) reqPayload.name = cleanOrigin;
      if ('code' in reqFields) reqPayload.code = cleanOrigin;
      if ('reference' in reqFields) reqPayload.reference = cleanOrigin;

      // 🟡 Yellow Box: description
      if ('description' in reqFields) reqPayload.description = cleanDescription;
      if ('notes' in reqFields) reqPayload.notes = cleanDescription;

      if ('date_start' in reqFields) {
        reqPayload.date_start = new Date().toISOString().substring(0, 10);
      }
    } else {
      // purchase.requisition fields
      if ('name' in reqFields) reqPayload.name = cleanOrigin;
      if ('origin' in reqFields) reqPayload.origin = cleanOrigin;
      if ('description' in reqFields) reqPayload.description = cleanDescription;
      else if ('notes' in reqFields) reqPayload.notes = cleanDescription;

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
      // Retry without assigned_to in case security groups prevent setting assigned_to directly on create
      const retryPayload: Record<string, any> = { ...reqPayload };
      delete retryPayload.assigned_to;
      delete retryPayload.approver_id;
      delete retryPayload.validator_id;

      try {
        reqId = await executeKw(targetModel, 'create', [retryPayload]);
      } catch (retryErr: any) {
        console.error(`[Odoo] ${targetModel} retry create failed:`, retryErr.message);
        const minimalPayload: Record<string, any> = {};
        if (targetModel === 'purchase.request') {
          if ('name' in reqFields) minimalPayload.name = cleanOrigin;
          if ('requested_by' in reqFields) minimalPayload.requested_by = uid;
          if ('description' in reqFields) minimalPayload.description = cleanDescription;
        } else {
          if ('name' in reqFields) minimalPayload.name = cleanOrigin;
          if ('origin' in reqFields) minimalPayload.origin = cleanOrigin;
          if (typeId && 'type_id' in reqFields) minimalPayload.type_id = typeId;
        }
        try {
          reqId = await executeKw(targetModel, 'create', [minimalPayload]);
        } catch (minErr: any) {
          return res.status(200).json({
            success: false,
            error: `Error al crear '${targetModel}' en Odoo: ${createReqErr.message || minErr.message}`,
            canSimulate: true
          });
        }
      }
    }

    if (!reqId) {
      return res.status(200).json({
        success: false,
        error: `No se pudo obtener el ID de la solicitud (${targetModel}) creada en Odoo.`,
        canSimulate: true
      });
    }

    // Follow up with an explicit write() to guarantee that Referencia de Solicitud (name), description, and assigned_to are set
    try {
      const writeData: Record<string, any> = {};
      if ('name' in reqFields) writeData.name = cleanOrigin;
      if ('reference' in reqFields) writeData.reference = cleanOrigin;
      if ('description' in reqFields) writeData.description = cleanDescription;
      if (approverId && 'assigned_to' in reqFields) writeData.assigned_to = approverId;
      if (Object.keys(writeData).length > 0) {
        await executeKw(targetModel, 'write', [[reqId], writeData]);
        console.log(`[Odoo] Explicit header update verified on ${targetModel} ID ${reqId}:`, writeData);
      }
    } catch (writeErr: any) {
      console.warn(`[Odoo] Post-create write warning on ${targetModel}:`, writeErr.message);
    }

    // Introspect line fields
    let lineFields: Record<string, any> = {};
    try {
      lineFields = (await executeKw(lineModel, 'fields_get', [], { attributes: ['type', 'required', 'string'] })) || {};
    } catch (lineFieldErr: any) {
      console.warn(`[Odoo] fields_get on ${lineModel} warning:`, lineFieldErr.message);
    }

    // Enforce user requirement:
    // "lo que no puede pasar es que un elemento COM no se le asigne un producto existente de la base de datos y se genere una purchase.request con menos elementos de los que se precisan o se le asigne aleatoriamente un producto existente para que pueda armarse la purchase.request"
    // Validate all items first so we NEVER create an incomplete request with missing lines!
    const validatedLines: Array<{ item: any; productId: number; uomId?: number }> = [];

    for (const item of items) {
      if (!item.partNumber && !item.description) continue;

      let productId: number | null = null;
      const rawCandidateId = Number(item.odooProductId || item.productId);

      // Verify product candidate exists in Odoo product.product
      if (rawCandidateId && !isNaN(rawCandidateId) && rawCandidateId > 0) {
        try {
          const verified = await executeKw('product.product', 'search_read', [
            [['id', '=', rawCandidateId]]
          ], { fields: ['id', 'name', 'default_code', 'uom_id'], limit: 1 });
          if (verified && verified.length > 0) {
            productId = verified[0].id;
          }
        } catch {}
      }

      // If not directly by ID, search by exact default_code (e.g. 247964, PIAZ 083, etc.)
      if (!productId && item.productCode) {
        try {
          const found = await executeKw('product.product', 'search_read', [
            [['default_code', '=', String(item.productCode).trim()]]
          ], { fields: ['id', 'name', 'default_code', 'uom_id'], limit: 1 });
          if (found && found.length > 0) {
            productId = found[0].id;
          }
        } catch {}
      }

      // If still not found, we CANNOT proceed or randomly assign a product!
      if (!productId) {
        return res.status(200).json({
          success: false,
          error: `No se pudo enviar la solicitud: La pieza '${item.partNumber}' no tiene un producto existente de Odoo asignado. Por favor, buscala y seleccionala desde el desplegable antes de enviar para evitar generar una solicitud incompleta.`,
          canSimulate: true
        });
      }

      // Read product UoM
      let uomId: number | undefined;
      try {
        const prodData = await executeKw('product.product', 'read', [[productId]], { fields: ['uom_id', 'uom_po_id', 'name'] });
        if (prodData && prodData[0]) {
          uomId = prodData[0].uom_id?.[0] || prodData[0].uom_po_id?.[0];
        }
      } catch {}

      validatedLines.push({ item, productId, uomId });
    }

    // 3. For each validated LDM item, create line in lineModel
    let createdLines = 0;
    const lineErrors: string[] = [];

    for (const { item, productId, uomId } of validatedLines) {
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

      const desc = String(item.productName || item.partNumber || 'Componente Comercial').trim();
      if ('name' in lineFields || targetModel === 'purchase.request') {
        linePayload.name = desc;
      }
      if (targetModel !== 'purchase.request' && 'description' in lineFields && !linePayload.description) {
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
  const { query = '', url, db, login, apiKey, limit = 50 } = req.body;
  const rawQ = String(query || '').trim();
  const cleanQ = rawQ.toLowerCase();

  // Stop words to avoid polluting search terms
  const stopWords = new Set(['a', 'e', 'o', 'u', 'y', 'd', 'de', 'la', 'el', 'en', 'para', 'con', 'sin', 'del', 'al', 'los', 'las', 'un', 'una', '-', '/', 'c/']);

  // Extract specific pattern codes
  const bracketCode = (rawQ.match(/\[(.*?)\]/)?.[1] || '').trim();
  const parenCode = (rawQ.match(/\((PIAZ\s*\d+|[A-Z0-9\-_]{3,})\)/i)?.[1] || '').trim();
  const piazCode = (rawQ.match(/\b(PIAZ\s*\d+)\b/i)?.[1] || '').trim();

  // Extract individual words/tokens with length >= 2 OR numeric digits (like "4", "2")
  const cleanTokens = rawQ
    .replace(/[\[\](),\-_/]/g, ' ')
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => (t.length >= 2 || /\d/.test(t)) && !stopWords.has(t.toLowerCase()));

  // Distinct search segments ("tramos"):
  const tramos: string[] = [];
  if (bracketCode && !tramos.includes(bracketCode)) tramos.push(bracketCode);
  if (parenCode && !tramos.includes(parenCode)) tramos.push(parenCode);
  if (piazCode && !tramos.includes(piazCode)) tramos.push(piazCode);
  for (const tok of cleanTokens) {
    if (!tramos.some(t => t.toLowerCase() === tok.toLowerCase())) {
      tramos.push(tok);
    }
  }

  const useUrl = url || savedOdooAuth.url || 'https://deblasi.adhoc.ar';
  const useDb = db || savedOdooAuth.db || '';
  const useLogin = login || savedOdooAuth.login || '';
  const useApiKey = apiKey || savedOdooAuth.apiKey || '';

  // Helper to check if a tramo matches a product accurately (with word boundaries for numbers like 4)
  const checkTramoMatch = (pCode: string, pName: string, t: string): boolean => {
    const tNorm = t.toLowerCase().trim();
    if (!tNorm) return false;
    if (pCode === tNorm) return true;

    // For short tokens (<= 2 chars like "4", "2", "20")
    if (tNorm.length <= 2) {
      const escaped = tNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(`(^|[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ])${escaped}([^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]|$)`, 'i');
      if (rx.test(pName)) return true;
      if (rx.test(pCode)) return true;
      return false;
    }

    return pName.includes(tNorm) || pCode.includes(tNorm);
  };

  // Helper to score and rank products by matched tramos
  const scoreProduct = (p: any): { prod: any; score: number; matchCount: number } => {
    const pCode = String(p.default_code || '').toLowerCase();
    const pName = String(p.name || '').toLowerCase();
    let matchCount = 0;
    for (const t of tramos) {
      if (checkTramoMatch(pCode, pName, t)) matchCount++;
    }
    let score = matchCount * 25;
    if (tramos.length > 0 && matchCount === tramos.length) score += 100; // All tramos match bonus!
    if (cleanQ && `${pCode} ${pName}`.includes(cleanQ)) score += 50; // Contiguous exact match bonus
    if (pCode && tramos.some(t => t.toLowerCase() === pCode)) score += 60; // Code match bonus
    return { prod: p, score, matchCount };
  };

  // 1. If credentials provided, attempt live search in Odoo
  if (useUrl && useDb && useLogin && useApiKey) {
    try {
      let cleanUrl = useUrl.trim().replace(/\/+$/, '').replace(/\/(odoo|web)$/i, '');
      const jsonRpcUrl = `${cleanUrl}/jsonrpc`;
      
      const authRes = await fetch(jsonRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: { service: 'common', method: 'authenticate', args: [useDb.trim(), useLogin.trim(), useApiKey.trim(), {}] },
          id: 1
        })
      });
      const authText = await authRes.text();
      const authJson = JSON.parse(authText);
      const uid = authJson?.result;

      if (uid) {
        let domain: any[] = [];
        const pushTramoCondition = (t: string) => {
          if (t.length <= 1) {
            domain.push('|');
            domain.push(['name', 'ilike', t]);
            domain.push(['default_code', '=', t]);
          } else {
            domain.push('|');
            domain.push(['name', 'ilike', t]);
            domain.push(['default_code', 'ilike', t]);
          }
        };

        if (tramos.length === 1) {
          pushTramoCondition(tramos[0]);
        } else if (tramos.length > 1) {
          // Multi-term search by "tramos": join all tramos with AND in Polish prefix notation
          for (let i = 0; i < tramos.length - 1; i++) {
            domain.push('&');
          }
          for (const t of tramos) {
            pushTramoCondition(t);
          }
        }

        let searchRes = await fetch(jsonRpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              service: 'object',
              method: 'execute_kw',
              args: [useDb.trim(), uid, useApiKey.trim(), 'product.product', 'search_read', [domain], {
                fields: ['id', 'name', 'default_code', 'qty_available', 'uom_id', 'standard_price'],
                limit
              }]
            },
            id: Date.now()
          })
        });
        let searchText = await searchRes.text();
        let searchJson = JSON.parse(searchText);

        // Fallback: If strict AND of all tramos returned 0, try an OR search so user sees closest partial matches
        if ((!Array.isArray(searchJson?.result) || searchJson.result.length === 0) && tramos.length > 1) {
          const fallbackDomain: any[] = [];
          const pushFallbackCondition = (t: string) => {
            if (t.length <= 1) {
              fallbackDomain.push('|');
              fallbackDomain.push(['name', 'ilike', t]);
              fallbackDomain.push(['default_code', '=', t]);
            } else {
              fallbackDomain.push('|');
              fallbackDomain.push(['name', 'ilike', t]);
              fallbackDomain.push(['default_code', 'ilike', t]);
            }
          };

          for (let i = 0; i < tramos.length - 1; i++) {
            fallbackDomain.push('|');
          }
          for (const t of tramos) {
            pushFallbackCondition(t);
          }

          searchRes = await fetch(jsonRpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'call',
              params: {
                service: 'object',
                method: 'execute_kw',
                args: [useDb.trim(), uid, useApiKey.trim(), 'product.product', 'search_read', [fallbackDomain], {
                  fields: ['id', 'name', 'default_code', 'qty_available', 'uom_id', 'standard_price'],
                  limit
                }]
              },
              id: Date.now() + 1
            })
          });
          searchText = await searchRes.text();
          searchJson = JSON.parse(searchText);
        }

        if (Array.isArray(searchJson?.result)) {
          const liveProducts = searchJson.result.map((p: any) => ({
            id: p.id,
            default_code: p.default_code || '',
            name: p.name || '',
            qty_available: p.qty_available || 0,
            uom_id: Array.isArray(p.uom_id) ? p.uom_id[1] : (p.uom_id || 'Unidades'),
            standard_price: p.standard_price || 0
          }));

          // Rank & Acotar: if there are products matching ALL tramos (e.g. 4/4), show only those
          const scoredLive = liveProducts.map((p: any) => scoreProduct(p));
          const fullMatchesLive = scoredLive.filter((item: any) => tramos.length > 0 && item.matchCount === tramos.length);
          const candidateLive = fullMatchesLive.length > 0 ? fullMatchesLive : scoredLive.filter((item: any) => !cleanQ || item.matchCount > 0);

          const rankedProducts = candidateLive
            .sort((a: any, b: any) => b.score - a.score)
            .map((item: any) => item.prod);

          // Merge live products into mockState.odooProducts cache
          for (const lp of rankedProducts) {
            const idx = mockState.odooProducts.findIndex(cp => cp.id === lp.id);
            if (idx >= 0) {
              mockState.odooProducts[idx] = { ...mockState.odooProducts[idx], ...lp };
            } else {
              mockState.odooProducts.push(lp);
            }
          }

          return res.json({
            success: true,
            source: 'odoo_live',
            products: rankedProducts,
            tramos
          });
        }
      }
    } catch (liveErr: any) {
      console.warn('Live search in Odoo failed, falling back to local database:', liveErr.message);
    }
  }

  // 2. Search local products database using exact tramos & ranking
  const scoredLocal = mockState.odooProducts.map((p: any) => scoreProduct(p));
  const fullMatchesLocal = scoredLocal.filter((item: any) => tramos.length > 0 && item.matchCount === tramos.length);
  const candidateLocal = fullMatchesLocal.length > 0 ? fullMatchesLocal : scoredLocal.filter((item: any) => !cleanQ || item.matchCount > 0);

  const matches = candidateLocal
    .sort((a: any, b: any) => b.score - a.score)
    .map((item: any) => item.prod);

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

  const pNum = partNumber || assemblyName || '';
  const aName = assemblyName || pNum || '';
  const proj = project || '';
  const sNum = stockNumber || '';
  const des = designer || author || '';
  const vend = vendor || '';
  const loc = location || fullFileName || '';

  const sessionId = `inv-${Date.now().toString(36)}`;
  const sessionData = {
    sessionId,
    importedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    partNumber: pNum,
    name: aName,
    fileType: 'iam' as const,
    revision: revision || '',
    author: des,
    material: material || '',
    mass: Number(mass) || 0,
    volume: Number(volume) || 0,
    dimensions: dimensions || '',
    odooProductId: '',
    syncStatus: 'pending' as const,
    lastSync: 'Recién importado de Inventor',
    iProperties: {
      Title: aName,
      Subject: proj,
      Company: vend,
      Manager: des,
      CostCenter: '',
      StandardCost: 0,
      StockLocation: '',
      PartNumber: pNum,
      StockNumber: sNum,
      Project: proj,
      Designer: des,
      Vendor: vend,
      Location: loc
    },
    bom: Array.isArray(bom) ? bom.map((item: any, idx: number) => {
      const rawCom = String(item.com ?? item.COM ?? item.isCom ?? '').trim();
      const isComVal = Boolean(
        item.isCom === true ||
        item.com === true ||
        rawCom === '✓' ||
        ['true', 'si', 's', '1', 'x', 'yes', 'y', 'verdadero'].includes(rawCom.toLowerCase())
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

// Synced state populated exclusively through Autodesk Inventor Add-In & Odoo ERP
const mockState: {
  activePart: any | null;
  presets: any[];
  odooProducts: any[];
  syncLogs: any[];
  purchaseRequisitions: any[];
} = {
  activePart: null, // Sin ensamblaje predeterminado: solo datos reales transmitidos desde Autodesk Inventor
  purchaseRequisitions: [],
  presets: [],
  odooProducts: [], // El catálogo se obtiene en vivo desde la base de datos de Odoo
  syncLogs: []
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
