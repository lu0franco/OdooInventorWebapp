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
