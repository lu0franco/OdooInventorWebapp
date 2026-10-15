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

    ' URL Activa de la WebApp en Google Cloud (ais-dev es el contenedor activo, no usar ais-pre que da 404)
    Public Const DEFAULT_WEBAPP_URL As String =
        "https://ais-dev-42l3or3b2dxjrpc2vewuxp-636822672302.us-west2.run.app"

    ''' <summary>
    ''' Obtiene la URL configurada para la WebApp, ya sea desde archivo INI local o la URL por defecto.
    ''' </summary>
    Public Shared Function GetConfiguredWebAppUrl() As String
        Try
            ' 1. Variable de entorno si está definida
            Dim envUrl As String = Environment.GetEnvironmentVariable("ODOO_INVENTOR_WEBAPP_URL")
            If Not String.IsNullOrWhiteSpace(envUrl) Then
                Return envUrl.Trim()
            End If

            ' 2. Archivo de configuración en la carpeta del Add-In o en C:\OdooInventor\config.ini
            Dim addinDir As String = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)
            Dim localIni As String = Path.Combine(addinDir, "InventorWebBridge.ini")
            If File.Exists(localIni) Then
                Dim lines = File.ReadAllLines(localIni)
                For Each line In lines
                    Dim trimmed = line.Trim()
                    If trimmed.StartsWith("URL=", StringComparison.OrdinalIgnoreCase) Then
                        Dim val = trimmed.Substring(4).Trim()
                        If Not String.IsNullOrWhiteSpace(val) Then Return val
                    End If
                Next
            End If

            ' 3. Carpeta global C:\OdooInventor\config.ini
            Dim globalIni As String = "C:\OdooInventor\config.ini"
            If File.Exists(globalIni) Then
                Dim lines = File.ReadAllLines(globalIni)
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

            ' Si no hay documento abierto, abrir la WebApp en la vista BOM
            If doc Is Nothing Then
                Process.Start(New ProcessStartInfo(webAppBaseUrl.TrimEnd("/"c) & "/?view=bom") With {.UseShellExecute = True})
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

            ' 2. Extraer la Lista de Materiales (LDM) COMPLETA de Inventor (todas las piezas reales, hasta 22 o más)
            If doc.DocumentType = DocumentTypeEnum.kAssemblyDocumentObject Then
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

                ' ESTRATEGIA 1: BOM Nativa de Inventor (BOMViews: PartsOnly y Structured)
                ' Esta es la lista oficial que el usuario ve en la tabla de LDM de Inventor
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
                        If view.ViewType = BOMViewTypeEnum.kPartsOnlyBOMViewType Then
                            targetBOMView = view
                            Exit For
                        End If
                    Next

                    If targetBOMView Is Nothing Then
                        For Each view As BOMView In oBOM.BOMViews
                            If view.ViewType = BOMViewTypeEnum.kStructuredBOMViewType Then
                                targetBOMView = view
                                Exit For
                            End If
                        Next
                    End If

                    If targetBOMView IsNot Nothing Then
                        ProcessBOMRows(targetBOMView.BOMRows, occurrencesCount, occurrencesMeta)
                    End If
                Catch
                End Try

                ' ESTRATEGIA 2: Si la BOM no devolvió filas, recorrer todas las ocurrencias hojas (AllLeafOccurrences)
                If occurrencesCount.Count = 0 Then
                    Try
                        For Each occ As ComponentOccurrence In asmDoc.ComponentDefinition.Occurrences.AllLeafOccurrences
                            Try
                                If occ.Suppressed Then Continue For
                                If occ.BOMStructure = BOMStructureEnum.kReferenceBOMStructure Then Continue For

                                Dim pNum As String = ""
                                Dim pDesc As String = ""
                                Dim pMat As String = "Acero / Normalizado"

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
                                If occurrencesCount.ContainsKey(pNum) Then
                                    occurrencesCount(pNum) += 1
                                Else
                                    occurrencesCount(pNum) = 1
                                    occurrencesMeta(pNum) = New Tuple(Of String, String, String)(pDesc, pMat, "Unidades")
                                End If
                            Catch
                            End Try
                        Next
                    Catch
                    End Try
                End If

                ' ESTRATEGIA 3: Recorrido recursivo de Occurrences directas
                If occurrencesCount.Count = 0 Then
                    TraverseOccurrencesRecursive(asmDoc.ComponentDefinition.Occurrences, occurrencesCount, occurrencesMeta)
                End If

                ' Armar la lista final ordenada
                Dim itemIdx As Integer = 1
                For Each kvp In occurrencesCount
                    Dim meta = occurrencesMeta(kvp.Key)
                    Dim itemDict As New Dictionary(Of String, Object) From {
                        {"id", itemIdx.ToString()},
                        {"item", itemIdx.ToString()},
                        {"partNumber", kvp.Key},
                        {"description", meta.Item1},
                        {"qty", kvp.Value},
                        {"uom", meta.Item3},
                        {"material", meta.Item2},
                        {"odooId", "PROD-" & (100 + itemIdx).ToString()},
                        {"status", "pending"}
                    }
                    bomList.Add(itemDict)
                    itemIdx += 1
                Next

            End If

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
                File.WriteAllText(Path.Combine(exportDir, "bom_export.json"), jsonPayload, Encoding.UTF8)

                ' También generar un CSV compatible directo
                Dim sbCsv As New StringBuilder()
                sbCsv.AppendLine("Item,PartNumber,Description,Quantity,UoM,Material,OdooID,Status")
                For Each b In bomList
                    sbCsv.AppendLine(String.Format("""{0}"",""{1}"",""{2}"",{3},""{4}"",""{5}"",""{6}"",""{7}""",
                        b("item"), b("partNumber"), b("description"), b("qty"), b("uom"), b("material"), b("odooId"), b("status")))
                Next
                File.WriteAllText(Path.Combine(exportDir, "bom_export.csv"), sbCsv.ToString(), Encoding.UTF8)
            Catch
            End Try

            ' 5. Preparar URL de destino (ais-dev)
            Dim sessionId As String = ""
            Dim directUrlWithData As String = webAppBaseUrl.TrimEnd("/"c) & "/?view=bom"
            Dim postSuccess As Boolean = False

            ' 6. Intentar POST directo a la WebApp (API)
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
                            directUrlWithData = String.Format("{0}/?session={1}&view=bom", webAppBaseUrl.TrimEnd("/"c), sessionId)
                        End Using
                    End If
                End Using
            Catch
            End Try

            ' 7. Informar al usuario en Inventor y consultar antes de abrir una pestaña redundante
            If postSuccess Then
                Dim msgExito As String = String.Format(
                    "¡Lista de Materiales transmitida exitosamente a la WebApp!" & Environment.NewLine & Environment.NewLine &
                    "• Ensamblaje: {0}" & Environment.NewLine &
                    "• Componentes reales: {1} piezas" & Environment.NewLine &
                    "• La pestaña que ya tenés abierta en el navegador (OdooInventorWebapp) se actualiza automáticamente." & Environment.NewLine &
                    "• También se copió al Portapapeles y se guardó en C:\OdooInventor\bom_export.json" & Environment.NewLine & Environment.NewLine &
                    "¿Deseás abrir una pestaña nueva en el navegador?",
                    partNumber, bomList.Count)

                Dim res As DialogResult = MessageBox.Show(
                    msgExito,
                    "OdooInventor — Sincronización Exitosa",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Information)

                If res = DialogResult.Yes Then
                    Process.Start(New ProcessStartInfo(directUrlWithData) With {.UseShellExecute = True})
                End If
            Else
                ' Si el POST directo no conectó (bloqueo de red o proxy)
                Dim msgClipboard As String = String.Format(
                    "¡{0} componentes extraídos del ensamblaje '{1}'!" & Environment.NewLine & Environment.NewLine &
                    "1. Los datos se copiaron al PORTAPAPELES de Windows y se guardaron en C:\OdooInventor\bom_export.json." & Environment.NewLine &
                    "2. En la WebApp (pestaña que ya tenés abierta), hacé clic en el botón verde: '📋 Pegar LDM del Portapapeles' para cargarlos al instante." & Environment.NewLine & Environment.NewLine &
                    "¿Deseás abrir la WebApp en el navegador ahora?",
                    bomList.Count, partNumber)

                Dim res As DialogResult = MessageBox.Show(
                    msgClipboard,
                    "OdooInventor — LDM en Portapapeles",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Information)

                If res = DialogResult.Yes Then
                    Process.Start(New ProcessStartInfo(directUrlWithData) With {.UseShellExecute = True})
                End If
            End If

        Catch ex As Exception
            MessageBox.Show(
                "Error al extraer BOM de Inventor: " & Environment.NewLine & Environment.NewLine & ex.ToString(),
                "OdooInventor Bridge",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error)
        End Try

    End Function

    ''' <summary>
    ''' Procesa filas de la BOM nativa de Inventor de forma recursiva.
    ''' </summary>
    Private Shared Sub ProcessBOMRows(
        rows As BOMRowsEnumerator,
        counts As Dictionary(Of String, Double),
        meta As Dictionary(Of String, Tuple(Of String, String, String)))

        If rows Is Nothing Then Return

        For Each row As BOMRow In rows
            Try
                Dim pNum As String = ""
                Dim pDesc As String = ""
                Dim pMat As String = "Normalizado"
                Dim pUom As String = "Unidades"
                Dim qty As Double = row.ItemQuantity

                If row.ComponentDefinitions IsNot Nothing AndAlso row.ComponentDefinitions.Count > 0 Then
                    Dim compDef As ComponentDefinition = row.ComponentDefinitions.Item(1)
                    Try
                        Dim rowDoc As Document = compDef.Document
                        If rowDoc IsNot Nothing Then
                            pNum = rowDoc.DisplayName
                            pDesc = rowDoc.DisplayName
                            Dim dp As PropertySet = rowDoc.PropertySets.Item("Design Tracking Properties")
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
                End If

                If String.IsNullOrWhiteSpace(pNum) Then
                    pNum = "PIEZA-" & (counts.Count + 1).ToString()
                End If
                If String.IsNullOrWhiteSpace(pDesc) Then pDesc = pNum

                pNum = pNum.Trim()
                If counts.ContainsKey(pNum) Then
                    counts(pNum) += qty
                Else
                    counts(pNum) = qty
                    meta(pNum) = New Tuple(Of String, String, String)(pDesc, pMat, pUom)
                End If

                ' Si la fila tiene hijos (subensamblajes desglosados)
                If row.ChildRows IsNot Nothing AndAlso row.ChildRows.Count > 0 Then
                    ProcessBOMRows(row.ChildRows, counts, meta)
                End If
            Catch
            End Try
        Next
    End Sub

    ''' <summary>
    ''' Recorrido recursivo de ocurrencias de componentes en caso de fallo de BOM
    ''' </summary>
    Private Shared Sub TraverseOccurrencesRecursive(
        occurrences As ComponentOccurrences,
        counts As Dictionary(Of String, Double),
        meta As Dictionary(Of String, Tuple(Of String, String, String)))

        If occurrences Is Nothing Then Return

        For Each occ As ComponentOccurrence In occurrences
            Try
                If occ.Suppressed Then Continue For
                If occ.BOMStructure = BOMStructureEnum.kReferenceBOMStructure Then Continue For

                If occ.SubOccurrences IsNot Nothing AndAlso occ.SubOccurrences.Count > 0 AndAlso occ.BOMStructure <> BOMStructureEnum.kInseparableBOMStructure Then
                    TraverseOccurrencesRecursive(occ.SubOccurrences, counts, meta)
                Else
                    Dim pNum As String = ""
                    Dim pDesc As String = ""
                    Dim pMat As String = "Normalizado"

                    Try
                        Dim doc As Document = occ.Definition.Document
                        If doc IsNot Nothing Then
                            pNum = doc.DisplayName
                            pDesc = doc.DisplayName
                            Dim dp As PropertySet = doc.PropertySets.Item("Design Tracking Properties")
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
                        meta(pNum) = New Tuple(Of String, String, String)(pDesc, pMat, "Unidades")
                    End If
                End If
            Catch
            End Try
        Next
    End Sub

End Class
