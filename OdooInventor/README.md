# OdooInventor

Integración de **Autodesk Inventor 2027** con el sistema ERP **Odoo** a través de servicios JSON-RPC.

## Características

- **Prueba de Conectividad JSON-RPC**: Diagnóstico directo con el endpoint `/jsonrpc` de Odoo (método `common.version`), medición de latencia HTTP y visualización detallada de respuestas.
- **Autodesk Inventor Ribbon & Add-In**: Réplica de la interfaz de Inventor con la pestaña `ODOO`, panel dedicado y comando para ejecutar la prueba de conexión (`OdooTestForm`).
- **Visualizador CAD 3D**: Renderizado isométrico de ensamblajes (`.iam`) y piezas (`.ipt`), con rotación 3D en tiempo real, desglose de vista explosionada y cálculo de propiedades físicas (masa, volumen, material).
- **Gestión de iProperties**: Mapeo bidireccional de metadatos de ingeniería con registros `product.template` de Odoo (centro de costos, costo estándar, ubicación de almacén).
- **Lista de Materiales (BOM) a Odoo MRP**: Sincronización de componentes del ensamble CAD con las listas de materiales de fabricación de Odoo (`mrp.bom` y `mrp.bom.line`), con exportación a CSV.
- **Catálogo Odoo ERP**: Explorador de inventario y stock de productos vinculados.
- **Registro de Auditoría**: Trazabilidad completa de llamadas de red y sincronizaciones.

## Ejecución

```bash
npm install
npm run dev
```

El servidor web y proxy JSON-RPC se iniciará en el puerto 3000 (`http://192.168.0.229:3000`).
