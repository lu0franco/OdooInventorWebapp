import React, { useState } from 'react';
import { 
  Layers, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ExternalLink,
  Cpu,
  FileSpreadsheet,
  ShoppingCart,
  Send,
  X,
  Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { CadPart, BomItem } from '../types';

interface BOMSyncManagerProps {
  part: CadPart;
  onUpdateBom: (newBom: BomItem[]) => void;
  onSyncBomToOdoo: () => void;
  isSyncing: boolean;
}

export const BOMSyncManager: React.FC<BOMSyncManagerProps> = ({
  part,
  onUpdateBom,
  onSyncBomToOdoo,
  isSyncing
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newItemModal, setNewItemModal] = useState(false);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [poDb, setPoDb] = useState('');
  const [poLogin, setPoLogin] = useState('');
  const [poApiKey, setPoApiKey] = useState('');
  const [poPartnerId, setPoPartnerId] = useState('1');
  const [isCreatingPo, setIsCreatingPo] = useState(false);
  const [poResult, setPoResult] = useState<{ success: boolean; message: string; orderName?: string } | null>(null);
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newMaterial, setNewMaterial] = useState('');
  const [newUom, setNewUom] = useState('Unidades');

  const filteredBom = part.bom.filter(item => 
    item.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.material.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartNumber.trim() || !newDesc.trim()) return;

    const newItem: BomItem = {
      id: Date.now().toString(),
      item: (part.bom.length + 1).toString(),
      partNumber: newPartNumber.trim(),
      description: newDesc.trim(),
      qty: parseFloat(newQty) || 1,
      uom: newUom,
      material: newMaterial || 'No especificado',
      odooId: `PROD-${Math.floor(100 + Math.random() * 900)}`,
      status: 'pending'
    };

    onUpdateBom([...part.bom, newItem]);
    setNewPartNumber('');
    setNewDesc('');
    setNewQty('1');
    setNewMaterial('');
    setNewItemModal(false);
  };

  const handleDeleteItem = (id: string) => {
    onUpdateBom(part.bom.filter(item => item.id !== id));
  };

  const exportCSV = () => {
    const headers = 'Item,PartNumber,Description,Quantity,UoM,Material,OdooID,Status\n';
    const rows = part.bom.map(i => 
      `"${i.item}","${i.partNumber}","${i.description}",${i.qty},"${i.uom}","${i.material}","${i.odooId}","${i.status}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BOM_${part.partNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreatePurchaseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingPo(true);
    setPoResult(null);
    try {
      const res = await fetch('/api/odoo/create-purchase-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://deblasi.adhoc.ar',
          db: poDb.trim(),
          login: poLogin.trim(),
          apiKey: poApiKey.trim(),
          partnerId: Number(poPartnerId) || 1,
          origin: `Inventor LDM ${part.partNumber}`,
          items: part.bom.map(b => ({
            partNumber: b.partNumber,
            description: b.description,
            qty: b.qty
          }))
        })
      });
      const data = await res.json();
      if (data.success) {
        setPoResult({
          success: true,
          message: data.message,
          orderName: data.orderName
        });
      } else {
        setPoResult({
          success: false,
          message: data.error || 'Error al generar pedido de compra'
        });
      }
    } catch (err: any) {
      setPoResult({
        success: false,
        message: err.message || 'Error de red'
      });
    } finally {
      setIsCreatingPo(false);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!data || data.length <= 1) {
          alert('El archivo no contiene filas de datos.');
          return;
        }

        const headers: string[] = (data[0] || []).map((h: any) => String(h).toLowerCase());
        const partNumCol = headers.findIndex(h => h.includes('part') || h.includes('pieza') || h.includes('codigo') || h.includes('código') || h.includes('referencia'));
        const descCol = headers.findIndex(h => h.includes('desc') || h.includes('nombre') || h.includes('denominacion'));
        const qtyCol = headers.findIndex(h => h.includes('cant') || h.includes('qty') || h.includes('unidades'));
        const matCol = headers.findIndex(h => h.includes('mat') || h.includes('material'));

        const newItems: BomItem[] = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const partNumber = String(row[partNumCol !== -1 ? partNumCol : 1] || row[0] || '').trim();
          if (!partNumber) continue;

          const description = String(row[descCol !== -1 ? descCol : 2] || partNumber).trim();
          const qty = Number(row[qtyCol !== -1 ? qtyCol : 3]) || 1;
          const material = String(row[matCol !== -1 ? matCol : 4] || 'Comercial / LDM').trim();

          newItems.push({
            id: String(newItems.length + 1),
            item: String(newItems.length + 1),
            partNumber,
            description,
            qty,
            uom: 'Unidades',
            material,
            odooId: `PROD-${Math.floor(100 + Math.random() * 900)}`,
            status: 'pending'
          });
        }

        if (newItems.length > 0) {
          onUpdateBom(newItems);
        }
      } catch (err: any) {
        alert('Error al leer archivo Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-200 overflow-hidden">
      
      {/* BOM Header Bar */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-slate-100">
                Lista de Materiales de Ingeniería (BOM)
              </h2>
              <span className="text-xs bg-slate-800 font-mono text-orange-400 px-2 py-0.5 rounded border border-slate-700">
                {part.partNumber}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Estructura de componentes generada desde Autodesk Inventor para el módulo de Fabricación de Odoo (mrp.bom).
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Subir Excel de LDM MANAGER */}
          <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center space-x-1.5 cursor-pointer transition" title="Cargar archivo Excel (.xlsx / .csv) generado por LDM MANAGER">
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Importar Excel LDM</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} className="hidden" />
          </label>

          <button
            onClick={exportCSV}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center space-x-1.5 transition"
            title="Descargar lista de materiales en formato CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => setNewItemModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center space-x-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5 text-orange-400" />
            <span>Añadir Pieza</span>
          </button>

          <button
            onClick={() => setIsPoModalOpen(true)}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-semibold text-xs rounded shadow flex items-center space-x-1.5 transition"
            title="Enviar las líneas de la LDM a una orden de compra en Odoo (purchase.order & purchase.order.line)"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-emerald-200" />
            <span>Crear Pedido Compra (PO)</span>
          </button>

          <button
            onClick={onSyncBomToOdoo}
            disabled={isSyncing}
            className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-semibold text-xs rounded shadow flex items-center space-x-2 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando con Odoo...' : 'Sincronizar BOM a Odoo MRP'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between">
        <div className="relative w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código, descripción o material..."
            className="w-full pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-sans"
          />
        </div>

        <div className="flex items-center space-x-4 text-xs text-slate-400">
          <div>
            Total líneas: <b className="text-slate-200 font-mono">{part.bom.length}</b>
          </div>
          <div>
            Cantidad total componentes: <b className="text-slate-200 font-mono">
              {part.bom.reduce((acc, curr) => acc + curr.qty, 0)}
            </b>
          </div>
          <div className="flex items-center space-x-1 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Mapeo Odoo MRP Activo</span>
          </div>
        </div>
      </div>

      {/* BOM Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900/90 sticky top-0 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 select-none">
            <tr>
              <th className="py-2.5 px-3 w-14 text-center">Ítem</th>
              <th className="py-2.5 px-3">Número de Pieza (CAD)</th>
              <th className="py-2.5 px-3">Descripción de Componente</th>
              <th className="py-2.5 px-3 w-20 text-right">Cant.</th>
              <th className="py-2.5 px-3 w-24">Unidad</th>
              <th className="py-2.5 px-3">Material Especificado</th>
              <th className="py-2.5 px-3">Código Odoo</th>
              <th className="py-2.5 px-3 w-28 text-center">Estado ERP</th>
              <th className="py-2.5 px-3 w-16 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 font-mono">
            {filteredBom.map((item, index) => (
              <tr 
                key={item.id} 
                className="hover:bg-slate-900/80 transition-colors group"
              >
                <td className="py-2 px-3 text-center text-slate-500 font-bold">
                  {item.item}
                </td>
                <td className="py-2 px-3 font-semibold text-orange-400">
                  {item.partNumber}
                </td>
                <td className="py-2 px-3 font-sans text-slate-200">
                  {item.description}
                </td>
                <td className="py-2 px-3 text-right font-bold text-slate-100">
                  {item.qty}
                </td>
                <td className="py-2 px-3 font-sans text-slate-400">
                  {item.uom}
                </td>
                <td className="py-2 px-3 font-sans text-slate-300">
                  {item.material}
                </td>
                <td className="py-2 px-3 text-emerald-400 font-semibold">
                  {item.odooId}
                </td>
                <td className="py-2 px-3 text-center">
                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-sans ${
                    item.status === 'synced'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                      : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                  }`}>
                    {item.status === 'synced' ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Sincronizado</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3" />
                        <span>Pendiente</span>
                      </>
                    )}
                  </span>
                </td>
                <td className="py-2 px-3 text-center">
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition"
                    title="Eliminar línea de BOM"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Item Modal */}
      {newItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Plus className="w-4 h-4 text-orange-400" />
              <span>Añadir Componente a Lista de Materiales</span>
            </h3>

            <form onSubmit={handleAddItem} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Número de Pieza CAD:</label>
                <input
                  type="text"
                  required
                  placeholder="ej. TORN-M6X20-DIN912"
                  value={newPartNumber}
                  onChange={(e) => setNewPartNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Descripción:</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Tornillo Allen Cilíndrico M6x20"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Cantidad:</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Unidad de Medida:</label>
                  <select
                    value={newUom}
                    onChange={(e) => setNewUom(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-sans"
                  >
                    <option value="Unidades">Unidades</option>
                    <option value="Metros">Metros</option>
                    <option value="Kg">Kilogramos</option>
                    <option value="Litros">Litros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Material:</label>
                <input
                  type="text"
                  placeholder="ej. Acero Inoxidable AISI 316"
                  value={newMaterial}
                  onChange={(e) => setNewMaterial(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-sans"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewItemModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded shadow"
                >
                  Agregar a BOM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Generar Pedido de Compra en Odoo (purchase.order & purchase.order.line) */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-lg shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/30 text-emerald-400">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Generar Pedido de Compra en Odoo (purchase.order)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Inserta las {part.bom.length} líneas de la LDM directamente en <code>purchase.order.line</code>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchaseOrder} className="space-y-3 text-xs">
              
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">
                  Servidor Odoo Destino
                </div>
                <div className="font-mono text-slate-300 text-xs flex items-center justify-between">
                  <span>URL:</span>
                  <span className="text-emerald-400 font-bold">https://deblasi.adhoc.ar</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  * Endpoint JSON-RPC 2.0 validado (Odoo 18.0+e Enterprise)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Base de Datos (DB):</label>
                  <input
                    type="text"
                    placeholder="ej. deblasi_prod"
                    value={poDb}
                    onChange={(e) => setPoDb(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">ID Proveedor (partner_id):</label>
                  <input
                    type="number"
                    min="1"
                    value={poPartnerId}
                    onChange={(e) => setPoPartnerId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Usuario / Email Odoo:</label>
                  <input
                    type="text"
                    placeholder="tu_email@empresa.com"
                    value={poLogin}
                    onChange={(e) => setPoLogin(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">API Key / Contraseña:</label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••"
                    value={poApiKey}
                    onChange={(e) => setPoApiKey(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-slate-950/70 rounded border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-slate-300">Modo de prueba:</span>
                <p>
                  Si dejás los campos de credenciales vacíos, se creará un pedido de compra en <b>modo simulación</b> para que puedas probar todo el flujo inmediatamente en la interfaz. Si los completás, se enviará directo a tu base en <code>deblasi.adhoc.ar</code>.
                </p>
              </div>

              {poResult && (
                <div className={`p-3 rounded-lg border text-xs font-mono ${
                  poResult.success 
                    ? 'bg-emerald-950/80 text-emerald-200 border-emerald-800' 
                    : 'bg-rose-950/80 text-rose-200 border-rose-800'
                }`}>
                  <div className="font-bold flex items-center space-x-1.5">
                    {poResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                    <span>{poResult.message}</span>
                  </div>
                  {poResult.orderName && (
                    <div className="mt-1 text-[11px] text-slate-300">
                      Identificador de orden: <b>{poResult.orderName}</b> (Listo para confirmar en Odoo Compras).
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPoModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPo}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded shadow flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isCreatingPo ? 'Enviando a Odoo...' : 'Crear Pedido de Compra'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
