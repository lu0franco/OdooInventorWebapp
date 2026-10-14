Imports System
Imports System.Runtime.InteropServices
Imports System.Windows.Forms
Imports Inventor

<GuidAttribute("b64d2c5b-1eb1-46ab-b3f2-d780733b00bc"),
 ComVisible(True)>
Public Class StandardAddInServer
    Implements Inventor.ApplicationAddInServer

    ' =========================================================
    ' CAMPOS
    ' =========================================================
    Private _inventor As Inventor.Application
    Private _buttons As Buttons

    ' =========================================================
    ' ACTIVATE (Punto de entrada de Inventor)
    ' =========================================================
    Public Sub Activate(
        AddInSiteObject As Inventor.ApplicationAddInSite,
        FirstTime As Boolean) _
        Implements Inventor.ApplicationAddInServer.Activate

        Try
            ' 1. Guardar referencia a la instancia de Inventor
            _inventor = AddInSiteObject.Application

            ' 2. Crear todos los botones y ribbons dinámicos (busca TAB_TECNICA o crea TAB_ODOO)
            _buttons = New Buttons(_inventor)

        Catch ex As Exception
            MessageBox.Show(
                "Error al cargar OdooInventor Add-In:" & Environment.NewLine & Environment.NewLine & ex.ToString(),
                "OdooInventor - Error de Carga",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error)
        End Try

    End Sub

    ' =========================================================
    ' DEACTIVATE (Descarga de Inventor)
    ' =========================================================
    Public Sub Deactivate() _
        Implements Inventor.ApplicationAddInServer.Deactivate

        Try
            _buttons = Nothing
            _inventor = Nothing
        Catch
        End Try

        GC.Collect()
        GC.WaitForPendingFinalizers()

    End Sub

    ' =========================================================
    ' EXECUTE COMMAND
    ' =========================================================
    Public Sub ExecuteCommand(CommandID As Integer) _
        Implements Inventor.ApplicationAddInServer.ExecuteCommand
    End Sub

    ' =========================================================
    ' AUTOMATION
    ' =========================================================
    Public ReadOnly Property Automation As Object _
        Implements Inventor.ApplicationAddInServer.Automation
        Get
            Return Nothing
        End Get
    End Property

End Class
