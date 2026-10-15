import React, { useState } from 'react';
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
  FileSpreadsheet
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
  const [propsState, setPropsState] = useState(part.iProperties);
  const [tempMass, setTempMass] = useState(part.mass.toString());
  const [tempMaterial, setTempMaterial] = useState(part.material);
  const [tempDimensions, setTempDimensions] = useState(part.dimensions);

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

        {/* Card 2: Metadatos de Proyecto & Orden de Trabajo */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
              <FileCode className="w-4 h-4" />
              <span>Proyecto e iProperties</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Inventor Summary</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px] mb-1">Título / Denominación:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={propsState.Title}
                  onChange={(e) => setPropsState({ ...propsState, Title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                />
              ) : (
                <div className="font-semibold text-slate-100 bg-slate-950 px-3 py-2 rounded border border-slate-800/80">
                  {propsState.Title}
                </div>
              )}
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] mb-1">Asunto / Orden de Trabajo (OT):</span>
              {isEditing ? (
                <input
                  type="text"
                  value={propsState.Subject}
                  onChange={(e) => setPropsState({ ...propsState, Subject: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                />
              ) : (
                <div className="text-slate-200 bg-slate-950 px-3 py-2 rounded border border-slate-800/80">
                  {propsState.Subject}
                </div>
              )}
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] mb-1">Empresa / Cliente:</span>
              <div className="text-slate-200 bg-slate-950 px-3 py-2 rounded border border-slate-800/80 flex items-center space-x-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{propsState.Company}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 block text-[11px] mb-1">Autor CAD:</span>
                <div className="text-slate-300 bg-slate-950 px-2.5 py-2 rounded border border-slate-800/80 flex items-center space-x-1.5 truncate">
                  <User className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{part.author}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px] mb-1">Revisión:</span>
                <div className="font-mono text-orange-400 bg-slate-950 px-2.5 py-2 rounded border border-slate-800/80 font-bold text-center">
                  {part.revision}
                </div>
              </div>
            </div>
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
