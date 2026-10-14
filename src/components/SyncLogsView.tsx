import React from 'react';
import { FileText, CheckCircle2, AlertTriangle, Clock, RefreshCw, Terminal } from 'lucide-react';
import { SyncLog } from '../types';

interface SyncLogsViewProps {
  logs: SyncLog[];
  onClearLogs: () => void;
}

export const SyncLogsView: React.FC<SyncLogsViewProps> = ({ logs, onClearLogs }) => {
  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-slate-100">
                Registro de Tráfico y Actividad Odoo JSON-RPC
              </h2>
              <span className="text-xs bg-slate-800 font-mono text-purple-400 px-2 py-0.5 rounded border border-slate-700">
                Auditoría en Tiempo Real
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Trazabilidad completa de llamadas de red, pruebas de versión, sincronización de listas BOM y actualización de propiedades.
            </p>
          </div>
        </div>

        <button
          onClick={onClearLogs}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition"
        >
          Limpiar Historial
        </button>
      </div>

      {/* Logs Table */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No hay registros de actividad aún. Probá la conexión o sincronizá la BOM para generar eventos.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-start space-x-3 text-xs font-mono hover:border-slate-700 transition"
            >
              <div className="mt-0.5">
                {log.status === 'OK' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 text-[10px]">
                      {log.action}
                    </span>
                    <span className="text-slate-300 font-semibold">{log.target}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
                    <Clock className="w-3 h-3" />
                    <span>{log.timestamp}</span>
                  </div>
                </div>

                <div className="text-slate-300 font-sans text-xs pt-0.5">
                  {log.details}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
