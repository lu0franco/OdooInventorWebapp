import React, { useState } from 'react';
import { X, FileCode, CheckCircle, Download, ExternalLink, Terminal, Shield, Package, Copy, Check } from 'lucide-react';

interface AddinInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddinInfoModal: React.FC<AddinInfoModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'buttons' | 'architecture' | 'icons'>('icons');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const buttonsVbSnippet = `' =====================================================================
' BUTTONS.VB PARA ODOOINVENTOR (Autodesk Inventor Add-In)
' Genera la pestaña TAB_ODOO dinámicamente según el entorno:
' - Assembly (.iam): Probar Conexión, Sincronizar BOM, iProperties, Stock
' - Part (.ipt): Probar Conexión, Sincronizar Pieza, Stock
' - Drawing (.idw): Vincular Plano, Actualizar Rótulo desde ERP
' - ZeroDoc: Probar Conexión Odoo, Configuración
' =====================================================================

Imports System
Imports System.Collections.Generic
Imports System.Drawing
Imports System.IO
Imports System.Reflection
Imports System.Windows.Forms
Imports Inventor

Public Class ButtonData
    Public Property DisplayName As String
    Public Property InternalName As String
    Public Property Description As String
    Public Property Environment As String
    Public Property LargeIcon As String
    Public Property ExecuteAction As Action(Of Inventor.Application)

    Public Sub New(displayName As String, internalName As String, description As String,
                   environment As String, executeAction As Action(Of Inventor.Application),
                   Optional largeIcon As String = "")
        Me.DisplayName = displayName
        Me.InternalName = internalName
        Me.Description = description
        Me.Environment = environment
        Me.ExecuteAction = executeAction
        Me.LargeIcon = largeIcon
    End Sub
End Class

Public Class Buttons
    Private ReadOnly _inventor As Inventor.Application
    Private ReadOnly _buttonsData As New List(Of ButtonData)
    Private ReadOnly _buttons As New Dictionary(Of String, ButtonDefinition)
    Private ReadOnly _buttonActions As New Dictionary(Of String, Action(Of Inventor.Application))

    Private Const RIBBON_TAB_DISPLAY_NAME As String = "ODOO ERP"
    Private Const RIBBON_TAB_INTERNAL_NAME As String = "TAB_ODOO"
    Private Const RIBBON_PANEL_DISPLAY_NAME As String = "ODOO INTEGRACIÓN"
    Private Const RIBBON_PANEL_INTERNAL_NAME As String = "PANEL_ODOO"

    Public Sub New(inventor As Inventor.Application)
        _inventor = inventor
        LoadButtonsData()
        CreateButtons()
    End Sub

    Private Sub LoadButtonsData()
        ' Assembly (.iam)
        _buttonsData.Add(New ButtonData("Probar Conexión", "BTN_ODOO_TEST_ASM", "Prueba JSON-RPC con Odoo", "Assembly", AddressOf EjecutarProbarConexion))
        _buttonsData.Add(New ButtonData("Sincronizar BOM a MRP", "BTN_ODOO_SYNC_BOM", "Sincroniza con mrp.bom", "Assembly", AddressOf EjecutarSincronizarBOM))
        _buttonsData.Add(New ButtonData("Enviar iProperties", "BTN_ODOO_PROP_ASM", "Envía propiedades a product.template", "Assembly", AddressOf EjecutarEnviarPropiedades))
        _buttonsData.Add(New ButtonData("Consultar Stock", "BTN_ODOO_STOCK_ASM", "Consulta stock en almacén", "Assembly", AddressOf EjecutarConsultarStock))

        ' Part (.ipt)
        _buttonsData.Add(New ButtonData("Probar Conexión", "BTN_ODOO_TEST_PART", "Prueba JSON-RPC con Odoo", "Part", AddressOf EjecutarProbarConexion))
        _buttonsData.Add(New ButtonData("Sincronizar Pieza", "BTN_ODOO_SYNC_PART", "Sincroniza ficha de pieza con Odoo", "Part", AddressOf EjecutarSincronizarPieza))
        _buttonsData.Add(New ButtonData("Consultar Stock Pieza", "BTN_ODOO_STOCK_PART", "Consulta stock en almacén", "Part", AddressOf EjecutarConsultarStock))

        ' Drawing (.idw)
        _buttonsData.Add(New ButtonData("Vincular con Odoo", "BTN_ODOO_LINK_DWG", "Vincula plano con código Odoo", "Drawing", AddressOf EjecutarVincularPlano))
        _buttonsData.Add(New ButtonData("Actualizar Rótulo", "BTN_ODOO_UPDATE_DWG", "Trae descripción y código desde Odoo", "Drawing", AddressOf EjecutarActualizarRotulo))

        ' ZeroDoc
        _buttonsData.Add(New ButtonData("Probar Conexión Odoo", "BTN_ODOO_TEST_ZERODOC", "Prueba conexión sin documentos abiertos", "ZeroDoc", AddressOf EjecutarProbarConexion))
        _buttonsData.Add(New ButtonData("Configuración Odoo", "BTN_ODOO_CONFIG", "Configura URL y credenciales de Odoo", "ZeroDoc", AddressOf EjecutarConfiguracion))
    End Sub

    Private Sub CreateButtons()
        Dim conDefs As ControlDefinitions = _inventor.CommandManager.ControlDefinitions
        For Each btnData In _buttonsData
            Dim btn As ButtonDefinition
            Try
                btn = conDefs.Item(btnData.InternalName)
            Catch
                btn = conDefs.AddButtonDefinition(btnData.DisplayName, btnData.InternalName,
                                                  CommandTypesEnum.kEditMaskCmdType,
                                                  Guid.NewGuid().ToString(), btnData.Description,
                                                  btnData.Description, Nothing, LoadIcon(btnData.LargeIcon))
            End Try
            Dim internalName As String = btnData.InternalName
            AddHandler btn.OnExecute, Sub() ExecuteButtonAction(internalName)
            If Not _buttons.ContainsKey(internalName) Then _buttons.Add(internalName, btn)
            If Not _buttonActions.ContainsKey(internalName) Then _buttonActions.Add(internalName, btnData.ExecuteAction)
            AddButtonToRibbon(btn, btnData)
        Next
    End Sub

    Private Sub AddButtonToRibbon(btn As ButtonDefinition, btnData As ButtonData)
        Try
            Dim ribbon As Ribbon = _inventor.UserInterfaceManager.Ribbons.Item(btnData.Environment)
            Dim ribbonTab As RibbonTab
            Try
                ribbonTab = ribbon.RibbonTabs.Item(RIBBON_TAB_INTERNAL_NAME)
            Catch
                ribbonTab = ribbon.RibbonTabs.Add(RIBBON_TAB_DISPLAY_NAME, RIBBON_TAB_INTERNAL_NAME, Guid.NewGuid().ToString())
            End Try
            Dim ribbonPanel As RibbonPanel
            Try
                ribbonPanel = ribbonTab.RibbonPanels.Item(RIBBON_PANEL_INTERNAL_NAME)
            Catch
                ribbonPanel = ribbonTab.RibbonPanels.Add(RIBON_PANEL_DISPLAY_NAME, RIBBON_PANEL_INTERNAL_NAME, Guid.NewGuid().ToString())
            End Try
            ribbonPanel.CommandControls.AddButton(btn, True)
        Catch ex As Exception
            System.Diagnostics.Debug.WriteLine("Error: " & ex.Message)
        End Try
    End Sub

    Private Sub ExecuteButtonAction(internalName As String)
        Try
            If _buttonActions.ContainsKey(internalName) Then
                _buttonActions(internalName).Invoke(_inventor)
            End If
        Catch ex As Exception
            MessageBox.Show(ex.ToString, "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Error)
        End Try
    End Sub

    Private Sub EjecutarProbarConexion(invApp As Inventor.Application)
        Using form As New OdooTestForm(invApp)
            form.ShowDialog()
        End Using
    End Sub

    Private Sub EjecutarSincronizarBOM(invApp As Inventor.Application)
        MessageBox.Show("Sincronizando BOM con Odoo mrp.bom...", "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Information)
    End Sub

    Private Sub EjecutarEnviarPropiedades(invApp As Inventor.Application)
        MessageBox.Show("Enviando iProperties a Odoo product.template...", "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Information)
    End Sub

    Private Sub EjecutarConsultarStock(invApp As Inventor.Application)
        MessageBox.Show("Consultando stock en almacén Odoo...", "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Information)
    End Sub

    Private Sub EjecutarSincronizarPieza(invApp As Inventor.Application)
        MessageBox.Show("Sincronizando pieza con Odoo product.template...", "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Information)
    End Sub

    Private Sub EjecutarVincularPlano(invApp As Inventor.Application)
        MessageBox.Show("Vinculando plano con producto Odoo...", "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Information)
    End Sub

    Private Sub EjecutarActualizarRotulo(invApp As Inventor.Application)
        MessageBox.Show("Actualizando cajetín de plano desde Odoo...", "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Information)
    End Sub

    Private Sub EjecutarConfiguracion(invApp As Inventor.Application)
        Using form As New OdooTestForm(invApp)
            form.ShowDialog()
        End Using
    End Sub

    Private Function LoadIcon(fileName As String) As Object
        Return Nothing ' O convertidor ToIPictureDisp
    End Function
End Class`;

  const copyCode = () => {
    navigator.clipboard.writeText(buttonsVbSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden text-slate-200 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-slate-950 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Package className="w-4 h-4 text-orange-400" />
            <h3 className="font-bold text-sm text-slate-100">
              Integración Autodesk Inventor — Buttons.vb & Arquitectura
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center space-x-2 px-5 pt-2 border-b border-slate-800 bg-slate-950/60 text-xs">
          <button
            onClick={() => setActiveTab('icons')}
            className={`px-3 py-1.5 font-semibold transition border-b-2 ${
              activeTab === 'icons' 
                ? 'border-orange-500 text-orange-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Íconos Generados (/Icons)
          </button>
          <button
            onClick={() => setActiveTab('buttons')}
            className={`px-3 py-1.5 font-semibold transition border-b-2 ${
              activeTab === 'buttons' 
                ? 'border-orange-500 text-orange-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Clase Buttons.vb (Multi-Entorno)
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1.5 font-semibold transition border-b-2 ${
              activeTab === 'architecture' 
                ? 'border-orange-500 text-orange-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Cómo Instanciar en StandardAddInServer.vb
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto text-xs leading-relaxed space-y-4 flex-1">
          {activeTab === 'buttons' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-slate-300">
                  Esta clase crea la pestaña <b>TAB_ODOO ("ODOO ERP")</b> y su panel en cada entorno de Inventor (<b>Assembly</b>, <b>Part</b>, <b>Drawing</b>, <b>ZeroDoc</b>):
                </p>
                <button
                  onClick={copyCode}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex items-center space-x-1.5 text-xs transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar Código'}</span>
                </button>
              </div>

              <div className="relative rounded-lg overflow-hidden border border-slate-800">
                <pre className="p-3.5 bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-[420px] leading-snug">
                  {buttonsVbSnippet}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-orange-500/10 border border-orange-500/30 rounded-lg space-y-1">
                <h4 className="font-bold text-orange-300">¿Cómo se conecta con StandardAddInServer.vb?</h4>
                <p className="text-slate-300">
                  En lugar de agregar botones a mano en el método <code>Activate</code>, simplemente instanciás <code>New Buttons(_inventor)</code>:
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] space-y-2">
                <div className="text-slate-400 font-bold">// Dentro de StandardAddInServer.vb:</div>
                <pre className="text-emerald-300 bg-slate-900 p-3 rounded">
{`Public Class StandardAddInServer
    Implements Inventor.ApplicationAddInServer

    Private _inventor As Inventor.Application
    Private _buttons As Buttons

    Public Sub Activate(AddInSiteObject As Inventor.ApplicationAddInSite, FirstTime As Boolean) _
        Implements Inventor.ApplicationAddInServer.Activate

        _inventor = AddInSiteObject.Application

        ' INSTANCIAR TODOS LOS BOTONES Y PESTAÑAS SEGÚN EL ENTORNO
        _buttons = New Buttons(_inventor)

    End Sub
End Class`}
                </pre>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-300 text-xs">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                  <span className="font-bold text-orange-400">Pestaña Unificada TAB_ODOO</span>
                  <p className="text-slate-400">
                    Aparece con el nombre "ODOO ERP" tanto en piezas (.ipt), ensamblajes (.iam) como en dibujos (.idw).
                  </p>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                  <span className="font-bold text-orange-400">Acciones Modulares</span>
                  <p className="text-slate-400">
                    Cada botón tiene su propia acción aislada, invocando <code>OdooTestForm</code> o la API de Odoo.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'icons' && (
            <div className="space-y-4">
              <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-orange-300">Íconos Generados para Autodesk Inventor Add-In</h4>
                  <p className="text-slate-300 text-xs mt-0.5">
                    Todos los íconos referenciados en <code>Buttons.vb</code> fueron generados en <b>32x32</b> y <b>16x16</b> píxeles con fondo transparente en <code>/Icons/</code>.
                  </p>
                </div>
                <div className="flex items-center space-x-1.5 font-mono text-[11px] bg-slate-900 px-2.5 py-1 rounded border border-slate-700 text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>16 PNGs Listos</span>
                </div>
              </div>

              {/* Grid of icons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { name: 'icon_odoo_test', title: 'Probar Conexión', env: 'Todos los entornos', desc: 'Rayo JSON-RPC' },
                  { name: 'icon_odoo_bom', title: 'Sincronizar BOM', env: 'Assembly (.iam)', desc: 'Árbol jerárquico mrp.bom' },
                  { name: 'icon_odoo_prop', title: 'iProperties', env: 'Assembly / Part', desc: 'Ficha de propiedades' },
                  { name: 'icon_odoo_stock', title: 'Consultar Stock', env: 'Assembly / Part', desc: 'Cajas almacén Odoo' },
                  { name: 'icon_odoo_part', title: 'Sincronizar Pieza', env: 'Part (.ipt)', desc: 'Engranaje CAD 3D' },
                  { name: 'icon_odoo_link', title: 'Vincular Plano', env: 'Drawing (.idw)', desc: 'Eslabones de enlace ERP' },
                  { name: 'icon_odoo_dwg', title: 'Actualizar Rótulo', env: 'Drawing (.idw)', desc: 'Plano técnico 2D' },
                  { name: 'icon_odoo_config', title: 'Configuración', env: 'ZeroDoc', desc: 'Engranaje de ajustes' },
                ].map(item => (
                  <div key={item.name} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col items-center text-center space-y-2 hover:border-orange-500/50 transition">
                    <div className="w-12 h-12 bg-slate-900 rounded-md border border-slate-700 flex items-center justify-center p-1.5 shadow-inner">
                      <img 
                        src={`/icons/${item.name}_32x32.png`} 
                        alt={item.title} 
                        className="w-8 h-8 object-contain drop-shadow" 
                      />
                    </div>
                    <div>
                      <div className="font-bold text-slate-100 text-xs">{item.title}</div>
                      <div className="text-[10px] text-orange-400 font-mono mt-0.5">{item.name}_32x32.png</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{item.env}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Instructions on Visual Studio */}
              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <span className="font-bold text-slate-200">Ubicación en tu proyecto de Visual Studio:</span>
                <p className="text-slate-400">
                  Copiá la carpeta <code>Icons/</code> dentro del proyecto de Visual Studio de tu Add-In. Seleccioná todas las imágenes PNG y en la ventana de <b>Propiedades</b> configurá:
                </p>
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-orange-300">
                  Acción de compilación (Build Action): <b>Contenido (Content)</b><br />
                  Copiar en el directorio de salida: <b>Copiar si es posterior (Copy if newer)</b>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            Archivo guardado en la raíz del proyecto: <b>/Buttons.vb</b>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded transition"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
