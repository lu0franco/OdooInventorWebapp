import React, { useState, useMemo, useEffect } from 'react';
import { 
  Scale, 
  FileCode, 
  Cpu, 
  Building2, 
  DollarSign, 
  MapPin, 
  User, 
  Calendar, 
  Layers, 
  UploadCloud, 
  Check, 
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { CadPart } from '../types';

interface AssemblyPropertiesViewProps {
  part: CadPart;
  onUpdatePart: (updatedPart: CadPart) => void;
  onPushProperties: () => void;
  isPushing: boolean;
  onGoToBom: () => void;
}

export const AssemblyPropertiesView: React.FC<AssemblyPropertiesViewProps> = ({
  part,
  onUpdatePart,
  onPushProperties,
  isPushing,
  onGoToBom
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const defaultIProps = useMemo(() => ({
    Title: part.iProperties?.Title || part.name || '',
    Subject: part.iProperties?.Subject || '',
    Company: part.iProperties?.Company || '',
    Manager: part.iProperties?.Manager || '',
    CostCenter: part.iProperties?.CostCenter || '',
    StandardCost: part.iProperties?.StandardCost ?? 0,
    StockLocation: part.iProperties?.StockLocation || '',
    PartNumber: part.iProperties?.PartNumber || part.partNumber || '',
    StockNumber: part.iProperties?.StockNumber || '',
    Project: part.iProperties?.Project || '',
    Designer: part.iProperties?.Designer || '',
    Vendor: part.iProperties?.Vendor || '',
    Location: part.iProperties?.Location || ''
  }), [part]);

  const [propsState, setPropsState] = useState(defaultIProps);
  const [tempMass, setTempMass] = useState(part.mass.toString());
  const [tempMaterial, setTempMaterial] = useState(part.material);
  const [tempDimensions, setTempDimensions] = useState(part.dimensions);

  useEffect(() => {
    setPropsState(defaultIProps);
    setTempMass(part.mass.toString());
    setTempMaterial(part.material);
    setTempDimensions(part.dimensions);
  }, [defaultIProps, part]);

  const handleSave = () => {
    onUpdatePart({
      ...part,
      mass: parseFloat(tempMass) || part.mass,
      material: tempMaterial,
      dimensions: tempDimensions,
      iProperties: propsState
    });
    setIsEditing(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 text-slate-200 p-6 space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-400">
            <Cpu className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-lg font-bold text-slate-100 font-sans">
                {part.name}
              </h1>
              <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40">
                {part.partNumber}.iam
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {part.revision}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Metadatos e iProperties de Autodesk Inventor Professional listos para sincronización con Odoo ERP (<code>product.template</code>).
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            {isEditing ? 'Cancelar Edición' : 'Editar Propiedades'}
          </button>

          <button
            onClick={onPushProperties}
            disabled={isPushing}
            className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-semibold text-xs rounded-lg shadow-md flex items-center space-x-2 transition disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{isPushing ? 'Enviando a Odoo...' : 'Enviar iProperties a Odoo'}</span>
          </button>
        </div>
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Propiedades Físicas CAD */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-orange-400 font-bold text-xs uppercase tracking-wider">
              <Scale className="w-4 h-4" />
              <span>Propiedades Físicas (CAD)</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Calculadas por Inventor</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px] mb-1">Masa Total del Ensamblaje:</span>
              {isEditing ? (
                <input
                  type="number"
                  step="0.1"
                  value={tempMass}
                  onChange={(e) => setTempMass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-orange-400"
                />
              ) : (
                <div className="font-mono text-base font-bold text-slate-100 bg-slate-950 px-3 py-2 rounded border border-slate-800/80">
                  {part.mass} kg
                </div>
              )}
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] mb-1">Volumen Calculado:</span>
              <div className="font-mono text-xs font-semibold text-slate-200 bg-slate-950 px-3 py-2 rounded border border-slate-800/80">
                {part.volume} cm³
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] mb-1">Dimensiones Envolventes (L x A x H):</span>
              {isEditing ? (
                <input
                  type="text"
                  value={tempDimensions}
                  onChange={(e) => setTempDimensions(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-slate-200"
                />
              ) : (
                <div className="font-mono text-xs font-semibold text-slate-200 bg-slate-950 px-3 py-2 rounded border border-slate-800/80">
                  {part.dimensions}
                </div>
              )}
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] mb-1">Material Predominante:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={tempMaterial}
                  onChange={(e) => setTempMaterial(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                />
              ) : (
                <div className="text-xs font-medium text-slate-200 bg-slate-950 px-3 py-2 rounded border border-slate-800/80">
                  {part.material}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: DATOS DE PROYECTO (iProperties de Proyecto - RuleManager V2) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
              <FileCode className="w-4 h-4" />
              <span>Datos de Proyecto (iProperties)</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              RuleManager V2
            </span>
          </div>

          {/* Document path from RuleManager / iProperties */}
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-850 space-y-1">
            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-200">
              <span className="text-blue-400">Documento:</span>
              <span className="font-mono text-cyan-300 truncate">{part.name}</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 truncate" title={propsState.Location}>
              {propsState.Location || 'Sin ruta de archivo especificada'}
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Nº de pieza (Púrpura) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-300 font-semibold text-[11px]">Nº de pieza:</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  🟣 Odoo: Referencia
                </span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={propsState.PartNumber}
                  onChange={(e) => setPropsState({ ...propsState, PartNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-purple-500/80 rounded px-2.5 py-1.5 font-bold font-mono text-purple-200"
                />
              ) : (
                <div className="font-mono font-bold text-sm text-purple-200 bg-purple-950/30 px-3 py-2 rounded-lg border-2 border-purple-500/70 shadow-sm">
                  {propsState.PartNumber}
                </div>
              )}
            </div>

            {/* Nº de almacenamiento (Amarillo) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-300 font-semibold text-[11px]">Nº de almacenamiento:</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  🟡 Odoo: Descripción
                </span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={propsState.StockNumber}
                  onChange={(e) => setPropsState({ ...propsState, StockNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-amber-500/80 rounded px-2.5 py-1.5 font-bold font-mono text-amber-200"
                />
              ) : (
                <div className="font-mono font-bold text-sm text-amber-200 bg-amber-950/30 px-3 py-2 rounded-lg border-2 border-amber-500/70 shadow-sm">
                  {propsState.StockNumber}
                </div>
              )}
            </div>

            {/* Proyecto (OT) (Rojo) y Diseñador (Azul) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-300 font-semibold text-[11px]">Proyecto (OT):</span>
                  <span className="text-[10px] font-mono px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    🔴 Prefijo
                  </span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={propsState.Project}
                    onChange={(e) => setPropsState({ ...propsState, Project: e.target.value })}
                    className="w-full bg-slate-950 border border-rose-500/80 rounded px-2.5 py-1.5 font-bold font-mono text-rose-200"
                  />
                ) : (
                  <div className="font-mono font-bold text-sm text-rose-200 bg-rose-950/30 px-3 py-2 rounded-lg border-2 border-rose-500/70 text-center shadow-sm">
                    {propsState.Project}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-300 font-semibold text-[11px]">Diseñador:</span>
                  <span className="text-[10px] font-mono px-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    🔵 Autorizador
                  </span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={propsState.Designer}
                    onChange={(e) => setPropsState({ ...propsState, Designer: e.target.value })}
                    className="w-full bg-slate-950 border border-blue-500/80 rounded px-2.5 py-1.5 font-bold font-mono text-blue-200 text-center"
                  />
                ) : (
                  <div className="font-mono font-bold text-sm text-blue-200 bg-blue-950/30 px-3 py-2 rounded-lg border-2 border-blue-500/70 text-center shadow-sm">
                    {propsState.Designer}
                  </div>
                )}
              </div>
            </div>

            {/* Proveedor / Cliente */}
            <div>
              <span className="text-slate-300 font-semibold block text-[11px] mb-1">Proveedor / Cliente:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={propsState.Vendor}
                  onChange={(e) => setPropsState({ ...propsState, Vendor: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                />
              ) : (
                <div className="text-slate-100 font-semibold bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 flex items-center space-x-2">
                  <Building2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span>{propsState.Vendor}</span>
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-500 italic pt-1 leading-snug">
              Nota: Estos campos alimentan las Listas de Materiales, Carátulas y Planos en la carpeta del proyecto y la Solicitud de Compra en Odoo.
            </p>
          </div>
        </div>

        {/* Card 3: Mapeo Odoo ERP */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <DollarSign className="w-4 h-4" />
              <span>Costos y Logística Odoo</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono">product.template</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px] mb-1">Centro de Costo:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={propsState.CostCenter}
                  onChange={(e) => setPropsState({ ...propsState, CostCenter: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-slate-200"
                />
              ) : (
                <div className="font-mono text-slate-200 bg-slate-950 px-3 py-2 rounded border border-slate-800/80">
                  {propsState.CostCenter}
                </div>
              )}
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] mb-1">Costo Estándar Estimado (USD):</span>
              {isEditing ? (
                <input
                  type="number"
                  step="10"
                  value={propsState.StandardCost}
                  onChange={(e) => setPropsState({ ...propsState, StandardCost: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-emerald-400 font-bold"
                />
              ) : (
                <div className="font-mono text-lg font-bold text-emerald-400 bg-slate-950 px-3 py-2 rounded border border-slate-800/80">
                  ${propsState.StandardCost.toFixed(2)}
                </div>
              )}
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] mb-1">Ubicación de Almacén Destino:</span>
              <div className="text-slate-300 bg-slate-950 px-3 py-2 rounded border border-slate-800/80 flex items-center space-x-2 font-mono text-xs">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{propsState.StockLocation}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onGoToBom}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-orange-400 font-semibold rounded-lg border border-slate-700 flex items-center justify-center space-x-2 transition"
              >
                <Layers className="w-4 h-4" />
                <span>Ver Lista de Materiales ({part.bom.length} componentes)</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Visual Odoo ERP Linkage Guide (Mapping matching user colors) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Mapeo de Datos iProperties ➔ Odoo ERP (purchase.request)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Campos sincronizados con el ERP Deblasi S.A.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mapping 1: Referencia */}
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
              <span>Campo Odoo:</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Referencia de Solicitud
              </span>
            </div>
            <div className="flex items-center space-x-1.5 flex-wrap">
              <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/50 font-mono font-bold text-xs">
                🔴 {propsState.Project}
              </span>
              <span className="text-slate-500 font-bold">-</span>
              <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/50 font-mono font-bold text-xs">
                🟣 {propsState.PartNumber}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Combina el <strong>Proyecto (OT)</strong> con el <strong>Nº de pieza</strong> del ensamble de Inventor.
            </p>
          </div>

          {/* Mapping 2: Descripción */}
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
              <span>Campo Odoo:</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Descripción
              </span>
            </div>
            <div>
              <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 font-mono font-bold text-xs inline-block">
                🟡 {propsState.StockNumber}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Mapeado directamente desde el <strong>Nº de almacenamiento</strong> de las iProperties de Inventor.
            </p>
          </div>

          {/* Mapping 3: Autorizador */}
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
              <span>Campo Odoo:</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Autorizador / Diseñador
              </span>
            </div>
            <div>
              <span className="px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/50 font-mono font-bold text-xs inline-block">
                🔵 {propsState.Designer}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Mapeado desde el campo <strong>Diseñador</strong> para asignación del responsable en el flujo de aprobación.
            </p>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <span className="text-xs text-amber-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4" />
            <span>Hay cambios sin guardar en las propiedades locales.</span>
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs rounded shadow flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Guardar Cambios</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
