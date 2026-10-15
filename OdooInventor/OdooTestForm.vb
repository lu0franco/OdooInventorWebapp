Imports System
Imports System.Drawing
Imports System.Threading.Tasks
Imports System.Windows.Forms

Public Class OdooTestForm

    Inherits System.Windows.Forms.Form

    Private ReadOnly _inventor As Inventor.Application

    Private _txtUrl As System.Windows.Forms.TextBox
    Private _txtApiKey As System.Windows.Forms.TextBox
    Private _txtResultado As System.Windows.Forms.TextBox

    Private _btnProbar As System.Windows.Forms.Button
    Private _btnCerrar As System.Windows.Forms.Button

    Public Sub New(inventor As Inventor.Application)

        MyBase.New()

        _inventor = inventor

        InitializeForm()

    End Sub

    Private Sub InitializeForm()

        '========================================================
        ' CONFIGURACIÓN DEL FORMULARIO
        '========================================================

        Me.Text = "OdooInventor - Prueba de conexión"
        Me.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen
        Me.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedDialog
        Me.MaximizeBox = False
        Me.MinimizeBox = False
        Me.ClientSize = New System.Drawing.Size(650, 500)

        '========================================================
        ' URL
        '========================================================

        Dim lblUrl As New System.Windows.Forms.Label()
        lblUrl.Text = "URL de Odoo (ej. https://deblasi.adhoc.ar):"
        lblUrl.AutoSize = True
        lblUrl.Location = New System.Drawing.Point(20, 20)
        Me.Controls.Add(lblUrl)

        _txtUrl = New System.Windows.Forms.TextBox()
        _txtUrl.Location = New System.Drawing.Point(20, 45)
        _txtUrl.Size = New System.Drawing.Size(610, 25)
        _txtUrl.Text = "https://deblasi.adhoc.ar"
        Me.Controls.Add(_txtUrl)

        '========================================================
        ' API KEY
        '========================================================

        Dim lblApiKey As New System.Windows.Forms.Label()
        lblApiKey.Text = "API Key:"
        lblApiKey.AutoSize = True
        lblApiKey.Location = New System.Drawing.Point(20, 85)
        Me.Controls.Add(lblApiKey)

        _txtApiKey = New System.Windows.Forms.TextBox()
        _txtApiKey.Location = New System.Drawing.Point(20, 110)
        _txtApiKey.Size = New System.Drawing.Size(610, 25)
        _txtApiKey.UseSystemPasswordChar = True
        Me.Controls.Add(_txtApiKey)

        '========================================================
        ' RESULTADO
        '========================================================

        Dim lblResultado As New System.Windows.Forms.Label()
        lblResultado.Text = "Resultado:"
        lblResultado.AutoSize = True
        lblResultado.Location = New System.Drawing.Point(20, 150)
        Me.Controls.Add(lblResultado)

        _txtResultado = New System.Windows.Forms.TextBox()
        _txtResultado.Location = New System.Drawing.Point(20, 175)
        _txtResultado.Size = New System.Drawing.Size(610, 250)
        _txtResultado.Multiline = True
        _txtResultado.ScrollBars = System.Windows.Forms.ScrollBars.Both
        _txtResultado.ReadOnly = True
        _txtResultado.WordWrap = False
        Me.Controls.Add(_txtResultado)

        '========================================================
        ' BOTÓN PROBAR
        '========================================================

        _btnProbar = New System.Windows.Forms.Button()
        _btnProbar.Text = "Probar"
        _btnProbar.Location = New System.Drawing.Point(440, 445)
        _btnProbar.Size = New System.Drawing.Size(90, 30)

        AddHandler _btnProbar.Click, AddressOf ProbarConexion
        Me.Controls.Add(_btnProbar)

        '========================================================
        ' BOTÓN CERRAR
        '========================================================

        _btnCerrar = New System.Windows.Forms.Button()
        _btnCerrar.Text = "Cerrar"
        _btnCerrar.Location = New System.Drawing.Point(540, 445)
        _btnCerrar.Size = New System.Drawing.Size(90, 30)

        AddHandler _btnCerrar.Click, AddressOf CerrarFormulario
        Me.Controls.Add(_btnCerrar)

    End Sub

    Private Async Sub ProbarConexion(sender As Object, e As EventArgs)

        Try

            _btnProbar.Enabled = False
            _txtResultado.Text = "Probando Odoo JSON-RPC..." & Environment.NewLine & Environment.NewLine & "Esperá un momento..."

            Dim url As String = _txtUrl.Text.Trim()

            If String.IsNullOrWhiteSpace(url) Then
                MessageBox.Show("Ingresá la URL de Odoo.", "OdooInventor", MessageBoxButtons.OK, MessageBoxIcon.Warning)
                Return
            End If

            ' OdooService normaliza automáticamente si el usuario ingresó /odoo o /web al final
            Dim servicio As New OdooService(url)

            Try
                Dim resultado As String = Await servicio.TestCommonVersionAsync()
                _txtResultado.Text = resultado
            Finally
                servicio.Dispose()
            End Try

        Catch ex As Exception
            _txtResultado.Text = "ERROR:" & Environment.NewLine & Environment.NewLine & ex.ToString()
        Finally
            _btnProbar.Enabled = True
        End Try

    End Sub

    Private Sub CerrarFormulario(sender As Object, e As EventArgs)
        Me.Close()
    End Sub

End Class
