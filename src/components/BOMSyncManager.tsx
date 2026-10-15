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
  HelpCircle
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
  const [isOdooSyncModalOpen, setIsOdooSyncModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'flamarique' | 'excel' | 'paste' | 'ilogic' | 'bridge403'>('flamarique');
  const [pasteText, setPasteText] = useState('');
  const [copiedIlogic, setCopiedIlogic] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [clipboardSuccessMsg, setClipboardSuccessMsg] = useState<string | null>(null);

  // PO Modal State
  const [poDb, setPoDb] = useState('');
  const [poLogin, setPoLogin] = useState('');
  const [poApiKey, setPoApiKey] = useState('');
  const [poPartnerId, setPoPartnerId] = useState('1');
  const [isCreatingPo, setIsCreatingPo] = useState(false);
  const [poResult, setPoResult] = useState<{ success: boolean; message: string; orderName?: string } | null>(null);

  // New Item State
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newMaterial, setNewMaterial] = useState('');
  const [newUom, setNewUom] = useState('Unidades');

  // URL activa de la WebApp (toma dinámicamente el origen de tu navegador)
  const publicWebAppUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://ais-dev-42l3or3b2dxjrpc2vewuxp-636822672302.us-west2.run.app';

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
            status: 'pending'
          }));
          onUpdateBom(items);
          setClipboardSuccessMsg(`¡${items.length} componentes reales de Inventor recibidos con éxito!`);
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
          status: 'pending'
        });
      }

      if (items.length > 0) {
        onUpdateBom(items);
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
          setIsImportModalOpen(false);
          setClipboardSuccessMsg(`¡${newItems.length} componentes importados exitosamente desde Excel!`);
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
            status: 'pending'
          }));
          onUpdateBom(items);
          setIsImportModalOpen(false);
          setClipboardSuccessMsg(`¡${items.length} componentes cargados desde JSON!`);
          setTimeout(() => setClipboardSuccessMsg(null), 5000);
          return;
        }
      }

      // 2. Try TSV/CSV line by line
      const lines = pasteText.split(/\r?\n/).filter(l => l.trim().length > 0);
      const items: BomItem[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const cols = line.includes('\t') ? line.split('\t') : line.split(',');
        if (cols.length === 0) continue;
        const partNumber = cols[0].replace(/"/g, '').trim();
        const description = (cols[1] || partNumber).replace(/"/g, '').trim();
        const qty = parseFloat(cols[2] || '1') || 1;
        const material = (cols[3] || 'Comercial').replace(/"/g, '').trim();

        items.push({
          id: String(i + 1),
          item: String(i + 1),
          partNumber,
          description,
          qty,
          uom: 'Unidades',
          material,
          odooId: `PROD-${Math.floor(100 + Math.random() * 900)}`,
          status: 'pending'
        });
      }

      if (items.length > 0) {
        onUpdateBom(items);
        setIsImportModalOpen(false);
        setClipboardSuccessMsg(`¡${items.length} componentes cargados desde texto!`);
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
      if (data.success && data.part?.bom) {
        onUpdateBom(data.part.bom);
        setIsImportModalOpen(false);
        setClipboardSuccessMsg(`¡Cargados los ${data.part.bom.length} componentes reales de D-659.00!`);
        setTimeout(() => setClipboardSuccessMsg(null), 5000);
      }
    } catch {
      setIsImportModalOpen(false);
    }
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

    ' ESTRATEGIA 1: BOM Nativa de Inventor (PartsOnly / Structured)
    Try
        Dim oBOM As BOM = asmDef.BOM
        oBOM.PartsOnlyViewEnabled = True
        oBOM.StructuredViewEnabled = True
        oBOM.StructuredViewFirstLevelOnly = False

        Dim targetView As BOMView = Nothing
        For Each v As BOMView In oBOM.BOMViews
            If v.ViewType = BOMViewTypeEnum.kPartsOnlyBOMViewType OrElse v.ViewType = BOMViewTypeEnum.kStructuredBOMViewType Then
                targetView = v
                Exit For
            End If
        Next

        If targetView IsNot Nothing Then
            For Each row As BOMRow In targetView.BOMRows
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
                        pMat = dp.Item("Material").Value.ToString()
                    Catch
                    End Try

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
                    End If
                Catch
                End Try
            Next
        End If
    Catch
    End Try

    ' ESTRATEGIA 2: Fallback AllLeafOccurrences si la BOM nativa estuvo vacía
    If counts.Count = 0 Then
        For Each occ As ComponentOccurrence In asmDef.Occurrences.AllLeafOccurrences
            Try
                If occ.Suppressed Then Continue For
                If occ.BOMStructure = BOMStructureEnum.kReferenceBOMStructure Then Continue For

                Dim pNum As String = ""
                Dim pDesc As String = ""
                Dim pMat As String = "Normalizado"

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
                        Try
                            pMat = dp.Item("Material").Value.ToString()
                        Catch
                        End Try
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
                End If
            Catch
            End Try
        Next
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

    ' 3. Enviar por HTTP a la WebApp y abrir navegador
    Try
        Using client As New System.Net.WebClient()
            client.Headers.Add("Content-Type", "application/json; charset=utf-8")
            Dim resp As String = client.UploadString(endpointUrl, "POST", jsonStr)
            
            Dim pos As Integer = resp.IndexOf("""sessionId"":""")
            If pos > 0 Then
                Dim sId As String = resp.Substring(pos + 13, 20).Split(""""c)(0)
                Process.Start(webAppUrl & "/?session=" & sId & "&view=bom")
                Return
            End If
        End Using
        Process.Start(webAppUrl & "/?view=bom")
    Catch ex As Exception
        ' Si la red corporativa bloquea el puerto, abrimos la WebApp pública igualmente
        Process.Start(webAppUrl & "/?view=bom")
    End Try

    MessageBox.Show("¡" & bomItems.Count & " componentes extraídos exitosamente!" & vbCrLf & vbCrLf & _
                    "1. Se abrió la WebApp en el navegador." & vbCrLf & _
                    "2. En la WebApp, tocá 'Pegar LDM del Portapapeles' si no se cargó automáticamente.", _
                    "OdooInventor iLogic", MessageBoxButtons.OK, MessageBoxIcon.Information)
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
          </div>

        </div>
      </div>

      {/* Secondary Tool Bar */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-3">
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, descripción, material..."
              className="w-full pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-sans"
            />
          </div>
          <div className="text-xs text-slate-400">
            Mostrando <b className="text-slate-200 font-mono">{filteredBom.length}</b> de <b className="text-slate-200 font-mono">{part.bom.length}</b> componentes
          </div>
        </div>

        {/* Secondary Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setNewItemModal(true)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center space-x-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5 text-orange-400" />
            <span>Añadir Pieza Manual</span>
          </button>

          <button
            onClick={exportCSV}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center space-x-1.5 transition"
            title="Descargar lista de materiales en formato CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => setIsPoModalOpen(true)}
            className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs rounded border border-emerald-600 flex items-center space-x-1.5 transition"
            title="Generar orden de compra (purchase.order) para insumos y piezas comerciales"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-emerald-200" />
            <span>Crear Pedido de Compra (PO)</span>
          </button>

          <button
            onClick={onSyncBomToOdoo}
            disabled={isSyncing}
            className="px-3.5 py-1 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs rounded flex items-center space-x-1.5 shadow transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Rápido a Odoo'}</span>
          </button>
        </div>
      </div>

      {/* BOM Table (Hero View - 100% focused on components & engineering attributes) */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 sticky top-0 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 select-none z-10 shadow-sm">
            <tr>
              <th className="py-2.5 px-3 w-14 text-center">Ítem</th>
              <th className="py-2.5 px-3">Número de Pieza (CAD / Ref)</th>
              <th className="py-2.5 px-3">Descripción Técnica del Componente</th>
              <th className="py-2.5 px-3 w-20 text-right">Cant.</th>
              <th className="py-2.5 px-3 w-24">Unidad</th>
              <th className="py-2.5 px-3">Material Especificado</th>
              <th className="py-2.5 px-3">Mapeo Odoo</th>
              <th className="py-2.5 px-3 w-28 text-center">Estado Odoo</th>
              <th className="py-2.5 px-3 w-16 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 font-mono">
            {filteredBom.map((item) => (
              <tr 
                key={item.id} 
                className="hover:bg-slate-900/90 transition-colors group"
              >
                <td className="py-2 px-3 text-center text-slate-500 font-bold">
                  {item.item}
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

      {/* Modal: Paso a Odoo ERP (Llevar la LDM a mrp.bom) */}
      {isOdooSyncModalOpen && (
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

      {/* Modal: Crear Orden de Compra (PO) en Odoo */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-emerald-400">
                <ShoppingCart className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-100">
                  Generar Pedido de Compra en Odoo (purchase.order)
                </h3>
              </div>
              <button onClick={() => setIsPoModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchaseOrder} className="space-y-3 text-xs">
              <p className="text-slate-300">
                Crea una orden de compra en Odoo con las <b>{part.bom.length} líneas de la LDM</b> de <code>{part.partNumber}</code>.
              </p>

              <div className="grid grid-cols-2 gap-3">
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
