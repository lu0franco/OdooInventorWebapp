Imports System
Imports System.Collections.Generic
Imports System.Drawing
Imports System.IO
Imports System.Reflection
Imports System.Windows.Forms
Imports Inventor

' =====================================================================
' CLASE DE DATOS PARA CADA BOTÓN DEL RIBBON
' =====================================================================
Public Class ButtonData

    Public Property DisplayName As String
    Public Property InternalName As String
    Public Property Description As String
    Public Property Environment As String
    Public Property LargeIcon As String
    Public Property ExecuteAction As Action(Of Inventor.Application)

    Public Sub New(
        displayName As String,
        internalName As String,
        description As String,
        environment As String,
        executeAction As Action(Of Inventor.Application),
        Optional largeIcon As String = "")

        Me.DisplayName = displayName
        Me.InternalName = internalName
        Me.Description = description
        Me.Environment = environment
        Me.ExecuteAction = executeAction
        Me.LargeIcon = largeIcon

    End Sub

End Class


' =====================================================================
' GESTOR DE BOTONES Y PESTAÑAS (TECNICA / ODOO)
' =====================================================================
Public Class Buttons

    Private ReadOnly _inventor As Inventor.Application

    ' =========================================================
    ' CONFIGURACIÓN DE PESTAÑA:
    ' Si True: Busca primero si ya existe "TAB_TECNICA" (de RuleManager).
    '          Si existe, mete el panel "ODOO" adentro de TECNICA.
    '          Si no existe, crea una pestaña propia "TAB_ODOO".
    ' Si False: Siempre crea una pestaña independiente llamada "ODOO".
    ' =========================================================
    Public Property UseExistingTecnicaTabIfAvailable As Boolean = True

    Private Const TAB_TECNICA_INTERNAL As String = "TAB_TECNICA"
    Private Const TAB_ODOO_INTERNAL As String = "TAB_ODOO"
    Private Const TAB_ODOO_DISPLAY As String = "ODOO"

    Private Const PANEL_ODOO_INTERNAL As String = "PANEL_ODOO"
    Private Const PANEL_ODOO_DISPLAY As String = "ODOO"

    Private ReadOnly _buttonsData As New List(Of ButtonData)
    Private ReadOnly _buttons As New Dictionary(Of String, ButtonDefinition)
    Private ReadOnly _buttonActions As New Dictionary(Of String, Action(Of Inventor.Application))


    ' =========================================================
    ' CONSTRUCTOR
    ' =========================================================
    Public Sub New(inventor As Inventor.Application)

        _inventor = inventor

        LoadButtonsData()

        CreateButtons()

    End Sub


    ' =========================================================
    ' CARGAR BOTONES POR ENTORNO (Assembly, Part, Drawing, ZeroDoc)
    ' =========================================================
    Private Sub LoadButtonsData()

        ' =====================================================
        ' 1. ENSAMBLAJE (Assembly - .iam)
        ' =====================================================
        _buttonsData.Add(New ButtonData(
            "Probar Odoo",
            "BTN_ODOO_TEST_ASM",
            "Prueba la conectividad JSON-RPC con el servidor Odoo.",
            "Assembly",
            AddressOf EjecutarProbarConexion,
            "icon_odoo_test_32x32.png"))

        _buttonsData.Add(New ButtonData(
            "Sincronizar BOM",
            "BTN_ODOO_SYNC_BOM",
            "Extrae la estructura del ensamblaje y genera o actualiza mrp.bom en Odoo.",
            "Assembly",
            AddressOf EjecutarSincronizarBOM,
            "icon_odoo_bom_32x32.png"))

        _buttonsData.Add(New ButtonData(
            "Enviar iProperties",
            "BTN_ODOO_PROP_ASM",
            "Envía masa, volumen, material y costo a Odoo product.template.",
            "Assembly",
            AddressOf EjecutarEnviarPropiedades,
            "icon_odoo_prop_32x32.png"))

        _buttonsData.Add(New ButtonData(
            "Stock Ensamblaje",
            "BTN_ODOO_STOCK_ASM",
            "Consulta en Odoo la disponibilidad en almacén de los componentes.",
            "Assembly",
            AddressOf EjecutarConsultarStock,
            "icon_odoo_stock_32x32.png"))


        ' =====================================================
        ' 2. PIEZA (Part - .ipt)
        ' =====================================================
        _buttonsData.Add(New ButtonData(
            "Probar Odoo",
            "BTN_ODOO_TEST_PART",
            "Prueba la conectividad JSON-RPC con el servidor Odoo.",
            "Part",
            AddressOf EjecutarProbarConexion,
            "icon_odoo_test_32x32.png"))

        _buttonsData.Add(New ButtonData(
            "Sincronizar Pieza",
            "BTN_ODOO_SYNC_PART",
            "Crea o actualiza la pieza en Odoo (product.template).",
            "Part",
            AddressOf EjecutarSincronizarPieza,
            "icon_odoo_part_32x32.png"))

        _buttonsData.Add(New ButtonData(
            "Stock Pieza",
            "BTN_ODOO_STOCK_PART",
            "Consulta stock disponible en Odoo para esta pieza.",
            "Part",
            AddressOf EjecutarConsultarStock,
            "icon_odoo_stock_32x32.png"))


        ' =====================================================
        ' 3. PLANO (Drawing - .idw / .dwg)
        ' =====================================================
        _buttonsData.Add(New ButtonData(
            "Vincular con Odoo",
            "BTN_ODOO_LINK_DWG",
            "Asocia este plano con el código de producto en Odoo.",
            "Drawing",
            AddressOf EjecutarVincularPlano,
            "icon_odoo_link_32x32.png"))

        _buttonsData.Add(New ButtonData(
            "Actualizar Rótulo",
            "BTN_ODOO_UPDATE_DWG",
            "Trae descripción y código del ERP al cajetín del plano.",
            "Drawing",
            AddressOf EjecutarActualizarRotulo,
            "icon_odoo_dwg_32x32.png"))


        ' =====================================================
        ' 4. SIN DOCUMENTO ABIERTO (ZeroDoc)
        ' =====================================================
        _buttonsData.Add(New ButtonData(
            "Probar Odoo",
            "BTN_ODOO_TEST_ZERODOC",
            "Prueba la conexión con Odoo sin necesidad de abrir un documento.",
            "ZeroDoc",
            AddressOf EjecutarProbarConexion,
            "icon_odoo_test_32x32.png"))

        _buttonsData.Add(New ButtonData(
            "Configuración Odoo",
            "BTN_ODOO_CONFIG",
            "Configura la URL y credenciales de Odoo.",
            "ZeroDoc",
            AddressOf EjecutarConfiguracion,
            "icon_odoo_config_32x32.png"))

    End Sub


    ' =========================================================
    ' CREAR DEFINICIONES DE COMANDO
    ' =========================================================
    Private Sub CreateButtons()

        Dim conDefs As ControlDefinitions =
            _inventor.CommandManager.ControlDefinitions

        For Each btnData In _buttonsData

            Dim btn As ButtonDefinition

            Try
                btn = conDefs.Item(btnData.InternalName)
            Catch
                Dim iconObj As Object = LoadIcon(btnData.LargeIcon)

                btn = conDefs.AddButtonDefinition(
                    btnData.DisplayName,
                    btnData.InternalName,
                    CommandTypesEnum.kEditMaskCmdType,
                    Guid.NewGuid().ToString(),
                    btnData.Description,
                    btnData.Description,
                    Nothing,
                    iconObj)
            End Try

            Dim internalName As String = btnData.InternalName
            AddHandler btn.OnExecute, Sub() ExecuteButtonAction(internalName)

            If Not _buttons.ContainsKey(btnData.InternalName) Then
                _buttons.Add(btnData.InternalName, btn)
            End If

            If Not _buttonActions.ContainsKey(btnData.InternalName) Then
                _buttonActions.Add(btnData.InternalName, btnData.ExecuteAction)
            End If

            ' Agregar a la cinta según el entorno
            AddButtonToRibbon(btn, btnData)

        Next

    End Sub


    ' =========================================================
    ' AGREGAR BOTÓN A LA CINTA (Busca TAB_TECNICA o crea TAB_ODOO)
    ' =========================================================
    Private Sub AddButtonToRibbon(
        btn As ButtonDefinition,
        btnData As ButtonData)

        Try

            ' 1. Obtener Ribbon del entorno correspondiente
            Dim ribbon As Ribbon = Nothing
            Try
                ribbon = _inventor.UserInterfaceManager.Ribbons.Item(btnData.Environment)
            Catch ex As Exception
                ' Si el entorno no existe o no está inicializado (ej. ZeroDoc en algunas versiones)
                Return
            End Try

            If ribbon Is Nothing Then Return

            ' 2. Resolver Pestaña (TAB):
            Dim ribbonTab As RibbonTab = Nothing

            ' A) Si UseExistingTecnicaTabIfAvailable está habilitado, buscar si existe TAB_TECNICA
            If UseExistingTecnicaTabIfAvailable Then
                Try
                    ribbonTab = ribbon.RibbonTabs.Item(TAB_TECNICA_INTERNAL)
                Catch
                    ' No existe TAB_TECNICA en este entorno
                End Try
            End If

            ' B) Si no se encontró TAB_TECNICA, buscar si ya existe TAB_ODOO
            If ribbonTab Is Nothing Then
                Try
                    ribbonTab = ribbon.RibbonTabs.Item(TAB_ODOO_INTERNAL)
                Catch
                    ' No existe TAB_ODOO aún
                End Try
            End If

            ' C) Si ninguna existe, crearla:
            If ribbonTab Is Nothing Then
                Try
                    ' Si preferimos ODOO, creamos pestaña propia "ODOO"
                    ribbonTab = ribbon.RibbonTabs.Add(
                        TAB_ODOO_DISPLAY,
                        TAB_ODOO_INTERNAL,
                        Guid.NewGuid().ToString())
                Catch
                    ' Si falló, intentar crear TAB_TECNICA como fallback
                    Try
                        ribbonTab = ribbon.RibbonTabs.Add(
                            "TECNICA",
                            TAB_TECNICA_INTERNAL,
                            Guid.NewGuid().ToString())
                    Catch
                    End Try
                End Try
            End If

            If ribbonTab Is Nothing Then Return

            ' 3. Resolver Panel (PANEL_ODOO) dentro de la pestaña:
            Dim ribbonPanel As RibbonPanel = Nothing
            Try
                ribbonPanel = ribbonTab.RibbonPanels.Item(PANEL_ODOO_INTERNAL)
            Catch
                ribbonPanel = ribbonTab.RibbonPanels.Add(
                    PANEL_ODOO_DISPLAY,
                    PANEL_ODOO_INTERNAL,
                    Guid.NewGuid().ToString())
            End Try

            If ribbonPanel Is Nothing Then Return

            ' 4. Agregar botón al panel con icono grande (True)
            ribbonPanel.CommandControls.AddButton(btn, True)

        Catch ex As Exception
            System.Diagnostics.Debug.WriteLine(
                "Error agregando botón " & btnData.InternalName & ": " & ex.Message)
        End Try

    End Sub


    ' =========================================================
    ' DESPACHO DE ACCIONES
    ' =========================================================
    Private Sub ExecuteButtonAction(internalName As String)

        Try

            If _buttonActions.ContainsKey(internalName) Then
                _buttonActions(internalName).Invoke(_inventor)
            End If

        Catch ex As Exception

            MessageBox.Show(
                "Error en comando " & internalName & ":" & System.Environment.NewLine & System.Environment.NewLine & ex.ToString(),
                "OdooInventor",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error)

        End Try

    End Sub


    ' =========================================================
    ' ACCIONES DE BOTONES
    ' =========================================================

    Private Sub EjecutarProbarConexion(invApp As Inventor.Application)
        Try
            Using form As New OdooTestForm(invApp)
                form.ShowDialog()
            End Using
        Catch ex As Exception
            MessageBox.Show("Error al abrir formulario de prueba: " & ex.Message, "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Error)
        End Try
    End Sub

    Private Async Sub EjecutarSincronizarBOM(invApp As Inventor.Application)
        Dim doc As Document = invApp.ActiveDocument
        If doc Is Nothing OrElse doc.DocumentType <> DocumentTypeEnum.kAssemblyDocumentObject Then
            MessageBox.Show("Abrí un ensamblaje (.iam) para transferir la lista de materiales a la WebApp.", "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Warning)
            Return
        End If

        ' Abre la WebApp en el navegador o WebView2 precargada con los componentes de este ensamblaje
        Await InventorWebBridge.AbrirEnWebAppAsync(invApp)
    End Sub

    Private Sub EjecutarEnviarPropiedades(invApp As Inventor.Application)
        Dim doc As Document = invApp.ActiveDocument
        If doc Is Nothing Then
            MessageBox.Show("No hay ningún documento abierto.", "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Warning)
            Return
        End If

        MessageBox.Show(
            "Propiedades listas para enviar a Odoo para: " & doc.DisplayName,
            "OdooInventor - iProperties",
            MessageBoxButtons.OK,
            MessageBoxIcon.Information)
    End Sub

    Private Sub EjecutarConsultarStock(invApp As Inventor.Application)
        Dim doc As Document = invApp.ActiveDocument
        Dim nombre As String = If(doc IsNot Nothing, doc.DisplayName, "Selección")
        MessageBox.Show(
            "Consultando existencias de stock en Odoo para: " & nombre,
            "OdooInventor - Stock",
            MessageBoxButtons.OK,
            MessageBoxIcon.Information)
    End Sub

    Private Sub EjecutarSincronizarPieza(invApp As Inventor.Application)
        Dim doc As Document = invApp.ActiveDocument
        If doc Is Nothing OrElse doc.DocumentType <> DocumentTypeEnum.kPartDocumentObject Then
            MessageBox.Show("Abrí una pieza (.ipt) para sincronizarla.", "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Warning)
            Return
        End If

        MessageBox.Show("Sincronizando pieza '" & doc.DisplayName & "' con Odoo...", "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Information)
    End Sub

    Private Sub EjecutarVincularPlano(invApp As Inventor.Application)
        MessageBox.Show("Vinculando plano con producto Odoo...", "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Information)
    End Sub

    Private Sub EjecutarActualizarRotulo(invApp As Inventor.Application)
        MessageBox.Show("Actualizando cajetín/rótulo desde Odoo ERP...", "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Information)
    End Sub

    Private Sub EjecutarConfiguracion(invApp As Inventor.Application)
        Using form As New OdooTestForm(invApp)
            form.ShowDialog()
        End Using
    End Sub


    ' =========================================================
    ' CARGAR ÍCONO (PNG a IPictureDisp)
    ' =========================================================
    Private Function LoadIcon(fileName As String) As Object

        If String.IsNullOrWhiteSpace(fileName) Then Return Nothing

        Try

            Dim addinPath As String =
                System.IO.Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)

            Dim iconPath As String =
                System.IO.Path.Combine(addinPath, "Icons", fileName)

            If Not System.IO.File.Exists(iconPath) Then
                Return Nothing
            End If

            Using bmp As New Bitmap(iconPath)
                Return PictureDispConverter.ToIPictureDisp(bmp)
            End Using

        Catch
            Return Nothing
        End Try

    End Function


    ' =========================================================
    ' CONVERSOR AXHOST PARA GDI+ -> IPictureDisp
    ' =========================================================
    Private Class PictureDispConverter
        Inherits AxHost

        Private Sub New()
            MyBase.New(String.Empty)
        End Sub

        Public Shared Function ToIPictureDisp(image As Image) As Object
            Try
                Return GetIPictureDispFromPicture(image)
            Catch
                Return Nothing
            End Try
        End Function

    End Class

End Class
