import React, { useState } from 'react';
import { 
  Database, 
  Search, 
  ExternalLink, 
  CheckCircle2, 
  Package, 
  DollarSign, 
  Tag, 
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { OdooProduct } from '../types';

interface OdooProductsViewProps {
  products: OdooProduct[];
  odooUrl: string;
}

export const OdooProductsView: React.FC<OdooProductsViewProps> = ({
  products,
  odooUrl
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'product' | 'consu'>('all');

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.default_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-slate-100">
                Catálogo de Productos y Componentes Odoo (product.template)
              </h2>
              <span className="text-xs bg-slate-800 font-mono text-emerald-400 px-2 py-0.5 rounded border border-slate-700">
                JSON-RPC / ORM
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Productos sincronizados desde Autodesk Inventor hacia Odoo ERP. Control de inventario, costos y listas de materiales.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <a
            href={odooUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center space-x-1.5 transition"
          >
            <span>Abrir Odoo Web</span>
            <ExternalLink className="w-3.5 h-3.5 text-orange-400" />
          </a>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por código o nombre de producto..."
              className="w-full pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-sans"
            />
          </div>

          <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2 py-0.5 rounded ${filterType === 'all' ? 'bg-orange-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('product')}
              className={`px-2 py-0.5 rounded ${filterType === 'product' ? 'bg-orange-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              Almacenables (Piezas CAD)
            </button>
            <button
              onClick={() => setFilterType('consu')}
              className={`px-2 py-0.5 rounded ${filterType === 'consu' ? 'bg-orange-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              Consumibles (Tornillería)
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Registros mostrados: <b className="text-slate-200">{filteredProducts.length}</b>
        </div>
      </div>

      {/* Products Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead className="bg-slate-900/90 sticky top-0 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 select-none">
            <tr>
              <th className="py-2.5 px-3 w-16 text-center">ID Odoo</th>
              <th className="py-2.5 px-3">Referencia Interna (CAD Part Number)</th>
              <th className="py-2.5 px-3">Nombre del Producto</th>
              <th className="py-2.5 px-3 w-28">Tipo Odoo</th>
              <th className="py-2.5 px-3 w-24 text-right">Precio Venta</th>
              <th className="py-2.5 px-3 w-24 text-right">Costo Estándar</th>
              <th className="py-2.5 px-3 w-24 text-right">Stock Disponible</th>
              <th className="py-2.5 px-3 w-24 text-center">Listas BOM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filteredProducts.map((p) => (
              <tr key={p.id} className="hover:bg-slate-900/80 transition-colors font-mono">
                <td className="py-2.5 px-3 text-center text-slate-500 font-bold">
                  #{p.id}
                </td>
                <td className="py-2.5 px-3 font-semibold text-orange-400">
                  {p.default_code}
                </td>
                <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                  {p.name}
                </td>
                <td className="py-2.5 px-3 font-sans">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                    p.type === 'product' 
                      ? 'bg-blue-950/80 text-blue-300 border border-blue-800' 
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    {p.type === 'product' ? 'Almacenable (Pieza)' : 'Consumible'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right text-slate-300">
                  ${p.list_price.toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                  ${p.standard_price.toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className={`font-bold ${p.qty_available < 10 ? 'text-amber-400' : 'text-slate-100'}`}>
                    {p.qty_available} {p.uom_id}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center">
                  {p.bom_count > 0 ? (
                    <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-sans">
                      {p.bom_count} BOM Activa
                    </span>
                  ) : (
                    <span className="text-slate-500 text-[10px] font-sans">Componente</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};
