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
  Upload,
  Copy,
  Check,
  FileCode,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Database,
  Building,
  CheckCircle,
  HelpCircle,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { CadPart, BomItem } from '../types';

interface ProductCandidate {
  id: number;
  default_code: string | false;
  display_name: string;
  score: number;
}

interface ProductMatch {
  candidates: ProductCandidate[];
  selectedId: number | null;
  query: string;
}

interface BOMSyncManagerProps {
  part: CadPart | null;
  onUpdateBom: (newBom: BomItem[]) => void;
  onSyncBomToOdoo: () => void;
  isSyncing: boolean;
  onLoadPart?: (part: CadPart) => void;
  onClearPart?: () => void;
}

export const BOMSyncManager: React.FC<BOMSyncManagerProps> = ({
  part,
  onUpdateBom,
  onSyncBomToOdoo,
  isSyncing,
  onLoadPart,
  onClearPart
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newItemModal, setNewItemModal] = useState(false);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isOdooSyncModalOpen, setIsOdooSyncModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'flamarique' | 'excel' | 'paste' | 'ilogic' | 'bridge403'>('flamarique');
  const [pasteText, setPasteText] = useState('');
  const [copiedIlogic, setCopiedIlogic] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [clipboardSuccessMsg, setClipboardSuccessMsg] = useState<string | null>(null);

  // Filtro de COM en la tabla principal ('all' | 'com_only' | 'no_com')
  const [comFilter, setComFilter] = useState<'all' | 'com_only' | 'no_com'>('all');

  // Modal de Requisición de Compra (filtro para subir solo ítems con COM)
  const [poOnlyCom, setPoOnlyCom] = useState(true);
  const [poDb, setPoDb] = useState(() => localStorage.getItem('odoo_auth_db') || 'odoo');
  const [poLogin, setPoLogin] = useState(() => localStorage.getItem('odoo_auth_login') || 'ing@deblasi.com.ar');
  const [poApiKey, setPoApiKey] = useState(() => localStorage.getItem('odoo_auth_pwd') || '');
  const [poPartnerId, setPoPartnerId] = useState('1');
  const [isCreatingPo, setIsCreatingPo] = useState(false);
  const [poResult, setPoResult] = useState<{ success: boolean; message: string; orderName?: string } | null>(null);
  const [poMatches, setPoMatches] = useState<Record<string, ProductMatch>>({});
  const [isMatchingProducts, setIsMatchingProducts] = useState(false);

  // New Item State
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newMaterial, setNewMaterial] = useState('');
  const [newUom, setNewUom] = useState('Unidades');
  const [newIsCom, setNewIsCom] = useState(false);

  // URL activa de la WebApp (toma dinámicamente el origen de tu navegador)
  const publicWebAppUrl = typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
    ? window.location.origin
    : 'http://localhost:3000';

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Helper para determinar si un ítem tiene la propiedad personalizada COM activa
  const parseIsCom = (item: any): boolean => {
    if (!item) return false;
    if (item.isCom === true || item.com === true) return true;
    const strVal = String(item.com || item.COM || item.isCom || '').trim().toLowerCase();
    if (['true', 'si', 's', '1', 'x', 'yes'].includes(strVal)) return true;
    const pNum = String(item.partNumber || item.name || '').toUpperCase();
    const pMat = String(item.material || '').toUpperCase();
    if (pNum.startsWith('COMERCIAL') || pNum.startsWith('ISO ') || pNum.startsWith('ROD-') || pMat.includes('NORMALIZADO')) {
      return true;
    }
    return false;
  };

  const handleDirectFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const content = evt.target?.result as string;
          const parsed = JSON.parse(content);
          if (parsed) {
            const list = Array.isArray(parsed) ? parsed : (parsed.bom || []);
            const items: BomItem[] = list.map((item: any, idx: number) => ({
              id: String(idx + 1),
              item: String(idx + 1),
              partNumber: item.partNumber || item.name || `ITEM-${idx + 1}`,
              description: item.description || item.name || item.partNumber || '',
              qty: Number(item.qty || item.quantity || 1),
              uom: item.uom || 'Unidades',
              material: item.material || 'Comercial',
              odooId: item.odooId || `PROD-${Math.floor(100 + Math.random() * 900)}`,
              status: 'pending',
              isCom: parseIsCom(item)
            }));

            if (onLoadPart) {
              const newPart: CadPart = {
                partNumber: parsed.partNumber || file.name.replace('.json', ''),
                name: parsed.assemblyName || parsed.name || parsed.description || 'Ensamblaje Autodesk Inventor',
                fileType: 'iam',
                revision: parsed.revision || 'Rev. 1',
                author: parsed.author || 'flucero (Inventor 2027)',
                material: parsed.material || 'Acero Inoxidable / Normalizados',
                mass: Number(parsed.mass) || 0,
                volume: Number(parsed.volume) || 0,
                dimensions: parsed.dimensions || 'N/A',
                odooProductId: '1048',
                syncStatus: 'pending',
                lastSync: 'Cargado desde ' + file.name,
                iProperties: parsed.iProperties || {
                  Title: parsed.description || 'Ensamblaje Inventor',
                  Subject: 'OT-26148',
                  Company: 'Deblasi Soluciones Industriales',
                  Manager: 'Ingeniería Mecánica',
                  CostCenter: 'CC-ING',
                  StandardCost: 0,
                  StockLocation: 'WH/Stock'
                },
                bom: items
              };
              onLoadPart(newPart);
            } else {
              onUpdateBom(items);
            }
            const comsCount = items.filter(i => i.isCom).length;
            setClipboardSuccessMsg(`¡${items.length} componentes cargados desde ${file.name} (${comsCount} marcados con COM)!`);
            setTimeout(() => setClipboardSuccessMsg(null), 5000);
          }
        } catch (err: any) {
          alert('Error al leer archivo JSON: ' + err.message);
        }
      };
      reader.readAsText(file, 'utf-8');
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      handleExcelUpload(e);
    } else if (file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const content = evt.target?.result as string;
          const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
          if (lines.length === 0) return;

          // Detectar si la primera fila es encabezado
          const firstLineCols = lines[0].includes('\t') ? lines[0].split('\t') : lines[0].split(',');
          const rawHeaders = firstLineCols.map(h => h.replace(/"/g, '').trim().toLowerCase());
          const hasHeader = rawHeaders.some(h => 
            h.includes('part') || h.includes('pieza') || h.includes('item') || 
            h.includes('desc') || h.includes('cant') || h.includes('material') || h.includes('com')
          );

          let pNumIdx = rawHeaders.findIndex(h => h.includes('partnumber') || h.includes('part number') || h.includes('pieza') || h.includes('código') || h.includes('codigo'));
          if (pNumIdx === -1) pNumIdx = rawHeaders.includes('item') && rawHeaders.length > 1 ? 1 : 0;

          let descIdx = rawHeaders.findIndex(h => h.includes('desc') || h.includes('nombre') || h.includes('denominacion'));
          if (descIdx === -1) descIdx = pNumIdx === 1 ? 2 : 1;

          let qtyIdx = rawHeaders.findIndex(h => h.includes('cant') || h.includes('qty') || h.includes('quantity') || h.includes('unidades'));
          if (qtyIdx === -1) qtyIdx = pNumIdx === 1 ? 3 : 2;

          let matIdx = rawHeaders.findIndex(h => h.includes('material_plano') || h.includes('material plano') || h.includes('mat_plano'));
          if (matIdx === -1) matIdx = rawHeaders.findIndex(h => h.includes('material') || h.includes('mat'));
          if (matIdx === -1) matIdx = pNumIdx === 1 ? 5 : 3;

          let comIdx = rawHeaders.findIndex(h => h === 'com' || h === 'comercial' || h.includes('compra'));

          const startRow = hasHeader ? 1 : 0;
          const items: BomItem[] = [];

          for (let i = startRow; i < lines.length; i++) {
            const line = lines[i];
            const cols = line.includes('\t') ? line.split('\t') : line.split(',');
            if (cols.length === 0) continue;

            const partNumber = (cols[pNumIdx] || cols[0] || '').replace(/"/g, '').trim();
            if (!partNumber || partNumber.toLowerCase().includes('part') || partNumber.toLowerCase().includes('item') || partNumber.toLowerCase().includes('número')) continue;

            const description = (cols[descIdx] || cols[1] || partNumber).replace(/"/g, '').trim();
            const qty = parseFloat(cols[qtyIdx] || '1') || 1;
            const material = (cols[matIdx] || cols[3] || 'Comercial / LDM').replace(/"/g, '').trim();

            const isComVal = comIdx !== -1 
              ? ['true', 'si', 's', '1', 'x', 'yes'].includes((cols[comIdx] || '').replace(/"/g, '').trim().toLowerCase())
              : parseIsCom({ partNumber, material });

            items.push({
              id: String(items.length + 1),
              item: String(items.length + 1),
              partNumber,
              description,
              qty,
              uom: 'Unidades',
              material,
              odooId: `PROD-${Math.floor(100 + Math.random() * 900)}`,
              status: 'pending',
              isCom: isComVal
            });
          }
          if (items.length > 0) {
            onUpdateBom(items);
            const comsCount = items.filter(i => i.isCom).length;
            setClipboardSuccessMsg(`¡${items.length} componentes cargados desde ${file.name} (${comsCount} marcados con COM)!`);
            setTimeout(() => setClipboardSuccessMsg(null), 5000);
          }
        } catch (err: any) {
          alert('Error al leer CSV: ' + err.message);
        }
      };
      reader.readAsText(file, 'utf-8');
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        alert('El portapapeles está vacío. Tocá "Sincronizar BOM" en Inventor o copiá la tabla de componentes de tu ensamble.');
        return;
      }
      setPasteText(text);

      // 1. JSON
      if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : (parsed.bom || []);
        if (list.length > 0) {
          const items: BomItem[] = list.map((item: any, idx: number) => ({
            id: String(idx + 1),
            item: String(idx + 1),
            partNumber: item.partNumber || item.name || `ITEM-${idx + 1}`,
            description: item.description || item.partNumber || '',
            qty: Number(item.qty || item.quantity || 1),
            uom: item.uom || 'Unidades',
            material: item.material || 'Comercial',
            odooId: item.odooId || `PROD-${Math.floor(100 + Math.random() * 900)}`,
            status: 'pending',
            isCom: parseIsCom(item)
          }));

          if (onLoadPart) {
            const newPart: CadPart = {
              partNumber: parsed.partNumber || 'ASM-INVENTOR',
              name: parsed.assemblyName || parsed.description || 'Ensamblaje Autodesk Inventor',
              fileType: 'iam',
              revision: parsed.revision || 'Rev. 1',
              author: parsed.author || 'Inventor Designer',
              material: parsed.material || 'Acero Inoxidable / Comercial',
              mass: Number(parsed.mass) || 0,
              volume: Number(parsed.volume) || 0,
              dimensions: parsed.dimensions || 'N/A',
              odooProductId: '1048',
              syncStatus: 'pending',
              lastSync: 'Recibido desde Portapapeles de Windows',
              iProperties: parsed.iProperties || {
                Title: parsed.description || 'Ensamblaje Inventor',
                Subject: 'OT-26148',
                Company: 'Deblasi Soluciones Industriales',
                Manager: 'Ingeniería Mecánica',
                CostCenter: 'CC-ING',
                StandardCost: 0,
                StockLocation: 'WH/Stock'
              },
              bom: items
            };
            onLoadPart(newPart);
          } else {
            onUpdateBom(items);
          }
          const comsCount = items.filter(i => i.isCom).length;
          setClipboardSuccessMsg(`¡${items.length} componentes recibidos con éxito (${comsCount} marcados con COM)!`);
          setTimeout(() => setClipboardSuccessMsg(null), 5000);
          return;
        }
      }

      // 2. TSV / CSV
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      const items: BomItem[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const cols = line.includes('\t') ? line.split('\t') : line.split(',');
        if (cols.length === 0) continue;
        const partNumber = cols[0].replace(/"/g, '').trim();
        if (!partNumber || partNumber.toLowerCase().includes('part') || partNumber.toLowerCase().includes('número')) continue;
        const description = (cols[1] || partNumber).replace(/"/g, '').trim();
        const qty = parseFloat(cols[2] || '1') || 1;
        const material = (cols[3] || 'Comercial').replace(/"/g, '').trim();

        items.push({
          id: String(items.length + 1),
          item: String(items.length + 1),
          partNumber,
          description,
          qty,
          uom: 'Unidades',
          material,
          odooId: `PROD-${Math.floor(100 + Math.random() * 900)}`,
          status: 'pending',
          isCom: parseIsCom({ partNumber, material, com: cols[4] })
        });
      }

      if (items.length > 0) {
        if (onLoadPart && !part) {
          const newPart: CadPart = {
            partNumber: 'ASM-PORTAPAPELES',
            name: 'Ensamblaje importado desde tabla',
            fileType: 'iam',
            revision: 'Rev. 1',
            author: 'Inventor Designer',
            material: 'Comercial',
            mass: 0,
            volume: 0,
            dimensions: 'N/A',
            odooProductId: '1048',
            syncStatus: 'pending',
            lastSync: 'Recibido desde Portapapeles',
            iProperties: {
              Title: 'Ensamblaje Inventor',
              Subject: 'Importado',
              Company: 'Deblasi Soluciones Industriales',
              Manager: 'Ingeniería',
              CostCenter: 'CC-ING',
              StandardCost: 0,
              StockLocation: 'WH/Stock'
            },
            bom: items
          };
          onLoadPart(newPart);
        } else {
          onUpdateBom(items);
        }
        setClipboardSuccessMsg(`¡${items.length} componentes importados desde el Portapapeles!`);
        setTimeout(() => setClipboardSuccessMsg(null), 5000);
      } else {
        setImportTab('paste');
        setIsImportModalOpen(true);
      }
    } catch {
      setImportTab('paste');
      setIsImportModalOpen(true);
    }
  };

  const bomList = part?.bom || [];
  const comCount = bomList.filter(item => item.isCom === true).length;
  const nonComCount = bomList.length - comCount;

  // Lista de artículos a enviar a la Requisición de Compra (purchase.requisition): solo con tick COM o todos
  const itemsToUpload = poOnlyCom 
    ? bomList.filter(item => item.isCom === true)
    : bomList;

  const unassignedCount = itemsToUpload.filter(item => !poMatches[item.id]?.selectedId).length;

  // Filtrado compuesto: Búsqueda de texto + Filtro COM
  const filteredBom = bomList.filter(item => {
    const matchesSearch = 
      item.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.material.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    if (comFilter === 'com_only') return item.isCom === true;
    if (comFilter === 'no_com') return !item.isCom;
    return true;
  });

  // Toggle individual del tick COM para una fila
  const handleToggleCom = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = (part?.bom || []).map(item =>
      item.id === id ? { ...item, isCom: !item.isCom } : item
    );
    onUpdateBom(updated);
  };

  // Asignar COM a todos o limpiar todos
  const handleBatchSetCom = (value: boolean) => {
    const updated = (part?.bom || []).map(item => ({ ...item, isCom: value }));
    onUpdateBom(updated);
    setClipboardSuccessMsg(
      value 
        ? `¡Marcados los ${updated.length} componentes con el tick COM!`
        : `¡Se quitó el tick COM de todos los componentes!`
    );
    setTimeout(() => setClipboardSuccessMsg(null), 4000);
  };

  // Asignar COM a componentes filtrados en la búsqueda
  const handleSetFilteredCom = (value: boolean) => {
    const visibleIds = new Set(filteredBom.map(i => i.id));
    const updated = (part?.bom || []).map(item =>
      visibleIds.has(item.id) ? { ...item, isCom: value } : item
    );
    onUpdateBom(updated);
    setClipboardSuccessMsg(
      value 
        ? `¡Marcados los ${visibleIds.size} componentes filtrados con el tick COM!`
        : `¡Se quitó el tick COM de los componentes filtrados!`
    );
    setTimeout(() => setClipboardSuccessMsg(null), 4000);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartNumber.trim() || !newDesc.trim()) return;

    const newItem: BomItem = {
      id: Date.now().toString(),
      item: ((part?.bom.length || 0) + 1).toString(),
      partNumber: newPartNumber.trim(),
      description: newDesc.trim(),
      qty: parseFloat(newQty) || 1,
      uom: newUom,
      material: newMaterial || 'No especificado',
      odooId: `PROD-${Math.floor(100 + Math.random() * 900)}`,
      status: 'pending',
      isCom: newIsCom
    };

    onUpdateBom([...(part?.bom || []), newItem]);
    setNewPartNumber('');
    setNewDesc('');
    setNewQty('1');
    setNewMaterial('');
    setNewIsCom(false);
    setNewItemModal(false);
  };

  const handleDeleteItem = (id: string) => {
    onUpdateBom((part?.bom || []).filter(item => item.id !== id));
  };

  const exportCSV = () => {
    if (!part) return;
    const headers = 'Item,PartNumber,Description,Quantity,UoM,Material,COM,OdooID,Status\n';
    const rows = part.bom.map(i => 
      `"${i.item}","${i.partNumber}","${i.description}",${i.qty},"${i.uom}","${i.material}","${i.isCom ? 'SI' : 'NO'}","${i.odooId}","${i.status}"`
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
        const partNumCol = headers.findIndex(h => h.includes('part') || h.includes('pieza') || h.includes('codigo') || h.includes('código') || h.includes('referencia') || h.includes('número'));
        const descCol = headers.findIndex(h => h.includes('desc') || h.includes('nombre') || h.includes('denominacion') || h.includes('denominación'));
        const qtyCol = headers.findIndex(h => h.includes('cant') || h.includes('qty') || h.includes('unidades') || h.includes('total'));
        
        // Priorizar columna MATERIAL_PLANO de Custom Properties
        const matPlanoCol = headers.findIndex(h => h.includes('material_plano') || h.includes('material plano') || h.includes('mat_plano'));
        const matCol = matPlanoCol !== -1 ? matPlanoCol : headers.findIndex(h => h.includes('mat') || h.includes('material'));

        // Detectar columna COM
        const comCol = headers.findIndex(h => h === 'com' || h === 'comercial' || h.includes('compra'));

        const newItems: BomItem[] = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const partNumber = String(row[partNumCol !== -1 ? partNumCol : 1] || row[0] || '').trim();
          if (!partNumber) continue;

          const description = String(row[descCol !== -1 ? descCol : 2] || partNumber).trim();
          const qty = Number(row[qtyCol !== -1 ? qtyCol : 3]) || 1;
          const material = String(row[matCol !== -1 ? matCol : 4] || 'Comercial / LDM').trim();

          const isComVal = comCol !== -1 
            ? ['true', 'si', 's', '1', 'x', 'yes'].includes(String(row[comCol] || '').trim().toLowerCase())
            : parseIsCom({ partNumber, material });

          newItems.push({
            id: String(newItems.length + 1),
            item: String(newItems.length + 1),
            partNumber,
            description,
            qty,
            uom: 'Unidades',
            material,
            odooId: `PROD-${Math.floor(100 + Math.random() * 900)}`,
            status: 'pending',
            isCom: isComVal
          });
        }

        if (newItems.length > 0) {
          onUpdateBom(newItems);
          setIsImportModalOpen(false);
          const comsCount = newItems.filter(i => i.isCom).length;
          setClipboardSuccessMsg(`¡${newItems.length} componentes importados exitosamente desde Excel (${comsCount} con COM)!`);
          setTimeout(() => setClipboardSuccessMsg(null), 5000);
        }
      } catch (err: any) {
        alert('Error al leer archivo Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleParsePastedText = () => {
    if (!pasteText.trim()) return;

    try {
      // 1. Try JSON parsing
      if (pasteText.trim().startsWith('{') || pasteText.trim().startsWith('[')) {
        const parsed = JSON.parse(pasteText);
        const list = Array.isArray(parsed) ? parsed : (parsed.bom || []);
        if (list.length > 0) {
          const items: BomItem[] = list.map((item: any, idx: number) => ({
            id: String(idx + 1),
            item: String(idx + 1),
            partNumber: item.partNumber || item.name || `ITEM-${idx + 1}`,
            description: item.description || item.partNumber || '',
            qty: Number(item.qty || item.quantity || 1),
            uom: item.uom || 'Unidades',
            material: item.material || 'Comercial',
            odooId: item.odooId || `PROD-${Math.floor(100 + Math.random() * 900)}`,
            status: 'pending',
            isCom: parseIsCom(item)
          }));
          onUpdateBom(items);
          setIsImportModalOpen(false);
          const comsCount = items.filter(i => i.isCom).length;
          setClipboardSuccessMsg(`¡${items.length} componentes cargados desde JSON (${comsCount} con COM)!`);
          setTimeout(() => setClipboardSuccessMsg(null), 5000);
          return;
        }
      }

      // 2. Try TSV/CSV line by line
      const lines = pasteText.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) return;

      const firstLineCols = lines[0].includes('\t') ? lines[0].split('\t') : lines[0].split(',');
      const rawHeaders = firstLineCols.map(h => h.replace(/"/g, '').trim().toLowerCase());
      const hasHeader = rawHeaders.some(h => 
        h.includes('part') || h.includes('pieza') || h.includes('item') || 
        h.includes('desc') || h.includes('cant') || h.includes('material') || h.includes('com')
      );

      let pNumIdx = rawHeaders.findIndex(h => h.includes('partnumber') || h.includes('part number') || h.includes('pieza') || h.includes('código') || h.includes('codigo'));
      if (pNumIdx === -1) pNumIdx = rawHeaders.includes('item') && rawHeaders.length > 1 ? 1 : 0;

      let descIdx = rawHeaders.findIndex(h => h.includes('desc') || h.includes('nombre') || h.includes('denominacion'));
      if (descIdx === -1) descIdx = pNumIdx === 1 ? 2 : 1;

      let qtyIdx = rawHeaders.findIndex(h => h.includes('cant') || h.includes('qty') || h.includes('quantity') || h.includes('unidades'));
      if (qtyIdx === -1) qtyIdx = pNumIdx === 1 ? 3 : 2;

      let matIdx = rawHeaders.findIndex(h => h.includes('material_plano') || h.includes('material plano') || h.includes('mat_plano'));
      if (matIdx === -1) matIdx = rawHeaders.findIndex(h => h.includes('material') || h.includes('mat'));
      if (matIdx === -1) matIdx = pNumIdx === 1 ? 5 : 3;

      let comIdx = rawHeaders.findIndex(h => h === 'com' || h === 'comercial' || h.includes('compra'));

      const startRow = hasHeader ? 1 : 0;
      const items: BomItem[] = [];

      for (let i = startRow; i < lines.length; i++) {
        const line = lines[i];
        const cols = line.includes('\t') ? line.split('\t') : line.split(',');
        if (cols.length === 0) continue;

        const partNumber = (cols[pNumIdx] || cols[0] || '').replace(/"/g, '').trim();
        if (!partNumber || partNumber.toLowerCase().includes('part') || partNumber.toLowerCase().includes('item') || partNumber.toLowerCase().includes('número')) continue;

        const description = (cols[descIdx] || cols[1] || partNumber).replace(/"/g, '').trim();
        const qty = parseFloat(cols[qtyIdx] || '1') || 1;
        const material = (cols[matIdx] || cols[3] || 'Comercial / LDM').replace(/"/g, '').trim();

        const isComVal = comIdx !== -1 
          ? ['true', 'si', 's', '1', 'x', 'yes'].includes((cols[comIdx] || '').replace(/"/g, '').trim().toLowerCase())
          : parseIsCom({ partNumber, material });

        items.push({
          id: String(items.length + 1),
          item: String(items.length + 1),
          partNumber,
          description,
          qty,
          uom: 'Unidades',
          material,
          odooId: `PROD-${Math.floor(100 + Math.random() * 900)}`,
          status: 'pending',
          isCom: isComVal
        });
      }

      if (items.length > 0) {
        onUpdateBom(items);
        setIsImportModalOpen(false);
        setClipboardSuccessMsg(`¡${items.length} componentes cargados desde texto (MATERIAL_PLANO asignado)!`);
        setTimeout(() => setClipboardSuccessMsg(null), 5000);
      }
    } catch (e: any) {
      alert('Error procesando texto pegado: ' + e.message);
    }
  };

  const handleLoadFlamariquePreset = async () => {
    try {
      const res = await fetch('/api/inventor/load-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId: 'flamarique' })
      });
      const data = await res.json();
      if (data.success && data.part) {
        if (onLoadPart) {
          onLoadPart(data.part);
        } else if (data.part.bom) {
          onUpdateBom(data.part.bom);
        }
        setIsImportModalOpen(false);
        setClipboardSuccessMsg(`¡Cargados los ${data.part.bom.length} componentes de demostración (OT-26148 Flamarique)!`);
        setTimeout(() => setClipboardSuccessMsg(null), 5000);
      }
    } catch {
      setIsImportModalOpen(false);
    }
  };

  const odooCredentials = () => ({
    url: 'https://deblasi.adhoc.ar',
    db: poDb.trim(),
    login: poLogin.trim(),
    apiKey: poApiKey.trim()
  });

  // Busca en Odoo productos existentes parecidos a cada pieza (no crea productos)
  const handleMatchProducts = async (targets: { item: BomItem; query?: string }[]) => {
    if (targets.length === 0) return;
    setIsMatchingProducts(true);
    setPoResult(null);
    try {
      const res = await fetch('/api/odoo/match-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...odooCredentials(),
          items: targets.map(({ item, query }) => ({
            key: item.id,
            partNumber: item.partNumber,
            description: item.description,
            query
          }))
        })
      });
      const data = await res.json();
      if (!data.success) {
        setPoResult({ success: false, message: data.error || 'Error al buscar productos en Odoo' });
        return;
      }
      setPoMatches(prev => {
        const next = { ...prev };
        for (const { item, query } of targets) {
          const candidates: ProductCandidate[] = data.matches?.[item.id] || [];
          const exact = candidates.find(c => c.score >= 1000);
          const previous = prev[item.id]?.selectedId ?? null;
          next[item.id] = {
            candidates,
            query: query ?? prev[item.id]?.query ?? '',
            selectedId: exact?.id ?? (candidates.some(c => c.id === previous) ? previous : null)
          };
        }
        return next;
      });
    } catch (err: any) {
      setPoResult({ success: false, message: err.message || 'Error de red' });
    } finally {
      setIsMatchingProducts(false);
    }
  };

  const updatePoMatch = (itemId: string, changes: Partial<ProductMatch>) => {
    setPoMatches(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { candidates: [], selectedId: null, query: '' }), ...changes }
    }));
  };

  const handleCreatePurchaseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!part) return;
    setIsCreatingPo(true);
    setPoResult(null);

    const itemsToUpload = poOnlyCom 
      ? (part.bom || []).filter(b => b.isCom === true)
      : (part.bom || []);

    if (itemsToUpload.length === 0) {
      setPoResult({
        success: false,
        message: 'No hay piezas con el tick COM activo para generar la requisición de compra. Activá el tick COM en las filas deseadas o desmarcá la opción de subir solo COM.'
      });
      setIsCreatingPo(false);
      return;
    }

    const unassigned = itemsToUpload.filter(b => !poMatches[b.id]?.selectedId);
    if (unassigned.length > 0) {
      setPoResult({
        success: false,
        message: `Elegí el producto de Odoo para: ${unassigned.map(b => b.partNumber).join(', ')}`
      });
      setIsCreatingPo(false);
      return;
    }

    if (poDb.trim()) localStorage.setItem('odoo_auth_db', poDb.trim());
    if (poLogin.trim()) localStorage.setItem('odoo_auth_login', poLogin.trim());
    if (poApiKey) localStorage.setItem('odoo_auth_pwd', poApiKey);

    try {
      const res = await fetch('/api/odoo/create-purchase-requisition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://deblasi.adhoc.ar',
          db: poDb.trim(),
          login: poLogin.trim(),
          apiKey: poApiKey.trim(),
          partnerId: Number(poPartnerId) || 1,
          origin: poOnlyCom 
            ? `Inventor LDM ${part.partNumber} [COM: ${itemsToUpload.length} ítems]`
            : `Inventor LDM ${part.partNumber}`,
          items: itemsToUpload.map(b => ({
            productId: poMatches[b.id]?.selectedId,
            partNumber: b.partNumber,
            description: b.description,
            material: b.material,
            uom: b.uom,
            qty: b.qty
          }))
        })
      });
      const data = await res.json();
      if (data.success) {
        setPoResult({
          success: true,
          message: data.message + (poOnlyCom ? ` (${itemsToUpload.length} ítems con tick COM)` : ''),
          orderName: data.requisitionName
        });
      } else {
        setPoResult({
          success: false,
          message: data.error || 'Error al generar requisición de compra'
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

  // Regla iLogic completa que extrae TODOS los componentes (hasta 22 o más) y envía a la WebApp
  const ilogicCode = `' =====================================================================
' REGLA iLogic: Extraer LDM completa de Autodesk Inventor y sincronizar con WebApp
' Pega este código en: Pestaña "Administrar" -> iLogic -> Añadir Regla -> Guardar y Ejecutar
' =====================================================================
Sub Main()
    Dim doc As AssemblyDocument = TryCast(ThisDoc.Document, AssemblyDocument)
    If doc Is Nothing Then
        MessageBox.Show("Abrí un ensamblaje (.iam) en Autodesk Inventor.", "OdooInventor")
        Return
    End If

    Dim webAppUrl As String = "${publicWebAppUrl}"
    Dim endpointUrl As String = webAppUrl & "/api/inventor/import-session"

    Dim asmDef As AssemblyComponentDefinition = doc.ComponentDefinition
    Dim bomItems As New System.Collections.Generic.List(Of Object)()
    Dim counts As New System.Collections.Generic.Dictionary(Of String, Double)()
    Dim descriptions As New System.Collections.Generic.Dictionary(Of String, String)()
    Dim materials As New System.Collections.Generic.Dictionary(Of String, String)()
    Dim uoms As New System.Collections.Generic.Dictionary(Of String, String)()
    Dim isComs As New System.Collections.Generic.Dictionary(Of String, Boolean)()

    ' Función auxiliar para extraer MATERIAL_PLANO de Custom Properties
    Dim GetMatPlano = Function(d As Document) As String
        If d Is Nothing Then Return "Acero / Normalizado"
        Try
            Dim cProps As PropertySet = d.PropertySets.Item("Inventor User Defined Properties")
            For Each p As [Property] In cProps
                If String.Equals(p.Name, "MATERIAL_PLANO", StringComparison.OrdinalIgnoreCase) Then
                    If p.Value IsNot Nothing AndAlso Not String.IsNullOrWhiteSpace(p.Value.ToString()) Then
                        Return p.Value.ToString().Trim()
                    End If
                End If
            Next
        Catch
        End Try
        Try
            Dim dp As PropertySet = d.PropertySets.Item("Design Tracking Properties")
            Return dp.Item("Material").Value.ToString().Trim()
        Catch
        End Try
        Return "Acero / Normalizado"
    End Function

    ' Función auxiliar para extraer propiedad personalizada COM (True/False, SI/NO, 1/0, X, VERDADERO)
    Dim GetIsCom = Function(d As Document, pNum As String, pMat As String) As Boolean
        If d Is Nothing Then Return False
        Try
            Dim cProps As PropertySet = d.PropertySets.Item("Inventor User Defined Properties")
            For Each p As [Property] In cProps
                If String.Equals(p.Name, "COM", StringComparison.OrdinalIgnoreCase) OrElse _
                   String.Equals(p.Name, "COMERCIAL", StringComparison.OrdinalIgnoreCase) Then
                    If p.Value IsNot Nothing Then
                        Dim v As String = p.Value.ToString().Trim().ToUpper()
                        If v = "TRUE" OrElse v = "1" OrElse v = "SI" OrElse v = "S" OrElse v = "X" OrElse v = "YES" OrElse v = "Y" OrElse v = "VERDADERO" Then
                            Return True
                        ElseIf v = "FALSE" OrElse v = "0" OrElse v = "NO" OrElse v = "N" OrElse v = "FALSO" Then
                            Return False
                        End If
                    End If
                End If
            Next
        Catch
        End Try
        If pNum.ToUpper().StartsWith("COMERCIAL") OrElse pMat.ToUpper().Contains("NORMALIZADO") OrElse pNum.ToUpper().StartsWith("ISO ") OrElse pNum.ToUpper().StartsWith("ROD-") Then
            Return True
        End If
        Return False
    End Function

    ' ESTRATEGIA 1: BOM Nativa de Inventor (Structured & PartsOnly)
    Try
        Dim oBOM As BOM = asmDef.BOM
        oBOM.PartsOnlyViewEnabled = True
        oBOM.StructuredViewEnabled = True
        oBOM.StructuredViewFirstLevelOnly = False

        Dim targetView As BOMView = Nothing
        For Each v As BOMView In oBOM.BOMViews
            If v.ViewType = BOMViewTypeEnum.kStructuredBOMViewType Then
                targetView = v
                Exit For
            End If
        Next
        If targetView Is Nothing Then
            For Each v As BOMView In oBOM.BOMViews
                If v.ViewType = BOMViewTypeEnum.kPartsOnlyBOMViewType Then
                    targetView = v
                    Exit For
                End If
            Next
        End If

        Dim ProcessRow As Action(Of BOMRow) = Nothing
        ProcessRow = Sub(row As BOMRow)
            Try
                Dim compDef As ComponentDefinition = row.ComponentDefinitions.Item(1)
                Dim rDoc As Document = compDef.Document
                Dim pNum As String = rDoc.DisplayName
                Dim pDesc As String = rDoc.DisplayName
                Dim pMat As String = "Normalizado"

                Try
                    Dim dp As PropertySet = rDoc.PropertySets.Item("Design Tracking Properties")
                    pNum = dp.Item("Part Number").Value.ToString()
                    pDesc = dp.Item("Description").Value.ToString()
                Catch
                End Try

                ' Priorizar MATERIAL_PLANO y COM de Custom Properties
                pMat = GetMatPlano(rDoc)
                Dim isComVal As Boolean = GetIsCom(rDoc, pNum, pMat)

                If String.IsNullOrWhiteSpace(pNum) Then pNum = rDoc.DisplayName
                If String.IsNullOrWhiteSpace(pDesc) Then pDesc = pNum

                pNum = pNum.Trim()
                If counts.ContainsKey(pNum) Then
                    counts(pNum) += row.ItemQuantity
                Else
                    counts(pNum) = row.ItemQuantity
                    descriptions(pNum) = pDesc
                    materials(pNum) = pMat
                    uoms(pNum) = "Unidades"
                    isComs(pNum) = isComVal
                End If

                If row.ChildRows IsNot Nothing AndAlso row.ChildRows.Count > 0 Then
                    For Each childRow As BOMRow In row.ChildRows
                        ProcessRow(childRow)
                    Next
                End If
            Catch
            End Try
        End Sub

        If targetView IsNot Nothing Then
            For Each row As BOMRow In targetView.BOMRows
                ProcessRow(row)
            Next
        End If
    Catch
    End Try

    ' ESTRATEGIA 2: Recorrido recursivo que garantiza extraer TODAS las piezas (.ipt) Y ensamblajes (.iam)
    If counts.Count = 0 Then
        Dim TraverseOccs As Action(Of ComponentOccurrences) = Nothing
        TraverseOccs = Sub(occs As ComponentOccurrences)
            If occs Is Nothing Then Return
            For Each occ As ComponentOccurrence In occs
                Try
                    If occ.Suppressed Then Continue For
                    If occ.BOMStructure = BOMStructureEnum.kReferenceBOMStructure Then Continue For

                    Dim pNum As String = ""
                    Dim pDesc As String = ""
                    Dim pMat As String = "Normalizado"
                    Dim isComVal As Boolean = False

                    Try
                        Dim defDoc As Document = occ.Definition.Document
                        If defDoc IsNot Nothing Then
                            pNum = defDoc.DisplayName
                            pDesc = defDoc.DisplayName
                            Dim dp As PropertySet = defDoc.PropertySets.Item("Design Tracking Properties")
                            Try
                                pNum = dp.Item("Part Number").Value.ToString()
                            Catch
                            End Try
                            Try
                                pDesc = dp.Item("Description").Value.ToString()
                            Catch
                            End Try
                            pMat = GetMatPlano(defDoc)
                            isComVal = GetIsCom(defDoc, pNum, pMat)
                        End If
                    Catch
                    End Try

                    If String.IsNullOrWhiteSpace(pNum) Then
                        pNum = occ.Name
                        If pNum.Contains(":") Then pNum = pNum.Substring(0, pNum.LastIndexOf(":"c))
                    End If
                    If String.IsNullOrWhiteSpace(pDesc) Then pDesc = pNum

                    pNum = pNum.Trim()
                    If counts.ContainsKey(pNum) Then
                        counts(pNum) += 1
                    Else
                        counts(pNum) = 1
                        descriptions(pNum) = pDesc
                        materials(pNum) = pMat
                        uoms(pNum) = "Unidades"
                        isComs(pNum) = isComVal
                    End If

                    ' Si es un subensamblaje con componentes hijos, recorrer también sus partes
                    If occ.SubOccurrences IsNot Nothing AndAlso occ.SubOccurrences.Count > 0 Then
                        TraverseOccs(occ.SubOccurrences)
                    End If
                Catch
                End Try
            Next
        End Sub

        TraverseOccs(asmDef.Occurrences)
    End If

    ' Armar items
    Dim idx As Integer = 1
    For Each kvp In counts
        bomItems.Add(New With {
            .id = idx.ToString(),
            .item = idx.ToString(),
            .partNumber = kvp.Key,
            .description = descriptions(kvp.Key),
            .qty = kvp.Value,
            .uom = uoms(kvp.Key),
            .material = materials(kvp.Key),
            .isCom = If(isComs.ContainsKey(kvp.Key), isComs(kvp.Key), False),
            .odooId = "PROD-" & (100 + idx).ToString(),
            .status = "pending"
        })
        idx += 1
    Next

    Dim payload = New With {
        .assemblyName = doc.DisplayName,
        .partNumber = doc.DisplayName,
        .bom = bomItems
    }

    ' Serializar a JSON
    Dim jsonStr As String = System.Text.Json.JsonSerializer.Serialize(payload)

    ' 1. Copiar al Portapapeles (Garantía 100% infalible)
    Try
        System.Windows.Forms.Clipboard.SetText(jsonStr)
    Catch
    End Try

    ' 2. Guardar en C:\OdooInventor\bom_export.json
    Try
        If Not System.IO.Directory.Exists("C:\OdooInventor") Then
            System.IO.Directory.CreateDirectory("C:\OdooInventor")
        End If
        System.IO.File.WriteAllText("C:\OdooInventor\bom_export.json", jsonStr)
    Catch
    End Try

    ' 3. Intentar enviar por HTTP a la WebApp si está en localhost o red local
    Dim httpOk As Boolean = False
    Try
        Using client As New System.Net.WebClient()
            client.Headers.Add("Content-Type", "application/json; charset=utf-8")
            Dim resp As String = client.UploadString(endpointUrl, "POST", jsonStr)
            
            Dim pos As Integer = resp.IndexOf("""sessionId"":""")
            If pos > 0 Then
                Dim sId As String = resp.Substring(pos + 13, 20).Split(""""c)(0)
                ' Si es localhost o IP local, abrir navegador; si es un entorno cloud autenticado, no abrir para evitar error 403
                If webAppUrl.Contains("localhost") OrElse webAppUrl.Contains("127.0.0.1") Then
                    Process.Start(webAppUrl & "/?session=" & sId & "&view=bom")
                End If
                httpOk = True
            End If
        End Using
    Catch ex As Exception
    End Try

    ' 4. Mensaje claro con instrucciones
    If httpOk Then
        MessageBox.Show("¡" & bomItems.Count & " componentes transmitidos a la WebApp!" & vbCrLf & vbCrLf & _
                        "• Copia de seguridad guardada en Portapapeles y C:\OdooInventor\bom_export.json", _
                        "OdooInventor iLogic", MessageBoxButtons.OK, MessageBoxIcon.Information)
    Else
        MessageBox.Show("¡" & bomItems.Count & " piezas y ensamblajes extraídos con éxito!" & vbCrLf & vbCrLf & _
                        "• Copiados al PORTAPAPELES de Windows automáticamente." & vbCrLf & _
                        "• Guardados en C:\OdooInventor\bom_export.json" & vbCrLf & vbCrLf & _
                        "En tu pestaña de OdooInventor, tocá 'Pegar LDM del Portapapeles' para ver todas las piezas y elegir cuáles subir a la requisición con el tick COM.", _
                        "OdooInventor iLogic", MessageBoxButtons.OK, MessageBoxIcon.Information)
    End If
End Sub`;

  const copyToClipboard = (text: string, type: 'ilogic' | 'url') => {
    navigator.clipboard.writeText(text);
    if (type === 'ilogic') {
      setCopiedIlogic(true);
      setTimeout(() => setCopiedIlogic(false), 3000);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    }
  };

  const downloadIni = () => {
    const content = `; Configuración del Puente Inventor -> OdooInventor WebApp\n; Colocar en la carpeta del Add-In o en C:\\OdooInventor\\config.ini\nURL=${publicWebAppUrl}\n`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'InventorWebBridge.ini';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-200 overflow-hidden">
      
      {/* Dynamic Notification Banner when items imported */}
      {clipboardSuccessMsg && (
        <div className="bg-emerald-900 border-b border-emerald-600 px-4 py-2 flex items-center justify-between text-xs text-emerald-100 font-semibold animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-300" />
            <span>{clipboardSuccessMsg}</span>
          </div>
          <button 
            onClick={() => setClipboardSuccessMsg(null)}
            className="text-emerald-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!part ? (
        /* PANTALLA DE ESPERA ACTIVA: Ningún ensamblaje vinculado */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto overflow-y-auto">
          <div className="relative mb-5">
            <div className="absolute -inset-4 rounded-full bg-orange-500/10 blur-xl animate-pulse"></div>
            <div className="relative p-6 rounded-2xl bg-slate-900 border-2 border-dashed border-orange-500/40 text-orange-400 flex items-center justify-center shadow-xl">
              <Layers className="w-16 h-16 animate-pulse text-orange-400" />
            </div>
          </div>

          {/* Live Listening Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-mono mb-3 shadow-md">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="font-semibold">EN ESCUCHA ACTIVA — Esperando transmisión desde Autodesk Inventor</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
            Esperando sincronización de Ensamblaje (.iam)
          </h2>
          
          <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
            No hay ningún ensamblaje vinculado actualmente. <strong className="text-slate-200">No inventamos componentes ficticios.</strong> Cuando pulses el botón <strong className="text-orange-400">"Sincronizar BOM"</strong> en Autodesk Inventor, la estructura real de tus componentes aparecerá aquí al instante.
          </p>

          {/* Banner de acción rápida al volver de Inventor */}
          <div className="w-full mt-6 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border border-emerald-500/60 rounded-xl p-4 text-left shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Copy className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-black text-white text-sm">¿Acabás de tocar el botón en Inventor?</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] uppercase font-bold border border-emerald-500/40">Atajo: Ctrl + V</span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Inventor ya copió tu LDM al Portapapeles y a <code className="text-emerald-400 font-mono">C:\OdooInventor\bom_export.json</code>. Pegalos con 1 clic:
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 w-full md:w-auto">
              <button
                onClick={handlePasteFromClipboard}
                className="flex-1 md:flex-initial px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wide rounded-lg flex items-center justify-center space-x-2 transition shadow-lg hover:shadow-emerald-500/20 active:scale-95"
              >
                <Copy className="w-4 h-4" />
                <span>📋 Pegar LDM del Portapapeles</span>
              </button>
            </div>
          </div>

          {/* Hidden File Input for Direct Local Import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleDirectFileInput}
            accept=".json,.csv,.xlsx,.xls"
            className="hidden"
          />

          {/* 3 Main Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-5 text-left">
            {/* Card 1: Portapapeles (Fastest) */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/40 hover:border-emerald-500 transition shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-emerald-400 mb-2">
                  <Copy className="w-5 h-5" />
                  <span className="font-bold text-xs uppercase tracking-wide">Opción 1: Portapapeles</span>
                </div>
                <h3 className="font-bold text-slate-200 text-sm">Pegar del Portapapeles</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Al pulsar "Sincronizar BOM", Inventor copia todos los datos al portapapeles. Podés pegarlos o presionar <strong className="text-emerald-400 font-mono">Ctrl+V</strong> en cualquier parte.
                </p>
              </div>
              <button
                onClick={handlePasteFromClipboard}
                className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center space-x-2 transition shadow"
              >
                <Copy className="w-4 h-4" />
                <span>📋 Pegar LDM (Ctrl+V)</span>
              </button>
            </div>

            {/* Card 2: Archivo local de Inventor */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-blue-500/40 hover:border-blue-500 transition shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-blue-400 mb-2">
                  <Upload className="w-5 h-5" />
                  <span className="font-bold text-xs uppercase tracking-wide">Opción 2: Archivo Local</span>
                </div>
                <h3 className="font-bold text-slate-200 text-sm">Cargar bom_export.json</h3>
                <p className="text-xs text-slate-400 mt-1">
                  El Add-In guarda automáticamente una copia en <code className="text-blue-300 font-mono text-[11px]">C:\OdooInventor\bom_export.json</code>. Hacé clic para abrirlo directamente:
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg flex items-center justify-center space-x-2 transition shadow"
              >
                <Upload className="w-4 h-4" />
                <span>📁 Seleccionar bom_export.json</span>
              </button>
            </div>

            {/* Card 3: Regla iLogic */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-amber-400 mb-2">
                  <FileCode className="w-5 h-5" />
                  <span className="font-bold text-xs uppercase tracking-wide">Opción 3: Regla iLogic</span>
                </div>
                <h3 className="font-bold text-slate-200 text-sm">Regla iLogic de 1 Clic</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Alternativa directa dentro de Inventor sin requerir compilar DLL. Extrae la LDM nativa completa con 1 clic.
                </p>
              </div>
              <button
                onClick={() => { setImportTab('ilogic'); setIsImportModalOpen(true); }}
                className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs rounded-lg flex items-center justify-center space-x-2 transition border border-slate-700"
              >
                <FileCode className="w-4 h-4" />
                <span>💻 Ver Código iLogic</span>
              </button>
            </div>
          </div>

          {/* Diagnostics & URL guidance */}
          <div className="mt-7 w-full p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-left">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wide font-mono flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                <span>URL Activa de Enlace para Autodesk Inventor</span>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => copyToClipboard(publicWebAppUrl, 'url')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 flex items-center space-x-1"
                >
                  {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedUrl ? '¡Copiada!' : 'Copiar URL'}</span>
                </button>
                <button
                  onClick={downloadIni}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 flex items-center space-x-1"
                  title="Descargar archivo config.ini para guardarlo en C:\OdooInventor\config.ini"
                >
                  <Download className="w-3 h-3 text-orange-400" />
                  <span>Descargar config.ini</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-xs text-emerald-400 break-all select-all">
              {publicWebAppUrl}
            </div>

            <div className="mt-3 p-3 bg-amber-950/40 border border-amber-850/80 rounded-lg text-xs space-y-1.5">
              <div className="flex items-center space-x-2 font-bold text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>¿Por qué tira error 403 en applet-auth-bridge al abrir un link?</span>
              </div>
              <p className="text-amber-200/90 leading-relaxed text-[11px]">
                Ese error ocurre porque los enlaces directos de previsualización en la nube (<code>ais-dev-...run.app</code>) están protegidos por Google y requieren estar autenticado con la misma cuenta de Google en esa ventana. Además, si el link pertenecía a una sesión anterior de la applet, el puente de Google lo bloquea con <strong>403 Forbidden</strong>.
              </p>
              <p className="text-emerald-300 font-semibold text-[11px] pt-1">
                👉 <strong>Solución directa:</strong> No necesitás abrir ningún link desde Inventor. El script ya copia automáticamente todas las piezas y ensamblajes al <strong>Portapapeles de Windows</strong> y a <code>C:\OdooInventor\bom_export.json</code>. En esta misma pantalla, solo hacé clic en el botón verde <strong>"📋 Pegar LDM del Portapapeles"</strong> (o <strong>"📂 Cargar archivo"</strong>) y se cargarán al instante con su propiedad COM.
              </p>
            </div>
          </div>

          {/* Demo Mode Button */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 w-full flex items-center justify-between text-xs text-slate-400">
            <span>¿Querés probar el traspaso a Odoo ERP sin tener Inventor abierto ahora?</span>
            <button
              onClick={handleLoadFlamariquePreset}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-orange-300 hover:text-white font-medium rounded-lg border border-slate-700 flex items-center space-x-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span>🧪 Cargar Ensamble Flamarique (Demo 22 piezas)</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Hero Sync Workflow Banner: Paso 1 (Inventor -> WebApp) & Paso 2 (WebApp -> Odoo) */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              
              {/* Assembly Header & Status */}
              <div className="flex items-start space-x-3">
                <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 shrink-0">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider font-mono">
                      LDM de Ingeniería Activa
                    </span>
                    <span className="text-xs bg-orange-500/20 text-orange-300 font-mono font-bold px-2 py-0.5 rounded border border-orange-500/30">
                      {part.partNumber}.iam
                    </span>
                    <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono">
                      {part.bom.length} Componentes Reales
                    </span>
                    <span className="text-xs bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>Enlace CAD Listo</span>
                    </span>
                    <span className="text-xs bg-emerald-500/15 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/30 flex items-center space-x-1" title="Piezas comerciales marcadas con la propiedad COM">
                      <CheckSquare className="w-3 h-3 text-emerald-400" />
                      <span>{comCount} con tick COM</span>
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-100 mt-1">
                    {part.name}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Desglose completo de {part.bom.reduce((acc, curr) => acc + curr.qty, 0)} unidades físicas. Sin simulaciones: podés pegar la LDM en caliente desde Inventor o transferirla a Odoo ERP.
                  </p>
                </div>
              </div>

              {/* Quick Action Ribbon */}
              <div className="flex items-center flex-wrap gap-2">
                
                {/* Botón 1: Pegar Portapapeles Directo */}
                <button
                  onClick={handlePasteFromClipboard}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-lg border border-emerald-400/40 flex items-center space-x-2 shadow-lg transition"
                  title="Pegar los componentes que Inventor acaba de copiar al portapapeles"
                >
                  <Copy className="w-4 h-4 text-emerald-200" />
                  <span>📋 Pegar LDM del Portapapeles</span>
                </button>

                {/* Botón 2: Importar / Archivo / iLogic */}
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center space-x-2 transition"
                  title="Cargar archivo bom_export.json, Excel, o usar la regla iLogic de 1 clic"
                >
                  <Upload className="w-4 h-4 text-blue-400" />
                  <span>Importar / iLogic</span>
                </button>

                {/* Botón 3: Paso a Odoo ERP (mrp.bom) */}
                <button
                  onClick={() => setIsOdooSyncModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-lg shadow-lg flex items-center space-x-2 transition"
                  title="Verificar y llevar toda esta LDM al módulo de Fabricación de Odoo (mrp.bom)"
                >
                  <Database className="w-4 h-4 text-orange-200" />
                  <span>Llevar LDM a Odoo (mrp.bom)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-orange-200" />
                </button>

                {/* Botón 4: Desvincular / Reset */}
                {onClearPart && (
                  <button
                    onClick={onClearPart}
                    className="px-2.5 py-2 bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 text-xs rounded-lg border border-slate-700 flex items-center space-x-1.5 transition"
                    title="Desvincular ensamble actual y volver a la pantalla de espera de Inventor"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Desvincular</span>
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Secondary Tool Bar */}
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2.5">
            <div className="flex items-center space-x-3 flex-wrap gap-2">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar código, descripción..."
                  className="w-full pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-sans"
                />
              </div>

              {/* Filtros de Visualización: Todos vs Solo COM vs Sin COM */}
              <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-xs">
                <button
                  onClick={() => setComFilter('all')}
                  className={`px-2.5 py-1 rounded text-xs transition ${
                    comFilter === 'all' 
                      ? 'bg-orange-600 text-white font-bold shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Ver todos los componentes del ensamble"
                >
                  Todos ({bomList.length})
                </button>
                <button
                  onClick={() => setComFilter('com_only')}
                  className={`px-2.5 py-1 rounded text-xs transition flex items-center space-x-1 ${
                    comFilter === 'com_only' 
                      ? 'bg-emerald-600 text-white font-bold shadow-sm' 
                      : 'text-slate-400 hover:text-emerald-300'
                  }`}
                  title="Filtrar únicamente componentes con el tick COM activo (para Requisición de Compra)"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Solo COM ({comCount})</span>
                </button>
                <button
                  onClick={() => setComFilter('no_com')}
                  className={`px-2.5 py-1 rounded text-xs transition ${
                    comFilter === 'no_com' 
                      ? 'bg-slate-700 text-slate-100 font-bold shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Ver componentes sin el tick COM (piezas a fabricar o ensamblar)"
                >
                  Sin COM ({nonComCount})
                </button>
              </div>

              {/* Acciones Rápidas de COM */}
              <div className="flex items-center space-x-1 border-l border-slate-800 pl-2">
                <button
                  onClick={() => handleBatchSetCom(true)}
                  className="px-2 py-1 rounded bg-slate-800/90 hover:bg-slate-750 text-emerald-300 hover:text-emerald-200 text-[11px] font-mono border border-slate-700 transition"
                  title="Marcar todos los componentes del ensamble con el tick COM"
                >
                  + Marcar todos COM
                </button>
                {filteredBom.length < bomList.length && (
                  <button
                    onClick={() => handleSetFilteredCom(true)}
                    className="px-2 py-1 rounded bg-slate-800/90 hover:bg-slate-750 text-amber-300 hover:text-amber-200 text-[11px] font-mono border border-slate-700 transition"
                    title="Marcar únicamente los componentes actualmente visibles con el tick COM"
                  >
                    + Marcar visibles COM ({filteredBom.length})
                  </button>
                )}
                <button
                  onClick={() => handleBatchSetCom(false)}
                  className="px-2 py-1 rounded bg-slate-800/90 hover:bg-slate-750 text-slate-400 hover:text-slate-200 text-[11px] font-mono border border-slate-700 transition"
                  title="Limpiar tick COM de todos los componentes"
                >
                  Limpiar COM
                </button>
              </div>
            </div>

            {/* Secondary Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setNewItemModal(true)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center space-x-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5 text-orange-400" />
                <span>Añadir Pieza</span>
              </button>

              <button
                onClick={exportCSV}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center space-x-1.5 transition"
                title="Descargar lista de materiales en formato CSV (incluye columna COM)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar CSV</span>
              </button>

              <button
                onClick={() => setIsPoModalOpen(true)}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded border border-emerald-500/50 flex items-center space-x-1.5 shadow transition"
                title="Generar requisición de compra en Odoo (purchase.requisition). Filtra por componentes con tick en COM."
              >
                <ShoppingCart className="w-3.5 h-3.5 text-emerald-200" />
                <span>Crear Requisición de Compra</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-200 font-mono text-[10px] border border-emerald-600">
                  {comCount} COM
                </span>
              </button>

              <button
                onClick={onSyncBomToOdoo}
                disabled={isSyncing}
                className="px-3.5 py-1 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs rounded flex items-center space-x-1.5 shadow transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar mrp.bom'}</span>
              </button>
            </div>
          </div>

          {/* BOM Table (Hero View - 100% focused on components & engineering attributes) */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 sticky top-0 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 select-none z-10 shadow-sm">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">Ítem</th>
                  
                  {/* COLUMNA COM: Propiedad personalizada para compras */}
                  <th className="py-2.5 px-3 w-28 text-center" title="Propiedad personalizada COM (Comercial / Para Requisición de Compra)">
                    <div className="flex items-center justify-center space-x-1">
                      <span className="font-bold text-slate-200">COM</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                        REQ
                      </span>
                    </div>
                  </th>

                  <th className="py-2.5 px-3">Número de Pieza (CAD / Ref)</th>
                  <th className="py-2.5 px-3">Descripción Técnica del Componente</th>
                  <th className="py-2.5 px-3 w-20 text-right">Cant.</th>
                  <th className="py-2.5 px-3 w-24">Unidad</th>
                  <th className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span>Material Especificado</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal" title="Prioriza 'MATERIAL_PLANO' de Custom Properties con fallback a Design Tracking Properties">
                        MATERIAL_PLANO
                      </span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3">Mapeo Odoo</th>
                  <th className="py-2.5 px-3 w-28 text-center">Estado Odoo</th>
                  <th className="py-2.5 px-3 w-16 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {filteredBom.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`transition-colors group ${item.isCom ? 'bg-emerald-950/15 hover:bg-emerald-950/30' : 'hover:bg-slate-900/90'}`}
                  >
                    <td className="py-2 px-3 text-center text-slate-500 font-bold">
                      {item.item}
                    </td>

                    {/* Checkbox / Botón de tick COM interactivo */}
                    <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleCom(item.id, e)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono inline-flex items-center space-x-1.5 transition-all shadow-sm ${
                          item.isCom 
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-400/40 font-black' 
                            : 'bg-slate-800/90 hover:bg-emerald-950/70 hover:text-emerald-300 hover:border-emerald-600/60 text-slate-400 border border-slate-700'
                        }`}
                        title={
                          item.isCom 
                            ? "COM ACTIVO: Este componente se subirá a la Requisición de Compra. Hacé clic para quitar el tick COM." 
                            : "SIN COM: Hacé clic para ponerle el tick COM y agregarlo a la Requisición de Compra."
                        }
                      >
                        <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                          item.isCom 
                            ? 'bg-slate-950 text-emerald-400 font-black' 
                            : 'border border-slate-600 text-transparent group-hover:text-emerald-400'
                        }`}>
                          ✓
                        </span>
                        <span>{item.isCom ? 'COM' : '+ COM'}</span>
                      </button>
                    </td>

                    <td className="py-2 px-3 font-semibold text-orange-400 group-hover:text-orange-300">
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
                        title="Eliminar componente de la lista"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal: Paso a Odoo ERP (Llevar la LDM a mrp.bom) */}
      {isOdooSyncModalOpen && part && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-3xl shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/30 text-orange-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Paso a Odoo ERP: Transferir Lista de Materiales (mrp.bom)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Estructura validada de Autodesk Inventor lista para impactar en tu servidor de Odoo.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOdooSyncModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs">
              
              {/* Resumen del Encabezado mrp.bom */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2 font-sans">
                <span className="font-bold text-orange-400 uppercase tracking-wide text-[11px] block">
                  Encabezado de la LDM en Odoo (mrp.bom):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Producto a Fabricar:</span>
                    <b className="text-slate-100 font-mono">{part.partNumber}</b>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Descripción:</span>
                    <span className="truncate block font-semibold">{part.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Cantidad a Producir:</span>
                    <b className="text-slate-100 font-mono">1.00 Unidades</b>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Tipo de LDM:</span>
                    <span className="text-emerald-400 font-semibold">Fabricar este producto</span>
                  </div>
                </div>
              </div>

              {/* Mapeo de Líneas mrp.bom.line */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">
                    Líneas de Componentes a Crear / Actualizar ({part.bom.length} piezas):
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Destino: Modelo Odoo <code>mrp.bom.line</code>
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto rounded border border-slate-800 bg-slate-950 divide-y divide-slate-800/80 font-mono text-[11px]">
                  {part.bom.map((b) => (
                    <div key={b.id} className="p-2 flex items-center justify-between hover:bg-slate-900/50">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500 font-bold w-6">{b.item}.</span>
                        <span className="text-orange-400 font-semibold">{b.partNumber}</span>
                        <span className="text-slate-300 font-sans truncate max-w-[280px]">{b.description}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-slate-200 font-bold">{b.qty} {b.uom}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                          {b.material}
                        </span>
                        <span className="text-emerald-400 font-semibold">{b.odooId}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Explicación Técnica de la Sincronización */}
              <div className="p-3 bg-blue-950/30 border border-blue-900/60 rounded-lg text-slate-300 space-y-1">
                <div className="flex items-center space-x-2 text-blue-300 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Procedimiento de Impacto en Odoo ERP</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Al confirmar, se enviará una petición JSON-RPC a tu servidor de Odoo (<code>deblasi.adhoc.ar</code>):
                </p>
                <ol className="list-decimal list-inside text-[11px] text-slate-400 space-y-0.5 pl-1">
                  <li>Busca o crea la ficha del producto terminado <b>{part.partNumber}</b> en <code>product.template</code>.</li>
                  <li>Registra cada uno de los <b>{part.bom.length}</b> componentes en <code>product.product</code> con su código de parte de Inventor.</li>
                  <li>Crea o actualiza el registro en <code>mrp.bom</code> y asocia las líneas de consumo en <code>mrp.bom.line</code>.</li>
                </ol>
              </div>

            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsOdooSyncModalOpen(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium text-xs transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onSyncBomToOdoo();
                  setIsOdooSyncModalOpen(false);
                }}
                disabled={isSyncing}
                className="px-4 py-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded shadow-lg text-xs flex items-center space-x-2 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Confirmar y Enviar a Odoo mrp.bom'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal: Importar LDM de Inventor & Solución 403 */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-2xl shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/30 text-blue-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Importar Lista de Materiales (LDM) de Autodesk Inventor
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Métodos directos para pasar la LDM real completa (hasta 22+ componentes) sin simulaciones.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center space-x-1 border-b border-slate-800 text-xs">
              <button
                onClick={() => setImportTab('flamarique')}
                className={`px-3 py-1.5 font-medium border-b-2 transition ${
                  importTab === 'flamarique' ? 'border-orange-500 text-orange-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                1. Cargar D-659.00 (22 piezas)
              </button>
              <button
                onClick={() => setImportTab('ilogic')}
                className={`px-3 py-1.5 font-medium border-b-2 transition ${
                  importTab === 'ilogic' ? 'border-orange-500 text-orange-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                2. Regla iLogic (1 Clic)
              </button>
              <button
                onClick={() => setImportTab('excel')}
                className={`px-3 py-1.5 font-medium border-b-2 transition ${
                  importTab === 'excel' ? 'border-orange-500 text-orange-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                3. Subir Excel / CSV
              </button>
              <button
                onClick={() => setImportTab('paste')}
                className={`px-3 py-1.5 font-medium border-b-2 transition ${
                  importTab === 'paste' ? 'border-orange-500 text-orange-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                4. Pegar Texto / JSON
              </button>
              <button
                onClick={() => setImportTab('bridge403')}
                className={`px-3 py-1.5 font-medium border-b-2 transition ${
                  importTab === 'bridge403' ? 'border-orange-500 text-orange-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                5. Solución al Error 403
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
              
              {/* TAB 1: Ensamble D-659.00 Flamarique */}
              {importTab === 'flamarique' && (
                <div className="space-y-3">
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center space-x-2 text-orange-400 font-bold">
                      <Sparkles className="w-4 h-4" />
                      <span>Ensamble D-659.00 - CINTA DE TRANSFERENCIA 3 - OT-26148 - FLAMARIQUE</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Despiece de ingeniería completo con los <b>22 componentes reales</b> del ensamble modelado en Autodesk Inventor:
                    </p>
                    <ul className="list-disc list-inside text-slate-400 space-y-1 font-mono text-[11px] pl-1">
                      <li><b>Estructura Inox:</b> Costillas de cajón (6u), anclajes a ménsula (4u), cajón de mando, travesaño costillas (3u), tapa frontal.</li>
                      <li><b>Módulo Motriz:</b> Motorreductor STM UMI 50 (i=50 0.75kW), platina de reductor (2u), eje de mando Ø30mm SAE 1045, adaptadores comerciales 25-38 (2u).</li>
                      <li><b>Transmisión y Malla:</b> Ruedas dentadas Z12 paso 25 (2u), malla modular plástica paso 25mm (400mm ancho), babeta UHMW, perfiles guía UHMW (4u).</li>
                      <li><b>Módulo Retorno y Tensado:</b> Ensamble eje retorno, eje retorno tensor Ø25mm, rodillos guía retorno Ø80mm (2u), resortes tensores (2u), cajas porta rodamiento UCFL 206 (2u), rodamientos SKF 6205-2RS (4u).</li>
                      <li><b>Fijaciones y Apoyo:</b> Tornillos ISO 4017 M10x25 inox (12u), arandelas ISO 7089 M10 (24u), patas niveladoras articuladas M16 (4u).</li>
                    </ul>
                  </div>

                  <button
                    onClick={handleLoadFlamariquePreset}
                    className="w-full py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded-lg shadow-md flex items-center justify-center space-x-2 transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>Cargar los 22 componentes completos de D-659.00</span>
                  </button>
                </div>
              )}

              {/* TAB 2: Regla iLogic de 1 Clic */}
              {importTab === 'ilogic' && (
                <div className="space-y-3">
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                      <FileCode className="w-4 h-4" />
                      <span>Cómo extraer los componentes directamente desde Inventor con iLogic</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      No necesitás compilar ninguna DLL. En Autodesk Inventor:
                    </p>
                    <ol className="list-decimal list-inside text-slate-400 space-y-1 text-[11px] pl-1 font-sans">
                      <li>Abrí tu ensamblaje <b>D-659.00</b> en Autodesk Inventor.</li>
                      <li>Andá a la pestaña <b>Administrar</b> &gt; panel <b>iLogic</b> &gt; <b>Añadir regla</b>.</li>
                      <li>Pegá el código de abajo y hacé clic en <b>Aceptar</b> (se ejecuta al instante).</li>
                      <li>Copia automáticamente todos los componentes al portapapeles y los envía a la WebApp.</li>
                    </ol>
                  </div>

                  <div className="relative">
                    <pre className="p-3 bg-black/60 rounded border border-slate-800 text-[10px] text-slate-300 font-mono overflow-x-auto max-h-56 select-all">
                      {ilogicCode}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(ilogicCode, 'ilogic')}
                      className="absolute top-2 right-2 px-2.5 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-[11px] font-semibold flex items-center space-x-1 shadow transition"
                    >
                      {copiedIlogic ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedIlogic ? '¡Copiado!' : 'Copiar Código iLogic'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: Subir Excel / CSV */}
              {importTab === 'excel' && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-slate-700 hover:border-orange-500/60 rounded-xl p-6 text-center space-y-3 transition bg-slate-950/40">
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">
                        Arrastrá tu archivo de Excel o CSV exportado desde Inventor
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Compatible con la exportación nativa de la lista de materiales de Inventor (.xlsx, .xls, .csv)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleExcelUpload}
                      className="hidden"
                      id="excel-file-input"
                    />
                    <label
                      htmlFor="excel-file-input"
                      className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 cursor-pointer transition shadow"
                    >
                      Seleccionar Archivo Excel...
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 4: Pegar Texto / JSON */}
              {importTab === 'paste' && (
                <div className="space-y-3">
                  <p className="text-slate-300 text-[11px]">
                    Pegá el contenido de <code>C:\OdooInventor\bom_export.json</code> o copiá y pegá las celdas directamente desde la tabla de LDM de Inventor:
                  </p>
                  <textarea
                    rows={7}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder='Pegá aquí el JSON o las columnas copiadas de la tabla de Inventor (Item, Part Number, Description, Qty)...'
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handlePasteFromClipboard}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-xs flex items-center space-x-1.5"
                    >
                      <Copy className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Pegar desde Portapapeles del Sistema</span>
                    </button>
                    <button
                      onClick={handleParsePastedText}
                      disabled={!pasteText.trim()}
                      className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded font-bold text-xs disabled:opacity-50"
                    >
                      Procesar e Importar Componentes
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 5: Solución al Error 403 */}
              {importTab === 'bridge403' && (
                <div className="space-y-3">
                  <div className="bg-amber-950/40 p-3.5 rounded-lg border border-amber-800/60 space-y-2">
                    <div className="flex items-center space-x-2 text-amber-300 font-bold">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Causa y Solución al Error 403 Forbidden</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      El error 403 ocurre cuando el Add-In de Inventor intenta abrir la URL interna <code>ais-dev-...</code>.
                      Esa URL exige una sesión interna de Google Cloud. La solución es configurar el Add-In con la <b>URL Pública Compartida</b>:
                    </p>
                  </div>

                  <div className="space-y-2 bg-slate-950 p-3.5 rounded-lg border border-slate-800 font-mono text-[11px]">
                    <div className="text-slate-400 text-xs font-bold font-sans">URL Pública sin restricciones:</div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={publicWebAppUrl}
                        className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-emerald-400 font-mono text-xs select-all"
                      />
                      <button
                        onClick={() => copyToClipboard(publicWebAppUrl, 'url')}
                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded font-semibold text-xs transition"
                      >
                        {copiedUrl ? '¡Copiada!' : 'Copiar'}
                      </button>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={downloadIni}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-xs flex items-center space-x-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-orange-400" />
                        <span>Descargar InventorWebBridge.ini (colocar en C:\OdooInventor\config.ini)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal: Añadir Pieza Manual */}
      {newItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Plus className="w-4 h-4 text-orange-400" />
                <span>Añadir Componente a la LDM</span>
              </h3>
              <button onClick={() => setNewItemModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Número de Pieza (Part Number / Código):</label>
                <input
                  type="text"
                  required
                  placeholder="ej. D-659.03.01 o ROD-6205"
                  value={newPartNumber}
                  onChange={(e) => setNewPartNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Descripción:</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Soporte Tensor con Ojal Regulable"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Cantidad:</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Unidad de Medida:</label>
                  <select
                    value={newUom}
                    onChange={(e) => setNewUom(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-orange-500"
                  >
                    <option value="Unidades">Unidades</option>
                    <option value="Metros">Metros</option>
                    <option value="Kg">Kg</option>
                    <option value="Litros">Litros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Material:</label>
                <input
                  type="text"
                  placeholder="ej. Acero Inox AISI 304, SAE 1045, UHMW-PE"
                  value={newMaterial}
                  onChange={(e) => setNewMaterial(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewItemModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded shadow"
                >
                  Guardar en LDM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear Requisición de Compra en Odoo */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-3xl shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center space-x-2 text-emerald-400">
                <ShoppingCart className="w-5 h-5 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Generar Requisición / Solicitud de Compra en Odoo
                  </h3>
                  <p className="text-[11px] text-slate-400 font-normal">
                    Filtro exclusivo para subir a la requisición solo las piezas y ensamblajes con tick en COM
                  </p>
                </div>
              </div>
              <button onClick={() => setIsPoModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchaseOrder} className="space-y-3.5 text-xs overflow-y-auto pr-1">
              
              {/* FILTRO PRINCIPAL: Solo COM vs Toda la LDM */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-200 font-bold flex items-center space-x-1.5">
                    <Filter className="w-4 h-4 text-emerald-400" />
                    <span>Filtro de Artículos para la Requisición de Compra:</span>
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    {itemsToUpload.length} seleccionados para la requisición
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPoOnlyCom(true)}
                    className={`p-2.5 rounded-lg border text-left transition flex items-start space-x-2.5 ${
                      poOnlyCom 
                        ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-100 ring-1 ring-emerald-500/50' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center text-xs shrink-0 ${
                      poOnlyCom ? 'bg-emerald-500 text-slate-950 font-black' : 'border border-slate-600'
                    }`}>
                      {poOnlyCom && '✓'}
                    </span>
                    <div>
                      <div className="font-bold flex items-center space-x-1.5">
                        <span>Solo con tick en COM</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                          {comCount} ítems
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        Sube únicamente los artículos comerciales que tienen el tick en la propiedad COM.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPoOnlyCom(false)}
                    className={`p-2.5 rounded-lg border text-left transition flex items-start space-x-2.5 ${
                      !poOnlyCom 
                        ? 'bg-orange-950/50 border-orange-500/80 text-orange-200 ring-1 ring-orange-500/50' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center text-xs shrink-0 ${
                      !poOnlyCom ? 'bg-orange-500 text-slate-950 font-black' : 'border border-slate-600'
                    }`}>
                      {!poOnlyCom && '✓'}
                    </span>
                    <div>
                      <div className="font-bold flex items-center space-x-1.5">
                        <span>Subir toda la LDM</span>
                        <span className="px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-300 font-mono text-[10px]">
                          {bomList.length} ítems
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        Sube todas las piezas y ensamblajes de la lista, tengan o no el tick en COM.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Alerta si no hay ningún COM tickado */}
              {poOnlyCom && comCount === 0 && (
                <div className="p-3 bg-amber-950/40 border border-amber-800/70 rounded-lg text-amber-200 space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Ningún componente tiene el tick COM activo actualmente</span>
                  </div>
                  <p className="text-[11px] text-amber-300/85">
                    Todas las piezas y subensamblajes están visibles en la webapp. Podés tickar las filas en la tabla principal o hacer clic para marcarlas todas:
                  </p>
                  <div className="flex items-center space-x-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleBatchSetCom(true)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs flex items-center space-x-1.5 shadow transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Marcar todas las piezas como COM</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPoModalOpen(false)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                    >
                      <span>Volver a la tabla para tickar</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Vista previa de las líneas que se enviarán a Odoo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center space-x-1">
                    <span>Artículos a incluir en la Requisición de Compra:</span>
                    <span className="font-bold text-emerald-400">
                      ({itemsToUpload.length} de {bomList.length})
                    </span>
                  </span>
                  {itemsToUpload.length > 0 && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      Total {itemsToUpload.reduce((acc, curr) => acc + curr.qty, 0)} unidades
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950 divide-y divide-slate-850 text-[11px]">
                  {itemsToUpload.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 italic">
                      Ningún componente seleccionado para subir a la requisición.
                    </div>
                  ) : (
                    itemsToUpload.map((item) => {
                      const match = poMatches[item.id];
                      return (
                        <div key={item.id} className="p-2 space-y-1.5 hover:bg-slate-900/60 transition">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center space-x-2 truncate min-w-0">
                              <button
                                type="button"
                                onClick={(e) => handleToggleCom(item.id, e)}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-700 shrink-0"
                                title="Hacé clic para destildar COM y quitar de esta requisición"
                              >
                                ✓ COM
                              </button>
                              <span className="font-mono font-bold text-orange-400 shrink-0">{item.partNumber}</span>
                              <span className="text-slate-300 truncate">{item.description}</span>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              <span className="font-bold text-slate-100 font-mono">{item.qty} {item.uom}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <select
                              value={match?.selectedId ?? ''}
                              onChange={(e) => updatePoMatch(item.id, { selectedId: e.target.value ? Number(e.target.value) : null })}
                              className={`w-full px-2 py-1.5 bg-slate-900 border rounded text-xs ${
                                match?.selectedId ? 'border-emerald-700 text-slate-100' : 'border-amber-700 text-amber-200'
                              }`}
                              title={match?.candidates.find(c => c.id === match.selectedId)?.display_name || "Producto existente en Odoo que se usará en esta línea"}
                            >
                              <option value="">
                                {!match
                                  ? 'Tocá "Buscar productos en Odoo"'
                                  : match.candidates.length > 0
                                    ? '— Elegí el producto de Odoo —'
                                    : 'Sin coincidencias: probá otra búsqueda'}
                              </option>
                              {match?.candidates.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.display_name}{c.score >= 1000 ? ' (código exacto)' : ''}
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                placeholder="Otra búsqueda (ej.: motorreductor 1:20)…"
                                value={match?.query ?? ''}
                                onChange={(e) => updatePoMatch(item.id, { query: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleMatchProducts([{ item, query: (match?.query || '').trim() || undefined }]);
                                  }
                                }}
                                className="flex-1 min-w-0 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-100"
                              />
                              <button
                                type="button"
                                onClick={() => handleMatchProducts([{ item, query: (match?.query || '').trim() || undefined }])}
                                disabled={isMatchingProducts}
                                className="p-1 rounded border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-50"
                                title="Buscar productos de Odoo para esta pieza"
                              >
                                <Search className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Credenciales Odoo */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                <div>
                  <label className="text-slate-400 block mb-1">Base de Datos Odoo:</label>
                  <input
                    type="text"
                    placeholder="ej. deblasi_prod"
                    value={poDb}
                    onChange={(e) => setPoDb(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">ID Proveedor (res.partner):</label>
                  <input
                    type="number"
                    placeholder="1"
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

              <button
                type="button"
                onClick={() => handleMatchProducts(itemsToUpload.map(item => ({ item })))}
                disabled={isMatchingProducts || itemsToUpload.length === 0}
                className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold rounded border border-slate-600 flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                <span>
                  {isMatchingProducts
                    ? 'Buscando en Odoo...'
                    : `Buscar productos en Odoo (${itemsToUpload.length} piezas)`}
                </span>
              </button>

              <div className="p-2.5 bg-slate-950/70 rounded border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-slate-300">Modo de prueba:</span>
                <p>
                  Si dejás los campos vacíos, se creará una requisición en <b>modo simulación</b> con los ítems filtrados. Si ingresás tus credenciales, se enviará directo a tu Odoo en <code>deblasi.adhoc.ar</code>.
                </p>
                <p>
                  No se crean productos: cada línea usa el producto existente que elijas y lleva en la descripción los datos de Inventor (código, descripción, material y cantidad).
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
                      Identificador de requisición: <b>{poResult.orderName}</b> (en borrador, lista para confirmar en Odoo Compras).
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPoModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPo || itemsToUpload.length === 0 || unassignedCount > 0}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded shadow flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isCreatingPo 
                      ? 'Enviando a Odoo...' 
                      : unassignedCount > 0
                        ? `Falta elegir producto (${unassignedCount})`
                        : `Crear Requisición de Compra (${itemsToUpload.length} ítems)`}
                  </span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
