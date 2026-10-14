import React, { useState } from 'react';
import { 
  X, 
  Play, 
  Copy, 
  Check, 
  AlertTriangle, 
  Terminal, 
  Globe, 
  Key, 
  ExternalLink,
  ShieldCheck,
  Server
} from 'lucide-react';
import { ConnectionTestResult } from '../types';

interface OdooConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  odooUrl: string;
  setOdooUrl: (url: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  onTestSuccess: (result: ConnectionTestResult) => void;
}

export const OdooConnectionDialog: React.FC<OdooConnectionDialogProps> = ({
  isOpen,
  onClose,
  odooUrl,
  setOdooUrl,
  apiKey,
  setApiKey,
  onTestSuccess
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [resultado, setResultado] = useState<string>(
    'Hacé clic en "Probar" para verificar la conectividad con el servicio JSON-RPC de Odoo.'
  );
  const [lastResult, setLastResult] = useState<ConnectionTestResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAdvancedAuth, setShowAdvancedAuth] = useState(false);
  const [authDb, setAuthDb] = useState('');
  const [authLogin, setAuthLogin] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authResult, setAuthResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProbar = async () => {
    const trimmedUrl = odooUrl.trim();
    if (!trimmedUrl) {
      setResultado('ADVERTENCIA:\r\nIngresá la URL de Odoo.');
      return;
    }

    setIsLoading(true);
    setResultado('Probando Odoo JSON-RPC...\r\n\r\nEsperá un momento...');

    try {
      const response = await fetch('/api/odoo/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl, apiKey: apiKey.trim() })
      });

      const data: ConnectionTestResult = await response.json();
      setLastResult(data);
      setResultado(data.formattedOutput);
      onTestSuccess(data);
    } catch (err: any) {
      const errorMsg = [
        'ERROR DE CONEXIÓN:',
        '',
        err.message || String(err),
        '',
        'No se pudo conectar al endpoint backend proxy.'
      ].join('\r\n');
      setResultado(errorMsg);
      setLastResult({
        success: false,
        formattedOutput: errorMsg,
        error: err.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAuth = async () => {
    if (!odooUrl || !authDb || !authLogin) {
      setAuthResult('Completá URL, Base de datos y Usuario/Email.');
      return;
    }
    setIsLoading(true);
    setAuthResult('Autenticando en Odoo common.authenticate...');
    try {
      const res = await fetch('/api/odoo/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: odooUrl,
          db: authDb,
          login: authLogin,
          password: authPassword || apiKey
        })
      });
      const data = await res.json();
      if (data.success) {
        setAuthResult(`✅ Autenticación Exitosa. UID de usuario: ${data.uid}`);
      } else {
        setAuthResult(`❌ Falló autenticación: ${data.error || 'Credenciales inválidas'}`);
      }
    } catch (err: any) {
      setAuthResult(`❌ Error de red: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(resultado);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setPresetUrl = (url: string) => {
    setOdooUrl(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      {/* Windows Form Replica Window */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-[680px] flex flex-col overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Form Titlebar (matching Windows Form caption) */}
        <div className="bg-slate-950 px-3.5 py-2.5 flex items-center justify-between border-b border-slate-800 select-none">
          <div className="flex items-center space-x-2">
            <div className="w-3.5 h-3.5 rounded bg-orange-600 flex items-center justify-center text-[9px] font-bold text-white">
              O
            </div>
            <span className="font-semibold text-xs tracking-wide text-slate-100">
              OdooInventor - Prueba de conexión
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-rose-600 rounded transition"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body (Exact controls matching OdooTestForm.vb) */}
        <div className="p-5 space-y-4">
          
          {/* URL de Odoo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-orange-400" />
                <span>URL de Odoo:</span>
              </label>
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                <span className="text-slate-500">Presets:</span>
                <button
                  type="button"
                  onClick={() => setPresetUrl('https://deblasi.adhoc.ar')}
                  className="hover:text-orange-400 underline decoration-slate-600 underline-offset-2"
                >
                  deblasi.adhoc.ar
                </button>
                <span>|</span>
                <button
                  type="button"
                  onClick={() => setPresetUrl('https://demo.odoo.com')}
                  className="hover:text-orange-400 underline decoration-slate-600 underline-offset-2"
                >
                  demo.odoo.com
                </button>
              </div>
            </div>
            <input
              type="text"
              value={odooUrl}
              onChange={(e) => setOdooUrl(e.target.value)}
              placeholder="https://deblasi.adhoc.ar"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-100 focus:outline-none focus:border-orange-500 transition"
            />
            <p className="text-[11px] text-slate-400">
              * Nota: Ingresá la raíz del dominio (sin <code>/odoo</code> ni <code>/web</code>), ya que el servicio JSON-RPC corre en <code>/jsonrpc</code>.
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-orange-400" />
                <span>API Key:</span>
              </label>
              <span className="text-[11px] text-slate-400 font-normal">
                (Opcional para `common.version`, requerida para operaciones de lectura/escritura)
              </span>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="••••••••••••••••••••••••••••••••••••••••"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-100 focus:outline-none focus:border-orange-500 transition"
            />
          </div>

          {/* Resultado Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-orange-400" />
                <span>Resultado:</span>
              </label>
              <div className="flex items-center space-x-2">
                {lastResult && (
                  <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-medium ${
                    lastResult.success 
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}>
                    {lastResult.success ? `200 OK (${lastResult.latencyMs}ms)` : 'Error / Offline'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center space-x-1 transition"
                  title="Copiar texto del resultado al portapapeles"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* ReadOnly Multiline TextBox with Both Scrollbars */}
            <div className="relative">
              <textarea
                value={resultado}
                readOnly
                rows={10}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-slate-200 leading-relaxed resize-none focus:outline-none whitespace-pre overflow-x-auto shadow-inner selection:bg-orange-600/40"
              />
              {isLoading && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[1px] flex flex-col items-center justify-center space-y-2 rounded">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium text-orange-300 font-mono">
                    Conectando con Odoo JSON-RPC...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Toggle Advanced ERP Authentication Test */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvancedAuth(!showAdvancedAuth)}
              className="text-xs text-orange-400 hover:text-orange-300 flex items-center space-x-1 font-medium transition"
            >
              <span>{showAdvancedAuth ? '▼ Ocultar' : '▶ Probar autenticación extendida (Database / Login / Password)'}</span>
            </button>

            {showAdvancedAuth && (
              <div className="mt-3 p-3 bg-slate-950/70 rounded border border-slate-800 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Base de Datos (DB):</label>
                    <input
                      type="text"
                      value={authDb}
                      onChange={(e) => setAuthDb(e.target.value)}
                      placeholder="deblasi_prod"
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Usuario / Email:</label>
                    <input
                      type="text"
                      value={authLogin}
                      onChange={(e) => setAuthLogin(e.target.value)}
                      placeholder="admin@empresa.com"
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Contraseña:</label>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleTestAuth}
                    disabled={isLoading}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center space-x-1"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
                    <span>Verificar Credenciales (common.authenticate)</span>
                  </button>
                  {authResult && (
                    <span className="text-xs font-mono text-slate-300">
                      {authResult}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form Footer Buttons (matching _btnProbar and _btnCerrar) */}
        <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>Endpoint: /jsonrpc (JSON-RPC 2.0 protocol)</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleProbar}
              disabled={isLoading}
              className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 disabled:opacity-50 text-white font-medium text-xs rounded shadow transition flex items-center space-x-1.5 min-w-[90px] justify-center"
            >
              <Play className="w-3 h-3 fill-white" />
              <span>{isLoading ? 'Probando...' : 'Probar'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded border border-slate-700 transition min-w-[90px]"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
