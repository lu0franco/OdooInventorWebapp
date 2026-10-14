import React, { useState, useEffect } from 'react';
import { RibbonHeader, InventorEnvironment } from './components/RibbonHeader';
import { OdooConnectionDialog } from './components/OdooConnectionDialog';
import { CADModelViewer } from './components/CADModelViewer';
import { BOMSyncManager } from './components/BOMSyncManager';
import { OdooProductsView } from './components/OdooProductsView';
import { SyncLogsView } from './components/SyncLogsView';
import { AddinInfoModal } from './components/AddinInfoModal';
import { CadPart, OdooProduct, SyncLog, ConnectionTestResult, BomItem } from './types';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('ODOO');
  const [activeView, setActiveView] = useState<'cad' | 'bom' | 'products' | 'logs'>('cad');
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

    // 2. Check if launched from Inventor with ?session=...
    const urlParams = new URLSearchParams(window.location.search);
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

    // 3. Listen for live WebView2 message from Inventor Add-In
    const handleBridgeMessage = (event: any) => {
      const data = event.data;
      if (!data) return;
      try {
        const payload = typeof data === 'string' ? JSON.parse(data) : data;
        if (payload.partNumber || payload.bom || payload.assemblyName) {
          // Received live assembly data from Inventor!
          fetch('/api/inventor/import-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
            .then(res => res.json())
            .then(resData => {
              if (resData.session) {
                setPart(resData.session);
                setActiveView('bom');
                showNotification('success', `¡Ensamblaje '${resData.session.partNumber}' recibido desde Inventor!`);
              }
            });
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

    return () => {
      window.removeEventListener('message', handleBridgeMessage);
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
      />

      {/* Main Viewport Content */}
      <main className="flex-1 flex overflow-hidden relative">
        {activeView === 'cad' && part && (
          <CADModelViewer
            part={part}
            onUpdatePart={setPart}
            onPushProperties={handlePushProperties}
            onSyncBom={() => setActiveView('bom')}
            isPushing={isPushing}
          />
        )}

        {activeView === 'bom' && part && (
          <BOMSyncManager
            part={part}
            onUpdateBom={handleUpdateBom}
            onSyncBomToOdoo={handleSyncBomToOdoo}
            isSyncing={isSyncing}
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
