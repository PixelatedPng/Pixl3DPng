import React from 'react';
import { Point3D, Polygon3D, MeshValidationError, PolygonDiagnostics } from '../types/geometry';
import {
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Info,
  Wand2,
  Trash2,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

interface ValidationReportProps {
  errors: MeshValidationError[];
  polygonDiagnostics: PolygonDiagnostics[];
  orphanPoints: Point3D[];
  nonPlanarCount: number;
  tolerance: number;
  torsionToleranceDeg: number;
  onUpdateTolerance: (dist: number, deg: number) => void;
  onFixAllNonPlanar: () => void;
  onRemoveOrphanPoints: () => void;
  onSelectPolygon: (id: string | null) => void;
  onSelectPoint: (id: string | null) => void;
}

export const ValidationReport: React.FC<ValidationReportProps> = ({
  errors,
  polygonDiagnostics,
  orphanPoints,
  nonPlanarCount,
  tolerance,
  torsionToleranceDeg,
  onUpdateTolerance,
  onFixAllNonPlanar,
  onRemoveOrphanPoints,
  onSelectPolygon,
  onSelectPoint,
}) => {
  const hasErrors = errors.some((e) => e.severity === 'error');
  const hasWarnings = errors.some((e) => e.severity === 'warning');

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasErrors ? (
            <ShieldAlert className="w-4 h-4 text-red-400" />
          ) : hasWarnings ? (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          )}
          <h2 className="text-sm font-semibold text-slate-200">Controllo Errori & Planarità</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* KPI Dashboard */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400">Poligoni Non Planari</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className={`text-xl font-bold font-mono ${nonPlanarCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {nonPlanarCount}
              </span>
              <span className="text-[11px] text-slate-500">
                su {polygonDiagnostics.length}
              </span>
            </div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400">Punti Orfani (Isolati)</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className={`text-xl font-bold font-mono ${orphanPoints.length > 0 ? 'text-sky-400' : 'text-slate-400'}`}>
                {orphanPoints.length}
              </span>
            </div>
          </div>
        </div>

        {/* Global Batch Fixes */}
        {nonPlanarCount > 0 && (
          <div className="p-2.5 bg-red-950/30 border border-red-800/60 rounded-lg flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Wand2 className="w-4 h-4 text-red-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-red-200 block truncate">
                  {nonPlanarCount} poligoni richiedono triangolazione
                </span>
                <span className="text-[10px] text-slate-300">
                  Converti tutti i poligoni svergolati in triangoli planari.
                </span>
              </div>
            </div>
            <button
              onClick={onFixAllNonPlanar}
              className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-md whitespace-nowrap transition-colors"
            >
              Triangola Tutti
            </button>
          </div>
        )}

        {orphanPoints.length > 0 && (
          <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-200 block truncate">
                {orphanPoints.length} punti non appartengono a nessuna faccia
              </span>
            </div>
            <button
              onClick={onRemoveOrphanPoints}
              className="px-2.5 py-1 bg-slate-800 hover:bg-red-900/60 text-slate-200 hover:text-red-200 text-xs font-medium rounded-md whitespace-nowrap transition-colors"
            >
              Rimuovi Orfani
            </button>
          </div>
        )}

        {/* Tolerance Controls */}
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            <span>Soglie di Tolleranza Planarità</span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-slate-400">
              <span>Scostamento max da piano:</span>
              <span className="font-mono text-slate-200 tabular-nums">{tolerance} unità</span>
            </div>
            <input
              type="range"
              min="0.001"
              max="0.1"
              step="0.005"
              value={tolerance}
              onChange={(e) => onUpdateTolerance(parseFloat(e.target.value), torsionToleranceDeg)}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />

            <div className="flex items-center justify-between text-slate-400 pt-1">
              <span>Angolo torsione max:</span>
              <span className="font-mono text-slate-200 tabular-nums">{torsionToleranceDeg}°</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.2"
              value={torsionToleranceDeg}
              onChange={(e) => onUpdateTolerance(tolerance, parseFloat(e.target.value))}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Detailed Issues List */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-300 block">
            Dettagli Segnalazioni ({errors.length})
          </span>

          {errors.length === 0 ? (
            <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Nessun errore riscontrato: la mesh è geometricamente valida e planare.</span>
            </div>
          ) : (
            errors.map((err) => {
              const isError = err.severity === 'error';
              const isWarning = err.severity === 'warning';
              return (
                <div
                  key={err.id}
                  onClick={() => {
                    if (err.polygonId) onSelectPolygon(err.polygonId);
                    if (err.pointId) onSelectPoint(err.pointId);
                  }}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    isError
                      ? 'bg-red-950/30 border-red-800/80 hover:border-red-600'
                      : isWarning
                      ? 'bg-amber-950/30 border-amber-800/80 hover:border-amber-600'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {isError ? (
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 font-medium leading-snug">{err.message}</p>
                      {err.actionSuggestion && (
                        <p className="text-[11px] text-slate-400 mt-1">{err.actionSuggestion}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
