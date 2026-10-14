import React, { useState } from 'react';
import { 
  Box, 
  Rotate3d, 
  Layers, 
  Scale, 
  Ruler, 
  Maximize2, 
  Eye, 
  EyeOff, 
  Sliders, 
  Check, 
  UploadCloud, 
  FileCode, 
  Compass,
  Cpu
} from 'lucide-react';
import { CadPart } from '../types';

interface CADModelViewerProps {
  part: CadPart;
  onUpdatePart: (updatedPart: CadPart) => void;
  onPushProperties: () => void;
  onSyncBom: () => void;
  isPushing: boolean;
}

export const CADModelViewer: React.FC<CADModelViewerProps> = ({
  part,
  onUpdatePart,
  onPushProperties,
  onSyncBom,
  isPushing
}) => {
  const [rotation, setRotation] = useState({ x: -25, y: 35 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [explodedView, setExplodedView] = useState(0); // 0 to 100%
  const [isWireframe, setIsWireframe] = useState(false);
  const [selectedPartIndex, setSelectedPartIndex] = useState<number | null>(null);
  const [isEditingProps, setIsEditingProps] = useState(false);
  const [propsState, setPropsState] = useState(part.iProperties);
  const [tempMass, setTempMass] = useState(part.mass.toString());
  const [tempMaterial, setTempMaterial] = useState(part.material);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setRotation(prev => ({
      x: Math.max(-85, Math.min(85, prev.x - dy * 0.5)),
      y: (prev.y + dx * 0.5) % 360
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSaveProperties = () => {
    onUpdatePart({
      ...part,
      mass: parseFloat(tempMass) || part.mass,
      material: tempMaterial,
      iProperties: propsState
    });
    setIsEditingProps(false);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950 text-slate-200">
      
      {/* 3D Viewport Area */}
      <div 
        className="flex-1 relative flex flex-col justify-between overflow-hidden cursor-grab active:cursor-grabbing select-none bg-gradient-to-br from-slate-900 via-slate-950 to-neutral-950"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* CAD Viewport Overlay HUD (Top-Left) */}
        <div className="absolute top-3 left-3 z-10 space-y-2 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded border border-slate-800 pointer-events-auto">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-xs font-mono font-bold text-orange-400">{part.partNumber}</span>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded uppercase">
                {part.fileType.toUpperCase()}
              </span>
            </div>
            <div className="text-xs text-slate-300 font-medium mt-0.5">{part.name}</div>
            <div className="text-[11px] text-slate-500 flex items-center space-x-2 mt-1">
              <span>Rev: <b className="text-slate-300 font-mono">{part.revision}</b></span>
              <span>•</span>
              <span>Autor: <b className="text-slate-300">{part.author}</b></span>
            </div>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-sm px-2.5 py-1.5 rounded border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center space-x-3 pointer-events-auto">
            <span>Rot X: <b className="text-slate-200">{Math.round(rotation.x)}°</b></span>
            <span>Rot Y: <b className="text-slate-200">{Math.round(rotation.y)}°</b></span>
            <button
              onClick={() => setRotation({ x: -25, y: 35 })}
              className="text-[10px] text-orange-400 hover:text-orange-300 ml-1"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Viewport Tools (Top-Right) */}
        <div className="absolute top-3 right-3 z-10 flex flex-col space-y-2 items-end">
          {/* ViewCube Simulation */}
          <div className="w-16 h-16 bg-slate-900/90 border border-slate-700 rounded-md p-1 flex flex-col items-center justify-center shadow-lg relative group">
            <Compass className="w-7 h-7 text-orange-400" />
            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">ISOMETRIC</span>
          </div>

          <div className="bg-slate-900/90 backdrop-blur-md p-1.5 rounded-md border border-slate-800 flex flex-col space-y-1 shadow">
            <button
              onClick={() => setIsWireframe(!isWireframe)}
              className={`p-1.5 rounded text-xs transition ${
                isWireframe ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Alternar estructura alámbrica (Wireframe)"
            >
              <Rotate3d className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedPartIndex(null)}
              className="p-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Deseleccionar piezas"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center CAD 3D Isometric SVG Model Canvas */}
        <div className="flex-1 flex items-center justify-center relative p-8">
          <div 
            className="w-full max-w-[540px] h-[380px] relative transition-transform duration-75 flex items-center justify-center"
            style={{
              transform: `perspective(900px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`
            }}
          >
            {/* SVG Engineering Assembly Graphics */}
            <svg 
              viewBox="0 0 500 400" 
              className="w-full h-full filter drop-shadow-[0_20px_25px_rgba(0,0,0,0.6)]"
            >
              <defs>
                {/* Gradients for metallic CAD parts */}
                <linearGradient id="metal-al" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#94a3b8" />
                  <stop offset="50%" stopColor="#cbd5e1" />
                  <stop offset="100%" stopColor="#64748b" />
                </linearGradient>
                <linearGradient id="metal-steel" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#475569" />
                  <stop offset="50%" stopColor="#64748b" />
                  <stop offset="100%" stopColor="#334155" />
                </linearGradient>
                <linearGradient id="bronze" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d97706" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
                <linearGradient id="gear-mesh" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
              </defs>

              {/* Grid ground shadow */}
              <ellipse cx="250" cy="360" rx="190" ry="24" fill="#020617" opacity="0.7" />

              {/* Component 1: Carcasa Inferior / Base (Explodes downward) */}
              <g 
                transform={`translate(0, ${explodedView * 0.7})`}
                onClick={() => setSelectedPartIndex(0)}
                className="cursor-pointer transition-transform duration-300"
              >
                <path 
                  d="M140 260 L250 315 L360 260 L360 230 L250 285 L140 230 Z" 
                  fill={isWireframe ? 'none' : 'url(#metal-al)'} 
                  stroke={selectedPartIndex === 0 ? '#f97316' : '#94a3b8'} 
                  strokeWidth={selectedPartIndex === 0 ? '3' : '1.5'}
                />
                <path 
                  d="M140 230 L250 285 L360 230 L360 200 L250 255 L140 200 Z" 
                  fill={isWireframe ? 'none' : '#64748b'} 
                  stroke={selectedPartIndex === 0 ? '#f97316' : '#475569'} 
                  strokeWidth="1.5"
                />
              </g>

              {/* Component 4: Corona Dentada Interior Z=90 */}
              <g 
                transform={`translate(0, ${explodedView * 0.3})`}
                onClick={() => setSelectedPartIndex(3)}
                className="cursor-pointer transition-transform duration-300"
              >
                <ellipse cx="250" cy="220" rx="110" ry="45" fill={isWireframe ? 'none' : 'url(#metal-steel)'} stroke={selectedPartIndex === 3 ? '#f97316' : '#334155'} strokeWidth="2" />
                <ellipse cx="250" cy="220" rx="80" ry="32" fill={isWireframe ? 'none' : '#0f172a'} stroke="#475569" strokeWidth="1.5" />
                {/* Teeth marks */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => {
                  const rad = (deg * Math.PI) / 180;
                  const x = 250 + Math.cos(rad) * 95;
                  const y = 220 + Math.sin(rad) * 38;
                  return <circle key={i} cx={x} cy={y} r="2" fill="#94a3b8" />;
                })}
              </g>

              {/* Component 3: 3x Satélites Planetarios Z=36 (Explodes outward) */}
              <g 
                onClick={() => setSelectedPartIndex(2)}
                className="cursor-pointer"
              >
                {/* Satellite 1 */}
                <g transform={`translate(${-explodedView * 0.6}, ${-explodedView * 0.1})`} className="transition-transform duration-300">
                  <ellipse cx="205" cy="205" rx="28" ry="16" fill={isWireframe ? 'none' : 'url(#bronze)'} stroke={selectedPartIndex === 2 ? '#f97316' : '#b45309'} strokeWidth="2" />
                  <circle cx="205" cy="205" r="5" fill="#1e293b" />
                </g>
                {/* Satellite 2 */}
                <g transform={`translate(${explodedView * 0.6}, ${-explodedView * 0.1})`} className="transition-transform duration-300">
                  <ellipse cx="295" cy="205" rx="28" ry="16" fill={isWireframe ? 'none' : 'url(#bronze)'} stroke={selectedPartIndex === 2 ? '#f97316' : '#b45309'} strokeWidth="2" />
                  <circle cx="295" cy="205" r="5" fill="#1e293b" />
                </g>
                {/* Satellite 3 */}
                <g transform={`translate(0, ${explodedView * 0.4})`} className="transition-transform duration-300">
                  <ellipse cx="250" cy="242" rx="28" ry="16" fill={isWireframe ? 'none' : 'url(#bronze)'} stroke={selectedPartIndex === 2 ? '#f97316' : '#b45309'} strokeWidth="2" />
                  <circle cx="250" cy="242" r="5" fill="#1e293b" />
                </g>
              </g>

              {/* Component 2: Engranaje Solar Central Z=18 */}
              <g 
                transform={`translate(0, ${-explodedView * 0.2})`}
                onClick={() => setSelectedPartIndex(1)}
                className="cursor-pointer transition-transform duration-300"
              >
                <ellipse cx="250" cy="210" rx="22" ry="12" fill={isWireframe ? 'none' : 'url(#gear-mesh)'} stroke={selectedPartIndex === 1 ? '#f97316' : '#0284c7'} strokeWidth="2" />
                <path d="M246 160 L254 160 L254 210 L246 210 Z" fill="url(#metal-steel)" stroke="#38bdf8" strokeWidth="1" />
              </g>

              {/* Component 5 & 6: Rodamientos & Retenes */}
              <g 
                transform={`translate(0, ${-explodedView * 0.6})`}
                onClick={() => setSelectedPartIndex(4)}
                className="cursor-pointer transition-transform duration-300"
              >
                <ellipse cx="250" cy="155" rx="34" ry="14" fill={isWireframe ? 'none' : '#334155'} stroke={selectedPartIndex === 4 ? '#f97316' : '#94a3b8'} strokeWidth="1.5" />
                <ellipse cx="250" cy="155" rx="20" ry="8" fill="#0f172a" />
              </g>

              {/* Component 1 (Superior): Tapa Superior de Carcasa */}
              <g 
                transform={`translate(0, ${-explodedView * 1.0})`}
                onClick={() => setSelectedPartIndex(0)}
                className="cursor-pointer transition-transform duration-300"
              >
                <path 
                  d="M140 160 L250 110 L360 160 L250 215 Z" 
                  fill={isWireframe ? 'none' : 'url(#metal-al)'} 
                  stroke={selectedPartIndex === 0 ? '#f97316' : '#cbd5e1'} 
                  strokeWidth={selectedPartIndex === 0 ? '3' : '1.5'}
                  opacity={selectedPartIndex === null || selectedPartIndex === 0 ? '0.92' : '0.4'}
                />
                {/* Flange bolts (DIN 912 M8x35) */}
                {[
                  { cx: 160, cy: 155 },
                  { cx: 250, cy: 118 },
                  { cx: 340, cy: 155 },
                  { cx: 250, cy: 200 }
                ].map((b, i) => (
                  <circle key={i} cx={b.cx} cy={b.cy} r="3.5" fill="#f8fafc" stroke="#475569" strokeWidth="1" />
                ))}
              </g>
            </svg>
          </div>
        </div>

        {/* Viewport Bottom Controls Bar */}
        <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2 border-t border-slate-800 flex items-center justify-between text-xs">
          {/* Exploded View Slider */}
          <div className="flex items-center space-x-3 w-72">
            <Sliders className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="text-slate-400 font-medium whitespace-nowrap">Vista Explosionada:</span>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={explodedView} 
              onChange={(e) => setExplodedView(parseInt(e.target.value, 10))}
              className="w-full accent-orange-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <span className="font-mono text-orange-400 text-xs w-8 text-right">{explodedView}%</span>
          </div>

          <div className="flex items-center space-x-3 text-slate-400">
            <span>Arrastrá para rotar libremente el modelo</span>
            <span>•</span>
            <span className="text-orange-400 font-mono font-medium">Autodesk Inventor iLogic Ready</span>
          </div>
        </div>

      </div>

      {/* Right Sidebar: iProperties & CAD Metadata Panel */}
      <div className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto">
        
        {/* Panel Header */}
        <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">
              iProperties de Inventor
            </span>
          </div>
          <button
            onClick={() => setIsEditingProps(!isEditingProps)}
            className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            {isEditingProps ? 'Cancelar' : 'Editar'}
          </button>
        </div>

        {/* Properties Form */}
        <div className="p-4 space-y-4 flex-1">
          
          {/* Physical CAD Properties */}
          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-2.5">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Scale className="w-3.5 h-3.5 text-orange-400" />
                <span>Propiedades Físicas</span>
              </span>
              <span className="text-slate-500 font-mono text-[10px]">Calculadas por CAD</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900 p-2 rounded border border-slate-800/80">
                <div className="text-slate-500 text-[10px]">Masa (kg):</div>
                {isEditingProps ? (
                  <input
                    type="number"
                    step="0.01"
                    value={tempMass}
                    onChange={(e) => setTempMass(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-orange-300 font-mono mt-1"
                  />
                ) : (
                  <div className="font-mono font-bold text-slate-200 mt-0.5">{part.mass} kg</div>
                )}
              </div>

              <div className="bg-slate-900 p-2 rounded border border-slate-800/80">
                <div className="text-slate-500 text-[10px]">Volumen (cm³):</div>
                <div className="font-mono font-bold text-slate-200 mt-0.5">{part.volume} cm³</div>
              </div>
            </div>

            <div className="bg-slate-900 p-2 rounded border border-slate-800/80 text-xs">
              <div className="text-slate-500 text-[10px]">Material CAD:</div>
              {isEditingProps ? (
                <input
                  type="text"
                  value={tempMaterial}
                  onChange={(e) => setTempMaterial(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 font-mono mt-1"
                />
              ) : (
                <div className="font-medium text-slate-300 mt-0.5">{part.material}</div>
              )}
            </div>

            <div className="bg-slate-900 p-2 rounded border border-slate-800/80 text-xs">
              <div className="text-slate-500 text-[10px]">Dimensiones envolventes:</div>
              <div className="font-mono text-slate-300 mt-0.5">{part.dimensions}</div>
            </div>
          </div>

          {/* Odoo ERP Mapping iProperties */}
          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-2.5">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <FileCode className="w-3.5 h-3.5 text-orange-400" />
                <span>Mapeo con Odoo ERP</span>
              </span>
              <span className="text-emerald-400 font-mono text-[10px]">product.template</span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-slate-500 text-[10px] block">Título / Denominación:</label>
                {isEditingProps ? (
                  <input
                    type="text"
                    value={propsState.Title}
                    onChange={(e) => setPropsState({ ...propsState, Title: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 mt-0.5"
                  />
                ) : (
                  <div className="text-slate-200 font-medium">{propsState.Title}</div>
                )}
              </div>

              <div>
                <label className="text-slate-500 text-[10px] block">Empresa Fabricante:</label>
                <div className="text-slate-300">{propsState.Company}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-500 text-[10px] block">Centro de Costo:</label>
                  <div className="font-mono text-slate-300">{propsState.CostCenter}</div>
                </div>
                <div>
                  <label className="text-slate-500 text-[10px] block">Costo Estándar (USD):</label>
                  {isEditingProps ? (
                    <input
                      type="number"
                      value={propsState.StandardCost}
                      onChange={(e) => setPropsState({ ...propsState, StandardCost: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-orange-300 font-mono mt-0.5"
                    />
                  ) : (
                    <div className="font-mono text-emerald-400 font-bold">${propsState.StandardCost.toFixed(2)}</div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-slate-500 text-[10px] block">Ubicación de Stock Odoo:</label>
                <div className="font-mono text-slate-400 text-[11px]">{propsState.StockLocation}</div>
              </div>
            </div>

            {isEditingProps && (
              <button
                type="button"
                onClick={handleSaveProperties}
                className="w-full py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded flex items-center justify-center space-x-1.5 shadow"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Guardar Cambios Locales</span>
              </button>
            )}
          </div>

          {/* Sync Status Badge */}
          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Estado de sincronización:</span>
              <span className="bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded text-[11px] font-mono border border-emerald-800 flex items-center space-x-1">
                <span>●</span>
                <span>Odoo ID #{part.odooProductId}</span>
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Última actualización: <span className="font-mono text-slate-400">{part.lastSync}</span>
            </div>
          </div>

        </div>

        {/* Panel Actions Bottom */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
          <button
            onClick={onPushProperties}
            disabled={isPushing}
            className="w-full py-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-semibold text-xs rounded-md shadow flex items-center justify-center space-x-2 transition disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{isPushing ? 'Enviando a Odoo...' : 'Enviar iProperties a Odoo ERP'}</span>
          </button>

          <button
            onClick={onSyncBom}
            className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded border border-slate-700 flex items-center justify-center space-x-1.5 transition"
          >
            <Layers className="w-3.5 h-3.5 text-orange-400" />
            <span>Abrir y Sincronizar BOM ({part.bom.length} componentes)</span>
          </button>
        </div>

      </div>

    </div>
  );
};
