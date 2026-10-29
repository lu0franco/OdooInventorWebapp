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

import { CadPart, ActiveView } from '../types';

export type InventorEnvironment = 'Assembly' | 'Part' | 'Drawing' | 'ZeroDoc';

interface RibbonHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
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
  setEnvironment: _setEnvironment,
  onOpenTestForm,
  onSyncBom,
  onPushProperties,
  onOpenAddinInfo: _onOpenAddinInfo,
  isSyncing,
  connectionState,
  odooUrl,
  part
}) => {
  const comCount = part?.bom ? part.bom.filter(b => b.isCom).length : 0;

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

  const isRequisitionActive = activeTab === 'REQUISITION' || activeView === 'requisition';

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
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${
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
            <span className="truncate max-w-[200px]">{odooUrl.replace('https://', '')}</span>
          </div>
        </div>
      </div>

      {/* Tabs navigation & View switcher */}
      <div className="flex items-center justify-between px-3 pt-1 border-b border-slate-800 bg-slate-900/60 text-xs">
        {/* Pestañas de la barra (Tabs de Inventor / Odoo) */}
        <div className="flex items-center space-x-1">
          {/* Tab 1: ODOO ERP (CAD & Ensamble) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('ODOO');
              if (activeView === 'requisition') setActiveView('bom');
            }}
            className={`px-3.5 py-1.5 font-semibold text-xs rounded-t flex items-center space-x-1.5 transition ${
              !isRequisitionActive
                ? 'text-orange-400 border-t-2 border-t-orange-500 bg-slate-850 shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <span>ODOO ERP</span>
            <span className="text-[9px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-mono">
              {environment}
            </span>
          </button>

          {/* Tab 2: Solicitud de Compra (purchase.requisition) - Ubicación indicada con círculo rojo */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('REQUISITION');
              setActiveView('requisition');
            }}
            className={`px-3.5 py-1.5 font-semibold text-xs rounded-t flex items-center space-x-2 transition relative ${
              isRequisitionActive
                ? 'text-orange-400 border-t-2 border-t-orange-500 bg-slate-850 shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
            title="Abrir módulo de Solicitudes de Compra en Odoo (purchase.requisition)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-orange-400" />
            <span>Solicitud de Compra (purchase.requisition)</span>
            {comCount > 0 && (
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                {comCount} COM
              </span>
            )}
          </button>
        </div>

        {/* View Switcher pills */}
        <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800 mb-1">
          <button
            onClick={() => {
              setActiveTab('ODOO');
              setActiveView('bom');
            }}
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
            onClick={() => {
              setActiveTab('ODOO');
              setActiveView('iproperties');
            }}
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
            onClick={() => {
              setActiveTab('ODOO');
              setActiveView('products');
            }}
            className={`px-3 py-1 text-xs font-medium rounded flex items-center space-x-1.5 transition ${
              activeView === 'products' 
                ? 'bg-orange-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Catálogo Odoo</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('REQUISITION');
              setActiveView('requisition');
            }}
            className={`px-3 py-1 text-xs font-semibold rounded flex items-center space-x-1.5 transition ${
              activeView === 'requisition' 
                ? 'bg-orange-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Ir a la vista de Solicitud de Compra (purchase.requisition)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-orange-400" />
            <span>Solicitud de Compra</span>
          </button>
        </div>
      </div>

      {/* Ribbon Panels (Specific to ODOO tab & Current Environment) */}
      <div className="bg-slate-900 px-3 py-2 flex items-stretch space-x-4 overflow-x-auto min-h-[92px]">
        
        {isRequisitionActive ? (
          /* Panel Comandos Solicitud de Compra */
          <div className="flex flex-col justify-between pr-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveView('requisition')}
                className="group flex flex-col items-center justify-center px-4 py-1.5 bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-md shadow-md active:scale-95 transition min-w-[100px]"
                title="Generar nueva solicitud de compra purchase.requisition en Odoo"
              >
                <FileSpreadsheet className="w-6 h-6 object-contain mb-0.5 group-hover:scale-110 transition drop-shadow" />
                <span className="text-xs font-bold leading-tight">Nueva Solicitud</span>
                <span className="text-[9px] text-orange-100 font-mono">purchase.requisition</span>
              </button>

              <button
                onClick={() => setActiveView('bom')}
                className="flex flex-col items-center justify-center px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                title="Ver y seleccionar piezas comerciales (COM) en la LDM"
              >
                <Layers className="w-6 h-6 object-contain mb-0.5 text-orange-400" />
                <span className="font-semibold text-[11px] leading-tight text-center">Ver Piezas COM</span>
                <span className="text-[9px] text-slate-400 font-mono">{comCount} marcadas</span>
              </button>

              <button
                onClick={() => setActiveView('products')}
                className="flex flex-col items-center justify-center px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                title="Consultar catálogo de productos y referencias en Odoo"
              >
                <Database className="w-6 h-6 object-contain mb-0.5 text-slate-300" />
                <span className="font-semibold text-[11px] leading-tight text-center">Catálogo Odoo</span>
                <span className="text-[9px] text-slate-400 font-mono">product.product</span>
              </button>

              <button
                onClick={onOpenTestForm}
                className="flex flex-col items-center justify-center px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                title="Diagnóstico de conexión JSON-RPC"
              >
                <img src="/icons/icon_odoo_test_32x32.png" alt="Test" className="w-6 h-6 object-contain mb-0.5" />
                <span className="font-semibold text-[11px] leading-tight text-center">Probar Conexión</span>
                <span className="text-[9px] text-slate-400 font-mono">JSON-RPC</span>
              </button>
            </div>

            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center mt-1">
              Comandos Solicitudes de Compra (purchase.requisition)
            </span>
          </div>
        ) : (
          /* Panel ODOO de Comandos CAD */
          <div className="flex flex-col justify-between pr-4">
          <div className="flex items-center space-x-2">

            {/* ENVIRONMENT: Assembly (.iam) */}
            {environment === 'Assembly' && (
              <>
                <button
                  onClick={onOpenTestForm}
                  className="group flex flex-col items-center justify-center px-3.5 py-1.5 bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-md shadow-md active:scale-95 transition min-w-[90px]"
                  title="Prueba la conectividad JSON-RPC con el servidor Odoo"
                >
                  <img src="/icons/icon_odoo_test_32x32.png" alt="Probar Conexión" className="w-6 h-6 object-contain mb-0.5 group-hover:scale-110 transition drop-shadow" />
                  <span className="text-xs font-bold leading-tight">Probar Conexión</span>
                  <span className="text-[9px] text-orange-100 font-mono">Assembly</span>
                </button>

                <button
                  onClick={onSyncBom}
                  disabled={isSyncing}
                  className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                  title="Extrae la estructura del ensamblaje y genera mrp.bom en Odoo"
                >
                  <img src="/icons/icon_odoo_bom_32x32.png" alt="BOM" className={`w-6 h-6 object-contain mb-0.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="font-semibold text-[11px] leading-tight text-center">Sincronizar BOM</span>
                  <span className="text-[9px] text-slate-400 font-mono">a mrp.bom</span>
                </button>

                <button
                  onClick={onPushProperties}
                  className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                  title="Envía masa, volumen y material a product.template"
                >
                  <img src="/icons/icon_odoo_prop_32x32.png" alt="Propiedades" className="w-6 h-6 object-contain mb-0.5" />
                  <span className="font-semibold text-[11px] leading-tight text-center">iProperties</span>
                  <span className="text-[9px] text-slate-400 font-mono">a Odoo ERP</span>
                </button>

                <button
                  onClick={() => setActiveView('products')}
                  className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                  title="Consulta stock de todos los componentes en Odoo"
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
                  title="Prueba la conectividad JSON-RPC con el servidor Odoo"
                >
                  <img src="/icons/icon_odoo_test_32x32.png" alt="Probar Conexión" className="w-6 h-6 object-contain mb-0.5 group-hover:scale-110 transition drop-shadow" />
                  <span className="text-xs font-bold leading-tight">Probar Conexión</span>
                  <span className="text-[9px] text-orange-100 font-mono">Part (.ipt)</span>
                </button>

                <button
                  onClick={onPushProperties}
                  className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                  title="Sincroniza la ficha de la pieza como producto almacenable"
                >
                  <img src="/icons/icon_odoo_part_32x32.png" alt="Pieza" className="w-6 h-6 object-contain mb-0.5" />
                  <span className="font-semibold text-[11px] leading-tight text-center">Sincronizar Pieza</span>
                  <span className="text-[9px] text-slate-400 font-mono">product.template</span>
                </button>

                <button
                  onClick={() => setActiveView('products')}
                  className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                  title="Consulta existencias de la pieza en Odoo"
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
                  title="Asocia el plano con el código de producto en Odoo"
                >
                  <img src="/icons/icon_odoo_link_32x32.png" alt="Vincular" className="w-6 h-6 object-contain mb-0.5 group-hover:scale-110 transition drop-shadow" />
                  <span className="text-xs font-bold leading-tight">Vincular con Odoo</span>
                  <span className="text-[9px] text-orange-100 font-mono">Drawing (.idw)</span>
                </button>

                <button
                  onClick={onPushProperties}
                  className="flex flex-col items-center justify-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[90px]"
                  title="Trae descripción y código del ERP al cajetín"
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
                  title="Prueba la conexión con el servidor Odoo sin documento abierto"
                >
                  <img src="/icons/icon_odoo_test_32x32.png" alt="Test" className="w-6 h-6 object-contain mb-0.5 group-hover:scale-110 transition drop-shadow" />
                  <span className="text-xs font-bold leading-tight">Probar Conexión</span>
                  <span className="text-[9px] text-orange-100 font-mono">ZeroDoc</span>
                </button>

                <button
                  onClick={onOpenTestForm}
                  className="flex flex-col items-center justify-center px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition min-w-[110px]"
                  title="Configura URL base y API Key de Odoo"
                >
                  <img src="/icons/icon_odoo_config_32x32.png" alt="Config" className="w-6 h-6 object-contain mb-0.5" />
                  <span className="font-semibold text-[11px] leading-tight text-center">Configuración</span>
                  <span className="text-[9px] text-slate-400 font-mono">Servidor Odoo</span>
                </button>
              </>
            )}

          </div>

          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center mt-1">
            Comandos Odoo ERP
          </span>
        </div>
        )}
      </div>
    </header>
  );
};
