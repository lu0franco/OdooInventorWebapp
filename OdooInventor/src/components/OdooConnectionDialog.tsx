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
  Server,
  HelpCircle,
  Info,
  Sparkles,
  ChevronDown,
  ChevronRight
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
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [showAdvancedAuth, setShowAdvancedAuth] = useState(true);
  const [showAdhocGuide, setShowAdhocGuide] = useState(true);
  const [authDb, setAuthDb] = useState(() => localStorage.getItem('odoo_auth_db') || '');
  const [authLogin, setAuthLogin] = useState(() => localStorage.getItem('odoo_auth_login') || 'flucero@deblasi.com.ar');
  const [authPassword, setAuthPassword] = useState(() => localStorage.getItem('odoo_auth_pwd') || '');
  const [authResult, setAuthResult] = useState<string | null>(null);
  const [authIsSuccess, setAuthIsSuccess] = useState<boolean | null>(null);

  if (!isOpen) return null;

  const handleCopyCmd = () => {
    navigator.clipboard.writeText('odoo.__session_info__.db');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

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

      const responseText = await response.text();
      let data: ConnectionTestResult;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = {
          success: false,
          error: 'Respuesta inválida del servidor proxy',
          formattedOutput: responseText
        };
      }
      setLastResult(data);
      setResultado(data.formattedOutput || '');
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
      setAuthResult('⚠️ Completá URL, Base de datos (DB) y Usuario/Email.');
      setAuthIsSuccess(false);
      return;
    }

    // Persist to localStorage for convenience
    localStorage.setItem('odoo_auth_db', authDb.trim());
    localStorage.setItem('odoo_auth_login', authLogin.trim());
    if (authPassword) localStorage.setItem('odoo_auth_pwd', authPassword);

    setIsLoading(true);
    setAuthResult('Autenticando en Odoo common.authenticate...');
    setAuthIsSuccess(null);

    try {
      const res = await fetch('/api/odoo/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: odooUrl.trim(),
          db: authDb.trim(),
          login: authLogin.trim(),
          password: authPassword || apiKey
        })
      });
      const resText = await res.text();
      let data: any = {};
      try { data = JSON.parse(resText); } catch { data = { success: false, error: 'Respuesta inválida' }; }
      if (data.success) {
        setAuthResult(`✅ ¡Autenticación Exitosa! Usuario UID: ${data.uid}. Conectado a la base de datos "${authDb.trim()}".`);
        setAuthIsSuccess(true);
        if (authPassword && !apiKey) {
          setApiKey(authPassword);
        }
      } else {
        setAuthResult(`❌ ${data.error || 'Credenciales inválidas'}`);
        setAuthIsSuccess(false);
      }
    } catch (err: any) {
      setAuthResult(`❌ Error de red: ${err.message}`);
      setAuthIsSuccess(false);
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
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-[720px] max-h-[92vh] flex flex-col overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Form Titlebar (matching Windows Form caption) */}
        <div className="bg-slate-950 px-3.5 py-2.5 flex items-center justify-between border-b border-slate-800 select-none flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-3.5 h-3.5 rounded bg-orange-600 flex items-center justify-center text-[9px] font-bold text-white">
              O
            </div>
            <span className="font-semibold text-xs tracking-wide text-slate-100">
              OdooInventor - Conexión & Diagnóstico Adhoc
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

        {/* Scrollable Form Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          
          {/* Adhoc & No Developer Mode Clarification Card */}
          <div className="p-3.5 bg-gradient-to-r from-orange-950/40 via-amber-950/20 to-slate-950/60 border border-orange-700/40 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-orange-300 font-medium text-xs">
                <Sparkles className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <span>¿Cómo conectarse con Odoo por Adhoc y sin Modo Desarrollador?</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAdhocGuide(!showAdhocGuide)}
                className="text-[11px] text-orange-400 hover:text-orange-200 flex items-center space-x-1"
              >
                <span>{showAdhocGuide ? 'Ocultar guía' : 'Ver pasos'}</span>
                {showAdhocGuide ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            </div>

            {showAdhocGuide && (
              <div className="text-[11px] space-y-2.5 text-slate-300 pt-1 border-t border-orange-900/40">
                <div className="space-y-1">
                  <div className="font-semibold text-amber-300 flex items-center space-x-1.5">
                    <span>1. ¿Hace falta Modo Desarrollador para la API Key?</span>
                    <span className="bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-800 text-[10px]">¡NO!</span>
                  </div>
                  <p className="text-slate-400 pl-3">
                    En Odoo (y en Adhoc), cualquier usuario puede crear su propia Clave de API sin ser administrador:
                  </p>
                  <ul className="list-disc pl-7 space-y-0.5 text-slate-300">
                    <li>Entrá a tu Odoo (<code className="text-orange-300 font-mono">https://deblasi.adhoc.ar</code>).</li>
                    <li>Hacé clic en tu <strong>foto / nombre</strong> arriba a la derecha y elegí <strong>Preferencias</strong> (o <em>Mi perfil</em>).</li>
                    <li>Seleccioná la pestaña <strong>Seguridad de la cuenta</strong>.</li>
                    <li>En la sección <strong>Claves de API</strong>, hacé clic en <strong>Nueva clave de API</strong>, ingresá tu contraseña de Odoo, poné de nombre <code className="text-orange-300 font-mono">Inventor CAD</code> y hacé clic en <em>Generar clave</em>.</li>
                    <li>Copiá esa clave y pegala en el campo <strong>API Key / Contraseña</strong> de abajo.</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <div className="font-semibold text-amber-300">
                    2. ¿Cómo saber el nombre exacto de la Base de Datos (DB) en Adhoc?
                  </div>
                  <p className="text-slate-400 pl-3">
                    En Adhoc, el servidor aloja las bases en clústeres y el nombre de la BD interna puede tener un sufijo (por ej. no es solo <code className="text-rose-300 font-mono">deblasi</code>). Para conocer tu nombre exacto de BD en 5 segundos sin permisos de desarrollador:
                  </p>
                  <div className="pl-3 flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="text-slate-400">En tu navegador con Odoo abierto, apretá <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-[10px]">F12</kbd> (Consola) y ejecutá:</span>
                    <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800 font-mono text-[11px] text-emerald-400">
                      <span>odoo.__session_info__.db</span>
                      <button
                        type="button"
                        onClick={handleCopyCmd}
                        className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] flex items-center space-x-1 transition"
                        title="Copiar comando al portapapeles"
                      >
                        {copiedCmd ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        <span>{copiedCmd ? '¡Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-400 pl-3 text-[10px]">
                    * También podés verlo en el portal de clientes de Adhoc (<code className="text-slate-300 font-mono">mi.adhoc.com.ar</code>) en la ficha de tu servicio contratado.
                  </p>
                </div>
              </div>
            )}
          </div>

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

          {/* Autenticación Completa (Database, Usuario, Contraseña / API Key) */}
          <div className="p-3.5 bg-slate-950/80 rounded-lg border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200">
                <ShieldCheck className="w-4 h-4 text-orange-400" />
                <span>Credenciales de Acceso a Odoo</span>
              </div>
              <span className="text-[10px] text-slate-400">
                (Requeridas para sincronizar BOM, Stock y Órdenes)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  1. Base de Datos (DB):
                </label>
                <input
                  type="text"
                  value={authDb}
                  onChange={(e) => {
                    setAuthDb(e.target.value);
                    localStorage.setItem('odoo_auth_db', e.target.value);
                  }}
                  placeholder="ej. deblasi_prod"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 font-mono focus:outline-none focus:border-orange-500"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  F12: odoo.__session_info__.db
                </span>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  2. Usuario / Email:
                </label>
                <input
                  type="text"
                  value={authLogin}
                  onChange={(e) => {
                    setAuthLogin(e.target.value);
                    localStorage.setItem('odoo_auth_login', e.target.value);
                  }}
                  placeholder="flucero@deblasi.com.ar"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 font-mono focus:outline-none focus:border-orange-500"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Tu correo de login en Odoo
                </span>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  3. API Key o Contraseña:
                </label>
                <input
                  type="password"
                  value={authPassword || apiKey}
                  onChange={(e) => {
                    setAuthPassword(e.target.value);
                    setApiKey(e.target.value);
                    localStorage.setItem('odoo_auth_pwd', e.target.value);
                  }}
                  placeholder="••••••••••••••••"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 font-mono focus:outline-none focus:border-orange-500"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  API Key desde tus Preferencias
                </span>
              </div>
            </div>

            <div className="pt-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleTestAuth}
                disabled={isLoading}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 text-xs rounded border border-slate-700 flex items-center space-x-1.5 transition font-medium"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
                <span>Verificar Autenticación (common.authenticate)</span>
              </button>

              {authResult && (
                <div className={`text-xs font-mono p-2 rounded border max-w-full overflow-x-auto ${
                  authIsSuccess === true 
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' 
                    : authIsSuccess === false
                    ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                    : 'bg-slate-900 text-slate-300 border-slate-700'
                }`}>
                  {authResult}
                </div>
              )}
            </div>
          </div>

          {/* Resultado Box de common.version */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-orange-400" />
                <span>Consola JSON-RPC / common.version:</span>
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
                rows={6}
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

        </div>

        {/* Form Footer Buttons (matching _btnProbar and _btnCerrar) */}
        <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
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
              <span>{isLoading ? 'Probando...' : 'Probar URL'}</span>
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
