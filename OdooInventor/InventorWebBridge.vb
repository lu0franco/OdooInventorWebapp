Imports System
Imports System.Collections.Generic
Imports System.Diagnostics
Imports System.IO
Imports System.Net.Http
Imports System.Reflection
Imports System.Text
Imports System.Text.Json
Imports System.Threading.Tasks
Imports System.Windows.Forms
Imports Inventor

' =====================================================================
' PUENTE ENTRE AUTODESK INVENTOR Y LA WEBAPP ODOOINVENTOR
' Extrae en caliente el ensamble 3D activo (toda la LDM) y la pasa a la WebApp
' =====================================================================
Public Class InventorWebBridge

    ' URL Activa de la WebApp en Google Cloud (ais-dev es el contenedor activo, NO usar ais-pre que da 404)
    Public Const DEFAULT_WEBAPP_URL As String =
        "https://ais-dev-42l3or3b2dxjrpc2vewuxp-636822672302.us-west2.run.app"

    ''' <summary>
    ''' Obtiene la URL configurada para la WebApp:
    ''' 1. Detecta si localhost:3000 está activo en la PC
    ''' 2. Variable de entorno ODOO_INVENTOR_WEBAPP_URL
    ''' 3. Archivo C:\OdooInventor\config.ini o InventorWebBridge.ini
    ''' 4. Servidor en la nube ais-dev por defecto (sin 404)
    ''' </summary>
    Public Shared Function GetConfiguredWebAppUrl() As String
        Try
            ' 1. Detectar si el servidor local está activo en http://localhost:3000
            ' Se usa 127.0.0.1: en Windows "localhost" intenta primero ::1 (IPv6) y el
            ' servidor Node escucha solo en IPv4, lo que demora ~2 s y vencía el timeout.
            Try
                Using handler As New HttpClientHandler() With {.UseProxy = False},
                      client As New HttpClient(handler)
                    client.Timeout = TimeSpan.FromMilliseconds(2000)
                    Dim resp = client.GetAsync("http://127.0.0.1:3000/api/odoo/state").Result
                    If resp.IsSuccessStatusCode Then
                        Return "http://localhost:3000"
                    End If
                End Using
            Catch
            End Try

            ' 2. Variable de entorno si está definida
            Dim envUrl As String = System.Environment.GetEnvironmentVariable("ODOO_INVENTOR_WEBAPP_URL")
            If Not String.IsNullOrWhiteSpace(envUrl) Then
                Return envUrl.Trim()
            End If

            ' 3. Archivo de configuración en la carpeta del Add-In o en C:\OdooInventor\config.ini
            Dim addinDir As String = System.IO.Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)
            Dim localIni As String = System.IO.Path.Combine(addinDir, "InventorWebBridge.ini")
            If System.IO.File.Exists(localIni) Then
                Dim lines = System.IO.File.ReadAllLines(localIni)
                For Each line In lines
                    Dim trimmed = line.Trim()
                    If trimmed.StartsWith("URL=", StringComparison.OrdinalIgnoreCase) Then
                        Dim val = trimmed.Substring(4).Trim()
                        If Not String.IsNullOrWhiteSpace(val) Then Return val
                    End If
                Next
            End If

            ' 4. Carpeta global C:\OdooInventor\config.ini
            Dim globalIni As String = "C:\OdooInventor\config.ini"
            If System.IO.File.Exists(globalIni) Then
                Dim lines = System.IO.File.ReadAllLines(globalIni)
                For Each line In lines
                    Dim trimmed = line.Trim()
                    If trimmed.StartsWith("URL=", StringComparison.OrdinalIgnoreCase) Then
                        Dim val = trimmed.Substring(4).Trim()
                        If Not String.IsNullOrWhiteSpace(val) Then Return val
                    End If
                Next
            End If
        Catch
        End Try

        Return DEFAULT_WEBAPP_URL
    End Function

    Public Shared Async Function AbrirEnWebAppAsync(
        invApp As Inventor.Application,
        Optional webAppBaseUrl As String = "") As Task

        If String.IsNullOrWhiteSpace(webAppBaseUrl) Then
            webAppBaseUrl = GetConfiguredWebAppUrl()
        End If

        Try
            Dim doc As Document = invApp.ActiveDocument

            ' Si no hay documento abierto en Inventor, avisar claramente y NO abrir URLs inválidas
            If doc Is Nothing Then
                MessageBox.Show(
                    "No hay ningún ensamblaje abierto en Autodesk Inventor." & System.Environment.NewLine & System.Environment.NewLine &
                    "Por favor abrí el ensamble (.iam) que deseás sincronizar con Odoo antes de presionar este botón.",
                    "OdooInventor — Sin Ensamblaje Activo",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning)
                Return
            End If

            ' Validar que sea un Ensamblaje
            If doc.DocumentType <> DocumentTypeEnum.kAssemblyDocumentObject Then
                MessageBox.Show(
                    "El archivo activo '" & doc.DisplayName & "' no es un ensamblaje (.iam)." & System.Environment.NewLine & System.Environment.NewLine &
                    "Para sincronizar la Lista de Materiales (LDM) completa a Odoo, debés tener abierto un archivo de ensamblaje.",
                    "OdooInventor — Solo Ensamblajes",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning)
                Return
            End If

            Dim partNumber As String = doc.DisplayName
            Dim description As String = doc.DisplayName
            Dim material As String = "Acero Inoxidable / Estructura Mixta"
            Dim mass As Double = 0.0
            Dim volume As Double = 0.0
            Dim dimensions As String = "N/A"
            Dim revision As String = "Rev. 1"
            Dim author As String = "Inventor Designer"

            ' 1. Leer iProperties del documento activo (Ensamblaje principal)
            Try
                Dim designProps As PropertySet = doc.PropertySets.Item("Design Tracking Properties")
                Try
                    partNumber = designProps.Item("Part Number").Value.ToString()
                Catch
                End Try
                Try
                    description = designProps.Item("Description").Value.ToString()
                Catch
                End Try
                Try
                    material = designProps.Item("Material").Value.ToString()
                Catch
                End Try

                ' Priorizar propiedad personalizada MATERIAL_PLANO de Custom Properties
                Dim asmMatPlano As String = GetMaterialPlano(doc)
                If Not String.IsNullOrWhiteSpace(asmMatPlano) AndAlso asmMatPlano <> "Acero / Normalizado" Then
                    material = asmMatPlano
                End If

                Dim summaryProps As PropertySet = doc.PropertySets.Item("Inventor Summary Information")
                Try
                    author = summaryProps.Item("Author").Value.ToString()
                Catch
                End Try
                Try
                    revision = summaryProps.Item("Revision Number").Value.ToString()
                Catch
                End Try
            Catch
            End Try

            Dim bomList As New List(Of Dictionary(Of String, Object))()
            Dim asmDoc As AssemblyDocument = CType(doc, AssemblyDocument)

            ' Calcular masa y volumen del ensamblaje
            Try
                mass = Math.Round(asmDoc.ComponentDefinition.MassProperties.Mass, 2)
                volume = Math.Round(asmDoc.ComponentDefinition.MassProperties.Volume, 2)
                Dim rangeBox As Box = asmDoc.ComponentDefinition.RangeBox
                Dim dx As Double = Math.Round((rangeBox.MaxPoint.X - rangeBox.MinPoint.X) * 10, 1) ' cm a mm
                Dim dy As Double = Math.Round((rangeBox.MaxPoint.Y - rangeBox.MinPoint.Y) * 10, 1)
                Dim dz As Double = Math.Round((rangeBox.MaxPoint.Z - rangeBox.MinPoint.Z) * 10, 1)
                dimensions = String.Format("{0}mm x {1}mm x {2}mm", dx, dy, dz)
            Catch
            End Try

            Dim occurrencesCount As New Dictionary(Of String, Double)()
            Dim occurrencesMeta As New Dictionary(Of String, Tuple(Of String, String, String))() ' (Description, Material, UoM)
            Dim occurrencesIsCom As New Dictionary(Of String, Boolean)() ' Propiedad personalizada COM

            ' =========================================================================
            ' ESTRATEGIA 1: BOM Nativa de Inventor (BOMViews: Structured y PartsOnly)
            ' Esta es la lista oficial que el usuario ve en la tabla de LDM de Inventor
            ' =========================================================================
            Try
                Dim oBOM As BOM = asmDoc.ComponentDefinition.BOM
                Try
                    oBOM.PartsOnlyViewEnabled = True
                Catch
                End Try
                Try
                    oBOM.StructuredViewEnabled = True
                    oBOM.StructuredViewFirstLevelOnly = False
                Catch
                End Try

                Dim targetBOMView As BOMView = Nothing
                For Each view As BOMView In oBOM.BOMViews
                    If view.ViewType = BOMViewTypeEnum.kStructuredBOMViewType Then
                        targetBOMView = view
                        Exit For
                    End If
                Next

                If targetBOMView Is Nothing Then
                    For Each view As BOMView In oBOM.BOMViews
                        If view.ViewType = BOMViewTypeEnum.kPartsOnlyBOMViewType Then
                            targetBOMView = view
                            Exit For
                        End If
                    Next
                End If

                If targetBOMView IsNot Nothing Then
                    ProcessBOMRows(targetBOMView.BOMRows, occurrencesCount, occurrencesMeta, occurrencesIsCom)
                End If
            Catch
            End Try

            ' =========================================================================
            ' ESTRATEGIA 2: Recorrido recursivo completo (incluye piezas .ipt y ensamblajes .iam)
            ' =========================================================================
            If occurrencesCount.Count = 0 Then
                TraverseOccurrencesRecursive(asmDoc.ComponentDefinition.Occurrences, occurrencesCount, occurrencesMeta, occurrencesIsCom)
            End If

            ' Armar la lista final ordenada
            Dim itemIdx As Integer = 1
            For Each kvp In occurrencesCount
                Dim meta = occurrencesMeta(kvp.Key)
                Dim isComVal As Boolean = If(occurrencesIsCom.ContainsKey(kvp.Key), occurrencesIsCom(kvp.Key), False)
                Dim itemDict As New Dictionary(Of String, Object) From {
                    {"id", itemIdx.ToString()},
                    {"item", itemIdx.ToString()},
                    {"partNumber", kvp.Key},
                    {"description", meta.Item1},
                    {"qty", kvp.Value},
                    {"uom", meta.Item3},
                    {"material", meta.Item2},
                    {"isCom", isComVal},
                    {"odooId", "PROD-" & (100 + itemIdx).ToString()},
                    {"status", "pending"}
                }
                bomList.Add(itemDict)
                itemIdx += 1
            Next

            ' 3. Armar el paquete de datos del CAD
            Dim payload As New Dictionary(Of String, Object) From {
                {"assemblyName", doc.DisplayName},
                {"partNumber", partNumber},
                {"description", description},
                {"revision", revision},
                {"author", author},
                {"material", material},
                {"mass", mass},
                {"volume", volume},
                {"dimensions", dimensions},
                {"bom", bomList}
            }

            Dim jsonPayload As String = JsonSerializer.Serialize(payload, New JsonSerializerOptions With {.WriteIndented = True})

            ' 4. COPIAR SIEMPRE AL PORTAPAPELES Y GUARDAR EN DISCO (Garantía 100% infalible)
            Try
                Clipboard.SetText(jsonPayload)
            Catch
            End Try

            Try
                Dim exportDir As String = "C:\OdooInventor"
                If Not Directory.Exists(exportDir) Then Directory.CreateDirectory(exportDir)
                System.IO.File.WriteAllText(System.IO.Path.Combine(exportDir, "bom_export.json"), jsonPayload, Encoding.UTF8)

                ' También generar un CSV compatible directo
                Dim sbCsv As New StringBuilder()
                sbCsv.AppendLine("Item,PartNumber,Description,Quantity,UoM,Material,OdooID,Status")
                For Each b In bomList
                    sbCsv.AppendLine(String.Format("""{0}"",""{1}"",""{2}"",{3},""{4}"",""{5}"",""{6}"",""{7}""",
                        b("item"), b("partNumber"), b("description"), b("qty"), b("uom"), b("material"), b("odooId"), b("status")))
                Next
                System.IO.File.WriteAllText(System.IO.Path.Combine(exportDir, "bom_export.csv"), sbCsv.ToString(), Encoding.UTF8)
            Catch
            End Try

            ' 5. Preparar URL limpia de destino con payload incrustado (Garantía de apertura directa en navegador)
            Dim sessionId As String = ""
            Dim compactPayloadJson As String = JsonSerializer.Serialize(payload)
            Dim base64Compact As String = Convert.ToBase64String(Encoding.UTF8.GetBytes(compactPayloadJson))
            Dim directUrlWithData As String = webAppBaseUrl.TrimEnd("/"c)

            If base64Compact.Length < 7500 Then
                directUrlWithData = String.Format("{0}/?import={1}", webAppBaseUrl.TrimEnd("/"c), Uri.EscapeDataString(base64Compact))
            Else
                directUrlWithData = String.Format("{0}/?view=bom", webAppBaseUrl.TrimEnd("/"c))
            End If

            Dim postSuccess As Boolean = False

            ' 6. Intentar POST directo a la WebApp (API de sincronización en vivo)
            Try
                Using http As New HttpClient()
                    http.Timeout = TimeSpan.FromSeconds(6)
                    Dim content As New StringContent(jsonPayload, Encoding.UTF8, "application/json")
                    Dim endpointUrl As String = webAppBaseUrl.TrimEnd("/"c) & "/api/inventor/import-session"
                    Dim response As HttpResponseMessage = Await http.PostAsync(endpointUrl, content)

                    If response.IsSuccessStatusCode Then
                        postSuccess = True
                        Dim respText As String = Await response.Content.ReadAsStringAsync()
                        Using jsonDoc As JsonDocument = JsonDocument.Parse(respText)
                            sessionId = jsonDoc.RootElement.GetProperty("sessionId").GetString()
                            directUrlWithData = String.Format("{0}/?session={1}", webAppBaseUrl.TrimEnd("/"c), sessionId)
                        End Using
                    End If
                End Using
            Catch
            End Try

            ' 7. Informar al usuario en Inventor y ofrecer abrir la WebApp
            Dim msgConfirmacion As String
            If postSuccess Then
                msgConfirmacion = String.Format(
                    "¡Lista de Materiales transmitida exitosamente a la WebApp!" & System.Environment.NewLine & System.Environment.NewLine &
                    "• Ensamblaje: {0}" & System.Environment.NewLine &
                    "• Componentes extraídos: {1} piezas reales" & System.Environment.NewLine &
                    "• Servidor conectado: {2}" & System.Environment.NewLine & System.Environment.NewLine &
                    "La WebApp en tu navegador actualiza la LDM en tiempo real." & System.Environment.NewLine &
                    "• Copia de seguridad en Portapapeles y en C:\OdooInventor\bom_export.json" & System.Environment.NewLine & System.Environment.NewLine &
                    "¿Deseás abrir o refrescar la WebApp en el navegador?",
                    partNumber, bomList.Count, webAppBaseUrl)
            Else
                msgConfirmacion = String.Format(
                    "¡{0} componentes reales extraídos del ensamblaje '{1}'!" & System.Environment.NewLine & System.Environment.NewLine &
                    "• Se copiaron al PORTAPAPELES de Windows automáticamente." & System.Environment.NewLine &
                    "• Se guardó una copia en C:\OdooInventor\bom_export.json" & System.Environment.NewLine & System.Environment.NewLine &
                    "¿Deseás abrir la WebApp ahora en el navegador precargada con estos componentes?",
                    bomList.Count, partNumber)
            End If

            Dim res As DialogResult = MessageBox.Show(
                msgConfirmacion,
                "OdooInventor — Sincronización de LDM",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Information)

            If res = DialogResult.Yes Then
                Process.Start(New ProcessStartInfo(directUrlWithData) With {.UseShellExecute = True})
            End If

        Catch ex As Exception
            MessageBox.Show(
                "Error al extraer BOM de Inventor: " & System.Environment.NewLine & System.Environment.NewLine & ex.ToString(),
                "OdooInventor Bridge",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error)
        End Try

    End Function

    ''' <summary>
    ''' Procesa filas de la BOM nativa de Inventor de forma recursiva, incluyendo propiedad COM.
    ''' </summary>
    Private Shared Sub ProcessBOMRows(
        rows As BOMRowsEnumerator,
        counts As Dictionary(Of String, Double),
        meta As Dictionary(Of String, Tuple(Of String, String, String)),
        isComMap As Dictionary(Of String, Boolean))

        If rows Is Nothing Then Return

        For Each row As BOMRow In rows
            Try
                Dim pNum As String = ""
                Dim pDesc As String = ""
                Dim pMat As String = "Acero / Normalizado"
                Dim uom As String = "Unidades"
                Dim qty As Double = 1.0
                Dim isComVal As Boolean = False

                Try
                    qty = Convert.ToDouble(row.ItemQuantity)
                Catch
                    qty = 1.0
                End Try

                Dim compDef As ComponentDefinition = Nothing
                If row.ComponentDefinitions.Count > 0 Then
                    compDef = row.ComponentDefinitions.Item(1)
                End If

                If compDef IsNot Nothing AndAlso compDef.Document IsNot Nothing Then
                    Dim rowDoc As Document = compDef.Document
                    pNum = rowDoc.DisplayName
                    pDesc = rowDoc.DisplayName
                    Try
                        Dim dp As PropertySet = rowDoc.PropertySets.Item("Design Tracking Properties")
                        Try
                            pNum = dp.Item("Part Number").Value.ToString()
                        Catch
                        End Try
                        Try
                            pDesc = dp.Item("Description").Value.ToString()
                        Catch
                        End Try
                    Catch
                    End Try

                    ' Priorizar MATERIAL_PLANO y COM de Custom Properties
                    pMat = GetMaterialPlano(rowDoc)
                    isComVal = GetIsCom(rowDoc, pNum, pMat)
                ElseIf compDef IsNot Nothing Then
                    ' Para componentes virtuales u ocurrencias sin documento en disco
                    Try
                        pMat = GetMaterialPlanoFromPropertySets(compDef.PropertySets)
                        isComVal = GetIsComFromPropertySets(compDef.PropertySets, pNum, pMat)
                    Catch
                    End Try
                End If

                If String.IsNullOrWhiteSpace(pNum) Then
                    Try
                        pNum = row.ItemNumber
                    Catch
                    End Try
                End If

                If String.IsNullOrWhiteSpace(pDesc) Then pDesc = pNum
                pNum = pNum.Trim()

                If Not String.IsNullOrWhiteSpace(pNum) Then
                    If counts.ContainsKey(pNum) Then
                        counts(pNum) += qty
                    Else
                        counts(pNum) = qty
                        meta(pNum) = New Tuple(Of String, String, String)(pDesc, pMat, uom)
                        isComMap(pNum) = isComVal
                    End If
                End If

                ' Recorrer sub-filas hijas si existen (ensamblajes hijos)
                If row.ChildRows IsNot Nothing AndAlso row.ChildRows.Count > 0 Then
                    ProcessBOMRows(row.ChildRows, counts, meta, isComMap)
                End If
            Catch
            End Try
        Next
    End Sub

    ''' <summary>
    ''' Recorrido recursivo que garantiza extraer TODAS las piezas (.ipt) Y ensamblajes (.iam)
    ''' </summary>
    Private Shared Sub TraverseOccurrencesRecursive(
        occs As ComponentOccurrences,
        counts As Dictionary(Of String, Double),
        meta As Dictionary(Of String, Tuple(Of String, String, String)),
        isComMap As Dictionary(Of String, Boolean))

        If occs Is Nothing Then Return

        For Each occ As ComponentOccurrence In occs
            Try
                If occ.Suppressed Then Continue For
                If occ.BOMStructure = BOMStructureEnum.kReferenceBOMStructure Then Continue For

                Dim pNum As String = ""
                Dim pDesc As String = ""
                Dim pMat As String = "Acero / Normalizado"
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

                        ' Priorizar MATERIAL_PLANO y COM de Custom Properties
                        pMat = GetMaterialPlano(defDoc)
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
                    meta(pNum) = New Tuple(Of String, String, String)(pDesc, pMat, "Unidades")
                    isComMap(pNum) = isComVal
                End If

                ' Si es un subensamblaje con sub-ocurrencias, recorrer también todos sus componentes hijos
                If occ.SubOccurrences IsNot Nothing AndAlso occ.SubOccurrences.Count > 0 Then
                    TraverseOccurrencesRecursive(occ.SubOccurrences, counts, meta, isComMap)
                End If
            Catch
            End Try
        Next
    End Sub

    ''' <summary>
    ''' Obtiene el material especificado con máxima prioridad para 'MATERIAL_PLANO' 
    ''' ubicado en Custom Properties (Inventor User Defined Properties).
    ''' Si no está definido en Custom Properties, realiza fallback al material de Design Tracking Properties.
    ''' </summary>
    Public Shared Function GetMaterialPlano(doc As Document) As String
        If doc Is Nothing Then Return "Acero / Normalizado"
        Try
            Return GetMaterialPlanoFromPropertySets(doc.PropertySets)
        Catch
            Return "Acero / Normalizado"
        End Try
    End Function

    ''' <summary>
    ''' Inspecciona colecciones de iProperties buscando 'MATERIAL_PLANO' en Custom Properties
    ''' </summary>
    Public Shared Function GetMaterialPlanoFromPropertySets(pSets As PropertySets) As String
        If pSets Is Nothing Then Return "Acero / Normalizado"

        ' 1. Buscar prioritariamente en "Inventor User Defined Properties" (Pestaña Personalizadas / Custom)
        Try
            Dim customProps As PropertySet = pSets.Item("Inventor User Defined Properties")
            If customProps IsNot Nothing Then
                For Each prop As [Property] In customProps
                    Dim pName As String = prop.Name
                    If String.Equals(pName, "MATERIAL_PLANO", StringComparison.OrdinalIgnoreCase) OrElse
                       String.Equals(pName, "MATERIAL PLANO", StringComparison.OrdinalIgnoreCase) OrElse
                       String.Equals(pName, "MATERIAL_PLANOS", StringComparison.OrdinalIgnoreCase) Then
                        If prop.Value IsNot Nothing Then
                            Dim valStr As String = prop.Value.ToString().Trim()
                            If Not String.IsNullOrWhiteSpace(valStr) Then
                                Return valStr
                            End If
                        End If
                    End If
                Next
            End If
        Catch
        End Try

        ' 2. Búsqueda exhaustiva en todos los PropertySets del modelo
        Try
            For Each pSet As PropertySet In pSets
                Try
                    For Each prop As [Property] In pSet
                        Dim pName As String = prop.Name
                        If String.Equals(pName, "MATERIAL_PLANO", StringComparison.OrdinalIgnoreCase) OrElse
                           String.Equals(pName, "MATERIAL PLANO", StringComparison.OrdinalIgnoreCase) Then
                            If prop.Value IsNot Nothing Then
                                Dim valStr As String = prop.Value.ToString().Trim()
                                If Not String.IsNullOrWhiteSpace(valStr) Then
                                    Return valStr
                                End If
                            End If
                        End If
                    Next
                Catch
                End Try
            Next
        Catch
        End Try

        ' 3. Fallback: Design Tracking Properties -> Material
        Try
            Dim dp As PropertySet = pSets.Item("Design Tracking Properties")
            If dp IsNot Nothing Then
                Dim matProp As [Property] = dp.Item("Material")
                If matProp IsNot Nothing AndAlso matProp.Value IsNot Nothing Then
                    Dim valStr As String = matProp.Value.ToString().Trim()
                    If Not String.IsNullOrWhiteSpace(valStr) Then
                        Return valStr
                    End If
                End If
            End If
        Catch
        End Try

        Return "Acero / Normalizado"
    End Function

    ''' <summary>
    ''' Obtiene el valor booleano de la propiedad personalizada COM (True/False, SI/NO, 1/0, X, VERDADERO)
    ''' </summary>
    Public Shared Function GetIsCom(doc As Document, pNum As String, pMat As String) As Boolean
        If doc Is Nothing Then Return False
        Try
            Return GetIsComFromPropertySets(doc.PropertySets, pNum, pMat)
        Catch
            Return False
        End Try
    End Function

    ''' <summary>
    ''' Inspecciona colecciones de iProperties buscando 'COM' en Custom Properties
    ''' </summary>
    Public Shared Function GetIsComFromPropertySets(pSets As PropertySets, pNum As String, pMat As String) As Boolean
        If pSets Is Nothing Then Return False
        Try
            Dim customProps As PropertySet = pSets.Item("Inventor User Defined Properties")
            If customProps IsNot Nothing Then
                For Each prop As [Property] In customProps
                    Dim pName As String = prop.Name
                    If String.Equals(pName, "COM", StringComparison.OrdinalIgnoreCase) Then
                        If prop.Value IsNot Nothing Then
                            Dim v As String = prop.Value.ToString().Trim().ToUpper()
                            If v = "✓" Then
                                Return True
                            ElseIf v = " " OrElse v = "" Then
                                Return False
                            End If
                        End If
                    End If
                Next
            End If
        Catch
        End Try

        If Not String.IsNullOrWhiteSpace(pNum) Then
            Dim pUpper = pNum.ToUpper()
            If pUpper.StartsWith("COMERCIAL") OrElse pUpper.StartsWith("ISO ") OrElse pUpper.StartsWith("ROD-") Then
                Return True
            End If
        End If
        If Not String.IsNullOrWhiteSpace(pMat) AndAlso pMat.ToUpper().Contains("NORMALIZADO") Then
            Return True
        End If

        Return False
    End Function

End Class
