Imports System
Imports System.Collections.Generic
Imports System.Diagnostics
Imports System.Net.Http
Imports System.Text
Imports System.Text.Json
Imports System.Threading.Tasks
Imports System.Windows.Forms
Imports Inventor

' =====================================================================
' PUENTE ENTRE AUTODESK INVENTOR Y LA WEBAPP ODOOINVENTOR
' Extrae en caliente el ensamble 3D activo y lo abre precargado en la WebApp
' =====================================================================
Public Class InventorWebBridge

    ' URL de desarrollo de la WebApp en Google Cloud
    Public Const DEFAULT_WEBAPP_URL As String =
        "https://ais-dev-juowvfnmryjo7ihziv3xfp-470848947286.us-east5.run.app"

    Public Shared Async Function AbrirEnWebAppAsync(
        invApp As Inventor.Application,
        Optional webAppBaseUrl As String = DEFAULT_WEBAPP_URL) As Task

        Try

            Dim doc As Document = invApp.ActiveDocument

            ' Si no hay documento abierto, abrir la WebApp en inicio
            If doc Is Nothing Then
                Process.Start(New ProcessStartInfo(webAppBaseUrl) With {.UseShellExecute = True})
                Return
            End If

            Dim partNumber As String = doc.DisplayName
            Dim material As String = "No especificado"
            Dim mass As Double = 0.0
            Dim bomList As New List(Of Object)()

            ' Si es un Ensamblaje (.iam), extraer la lista de componentes reales de Inventor
            If doc.DocumentType = DocumentTypeEnum.kAssemblyDocumentObject Then

                Dim asmDoc As AssemblyDocument = CType(doc, AssemblyDocument)
                Dim oBOM As BOM = asmDoc.ComponentDefinition.BOM
                oBOM.PartsOnlyViewEnabled = True

                Try
                    ' Buscar la vista de solo piezas (Parts Only)
                    Dim oBOMView As BOMView = Nothing
                    For Each view As BOMView In oBOM.BOMViews
                        If view.ViewType = BOMViewTypeEnum.kPartsOnlyBOMViewType Then
                            oBOMView = view
                            Exit For
                        End If
                    Next

                    If oBOMView IsNot Nothing Then
                        For Each row As BOMRow In oBOMView.BOMRows
                            Dim compDef As ComponentDefinition = row.ComponentDefinitions.Item(1)
                            Dim rowPartNumber As String = row.ItemNumber
                            Dim rowDocName As String = compDef.Document.DisplayName

                            bomList.Add(New With {
                                .partNumber = rowDocName,
                                .description = "Componente " & rowDocName,
                                .qty = row.ItemQuantity,
                                .uom = "Unidades",
                                .material = "Normalizado"
                            })
                        Next
                    End If
                Catch
                End Try

            End If

            ' Armar el paquete de datos del CAD
            Dim payload As New With {
                .assemblyName = doc.DisplayName,
                .partNumber = partNumber,
                .material = material,
                .mass = mass,
                .bom = bomList
            }

            ' Enviar datos al endpoint de la WebApp
            Using http As New HttpClient()
                http.Timeout = TimeSpan.FromSeconds(8)
                Dim jsonPayload As String = JsonSerializer.Serialize(payload)
                Dim content As New StringContent(jsonPayload, Encoding.UTF8, "application/json")

                Try
                    Dim endpointUrl As String = webAppBaseUrl.TrimEnd("/"c) & "/api/inventor/import-session"
                    Dim response As HttpResponseMessage = Await http.PostAsync(endpointUrl, content)

                    If response.IsSuccessStatusCode Then
                        Dim respText As String = Await response.Content.ReadAsStringAsync()
                        Using jsonDoc As JsonDocument = JsonDocument.Parse(respText)
                            Dim sessionId As String = jsonDoc.RootElement.GetProperty("sessionId").GetString()
                            ' Abrir navegador en la sesión exacta con todos los datos precargados
                            Dim targetUrl As String = webAppBaseUrl.TrimEnd("/"c) & "/?session=" & sessionId
                            Process.Start(New ProcessStartInfo(targetUrl) With {.UseShellExecute = True})
                            Return
                        End Using
                    End If
                Catch
                End Try

                ' Fallback: si no hubo conexión al endpoint, abrir la WebApp directamente
                Process.Start(New ProcessStartInfo(webAppBaseUrl) With {.UseShellExecute = True})

            End Using

        Catch ex As Exception
            MessageBox.Show(
                "Error al abrir WebApp: " & ex.Message,
                "OdooInventor Bridge",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning)
        End Try

    End Function

End Class
