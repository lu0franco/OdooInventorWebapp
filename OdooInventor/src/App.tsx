import React, { useState, useEffect } from 'react';
import { RibbonHeader, InventorEnvironment } from './components/RibbonHeader';
import { OdooConnectionDialog } from './components/OdooConnectionDialog';
import { AssemblyPropertiesView } from './components/AssemblyPropertiesView';
import { BOMSyncManager } from './components/BOMSyncManager';
import { OdooProductsView } from './components/OdooProductsView';
import { SyncLogsView } from './components/SyncLogsView';
import { AddinInfoModal } from './components/AddinInfoModal';
import { CadPart, OdooProduct, SyncLog, ConnectionTestResult, BomItem } from './types';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('ODOO');
  const [activeView, setActiveView] = useState<'bom' | 'iproperties' | 'products' | 'logs'>('bom');
  const [environment, setEnvironment] = useState<InventorEnvironment>('Assembly');
  const [isTestFormOpen, setIsTestFormOpen] = useState(false);
  const [isAddinInfoOpen, setIsAddinInfoOpen] = useState(false);
  
  // Odoo Connection State (initialized with exact defaults from OdooTestForm.vb)
  const [odooUrl, setOdooUrl] = useState('https://deblasi.adhoc.ar');
  const [apiKey, setApiKey] = useState('');
  const [connectionState, setConnectionState] = useState<'idle' | 'connected' | 'error'>('idle');
  
  // Data State
  const [part, setPart] = useState<CadPart | null>(null);
  const [products, setProducts] = useState<OdooProduct[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  
  // Loading & notification states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch initial mock CAD model & Odoo catalog
  useEffect(() => {
    // 1. Initial State
    fetch('/api/odoo/state')
      .then(res => res.json())
      .then(data => {
        if (data.activePart) setPart(data.activePart);
        if (data.odooProducts) setProducts(data.odooProducts);
        if (data.syncLogs) setLogs(data.syncLogs);
      })
      .catch(err => {
        console.warn('Could not fetch server state:', err);
      });

    // 2. Check URL parameters (?view=..., ?session=..., ?import=...)
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    if (viewParam && ['bom', 'iproperties', 'products', 'logs'].includes(viewParam)) {
      setActiveView(viewParam as 'bom' | 'iproperties' | 'products' | 'logs');
    }

    const sessionId = urlParams.get('session');
    if (sessionId) {
      fetch(`/api/inventor/session/${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.session) {
            setPart(data.session);
            setActiveView('bom');
            showNotification('success', `Cargado en vivo desde Inventor: ${data.session.name}`);
          }
        })
        .catch(err => console.error('Error cargando sesión de Inventor:', err));
    }

    // Helper to safely decode Base64 containing UTF-8 characters (accents, ñ, etc.)
    const safeDecodeBase64 = (str: string): string => {
      try {
        const cleanStr = decodeURIComponent(str).replace(/\s/g, '');
        const binary = atob(cleanStr);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
      } catch {
        try {
          return decodeURIComponent(str);
        } catch {
          return str;
        }
      }
    };

    // Helper to apply imported CAD payload
    const applyCadPayload = (payload: any, sourceName = 'Autodesk Inventor') => {
      if (!payload) return;
      const list = Array.isArray(payload) ? payload : (payload.bom || []);
      const items: BomItem[] = list.map((item: any, idx: number) => {
        const isComValue = Boolean(
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
          partNumber: item.partNumber || item.name || `ITEM-${idx + 1}`,
          description: item.description || item.name || item.partNumber || '',
          qty: Number(item.qty || item.quantity || 1),
          uom: item.uom || 'Unidades',
          material: item.material || 'Comercial',
          odooId: item.odooId || `PROD-${Math.floor(100 + Math.random() * 900)}`,
          status: 'pending',
          isCom: isComValue
        };
      });

      const newPart: CadPart = {
        partNumber: payload.partNumber || 'ASM-INVENTOR',
        name: payload.assemblyName || payload.name || payload.description || 'Ensamblaje Autodesk Inventor',
        fileType: 'iam',
        revision: payload.revision || 'Rev. 1',
        author: payload.author || 'flucero (Inventor 2027)',
        material: payload.material || 'Acero Inoxidable / Normalizados',
        mass: Number(payload.mass) || 0,
        volume: Number(payload.volume) || 0,
        dimensions: payload.dimensions || 'N/A',
        odooProductId: '1048',
        syncStatus: 'pending',
        lastSync: 'Recién cargado desde ' + sourceName,
        iProperties: payload.iProperties || {
          Title: payload.description || payload.assemblyName || 'Ensamblaje Inventor',
          Subject: 'OT-26148',
          Company: 'Deblasi Soluciones Industriales',
          Manager: 'Ingeniería Mecánica',
          CostCenter: 'CC-ING',
          StandardCost: 0,
          StockLocation: 'WH/Stock'
        },
        bom: items
      };

      setPart(newPart);
      setActiveView('bom');
      showNotification('success', `¡${items.length} componentes reales de '${newPart.partNumber}' cargados desde ${sourceName}!`);

      // Persist to server session storage
      fetch('/api/inventor/import-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(e => console.warn('Sync server warning:', e));
    };

    // Check ?import= or #import= or #data=
    const importParam = urlParams.get('import') || urlParams.get('data');
    let hashData = '';
    if (window.location.hash) {
      const match = window.location.hash.match(/[#&](import|data)=([^&]+)/);
      if (match) hashData = match[2];
    }
    const rawToImport = importParam || hashData;

    if (rawToImport) {
      try {
        const jsonStr = safeDecodeBase64(rawToImport);
        const payload = JSON.parse(jsonStr);
        if (payload && (payload.bom || payload.partNumber || Array.isArray(payload))) {
          applyCadPayload(payload, 'URL de Autodesk Inventor');
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (e) {
        console.warn('Error leyendo parámetro import:', e);
      }
    }

    // Global Paste Listener (Ctrl+V anywhere in window loads Inventor BOM immediately)
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const text = e.clipboardData?.getData('text');
      if (!text || !text.trim()) return;

      try {
        const trimmed = text.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          const parsed = JSON.parse(trimmed);
          if (parsed && (parsed.bom || parsed.partNumber || Array.isArray(parsed))) {
            applyCadPayload(parsed, 'Portapapeles de Windows (Ctrl+V)');
            e.preventDefault();
            return;
          }
        }
      } catch {}
    };
    window.addEventListener('paste', handleGlobalPaste);

    // 3. Listen for live WebView2 message from Inventor Add-In
    const handleBridgeMessage = (event: any) => {
      const data = event.data;
      if (!data) return;
      try {
        const payload = typeof data === 'string' ? JSON.parse(data) : data;
        if (payload.partNumber || payload.bom || payload.assemblyName) {
          applyCadPayload(payload, 'Conexión WebView2 Inventor');
        }
      } catch (e) {
        console.warn('Error parsing bridge message:', e);
      }
    };

    window.addEventListener('message', handleBridgeMessage);
    const chromeWebview = (window as any).chrome?.webview;
    if (chromeWebview?.addEventListener) {
      chromeWebview.addEventListener('message', handleBridgeMessage);
    }

    // 4. Polling & Window Focus Auto-Refresh (Detects when Inventor pushes new LDM)
    let lastKnownImportTime = '';
    const pollLatest = async () => {
      try {
        const res = await fetch('/api/inventor/latest');
        const data = await res.json();
        if (data.success && data.activePart) {
          const currentTimestamp = data.activePart.lastSync || data.activePart.importedAt || '';
          if (lastKnownImportTime && currentTimestamp && currentTimestamp !== lastKnownImportTime) {
            setPart(data.activePart);
            setActiveView('bom');
            showNotification('success', `¡${data.activePart.bom?.length || 0} componentes sincronizados en vivo desde Inventor!`);
          }
          lastKnownImportTime = currentTimestamp;
        }
      } catch {}
    };

    const pollInterval = setInterval(pollLatest, 2000);
    window.addEventListener('focus', pollLatest);

    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
      window.removeEventListener('message', handleBridgeMessage);
      clearInterval(pollInterval);
      window.removeEventListener('focus', pollLatest);
      if (chromeWebview?.removeEventListener) {
        chromeWebview.removeEventListener('message', handleBridgeMessage);
      }
    };
  }, []);

  const handleTestSuccess = (result: ConnectionTestResult) => {
    if (result.success) {
      setConnectionState('connected');
      showNotification('success', 'Conexión exitosa con Odoo JSON-RPC.');
      const newLog: SyncLog = {
        id: Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        action: 'JSONRPC_TEST',
        target: result.url || `${odooUrl}/jsonrpc`,
        status: 'OK',
        details: `Conexión verificada: ${result.statusText || '200 OK'} (${result.latencyMs}ms)`
      };
      setLogs(prev => [newLog, ...prev]);
    } else {
      setConnectionState('error');
      showNotification('error', 'Error al verificar conexión con Odoo.');
      const newLog: SyncLog = {
        id: Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        action: 'JSONRPC_TEST',
        target: result.url || `${odooUrl}/jsonrpc`,
        status: 'ERROR',
        details: result.error || 'Fallo de conexión'
      };
      setLogs(prev => [newLog, ...prev]);
    }
  };

  const handleSyncBomToOdoo = async () => {
    if (!part) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/odoo/sync-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partNumber: part.partNumber,
          description: part.name,
          bomLines: part.bom
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', data.message);
        // Mark items as synced
        const updatedBom = part.bom.map(i => ({ ...i, status: 'synced' as const }));
        setPart({ ...part, bom: updatedBom, syncStatus: 'synced', lastSync: data.timestamp });
        
        const newLog: SyncLog = {
          id: Date.now(),
          timestamp: data.timestamp,
          action: 'BOM_SYNC',
          target: `mrp.bom [${part.partNumber}]`,
          status: 'OK',
          details: `Lista de materiales sincronizada (${data.linesProcessed} componentes)`
        };
        setLogs(prev => [newLog, ...prev]);
      }
    } catch (err: any) {
      showNotification('error', `Error al sincronizar BOM: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushProperties = async () => {
    if (!part) return;
    setIsPushing(true);
    try {
      const res = await fetch('/api/odoo/sync-properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partNumber: part.partNumber,
          name: part.name,
          mass: part.mass,
          material: part.material,
          iProperties: part.iProperties
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', data.message);
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        setPart({ ...part, lastSync: timestamp });
        const newLog: SyncLog = {
          id: Date.now(),
          timestamp,
          action: 'IPROPERTIES_PUSH',
          target: `product.template (${part.partNumber})`,
          status: 'OK',
          details: `Actualizadas iProperties en Odoo: Masa=${part.mass}kg, Costo=$${part.iProperties.StandardCost}`
        };
        setLogs(prev => [newLog, ...prev]);
      }
    } catch (err: any) {
      showNotification('error', `Error al enviar propiedades: ${err.message}`);
    } finally {
      setIsPushing(false);
    }
  };

  const handleUpdateBom = (newBom: BomItem[]) => {
    if (!part) return;
    setPart({
      ...part,
      bom: newBom,
      syncStatus: 'modified'
    });
  };

  const handleClearLogs = () => {
    setLogs([]);
    showNotification('info', 'Historial de registros limpiado.');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans select-none">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className={`px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium flex items-center space-x-2 border ${
            notification.type === 'success' 
              ? 'bg-emerald-950 text-emerald-200 border-emerald-800' 
              : notification.type === 'error'
              ? 'bg-rose-950 text-rose-200 border-rose-800'
              : 'bg-slate-900 text-slate-200 border-slate-700'
          }`}>
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {notification.type === 'info' && <Info className="w-4 h-4 text-blue-400 shrink-0" />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Ribbon Header with Autodesk Inventor UI & ODOO Tab */}
      <RibbonHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeView={activeView}
        setActiveView={setActiveView}
        environment={environment}
        setEnvironment={setEnvironment}
        onOpenTestForm={() => setIsTestFormOpen(true)}
        onSyncBom={handleSyncBomToOdoo}
        onPushProperties={handlePushProperties}
        onOpenAddinInfo={() => setIsAddinInfoOpen(true)}
        isSyncing={isSyncing}
        connectionState={connectionState}
        odooUrl={odooUrl}
        part={part}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 flex overflow-hidden relative">
        {activeView === 'bom' && part && (
          <BOMSyncManager
            part={part}
            onUpdateBom={handleUpdateBom}
            onSyncBomToOdoo={handleSyncBomToOdoo}
            isSyncing={isSyncing}
          />
        )}

        {activeView === 'iproperties' && part && (
          <AssemblyPropertiesView
            part={part}
            onUpdatePart={setPart}
            onPushProperties={handlePushProperties}
            isPushing={isPushing}
            onGoToBom={() => setActiveView('bom')}
          />
        )}

        {activeView === 'products' && (
          <OdooProductsView
            products={products}
            odooUrl={odooUrl}
          />
        )}

        {activeView === 'logs' && (
          <SyncLogsView
            logs={logs}
            onClearLogs={handleClearLogs}
          />
        )}
      </main>

      {/* Modal: OdooTestForm.vb replica dialog */}
      <OdooConnectionDialog
        isOpen={isTestFormOpen}
        onClose={() => setIsTestFormOpen(false)}
        odooUrl={odooUrl}
        setOdooUrl={setOdooUrl}
        apiKey={apiKey}
        setApiKey={setApiKey}
        onTestSuccess={handleTestSuccess}
      />

      {/* Modal: AddIn Information & Manifest */}
      <AddinInfoModal
        isOpen={isAddinInfoOpen}
        onClose={() => setIsAddinInfoOpen(false)}
      />

    </div>
  );
}
