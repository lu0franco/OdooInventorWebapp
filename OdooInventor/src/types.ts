export interface BomItem {
  id: string;
  item: string;
  partNumber: string;
  description: string;
  qty: number;
  uom: string;
  material: string;
  odooId: string;
  status: 'synced' | 'pending' | 'conflict';
  isCom?: boolean; // Propiedad personalizada COM (Comercial / Para Pedido de Compra PO)
}

export interface IProperties {
  Title: string;
  Subject: string;
  Company: string;
  Manager: string;
  CostCenter: string;
  StandardCost: number;
  StockLocation: string;
  // Campos del RuleManager / Proyecto de Inventor vinculados a Odoo
  PartNumber?: string;   // Nº de pieza (Púrpura) -> Referencia en Odoo
  StockNumber?: string;  // Nº de almacenamiento (Amarillo) -> Descripción en Odoo
  Project?: string;      // Proyecto (OT) (Rojo) -> Prefijo Referencia en Odoo
  Designer?: string;     // Diseñador (Azul) -> Autorizador en Odoo
  Vendor?: string;       // Proveedor / Cliente
  Location?: string;     // Ubicación de archivo / Documento
}

export interface CadPart {
  partNumber: string;
  name: string;
  fileType: 'iam' | 'ipt' | 'idw';
  revision: string;
  author: string;
  material: string;
  mass: number;
  volume: number;
  dimensions: string;
  odooProductId: string;
  syncStatus: 'synced' | 'modified' | 'pending';
  lastSync: string;
  iProperties: IProperties;
  bom: BomItem[];
}

export interface OdooProduct {
  id: number;
  default_code: string;
  name: string;
  list_price: number;
  standard_price: number;
  qty_available: number;
  uom_id: string;
  type: string;
  bom_count: number;
}

export interface SyncLog {
  id: number;
  timestamp: string;
  action: string;
  target: string;
  status: 'OK' | 'ERROR' | 'WARNING';
  details: string;
}

export interface ConnectionTestResult {
  success: boolean;
  statusCode?: number;
  statusText?: string;
  url?: string;
  latencyMs?: number;
  rawResponse?: string;
  jsonResponse?: any;
  formattedOutput: string;
  error?: string;
  isNetworkError?: boolean;
}

export interface PurchaseRequisitionLine {
  id?: string | number;
  partNumber: string;
  description: string;
  qty: number;
  uom: string;
  price_unit?: number;
  schedule_date?: string;
  isCom?: boolean;
  product_id?: number | string;
  notes?: string;
}

export interface PurchaseRequisition {
  id?: number | string;
  name: string;
  origin: string;
  state: 'draft' | 'ongoing' | 'in_progress' | 'done' | 'cancel';
  type_id?: string;
  user_id?: string;
  ordering_date?: string;
  schedule_date?: string;
  lines: PurchaseRequisitionLine[];
  timestamp?: string;
  notes?: string;
  simulated?: boolean;
}

export type ActiveView = 'bom' | 'iproperties' | 'products' | 'logs' | 'requisition';

