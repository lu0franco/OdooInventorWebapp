import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Send, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Layers, 
  Sparkles, 
  RefreshCw, 
  Download,
  Info,
  ShieldCheck,
  Search,
  ChevronDown,
  X,
  ExternalLink,
  SlidersHorizontal,
  Package,
  PlusCircle,
  HelpCircle
} from 'lucide-react';
import { CadPart, BomItem, PurchaseRequisition, OdooProduct } from '../types';
import * as XLSX from 'xlsx';

interface PurchaseRequisitionViewProps {
  part: CadPart | null;
  odooUrl: string;
  onGoToBom: () => void;
  onNotification?: (type: 'success' | 'error' | 'info', message: string) => void;
  onUpdateBom?: (newBom: BomItem[]) => void;
}

interface ItemProductMapping {
  item: BomItem;
  qty: number;
  selectedProduct: OdooProduct | null;
  matchType: 'exact' | 'similar' | 'manual' | 'new';
  candidates: OdooProduct[];
  isIncluded: boolean;
}

export const PurchaseRequisitionView: React.FC<PurchaseRequisitionViewProps> = ({
  part,
  odooUrl,
  onGoToBom,
  onNotification,
  onUpdateBom
}) => {
  const [onlyCom, setOnlyCom] = useState(true);
  const [odooProducts, setOdooProducts] = useState<OdooProduct[]>([]);
  const [mappings, setMappings] = useState<ItemProductMapping[]>([]);
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
  
  // Settings & Parameters modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAddManualOpen, setIsAddManualOpen] = useState(false);

  // Manual item state
  const [manualPartNumber, setManualPartNumber] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualUom, setManualUom] = useState('Unidades');
  const [manualMaterial, setManualMaterial] = useState('Comercial');

  // Form Fields
  const [origin, setOrigin] = useState(() => part ? `${part.partNumber} — ${part.name}` : 'OT-26148 - FLAMARIQUE');
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date(Date.now() + 14 * 86400000);
    return d.toISOString().substring(0, 10);
  });
  const [notes, setNotes] = useState('Solicitud de compra generada automáticamente desde Autodesk Inventor 2027 — Componentes comerciales para fabricación.');

  // Credentials
  const [odooDb, setOdooDb] = useState(() => localStorage.getItem('odoo_auth_db') || 'odoo');
  const [odooLogin, setOdooLogin] = useState(() => localStorage.getItem('odoo_auth_login') || 'ing@deblasi.com.ar');
  const [odooApiKey, setOdooApiKey] = useState(() => localStorage.getItem('odoo_auth_pwd') || '');
  const [testingAuth, setTestingAuth] = useState(false);
  const [testAuthResult, setTestAuthResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Loading & Submission states
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    requisitionName: string;
    message: string;
    linesCount: number;
    simulated?: boolean;
  } | null>(null);

  // Active item dropdown for searching products
  const [activeSearchItemId, setActiveSearchItemId] = useState<string | null>(null);
  const [inlineSearchQuery, setInlineSearchQuery] = useState('');
  const [liveSearchResults, setLiveSearchResults] = useState<OdooProduct[]>([]);

  // Test live connection credentials directly
  const handleTestCredentials = async () => {
    if (!odooDb.trim() || !odooLogin.trim() || !odooApiKey.trim()) {
      setTestAuthResult({
        success: false,
        msg: 'Completá Base de Datos, Usuario y Contraseña/API Key para probar.'
      });
      return;
    }
    setTestingAuth(true);
    setTestAuthResult(null);
    try {
      const res = await fetch('/api/odoo/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: odooUrl.trim(),
          db: odooDb.trim(),
          login: odooLogin.trim(),
          password: odooApiKey.trim()
        })
      });
      const data = JSON.parse(await res.text());
      if (data.success) {
        setTestAuthResult({
          success: true,
          msg: `¡Conexión y Autenticación exitosa! UID: ${data.uid} en base "${odooDb.trim()}".`
        });
        localStorage.setItem('odoo_auth_db', odooDb.trim());
        localStorage.setItem('odoo_auth_login', odooLogin.trim());
        localStorage.setItem('odoo_auth_pwd', odooApiKey.trim());
      } else {
        setTestAuthResult({
          success: false,
          msg: `Error Odoo: ${data.error || 'Credenciales no válidas.'}`
        });
      }
    } catch (err: any) {
      setTestAuthResult({
        success: false,
        msg: `Error de red: ${err.message}`
      });
    } finally {
      setTestingAuth(false);
    }
  };

  // Update origin when part changes
  useEffect(() => {
    if (part) {
      setOrigin(`${part.partNumber} — ${part.name}`);
    }
  }, [part]);

  // Load existing requisitions & initial catalog
  const loadInitialData = async () => {
    try {
      // 1. Load catalog from state
      const stateRes = await fetch('/api/odoo/state');
      const text = await stateRes.text();
      let stateData: any = {};
      try {
        stateData = JSON.parse(text);
      } catch {
        stateData = {};
      }
      if (stateData.odooProducts && stateData.odooProducts.length > 0) {
        setOdooProducts(stateData.odooProducts);
      }
      if (stateData.purchaseRequisitions) {
        setRequisitions(stateData.purchaseRequisitions);
      }

      // 2. Query /api/odoo/products/search to fetch all available catalog items (live or cached)
      const searchRes = await fetch('/api/odoo/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '',
          url: odooUrl,
          db: odooDb,
          login: odooLogin,
          apiKey: odooApiKey,
          limit: 100
        })
      });
      const searchText = await searchRes.text();
      let searchData: any = {};
      try {
        searchData = JSON.parse(searchText);
      } catch {
        searchData = {};
      }
      if (searchData.success && searchData.products && searchData.products.length > 0) {
        setOdooProducts(prev => {
          const combined = [...prev];
          for (const np of searchData.products) {
            const idx = combined.findIndex(c => c.id === np.id);
            if (idx >= 0) {
              combined[idx] = { ...combined[idx], ...np };
            } else {
              combined.push(np);
            }
          }
          return combined;
        });
      }
    } catch (err) {
      console.warn('Error loading initial data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

// Helper to extract clean product code/term from PIEZA CAD / REFERENCIA (e.g. "[247964]" -> "247964", "(PIAZ 1258)" -> "PIAZ 1258")
export const extractSearchCode = (partNumber: string): string => {
  if (!partNumber) return '';
  const trimmed = partNumber.trim();
  // 1. Bracket code: [247964] -> 247964
  const bracket = trimmed.match(/\[([A-Za-z0-9_\-\.\s]+)\]/);
  if (bracket && bracket[1] && bracket[1].trim().length >= 2) {
    return bracket[1].trim();
  }
  // 2. Paren code: (PIAZ 1258) -> PIAZ 1258
  const paren = trimmed.match(/\(([A-Za-z0-9_\-\.\s]{3,})\)/);
  if (paren && paren[1] && paren[1].trim().length >= 2) {
    const clean = paren[1].trim();
    if (!['alternativo', 'import', 'estandar', 'acero', 'inox', 'final v4'].includes(clean.toLowerCase())) {
      return clean;
    }
  }
  // 3. PIAZ pattern
  const piaz = trimmed.match(/\b(PIAZ\s*\d+)\b/i);
  if (piaz && piaz[1]) {
    return piaz[1].trim();
  }
  return trimmed;
};

  // Helper function to tokenize and calculate similarity strictly based on PIEZA CAD / REFERENCIA
  const findMatchesForBomItem = (item: BomItem, catalog: OdooProduct[]): { best: OdooProduct | null; type: 'exact' | 'similar' | 'new'; candidates: OdooProduct[] } => {
    if (!catalog || catalog.length === 0) {
      return { best: null, type: 'new', candidates: [] };
    }

    // STRICTLY USE PIEZA CAD / REFERENCIA (item.partNumber) - Description from Inventor is ignored as requested
    const itemPartNumber = String(item.partNumber || '').trim();
    const fullText = itemPartNumber.toLowerCase();

    // 1. Extract specific codes from brackets [247964], parens (PIAZ 1258), or tokens
    const extractedCodes: string[] = [];

    // Brackets: e.g. [247964]
    const bracketMatches = itemPartNumber.match(/\[([A-Za-z0-9_\-\.\s]+)\]/g);
    if (bracketMatches) {
      bracketMatches.forEach(b => {
        const c = b.replace(/[\[\]]/g, '').trim().toLowerCase();
        if (c.length >= 2) extractedCodes.push(c);
      });
    }

    // Parentheses: e.g. (PIAZ 1258)
    const parenMatches = itemPartNumber.match(/\(([A-Za-z0-9_\-\.\s]{3,})\)/g);
    if (parenMatches) {
      parenMatches.forEach(p => {
        const c = p.replace(/[\(\)]/g, '').trim().toLowerCase();
        const ignoreList = ['alternativo', 'import', 'estandar', 'acero', 'inox', 'final v4'];
        if (c.length >= 2 && !ignoreList.includes(c)) {
          extractedCodes.push(c);
        }
      });
    }

    // PIAZ pattern
    const piazMatches = itemPartNumber.match(/\b(PIAZ\s*\d+)\b/gi);
    if (piazMatches) {
      piazMatches.forEach(p => extractedCodes.push(p.trim().toLowerCase()));
    }

    // 2. Check if any extracted code matches a product's default_code directly
    for (const code of extractedCodes) {
      const match = catalog.find(p => p.default_code && p.default_code.trim().toLowerCase() === code);
      if (match) {
        return { best: match, type: 'exact', candidates: [match] };
      }
    }

    // 3. Check if any product's default_code is contained inside itemPartNumber or vice-versa
    for (const prod of catalog) {
      const pCode = String(prod.default_code || '').trim().toLowerCase();
      if (pCode.length >= 3) {
        if (fullText.includes(pCode) || pCode === itemPartNumber.toLowerCase()) {
          return { best: prod, type: 'exact', candidates: [prod] };
        }
      }
    }

    // 4. Check exact default_code match with whole partNumber
    const exactCode = catalog.find(p => p.default_code && p.default_code.trim().toLowerCase() === itemPartNumber.toLowerCase());
    if (exactCode) {
      return { best: exactCode, type: 'exact', candidates: [exactCode] };
    }

    // 5. Check exact name match or if product name is inside itemPartNumber or vice versa
    const exactName = catalog.find(p => {
      const pName = String(p.name || '').trim().toLowerCase();
      return pName && (
        pName === itemPartNumber.toLowerCase() ||
        fullText.includes(pName) ||
        pName.includes(itemPartNumber.toLowerCase())
      );
    });
    if (exactName) {
      return { best: exactName, type: 'exact', candidates: [exactName] };
    }

    // 6. Token-based fuzzy matching strictly from itemPartNumber
    const stopWords = new Set(['de', 'la', 'el', 'en', 'para', 'y', 'con', 'sin', 'un', 'una', '-', '/', 'c/', 'chapa']);
    const getTokens = (str: string) => 
      str.toLowerCase()
        .replace(/[^a-z0-9áéíóúñ]/gi, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2 && !stopWords.has(t));

    const itemTokens = getTokens(itemPartNumber);

    // Score all products
    const scored = catalog.map(prod => {
      const prodText = `${prod.default_code || ''} ${prod.name || ''}`.toLowerCase();
      const prodTokens = getTokens(prodText);
      let score = 0;

      for (const token of itemTokens) {
        if (prodText.includes(token)) score += 2;
        if (prodTokens.includes(token)) score += 3;
      }

      // Special priority for key engineering keywords
      const keyKeywords = ['motorreductor', 'rodamient', 'brida', 'tambor', 'reductor', 'umi', 'skf', 'chapa', 'perfil', 'malla', 'tornillo', 'acoplamiento', 'rueda'];
      for (const kw of keyKeywords) {
        if (fullText.includes(kw) && prodText.includes(kw)) {
          score += 6;
        }
      }

      return { prod, score };
    })
    .filter(item => item.score > 2)
    .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const candidates = scored.slice(0, 5).map(s => s.prod);
      return {
        best: candidates[0],
        type: 'similar',
        candidates
      };
    }

    return { best: null, type: 'new', candidates: [] };
  };

  // Build and compute mappings when part.bom or odooProducts changes
  useEffect(() => {
    if (!part || !part.bom) {
      setMappings([]);
      return;
    }

    setMappings(prev => {
      return part.bom.map(item => {
        const existing = prev.find(m => m.item.id === item.id);
        if (existing) {
          return {
            ...existing,
            item,
            qty: item.qty || existing.qty
          };
        }
        const { best, type, candidates } = findMatchesForBomItem(item, odooProducts);
        return {
          item,
          qty: item.qty || 1,
          selectedProduct: best,
          matchType: best ? type : 'new',
          candidates,
          isIncluded: true
        };
      });
    });
  }, [part?.bom, odooProducts]);

  // Filtered rows for the table
  const displayedMappings = useMemo(() => {
    return mappings.filter(m => {
      if (onlyCom) return m.item.isCom;
      return true;
    });
  }, [mappings, onlyCom]);

  // Statistics
  const activeItemsToUpload = displayedMappings.filter(m => m.isIncluded);
  const totalUnits = activeItemsToUpload.reduce((acc, curr) => acc + curr.qty, 0);
  const linkedCount = activeItemsToUpload.filter(m => m.selectedProduct !== null).length;

  // Toggle item inclusion
  const handleToggleInclude = (itemId: string) => {
    setMappings(prev => prev.map(m => {
      if (m.item.id === itemId) {
        return { ...m, isIncluded: !m.isIncluded };
      }
      return m;
    }));
  };

  // Select / Deselect all displayed items
  const allDisplayedIncluded = displayedMappings.length > 0 && displayedMappings.every(m => m.isIncluded);
  const handleToggleSelectAll = () => {
    const targetState = !allDisplayedIncluded;
    setMappings(prev => prev.map(m => {
      if (onlyCom && !m.item.isCom) return m;
      return { ...m, isIncluded: targetState };
    }));
  };

  // Toggle item COM status (Comercial vs Fabricada)
  const handleToggleCom = (itemId: string) => {
    if (!part || !part.bom) return;
    const updatedBom = part.bom.map(b => 
      b.id === itemId ? { ...b, isCom: !b.isCom } : b
    );
    if (onUpdateBom) {
      onUpdateBom(updatedBom);
    }
    setMappings(prev => prev.map(m => {
      if (m.item.id === itemId) {
        return {
          ...m,
          item: { ...m.item, isCom: !m.item.isCom }
        };
      }
      return m;
    }));
  };

  // Add a manual commercial item to the BOM and requisition
  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPartNumber.trim() || !manualDesc.trim()) return;

    const newItem: BomItem = {
      id: Date.now().toString(),
      item: String((part?.bom?.length || 0) + 1),
      partNumber: manualPartNumber.trim(),
      description: manualDesc.trim(),
      qty: parseFloat(manualQty) || 1,
      uom: manualUom || 'Unidades',
      material: manualMaterial || 'Comercial',
      odooId: `PROD-${Math.floor(100 + Math.random() * 900)}`,
      status: 'pending',
      isCom: true
    };

    const updatedBom = [...(part?.bom || []), newItem];
    if (onUpdateBom) {
      onUpdateBom(updatedBom);
    }
    setManualPartNumber('');
    setManualDesc('');
    setManualQty('1');
    setIsAddManualOpen(false);
    if (onNotification) {
      onNotification('success', `Pieza comercial '${newItem.partNumber}' agregada a la solicitud.`);
    }
  };

  // Handle product selection for a row
  const handleSelectProduct = (itemId: string, product: OdooProduct | null, matchType: 'exact' | 'similar' | 'manual' | 'new') => {
    setMappings(prev => prev.map(m => {
      if (m.item.id === itemId) {
        return {
          ...m,
          selectedProduct: product,
          matchType
        };
      }
      return m;
    }));
    setActiveSearchItemId(null);
    setInlineSearchQuery('');
  };

  // Update item quantity
  const handleUpdateQty = (itemId: string, newQty: number) => {
    const validQty = Math.max(1, isNaN(newQty) ? 1 : newQty);
    setMappings(prev => prev.map(m => {
      if (m.item.id === itemId) {
        return { ...m, qty: validQty };
      }
      return m;
    }));
  };

  // Perform live search when typing in row search box
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchInputChange = (text: string) => {
    setInlineSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      if (!text.trim()) {
        setLiveSearchResults([]);
        return;
      }
      try {
        const res = await fetch('/api/odoo/products/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: text.trim(),
            url: odooUrl,
            db: odooDb,
            login: odooLogin,
            apiKey: odooApiKey
          })
        });
        const resText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(resText);
        } catch {
          data = {};
        }
        if (data.success && data.products) {
          setLiveSearchResults(data.products);
        }
      } catch (err) {
        console.warn('Error in live product search:', err);
      }
    }, 250);
  };

  // Real-time combined search results from live Odoo and local catalog cache
  const combinedSearchResults = useMemo(() => {
    const query = inlineSearchQuery.trim().toLowerCase();
    if (!query) {
      return odooProducts.slice(0, 30);
    }
    const filteredLocal = odooProducts.filter(p => {
      const code = String(p.default_code || '').toLowerCase();
      const name = String(p.name || '').toLowerCase();
      if (code.includes(query) || name.includes(query)) return true;
      const tokens = query.split(/\s+/).filter(t => t.length >= 2);
      return tokens.length > 0 && tokens.some(t => code.includes(t) || name.includes(t));
    });

    const list = [...liveSearchResults];
    for (const lp of filteredLocal) {
      if (!list.some(c => c.id === lp.id)) {
        list.push(lp);
      }
    }
    return list;
  }, [inlineSearchQuery, liveSearchResults, odooProducts]);

  // Sync / Re-match all items against Odoo catalog
  const handleSyncCatalogAndMatch = async () => {
    setIsSearchingCatalog(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/odoo/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '',
          url: odooUrl,
          db: odooDb,
          login: odooLogin,
          apiKey: odooApiKey,
          limit: 100
        })
      });
      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch {
        data = {};
      }
      if (data.success && data.products) {
        setOdooProducts(data.products);
        if (onNotification) {
          onNotification('success', `Catálogo sincronizado: ${data.products.length} productos disponibles para vinculación.`);
        }
      }
    } catch (err: any) {
      setErrorMessage(`Error al sincronizar catálogo: ${err.message}`);
    } finally {
      setIsSearchingCatalog(false);
    }
  };

  // Local fallback simulation generator (zero network dependency)
  const createLocalSimulation = () => {
    const fakeReqNumber = `REQ2027-${Math.floor(1000 + Math.random() * 9000)}`;
    const newReq: PurchaseRequisition = {
      id: Date.now(),
      name: fakeReqNumber,
      origin: origin.trim() || (part ? part.partNumber : 'Autodesk Inventor LDM'),
      state: 'draft',
      ordering_date: new Date().toISOString().substring(0, 10),
      schedule_date: scheduleDate || new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      notes: notes || 'Generado desde Autodesk Inventor 2027 — Componentes comerciales para fabricación.',
      simulated: true,
      lines: activeItemsToUpload.map((m, idx) => ({
        id: idx + 1,
        partNumber: m.item.partNumber,
        description: m.item.description,
        qty: m.qty,
        uom: m.item.uom,
        price_unit: 0,
        schedule_date: scheduleDate,
        isCom: m.item.isCom
      }))
    };
    setRequisitions(prev => [newReq, ...prev]);
    setSuccessResult({
      requisitionName: fakeReqNumber,
      message: `¡Solicitud de compra ${fakeReqNumber} (purchase.requisition) creada exitosamente con ${activeItemsToUpload.length} líneas de la LDM!`,
      linesCount: activeItemsToUpload.length,
      simulated: true
    });
    setErrorMessage(null);
    if (onNotification) {
      onNotification('success', `¡Solicitud ${fakeReqNumber} generada en modo simulación con ${activeItemsToUpload.length} líneas!`);
    }
  };

  // Submit purchase requisition to Odoo
  const handleSendPurchaseRequisition = async (forceSimulation = false) => {
    if (activeItemsToUpload.length === 0) {
      setErrorMessage('No hay artículos seleccionados para generar la solicitud.');
      return;
    }

    if (forceSimulation) {
      // Direct simulation mode requested
      try {
        const res = await fetch('/api/odoo/create-purchase-requisition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: '',
            db: '',
            login: '',
            apiKey: '',
            origin: origin.trim() || (part ? part.partNumber : 'Autodesk Inventor LDM'),
            scheduleDate,
            notes: notes || `Solicitud de compra de componentes comerciales — ${origin.trim() || (part ? part.partNumber : 'Autodesk Inventor LDM')}`,
            items: activeItemsToUpload.map(m => ({
              partNumber: m.item.partNumber,
              productCode: m.selectedProduct?.default_code || extractSearchCode(m.item.partNumber),
              description: m.selectedProduct?.name || m.item.partNumber,
              qty: m.qty,
              uom: m.selectedProduct?.uom_id || m.item.uom || 'Unidades',
              isCom: m.item.isCom,
              odooProductId: m.selectedProduct?.id || null,
              productName: m.selectedProduct?.name || m.item.partNumber
            }))
          })
        });
        const text = await res.text();
        const data = JSON.parse(text);
        if (data.success) {
          setSuccessResult({
            requisitionName: data.requisitionName,
            message: data.message,
            linesCount: data.linesCount,
            simulated: true
          });
          setErrorMessage(null);
          try {
            const reqListRes = await fetch('/api/odoo/purchase-requisitions');
            const reqListData = JSON.parse(await reqListRes.text());
            if (reqListData.success && reqListData.requisitions) {
              setRequisitions(reqListData.requisitions);
            }
          } catch {
            // ignore
          }
          return;
        }
      } catch {
        // Fallback to client-side generation
      }
      createLocalSimulation();
      return;
    }

    if (odooDb.trim()) localStorage.setItem('odoo_auth_db', odooDb.trim());
    if (odooLogin.trim()) localStorage.setItem('odoo_auth_login', odooLogin.trim());
    if (odooApiKey) localStorage.setItem('odoo_auth_pwd', odooApiKey);

    // If user wants live Odoo sync but has not provided an API Key/Password yet
    if (!odooApiKey.trim()) {
      setIsSettingsOpen(true);
      setErrorMessage('Para enviar directamente a tu servidor Odoo (deblasi.adhoc.ar), ingresá tu Contraseña o API Key en "Parámetros" abajo. Si querés probar el flujo primero sin ingresar credenciales, podés hacer clic en "Generar en Modo Simulación".');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessResult(null);

    const payload = {
      url: odooUrl,
      db: odooDb.trim(),
      login: odooLogin.trim(),
      apiKey: odooApiKey.trim(),
      origin: origin.trim() || (part ? part.partNumber : 'Autodesk Inventor LDM'),
      notes: notes || `Solicitud de compra de componentes comerciales — ${origin.trim() || (part ? part.partNumber : 'Autodesk Inventor LDM')}`,
      items: activeItemsToUpload.map(m => ({
        partNumber: m.item.partNumber,
        productCode: m.selectedProduct?.default_code || extractSearchCode(m.item.partNumber),
        description: m.selectedProduct?.name || m.item.partNumber,
        qty: m.qty,
        uom: m.selectedProduct?.uom_id || m.item.uom || 'Unidades',
        isCom: m.item.isCom,
        odooProductId: m.selectedProduct?.id || null,
        productName: m.selectedProduct?.name || m.item.partNumber
      }))
    };

    try {
      const res = await fetch('/api/odoo/create-purchase-requisition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Safe text reading to avoid Unexpected end of JSON input
      const responseText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch {
        if (res.status === 404) {
          throw new Error('El endpoint de solicitud no respondió (HTTP 404). El servidor se estaba iniciando; podés reintentar ahora o hacer clic en "Generar en Modo Simulación".');
        }
        throw new Error(`El servidor devolvió una respuesta no válida (HTTP ${res.status}): ${responseText.substring(0, 150)}`);
      }

      if (data.success) {
        setSuccessResult({
          requisitionName: data.requisitionName,
          message: data.message,
          linesCount: data.linesCount,
          simulated: data.simulated
        });
        if (data.lineErrors && data.lineErrors.length > 0) {
          setErrorMessage(`Aviso: La solicitud ${data.requisitionName} se creó con ${data.linesCount} líneas, pero algunas líneas tuvieron advertencias: ${data.lineErrors.join('; ')}`);
        }
        if (onNotification) {
          onNotification('success', `¡Solicitud ${data.requisitionName} generada con ${data.linesCount} líneas!`);
        }
        // Refresh requisitions list safely
        try {
          const reqListRes = await fetch('/api/odoo/purchase-requisitions');
          const reqListText = await reqListRes.text();
          const reqListData = JSON.parse(reqListText);
          if (reqListData.success && reqListData.requisitions) {
            setRequisitions(reqListData.requisitions);
          }
        } catch {
          // ignore refresh errors
        }
      } else {
        setErrorMessage(data.error || 'Odoo rechazó la creación de la solicitud de compra.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de comunicación con Odoo o el servidor proxy.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export table to Excel
  const handleExportExcel = () => {
    if (activeItemsToUpload.length === 0) return;
    const rows = activeItemsToUpload.map((m, idx) => ({
      '#': idx + 1,
      'Código CAD': m.item.partNumber,
      'Descripción CAD': m.item.description,
      'Cantidad': m.qty,
      'UOM': m.item.uom,
      'COM': m.item.isCom ? 'SÍ' : 'NO',
      'ID Producto Odoo': m.selectedProduct?.id || 'NUEVO',
      'Código Odoo': m.selectedProduct?.default_code || '',
      'Nombre Producto Odoo': m.selectedProduct?.name || '(Crear nuevo en Odoo)',
      'Tipo de Coincidencia': m.matchType === 'exact' ? 'Exacta' : m.matchType === 'similar' ? 'Similar' : m.matchType === 'manual' ? 'Manual' : 'Nuevo',
      'Fecha Requerida': scheduleDate,
      'Origen Solicitud': origin
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Solicitud_Compra');
    XLSX.writeFile(wb, `Solicitud_Compra_${part?.partNumber || 'BOM'}.xlsx`);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      
      {/* Top Header & Toolbar */}
      <div className="bg-slate-950 border-b border-slate-800 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-white tracking-tight">
                Líneas de Solicitud de Compra (purchase.requisition)
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                {part ? part.partNumber : 'CAD'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Vincula los componentes comerciales con productos de Odoo ERP y genera la requisición de compra.
            </p>
          </div>
        </div>

        {/* Filter & Metric Pills */}
        <div className="flex items-center space-x-2">
          {/* Scope Toggle: Solo COM vs Toda la LDM */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setOnlyCom(true)}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition ${
                onlyCom 
                  ? 'bg-orange-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Solo COM</span>
              <span className="px-1.5 py-0.2 rounded bg-black/30 font-mono text-[10px]">
                {mappings.filter(m => m.item.isCom).length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setOnlyCom(false)}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition ${
                !onlyCom 
                  ? 'bg-orange-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Toda la LDM</span>
              <span className="px-1.5 py-0.2 rounded bg-black/30 font-mono text-[10px]">
                {mappings.length}
              </span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="hidden md:flex items-center space-x-1.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400">Total:</span>
            <span className="font-bold text-white font-mono">{activeItemsToUpload.length} ítems</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Cant:</span>
            <span className="font-bold text-emerald-400 font-mono">{totalUnits} un.</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Vinculados:</span>
            <span className="font-bold text-blue-400 font-mono">{linkedCount}/{activeItemsToUpload.length}</span>
          </div>

          {/* Secondary Actions */}
          <button
            type="button"
            onClick={handleSyncCatalogAndMatch}
            disabled={isSearchingCatalog}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs font-medium border border-slate-800 flex items-center space-x-1.5 transition"
            title="Volver a buscar y emparejar productos en Odoo"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isSearchingCatalog ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Re-vincular</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center space-x-1.5 transition ${
              isSettingsOpen 
                ? 'bg-orange-600 text-white border-orange-500' 
                : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-800'
            }`}
            title="Configurar credenciales de Odoo y fecha requerida"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Parámetros</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-emerald-400 text-xs font-medium border border-slate-800 flex items-center space-x-1.5 transition"
            title="Exportar a Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddManualOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-orange-400 text-xs font-medium border border-slate-800 flex items-center space-x-1.5 transition"
            title="Añadir una pieza comercial manual a la solicitud"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Añadir COM</span>
          </button>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={() => handleSendPurchaseRequisition(false)}
            disabled={isSubmitting || activeItemsToUpload.length === 0}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white text-xs font-bold shadow-md flex items-center space-x-2 transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Enviar Solicitud ({activeItemsToUpload.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Slide-down Settings Panel */}
      {isSettingsOpen && (
        <div className="bg-slate-950/95 border-b border-slate-800 px-6 py-4 space-y-3 text-xs animate-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Documento de Origen / Referencia:
              </label>
              <input
                type="text"
                value={origin}
                onChange={e => setOrigin(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Fecha Requerida de Entrega:
              </label>
              <input
                type="date"
                value={scheduleDate}
                onChange={e => setScheduleDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Base de Datos Odoo:
              </label>
              <input
                type="text"
                value={odooDb}
                onChange={e => setOdooDb(e.target.value)}
                placeholder="odoo o deblasi"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Usuario / Email Odoo:
              </label>
              <input
                type="text"
                value={odooLogin}
                onChange={e => setOdooLogin(e.target.value)}
                placeholder="ing@deblasi.com.ar"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                API Key / Contraseña Odoo (Servidor: <span className="font-mono text-orange-400">deblasi.adhoc.ar</span>):
              </label>
              <input
                type="password"
                value={odooApiKey}
                onChange={e => setOdooApiKey(e.target.value)}
                placeholder="Contraseña o API Key de Odoo"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="flex items-end space-x-2">
              <button
                type="button"
                onClick={handleTestCredentials}
                disabled={testingAuth}
                className="flex-1 py-1.5 px-3 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{testingAuth ? 'Probando...' : 'Probar Credenciales'}</span>
              </button>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => handleSendPurchaseRequisition(true)}
                className="w-full py-1.5 px-3 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-amber-500/30 transition flex items-center justify-center space-x-1.5"
                title="Genera la requisición directamente en modo simulación para validar datos sin credenciales"
              >
                <span>Generar en Modo Simulación</span>
              </button>
            </div>
          </div>

          {testAuthResult && (
            <div className={`p-2.5 rounded text-xs flex items-center space-x-2 ${
              testAuthResult.success 
                ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-200' 
                : 'bg-rose-950/80 border border-rose-700 text-rose-200'
            }`}>
              {testAuthResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{testAuthResult.msg}</span>
            </div>
          )}
        </div>
      )}

      {/* Notification / Error Banner */}
      {errorMessage && (
        <div className="bg-rose-950/90 border-b border-rose-800 px-5 py-3 text-xs text-rose-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2 max-w-2xl">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium leading-relaxed">{errorMessage}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleSendPurchaseRequisition(false)}
              className="px-2.5 py-1 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold text-[11px] shadow transition"
            >
              Reintentar Envío
            </button>
            <button
              type="button"
              onClick={() => handleSendPurchaseRequisition(true)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px] border border-amber-600/40 transition"
            >
              Generar en Modo Simulación
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition"
            >
              Parámetros
            </button>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-300 hover:text-white ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {successResult && (
        <div className="bg-emerald-950/80 border-b border-emerald-800 px-5 py-2.5 text-xs text-emerald-200 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successResult.message}</span>
            <span className="font-mono font-bold text-orange-300 px-1.5 py-0.2 rounded bg-black/40">
              {successResult.requisitionName}
            </span>
            {successResult.simulated && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 rounded">
                Modo Simulación
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSuccessResult(null)}
            className="text-emerald-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Table Content (Full Width) */}
      <div className="flex-1 overflow-auto bg-slate-900">
        {displayedMappings.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Package className="w-10 h-10 text-orange-400 mx-auto opacity-75" />
            <h3 className="text-sm font-bold text-slate-200">
              No hay componentes para mostrar con el filtro actual
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {onlyCom 
                ? 'No hay piezas con tick COM. Podés cambiar a "Toda la LDM" o volver a la pestaña LDM para tickar las piezas comerciales.' 
                : 'La lista de materiales está vacía.'}
            </p>
            <button
              type="button"
              onClick={() => setOnlyCom(false)}
              className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-bold transition"
            >
              Ver Toda la LDM
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-semibold sticky top-0 z-20 border-b border-slate-800 shadow-sm">
              <tr>
                <th className="px-3 py-2 text-center w-12">
                  <div className="flex flex-col items-center space-y-0.5">
                    <span className="font-bold">ING.</span>
                    <input
                      type="checkbox"
                      checked={allDisplayedIncluded}
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-700 text-orange-500 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                      title="Seleccionar / Deseleccionar todos los mostrados"
                    />
                  </div>
                </th>
                <th className="px-3 py-2.5 w-16 text-center" title="Tipo: Hacer clic en el badge de cualquier fila para cambiar entre COM y FAB">
                  Tipo
                </th>
                <th className="px-3 py-2.5 min-w-[170px]">Pieza CAD / Referencia</th>
                <th className="px-3 py-2.5 min-w-[220px]">Descripción de Ingeniería</th>
                <th className="px-3 py-2.5 text-center w-24">Cantidad</th>
                <th className="px-3 py-2.5 w-20">UOM</th>
                <th className="px-3 py-2.5 min-w-[340px]">
                  <div className="flex items-center space-x-1.5">
                    <span>Producto Vinculado en Odoo ERP</span>
                    <span className="text-orange-400 text-[9px] lowercase font-normal">(búsqueda automática)</span>
                  </div>
                </th>
                <th className="px-3 py-2.5 text-center w-28">Estado Mapeo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-[11px]">
              {displayedMappings.map((m, idx) => {
                const isSearchingThis = activeSearchItemId === m.item.id;
                const p = m.selectedProduct;

                return (
                  <tr 
                    key={m.item.id} 
                    className={`transition ${
                      !m.isIncluded 
                        ? 'opacity-40 bg-slate-950/40' 
                        : idx % 2 === 0 
                        ? 'bg-slate-900/50 hover:bg-slate-850/60' 
                        : 'bg-slate-900/20 hover:bg-slate-850/60'
                    }`}
                  >
                    {/* Checkbox to include/exclude */}
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={m.isIncluded}
                        onChange={() => handleToggleInclude(m.item.id)}
                        className="rounded border-slate-700 text-orange-500 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                        title={m.isIncluded ? 'Desmarcar para no subir esta pieza a la solicitud' : 'Marcar para incluir en la solicitud'}
                      />
                    </td>

                    {/* COM Badge (Interactive Toggle) */}
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleCom(m.item.id)}
                        className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition inline-flex items-center space-x-1 cursor-pointer border ${
                          m.item.isCom 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/40' 
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                        }`}
                        title={m.item.isCom ? 'Hacer clic para desmarcar COM (pasa a Fabricada)' : 'Hacer clic para marcar como COM (pasa a Comercial)'}
                      >
                        {m.item.isCom ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>COM</span>
                          </>
                        ) : (
                          <span>FAB</span>
                        )}
                      </button>
                    </td>

                    {/* Part Number */}
                    <td className="px-3 py-2 font-mono font-bold text-orange-300">
                      {m.item.partNumber}
                    </td>

                    {/* Description */}
                    <td className="px-3 py-2 text-slate-200">
                      <div className="truncate max-w-sm" title={m.item.description}>
                        {m.item.description}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Mat: {m.item.material || 'Comercial'}
                      </div>
                    </td>

                    {/* Qty (Editable input) */}
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="1"
                        value={m.qty}
                        onChange={e => handleUpdateQty(m.item.id, parseInt(e.target.value, 10))}
                        className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center font-mono font-bold text-white focus:border-orange-500 focus:outline-none text-xs"
                      />
                    </td>

                    {/* UOM */}
                    <td className="px-3 py-2 text-slate-400 font-mono">
                      {m.item.uom}
                    </td>

                    {/* Odoo Product Linking (Interactive Combobox / Card) */}
                    <td className="px-3 py-2 relative">
                      {isSearchingThis ? (
                        /* Inline Search Dropdown Box */
                        <div className="bg-slate-950 border border-orange-500/90 rounded-lg p-2.5 shadow-2xl space-y-2 z-30">
                          <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-700 rounded px-2 py-1">
                            <Search className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            <input
                              type="text"
                              value={inlineSearchQuery}
                              onChange={e => handleSearchInputChange(e.target.value)}
                              placeholder="Ingresá descripción o código para buscar en Odoo..."
                              className="w-full bg-transparent text-xs text-white focus:outline-none placeholder-slate-500"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => setActiveSearchItemId(null)}
                              className="text-slate-400 hover:text-white"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Header info */}
                          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                            <span>Productos en Odoo ({combinedSearchResults.length} disponibles)</span>
                            {inlineSearchQuery && (
                              <button 
                                type="button" 
                                onClick={() => { setInlineSearchQuery(''); handleSearchInputChange(''); }}
                                className="text-orange-400 hover:underline"
                              >
                                Limpiar filtro
                              </button>
                            )}
                          </div>

                          {/* Candidates & Search Results */}
                          <div className="max-h-52 overflow-y-auto space-y-1 divide-y divide-slate-850">
                            {/* Option: Create New Product */}
                            <button
                              type="button"
                              onClick={() => handleSelectProduct(m.item.id, null, 'new')}
                              className="w-full text-left p-1.5 rounded hover:bg-slate-800 text-slate-300 flex items-center justify-between group transition border border-dashed border-slate-700 hover:border-orange-500/60"
                            >
                              <div className="flex items-center space-x-1.5">
                                <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
                                <span className="font-semibold text-blue-300">
                                  Crear como nuevo producto en Odoo
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">
                                [default_code: {m.item.partNumber}]
                              </span>
                            </button>

                            {/* Show search results */}
                            {combinedSearchResults.length === 0 ? (
                              <div className="p-3 text-center text-slate-400 text-xs">
                                No se encontraron productos coincidentes en Odoo para "{inlineSearchQuery}".
                              </div>
                            ) : (
                              combinedSearchResults.map(prod => (
                                <button
                                  key={prod.id}
                                  type="button"
                                  onClick={() => handleSelectProduct(m.item.id, prod, 'manual')}
                                  className="w-full text-left p-1.5 rounded hover:bg-slate-800/80 transition flex items-center justify-between gap-2 border border-transparent hover:border-slate-700"
                                >
                                  <div className="truncate min-w-0">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="font-mono font-bold text-orange-400 text-[10px] shrink-0">
                                        {prod.default_code ? `[${prod.default_code}]` : ''}
                                      </span>
                                      <span className="text-slate-200 font-medium truncate text-xs">
                                        {prod.name}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-2 mt-0.5">
                                      <span>ID: {prod.id}</span>
                                      <span>•</span>
                                      <span className="text-emerald-400">Stock: {prod.qty_available} {prod.uom_id}</span>
                                      {prod.standard_price > 0 && <span>• ${prod.standard_price.toLocaleString('es-AR')}</span>}
                                    </div>
                                  </div>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 font-semibold hover:bg-emerald-500 hover:text-white transition">
                                    Vincular
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Product Preview Card or Interactive Search Trigger */
                        p ? (
                          <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition gap-2">
                            <div className="truncate min-w-0">
                              <div className="flex items-center space-x-1.5 truncate">
                                <span className="font-mono font-bold text-orange-400 text-[10px] shrink-0">
                                  {p.default_code ? `[${p.default_code}]` : `ID:${p.id}`}
                                </span>
                                <span className="text-slate-200 truncate font-medium text-xs" title={p.name}>
                                  {p.name}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-2 mt-0.5">
                                <span>ID Odoo: {p.id}</span>
                                <span>•</span>
                                <span className="text-emerald-400">Stock: {p.qty_available} {p.uom_id}</span>
                              </div>
                            </div>

                            {/* Quick Change / Select Button & Unlink */}
                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSearchItemId(m.item.id);
                                  const initialQuery = p.default_code || extractSearchCode(m.item.partNumber);
                                  setInlineSearchQuery(initialQuery);
                                  handleSearchInputChange(initialQuery);
                                }}
                                className="px-2 py-1 rounded bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-semibold flex items-center space-x-1 transition"
                                title="Cambiar producto vinculado en Odoo"
                              >
                                <span>Cambiar</span>
                                <ChevronDown className="w-3 h-3 text-slate-400" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSelectProduct(m.item.id, null, 'new')}
                                className="p-1 rounded bg-slate-850 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 border border-slate-700 text-[10px] transition"
                                title="Desvincular (buscar otro o crear como nuevo)"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => {
                              setActiveSearchItemId(m.item.id);
                              const initialQuery = extractSearchCode(m.item.partNumber);
                              setInlineSearchQuery(initialQuery);
                              handleSearchInputChange(initialQuery);
                            }}
                            className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/90 border border-amber-500/50 hover:border-orange-500 cursor-pointer transition group"
                            title="Hacer clic para abrir buscador y desplegable de productos Odoo"
                          >
                            <div className="flex items-center space-x-2 truncate">
                              <Search className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                              <span className="text-slate-300 text-xs truncate">
                                Buscar producto en Odoo (código o referencia CAD)...
                              </span>
                            </div>
                            <div className="flex items-center space-x-1 shrink-0">
                              <span className="text-[10px] text-orange-400 font-semibold group-hover:underline">
                                Desplegar
                              </span>
                              <ChevronDown className="w-3.5 h-3.5 text-orange-400" />
                            </div>
                          </div>
                        )
                      )}
                    </td>

                    {/* Mapping Match Status */}
                    <td className="px-3 py-2 text-center">
                      {m.matchType === 'exact' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 inline-flex items-center space-x-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Exacto</span>
                        </span>
                      )}
                      {m.matchType === 'similar' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950/70 text-amber-300 border border-amber-500/40 inline-flex items-center space-x-1" title={`${m.candidates.length} productos similares encontrados en Odoo`}>
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>Similar ({m.candidates.length})</span>
                        </span>
                      )}
                      {m.matchType === 'manual' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-950/70 text-blue-300 border border-blue-500/40 inline-flex items-center space-x-1">
                          <span>Manual</span>
                        </span>
                      )}
                      {m.matchType === 'new' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700 inline-flex items-center space-x-1">
                          <span>Crear</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom Footer / Requisition History Bar */}
      <div className="bg-slate-950 border-t border-slate-800 px-5 py-2.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center space-x-3 text-slate-400">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="flex items-center space-x-1.5 text-slate-300 hover:text-white transition font-medium"
          >
            <Clock className="w-3.5 h-3.5 text-orange-400" />
            <span>Historial de Solicitudes ({requisitions.length})</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition transform ${isHistoryOpen ? 'rotate-180' : ''}`} />
          </button>
          <span className="text-slate-600">|</span>
          <span className="text-[11px] font-mono text-slate-500">
            Destino Odoo: <span className="text-slate-300">https://deblasi.adhoc.ar</span>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onGoToBom}
            className="px-3 py-1 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded border border-slate-700 transition"
          >
            Volver a la LDM
          </button>
        </div>
      </div>

      {/* Expandable Requisitions Drawer */}
      {isHistoryOpen && (
        <div className="bg-slate-950 border-t border-slate-800 p-4 max-h-48 overflow-y-auto space-y-2 text-xs">
          <div className="font-bold text-slate-300 uppercase text-[10px] tracking-wider mb-2">
            Solicitudes de Compra Creadas en Odoo (purchase.requisition)
          </div>
          {requisitions.length === 0 ? (
            <div className="text-slate-500 italic text-[11px]">
              No hay solicitudes creadas aún en esta sesión.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {requisitions.map(r => (
                <div key={r.id} className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-orange-400">{r.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300">
                      {r.state}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 truncate" title={r.origin}>
                    {r.origin}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {r.lines?.length || 0} líneas • {r.timestamp || r.ordering_date}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Añadir Pieza Comercial Manual a la Solicitud */}
      {isAddManualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <PlusCircle className="w-4 h-4 text-orange-400" />
                <span>Añadir Pieza Comercial (COM) a la Solicitud</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsAddManualOpen(false)} 
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualItem} className="space-y-3 text-xs">
              <p className="text-[11px] text-slate-400">
                Agregá un artículo comercial extra o insumo de compra a la LDM activa para vincularlo y pedirlo en Odoo.
              </p>

              <div>
                <label className="text-slate-400 block mb-1">Referencia / Código Comercial:</label>
                <input
                  type="text"
                  required
                  placeholder="ej. RODAMIENTO UCFL 206 o MOTOR-UMI-50"
                  value={manualPartNumber}
                  onChange={(e) => setManualPartNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Descripción de Ingeniería:</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Rodamiento autoalineable con caja brida 2 agujeros"
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
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
                    value={manualQty}
                    onChange={(e) => setManualQty(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Unidad de Medida:</label>
                  <select
                    value={manualUom}
                    onChange={(e) => setManualUom(e.target.value)}
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
                <label className="text-slate-400 block mb-1">Tipo de Material / Proveedor sugerido:</label>
                <input
                  type="text"
                  placeholder="ej. Comercial / Normalizado / SKF / STM"
                  value={manualMaterial}
                  onChange={(e) => setManualMaterial(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddManualOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded shadow"
                >
                  Agregar a Solicitud COM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
