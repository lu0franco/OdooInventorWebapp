import React, { useState } from 'react';
import { 
  Box, 
  Layers, 
  Settings, 
  RefreshCw, 
  Database, 
  Save, 
  FolderOpen, 
  RotateCcw, 
  RotateCw, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Boxes,
  Zap,
  Share2,
  FileSpreadsheet,
  Link2,
  FileSignature
} from 'lucide-react';

import { CadPart } from '../types';

export type InventorEnvironment = 'Assembly' | 'Part' | 'Drawing' | 'ZeroDoc';

interface RibbonHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeView: 'bom' | 'iproperties' | 'products' | 'logs';
  setActiveView: (view: 'bom' | 'iproperties' | 'products' | 'logs') => void;
  environment: InventorEnvironment;
  setEnvironment: (env: InventorEnvironment) => void;
  onOpenTestForm: () => void;
  onSyncBom: () => void;
  onPushProperties: () => void;
  onOpenAddinInfo: () => void;
  isSyncing: boolean;
  connectionState: 'idle' | 'connected' | 'error';
  odooUrl: string;
  part?: CadPart | null;
}

export const RibbonHeader: React.FC<RibbonHeaderProps> = ({
  activeTab,
  setActiveTab,
  activeView,
  setActiveView,
  environment,
  setEnvironment,
  onOpenTestForm,
  onSyncBom,
  onPushProperties,
  onOpenAddinInfo,
  isSyncing,
  connectionState,
  odooUrl,
  part
}) => {
  const [tabLocation, setTabLocation] = useState<'TECNICA' | 'ODOO'>('TECNICA');

  const tabs = [
    { 
      id: 'ODOO', 
      label: tabLocation === 'TECNICA' ? 'TECNICA (Integrado)' : 'ODOO ERP (TAB_ODOO)' 
    },
    { id: 'REQUISICION', label: 'Requisición de Compra' },
    { id: 'ENSAMBLE', label: 'Ensamblar' },
    { id: 'MODELADO', label: 'Modelo 3D' },
    { id: 'INSPECCION', label: 'Inspeccionar' },
    { id: 'HERRAMIENTAS', label: 'Herramientas' }
  ];

  const getDocBadge = () => {
    switch (environment) {
      case 'Assembly':
        return { 
          ext: part ? '.iam' : 'CAD', 
          name: part ? `${part.partNumber}.iam — ${part.name}` : 'Esperando transmisión desde Autodesk Inventor...', 
          color: part ? 'bg-orange-500/20 text-orange-300' : 'bg-amber-500/20 text-amber-300' 
        };
      case 'Part':
        return { ext: '.ipt', name: 'D-659.01.03.ipt — COSTILLA CAJÓN', color: 'bg-blue-500/20 text-blue-300' };
      case 'Drawing':
        return { ext: '.idw', name: 'D-659.00-DWG.idw — Plano de Montaje y Conjunto General', color: 'bg-emerald-500/20 text-emerald-300' };
      case 'ZeroDoc':
        return { ext: 'ZeroDoc', name: 'Sin documento activo en Autodesk Inventor', color: 'bg-slate-700 text-slate-300' };
    }
  };

  const badge = getDocBadge();

  return (
    <header className="bg-slate-950 border-b border-slate-800 text-slate-200 select-none">
      {/* Title Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 text-xs border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-semibold text-orange-500">
            <Box className="w-4 h-4 text-orange-400" />
            <span className="tracking-wide">Autodesk Inventor Professional 2027</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center space-x-1.5 text-slate-300">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${badge.color}`}>
              {badge.ext}
            </span>
            <span className="font-mono text-slate-300 font-medium truncate max-w-md">{badge.name}</span>
          </div>
        </div>

        {/* Quick Access & Status */}
        <div className="flex items-center space-x-4">
          {/* Environment Switcher according to Buttons.vb */}
          <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 px-1 font-mono uppercase">Entorno:</span>
            {(['Assembly', 'Part', 'Drawing', 'ZeroDoc'] as InventorEnvironment[]).map(env => (
              <button
                key={env}
                onClick={() => setEnvironment(env)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  environment === env 
                    ? 'bg-orange-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={`Cambiar entorno de Ribbon a ${env} (como en Buttons.vb)`}
              >
                {env === 'Assembly' ? 'Ensamblaje (.iam)' :
                 env === 'Part' ? 'Pieza (.ipt)' :
                 env === 'Drawing' ? 'Plano (.idw)' : 'ZeroDoc'}
              </button>
            ))}
          </div>

          {/* Ribbon Target Tab Toggle: TECNICA vs ODOO */}
          <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 px-1 font-mono uppercase">Pestaña:</span>
            <button
              onClick={() => setTabLocation('TECNICA')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                tabLocation === 'TECNICA' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Integrar en la pestaña existente 'TECNICA' (de RuleManagerV2)"
            >
              TECNICA
            </button>
            <button
              onClick={() => setTabLocation('ODOO')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                tabLocation === 'ODOO' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Crear pestaña independiente 'ODOO'"
            >
              ODOO
            </button>
          </div>

          <div className="flex items-center space-x-2 pl-2 border-l border-slate-700">
            <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono border ${
              connectionState === 'connected'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : connectionState === 'error'
                ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                connectionState === 'connected' ? 'bg-emerald-400 animate-pulse' :
                connectionState === 'error' ? 'bg-rose-500' : 'bg-amber-400'
              }`} />
              <span className="truncate max-w-[180px]">{odooUrl.replace('https://', '')}</span>
            </div>

            <button
              onClick={onOpenAddinInfo}
              className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center space-x-1.5 border border-slate-700 transition"
              title="Ver código fuente de Buttons.vb y arquitectura del AddIn"
            >
              <FileText className="w-3.5 h-3.5 text-orange-400" />
              <span>Ver Buttons.vb</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center space-x-1 px-2 pt-1 border-b border-slate-800 bg-slate-900/60 text-xs">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 font-medium transition-all relative ${
                isActive 
                  ? 'bg-slate-800 text-orange-400 border-t-2 border-t-orange-500 rounded-t shadow' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {tab.label}
              {tab.id === 'ODOO' && (
                <span className="ml-1.5 text-[9px] bg-orange-500/20 text-orange-300 px-1 py-0.2 rounded font-mono">
                  {environment}
                </span>
              )}
            </button>
          );
        })}

        <div className="flex-1" />

        {/* View Switcher pills */}
        <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800 mb-1">
          <button
            onClick={() => setActiveView('bom')}
            className={`px-3 py-1 text-xs font-semibold rounded flex items-center space-x-1.5 transition ${
              activeView === 'bom' 
                ? 'bg-orange-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Lista de Materiales (BOM / LDM)</span>
          </button>
          <button
            onClick={() => setActiveView('iproperties')}
            className={`px-3 py-1 text-xs font-semibold rounded flex items-center space-x-1.5 transition ${
              activeView === 'iproperties' 
                ? 'bg-orange-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>iProperties Ensamblaje</span>
          </button>
          <button
            onClick={() => setActiveView('products')}
            className={`px-2.5 py-1 text-xs font-medium rounded flex items-center space-x-1.5 transition ${
              activeView === 'products' 
                ? 'bg-orange-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Catálogo Odoo</span>
          </button>
          <button
            onClick={() => setActiveView('logs')}
            className={`px-2.5 py-1 text-xs font-medium rounded flex items-center space-x-1.5 transition ${
              activeView === 'logs' 
                ? 'bg-orange-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Logs JSON-RPC</span>
          </button>
        </div>
      </div>

      {/* Ribbon Panels (Specific to ODOO tab & Current Environment) */}
      <div className="bg-slate-900 px-3 py-2 flex items-stretch space-x-4 overflow-x-auto min-h-[92px]">
        
        {/* Panel ODOO generado por Buttons.vb */}
        <div className="flex flex-col justify-between border-r border-slate-800 pr-4">
          <div className="flex items-center space-x-2">

            {/* ENVIRONMENT: Assembly (.iam) */}
            {environment === 'Assembly' && (
              <>
                <button
                  onClick={onOpenTestForm}
                  className="group flex flex-col items-center justify-center px-3.5 py-1.5 bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-md shadow-md active:scale-95 transition min-w-[90px]"
                  title="[BTN_ODOO_TEST_ASM] Prueba la conectividad JSON-RPC con el servidor Odoo"
                >
                  <img src="/icons/icon_odoo_test_32x32.png" alt="Probar Conexión" className="w-6 h-6 object-contain mb-0.5 group-hover:scale-110 transition drop-shadow" />
                  <span className="text-xs font-bold leading-tight">Probar Conexión</span>
                  <span className="text-[9px] text-orange-100 font-mono">Assembly</span>
                </button>

                <button
                  onClick={onSyncBom}
                  disabled={isSyncing}
                  className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                  title="[BTN_ODOO_SYNC_BOM] Extrae la estructura del ensamblaje y genera mrp.bom en Odoo"
                >
                  <img src="/icons/icon_odoo_bom_32x32.png" alt="BOM" className={`w-6 h-6 object-contain mb-0.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="font-semibold text-[11px] leading-tight text-center">Sincronizar BOM</span>
                  <span className="text-[9px] text-slate-400 font-mono">a mrp.bom</span>
                </button>

                <button
                  onClick={onPushProperties}
                  className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                  title="[BTN_ODOO_PROP_ASM] Envía masa, volumen y material a product.template"
                >
                  <img src="/icons/icon_odoo_prop_32x32.png" alt="Propiedades" className="w-6 h-6 object-contain mb-0.5" />
                  <span className="font-semibold text-[11px] leading-tight text-center">iProperties</span>
                  <span className="text-[9px] text-slate-400 font-mono">a Odoo ERP</span>
                </button>

                <button
                  onClick={() => setActiveView('products')}
                  className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                  title="[BTN_ODOO_STOCK_ASM] Consulta stock de todos los componentes en Odoo"
                >
                  <img src="/icons/icon_odoo_stock_32x32.png" alt="Stock" className="w-6 h-6 object-contain mb-0.5" />
                  <span className="font-semibold text-[11px] leading-tight text-center">Consultar Stock</span>
                  <span className="text-[9px] text-slate-400 font-mono">Ensamblaje</span>
                </button>
              </>
            )}

            {/* ENVIRONMENT: Part (.ipt) */}
            {environment === 'Part' && (
              <>
                <button
                  onClick={onOpenTestForm}
                  className="group flex flex-col items-center justify-center px-3.5 py-1.5 bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-md shadow-md active:scale-95 transition min-w-[90px]"
                  title="[BTN_ODOO_TEST_PART] Prueba la conectividad JSON-RPC con el servidor Odoo"
                >
                  <img src="/icons/icon_odoo_test_32x32.png" alt="Probar Conexión" className="w-6 h-6 object-contain mb-0.5 group-hover:scale-110 transition drop-shadow" />
                  <span className="text-xs font-bold leading-tight">Probar Conexión</span>
                  <span className="text-[9px] text-orange-100 font-mono">Part (.ipt)</span>
                </button>

                <button
                  onClick={onPushProperties}
                  className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                  title="[BTN_ODOO_SYNC_PART] Sincroniza la ficha de la pieza como producto almacenable"
                >
                  <img src="/icons/icon_odoo_part_32x32.png" alt="Pieza" className="w-6 h-6 object-contain mb-0.5" />
                  <span className="font-semibold text-[11px] leading-tight text-center">Sincronizar Pieza</span>
                  <span className="text-[9px] text-slate-400 font-mono">product.template</span>
                </button>

                <button
                  onClick={() => setActiveView('products')}
                  className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                  title="[BTN_ODOO_STOCK_PART] Consulta existencias de la pieza en Odoo"
                >
                  <img src="/icons/icon_odoo_stock_32x32.png" alt="Stock" className="w-6 h-6 object-contain mb-0.5" />
                  <span className="font-semibold text-[11px] leading-tight text-center">Consultar Stock</span>
                  <span className="text-[9px] text-slate-400 font-mono">Almacén Odoo</span>
                </button>
              </>
            )}

            {/* ENVIRONMENT: Drawing (.idw) */}
            {environment === 'Drawing' && (
              <>
                <button
                  onClick={onOpenTestForm}
                  className="group flex flex-col items-center justify-center px-3.5 py-1.5 bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-md shadow-md active:scale-95 transition min-w-[90px]"
                  title="[BTN_ODOO_LINK_DWG] Asocia el plano con el código de producto en Odoo"
                >
                  <img src="/icons/icon_odoo_link_32x32.png" alt="Vincular" className="w-6 h-6 object-contain mb-0.5 group-hover:scale-110 transition drop-shadow" />
                  <span className="text-xs font-bold leading-tight">Vincular con Odoo</span>
                  <span className="text-[9px] text-orange-100 font-mono">Drawing (.idw)</span>
                </button>

                <button
                  onClick={onPushProperties}
                  className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                  title="[BTN_ODOO_UPDATE_DWG] Trae descripción y código del ERP al cajetín"
                >
                  <img src="/icons/icon_odoo_dwg_32x32.png" alt="Plano" className="w-6 h-6 object-contain mb-0.5" />
                  <span className="font-semibold text-[11px] leading-tight text-center">Actualizar Rótulo</span>
                  <span className="text-[9px] text-slate-400 font-mono">desde ERP</span>
                </button>

                <button
                  onClick={onOpenTestForm}
                  className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                >
                  <img src="/icons/icon_odoo_test_32x32.png" alt="Test" className="w-6 h-6 object-contain mb-0.5" />
                  <span className="font-semibold text-[11px] leading-tight text-center">Probar Conexión</span>
                  <span className="text-[9px] text-slate-400 font-mono">JSON-RPC</span>
                </button>
              </>
            )}

            {/* ENVIRONMENT: ZeroDoc */}
            {environment === 'ZeroDoc' && (
              <>
                <button
                  onClick={onOpenTestForm}
                  className="group flex flex-col items-center justify-center px-4 py-1.5 bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-md shadow-md active:scale-95 transition min-w-[110px]"
                  title="[BTN_ODOO_TEST_ZERODOC] Prueba la conexión con el servidor Odoo sin documento abierto"
                >
                  <img src="/icons/icon_odoo_test_32x32.png" alt="Test" className="w-6 h-6 object-contain mb-0.5 group-hover:scale-110 transition drop-shadow" />
                  <span className="text-xs font-bold leading-tight">Probar Conexión</span>
                  <span className="text-[9px] text-orange-100 font-mono">ZeroDoc</span>
                </button>

                <button
                  onClick={onOpenTestForm}
                  className="flex flex-col items-center justify-center px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[110px]"
                  title="[BTN_ODOO_CONFIG] Configura URL base y API Key de Odoo"
                >
                  <img src="/icons/icon_odoo_config_32x32.png" alt="Config" className="w-6 h-6 object-contain mb-0.5" />
                  <span className="font-semibold text-[11px] leading-tight text-center">Configuración</span>
                  <span className="text-[9px] text-slate-400 font-mono">Servidor Odoo</span>
                </button>
              </>
            )}

          </div>

          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center mt-1">
            PANEL_ODOO (en {tabLocation === 'TECNICA' ? 'TAB_TECNICA' : 'TAB_ODOO'})
          </span>
        </div>

        {/* Si está en modo TECNICA, mostrar el panel contiguo de AUTOMATIZACION (RuleManager) */}
        {tabLocation === 'TECNICA' && (
          <div className="flex flex-col justify-between border-r border-slate-800 pr-4 opacity-75 hover:opacity-100 transition">
            <div className="flex items-center space-x-1.5">
              <div className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800/80 text-slate-300 text-xs rounded border border-slate-700">
                <Box className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-[10px] font-semibold">Comerciales</span>
                <span className="text-[8px] text-slate-500 font-mono">RuleManager</span>
              </div>
              <div className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800/80 text-slate-300 text-xs rounded border border-slate-700">
                <Layers className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-[10px] font-semibold">Simetrías</span>
                <span className="text-[8px] text-slate-500 font-mono">RuleManager</span>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center mt-1">
              PANEL_AUTOMATIZACION
            </span>
          </div>
        )}

        {/* Panel Información de Parámetros */}
        <div className="flex flex-col justify-between border-r border-slate-800 pr-4">
          <div className="flex items-center space-x-3 text-xs">
            <div className="bg-slate-800/80 p-2 rounded border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px]">Entorno Activo:</div>
              <div className="font-mono font-bold text-orange-300">{environment}</div>
            </div>
            <div className="bg-slate-800/80 p-2 rounded border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px]">Pestaña Ribbon:</div>
              <div className="font-mono font-bold text-slate-200">
                {tabLocation === 'TECNICA' ? 'TAB_TECNICA' : 'TAB_ODOO'}
              </div>
            </div>
            <div className="bg-slate-800/80 p-2 rounded border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px]">Generado por:</div>
              <div className="font-mono font-bold text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 inline" />
                <span>Buttons.vb</span>
              </div>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center mt-1">
            {tabLocation === 'TECNICA' ? 'Pestaña Compartida con RuleManager' : 'Pestaña Propia ODOO'}
          </span>
        </div>

        {/* Panel Setup */}
        <div className="flex flex-col justify-between pr-2">
          <div className="flex items-center space-x-2 text-xs">
            <div className="flex flex-col justify-center space-y-1 bg-slate-800/50 p-2 rounded border border-slate-800">
              <div className="text-slate-400 text-[10px]">Plantilla Buttons.vb:</div>
              <div className="font-mono text-[10px] text-orange-300">Cargada y disponible en raíz</div>
              <div className="text-[10px] text-slate-500">AddButtonToRibbon según Environment</div>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center mt-1">
            Configuración Multi-Entorno
          </span>
        </div>
      </div>
    </header>
  );
};
