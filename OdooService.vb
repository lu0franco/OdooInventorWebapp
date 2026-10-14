Imports System
Imports System.Collections.Generic
Imports System.Net.Http
Imports System.Text
Imports System.Text.Json
Imports System.Threading.Tasks

' =====================================================================
' ESTRUCTURA DE COMPONENTE DE LA LISTA DE MATERIALES (LDM / EXCEL)
' =====================================================================
Public Class LdmItem
    Public Property PartNumber As String
    Public Property Description As String
    Public Property Quantity As Double = 1.0
    Public Property UnitPrice As Double = 0.0
    Public Property UnitOfMeasure As String = "Unidades"
End Class

' =====================================================================
' SERVICIO ODOO JSON-RPC 2.0 (Autodesk Inventor -> Odoo 18 Enterprise)
' =====================================================================
Public Class OdooService

    Private ReadOnly _baseUrl As String
    Private ReadOnly _http As HttpClient

    Public Sub New(baseUrl As String)

        ' Normalización de URL: eliminar barras y sufijos /odoo o /web que exigen CSRF
        Dim cleanUrl As String = baseUrl.Trim().TrimEnd("/"c)

        If cleanUrl.EndsWith("/odoo", StringComparison.OrdinalIgnoreCase) Then
            cleanUrl = cleanUrl.Substring(0, cleanUrl.Length - 5)
        ElseIf cleanUrl.EndsWith("/web", StringComparison.OrdinalIgnoreCase) Then
            cleanUrl = cleanUrl.Substring(0, cleanUrl.Length - 4)
        End If

        _baseUrl = cleanUrl

        _http = New HttpClient()
        _http.Timeout = TimeSpan.FromSeconds(30)

    End Sub

    ' =========================================================
    ' 1. PRUEBA DE CONEXIÓN (common.version)
    ' =========================================================
    Public Async Function TestCommonVersionAsync() As Task(Of String)

        Try

            Dim url As String = _baseUrl & "/jsonrpc"

            Dim requestObject As New With {
                .jsonrpc = "2.0",
                .method = "call",
                .params = New With {
                    .service = "common",
                    .method = "version",
                    .args = New Object() {}
                },
                .id = 1
            }

            Dim jsonRequest As String = JsonSerializer.Serialize(requestObject)

            Using content As New StringContent(jsonRequest, Encoding.UTF8, "application/json")

                Dim response As HttpResponseMessage = Await _http.PostAsync(url, content)
                Dim responseText As String = Await response.Content.ReadAsStringAsync()

                Dim resultado As New StringBuilder()
                resultado.AppendLine("PRUEBA ODOO JSON-RPC")
                resultado.AppendLine()
                resultado.AppendLine("HTTP: " & CInt(response.StatusCode).ToString() & " " & response.ReasonPhrase)
                resultado.AppendLine()
                resultado.AppendLine("URL:")
                resultado.AppendLine(url)
                resultado.AppendLine()
                resultado.AppendLine("Respuesta del servidor:")
                resultado.AppendLine()
                resultado.AppendLine(responseText)

                Return resultado.ToString()

            End Using

        Catch ex As Exception
            Return "ERROR DE CONEXIÓN:" & Environment.NewLine & Environment.NewLine & ex.ToString()
        End Try

    End Function

    ' =========================================================
    ' 2. AUTENTICACIÓN (common.authenticate)
    ' =========================================================
    Public Async Function AuthenticateAsync(db As String, login As String, apiKeyOrPassword As String) As Task(Of Integer)

        Dim url As String = _baseUrl & "/jsonrpc"

        Dim requestObject As New With {
            .jsonrpc = "2.0",
            .method = "call",
            .params = New With {
                .service = "common",
                .method = "authenticate",
                .args = New Object() {db, login, apiKeyOrPassword, New Dictionary(Of String, Object)()}
            },
            .id = 2
        }

        Dim jsonRequest As String = JsonSerializer.Serialize(requestObject)

        Using content As New StringContent(jsonRequest, Encoding.UTF8, "application/json")

            Dim response As HttpResponseMessage = Await _http.PostAsync(url, content)
            Dim responseText As String = Await response.Content.ReadAsStringAsync()

            Using doc As JsonDocument = JsonDocument.Parse(responseText)
                Dim root As JsonElement = doc.RootElement

                If root.TryGetProperty("error", Nothing) Then
                    Throw New Exception("Error Odoo: " & root.GetProperty("error").GetProperty("data").GetProperty("message").GetString())
                End If

                Dim resultProp As JsonElement = root.GetProperty("result")
                If resultProp.ValueKind = JsonValueKind.Number Then
                    Return resultProp.GetInt32()
                ElseIf resultProp.ValueKind = JsonValueKind.False Then
                    Throw New Exception("Credenciales inválidas en base de datos '" & db & "'.")
                End If

                Throw New Exception("Respuesta inesperada al autenticar en Odoo.")
            End Using

        End Using

    End Function

    ' =========================================================
    ' 3. LLAMADA GENÉRICA AL ORM DE ODOO (object.execute_kw)
    ' =========================================================
    Public Async Function ExecuteKwAsync(
        db As String,
        uid As Integer,
        apiKey As String,
        model As String,
        method As String,
        args As Object(),
        Optional kwargs As Object = Nothing) As Task(Of JsonElement)

        Dim url As String = _baseUrl & "/jsonrpc"

        If kwargs Is Nothing Then
            kwargs = New Dictionary(Of String, Object)()
        End If

        Dim requestObject As New With {
            .jsonrpc = "2.0",
            .method = "call",
            .params = New With {
                .service = "object",
                .method = "execute_kw",
                .args = New Object() {db, uid, apiKey, model, method, args, kwargs}
            },
            .id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        }

        Dim jsonRequest As String = JsonSerializer.Serialize(requestObject)

        Using content As New StringContent(jsonRequest, Encoding.UTF8, "application/json")

            Dim response As HttpResponseMessage = Await _http.PostAsync(url, content)
            Dim responseText As String = Await response.Content.ReadAsStringAsync()

            Dim doc As JsonDocument = JsonDocument.Parse(responseText)
            Dim root As JsonElement = doc.RootElement.Clone()

            If root.TryGetProperty("error", Nothing) Then
                Dim errMsg As String = "Error ORM Odoo"
                Try
                    errMsg = root.GetProperty("error").GetProperty("data").GetProperty("message").GetString()
                Catch
                    errMsg = root.GetProperty("error").GetProperty("message").GetString()
                End Try
                Throw New Exception(errMsg)
            End If

            Return root.GetProperty("result")

        End Using

    End Function

    ' =========================================================
    ' 4. BUSCAR O CREAR PRODUCTO POR PART NUMBER (product.product)
    ' =========================================================
    Public Async Function SearchOrCreateProductAsync(
        db As String,
        uid As Integer,
        apiKey As String,
        partNumber As String,
        description As String) As Task(Of Integer)

        ' Buscar por Referencia Interna (default_code)
        Dim domain As Object() = New Object() {
            New Object() {"default_code", "=", partNumber.Trim()}
        }

        Dim kwargs As New Dictionary(Of String, Object) From {
            {"fields", New String() {"id", "name", "default_code"}},
            {"limit", 1}
        }

        Dim searchResult As JsonElement = Await ExecuteKwAsync(
            db, uid, apiKey, "product.product", "search_read", New Object() {domain}, kwargs)

        If searchResult.GetArrayLength() > 0 Then
            Dim firstProduct As JsonElement = searchResult(0)
            Return firstProduct.GetProperty("id").GetInt32()
        End If

        ' Si no existe, crear el producto como almacenable
        Dim newProductValues As New Dictionary(Of String, Object) From {
            {"default_code", partNumber.Trim()},
            {"name", If(String.IsNullOrWhiteSpace(description), partNumber, description)},
            {"type", "consu"} ' o "product"
        }

        Dim createResult As JsonElement = Await ExecuteKwAsync(
            db, uid, apiKey, "product.product", "create", New Object() {newProductValues})

        Return createResult.GetInt32()

    End Function

    ' =========================================================
    ' 5. CREAR SOLICITUD DE PRESUPUESTO / PEDIDO DE COMPRA (purchase.order)
    ' =========================================================
    Public Async Function CreatePurchaseOrderAsync(
        db As String,
        uid As Integer,
        apiKey As String,
        partnerId As Integer,
        Optional originText As String = "Autodesk Inventor - LDM") As Task(Of Integer)

        Dim orderValues As New Dictionary(Of String, Object) From {
            {"partner_id", partnerId},
            {"origin", originText}
        }

        Dim result As JsonElement = Await ExecuteKwAsync(
            db, uid, apiKey, "purchase.order", "create", New Object() {orderValues})

        Return result.GetInt32()

    End Function

    ' =========================================================
    ' 6. AGREGAR LÍNEAS DE LA LDM A LA ORDEN DE COMPRA (purchase.order.line)
    ' =========================================================
    Public Async Function ImportLdmToPurchaseOrderAsync(
        db As String,
        uid As Integer,
        apiKey As String,
        partnerId As Integer,
        items As List(Of LdmItem),
        Optional origin As String = "Autodesk Inventor - LDM") As Task(Of (OrderId As Integer, LinesCount As Integer))

        ' 1. Crear la cabecera de compra en Odoo
        Dim orderId As Integer = Await CreatePurchaseOrderAsync(db, uid, apiKey, partnerId, origin)

        Dim count As Integer = 0

        ' 2. Por cada fila del Excel / LDM, buscar o crear producto e insertar la línea
        For Each item In items

            If String.IsNullOrWhiteSpace(item.PartNumber) Then Continue For

            Dim productId As Integer = Await SearchOrCreateProductAsync(
                db, uid, apiKey, item.PartNumber, item.Description)

            Dim lineValues As New Dictionary(Of String, Object) From {
                {"order_id", orderId},
                {"product_id", productId},
                {"name", If(String.IsNullOrWhiteSpace(item.Description), item.PartNumber, item.Description)},
                {"product_qty", item.Quantity}
            }

            If item.UnitPrice > 0 Then
                lineValues.Add("price_unit", item.UnitPrice)
            End If

            Await ExecuteKwAsync(
                db, uid, apiKey, "purchase.order.line", "create", New Object() {lineValues})

            count += 1

        Next

        Return (orderId, count)

    End Function

    ' =========================================================
    ' 7. OBTENER LISTA DE PROVEEDORES (res.partner)
    ' =========================================================
    Public Async Function GetSuppliersAsync(
        db As String,
        uid As Integer,
        apiKey As String) As Task(Of List(Of KeyValuePair(Of Integer, String)))

        Dim domain As Object() = New Object() {}
        Dim kwargs As New Dictionary(Of String, Object) From {
            {"fields", New String() {"id", "name"}},
            {"limit", 20}
        }

        Dim result As JsonElement = Await ExecuteKwAsync(
            db, uid, apiKey, "res.partner", "search_read", New Object() {domain}, kwargs)

        Dim lista As New List(Of KeyValuePair(Of Integer, String))
        For Each elem In result.EnumerateArray()
            Dim id As Integer = elem.GetProperty("id").GetInt32()
            Dim name As String = elem.GetProperty("name").GetString()
            lista.Add(New KeyValuePair(Of Integer, String)(id, name))
        Next

        Return lista

    End Function

    Public Sub Dispose()
        If _http IsNot Nothing Then
            _http.Dispose()
        End If
    End Sub

End Class
