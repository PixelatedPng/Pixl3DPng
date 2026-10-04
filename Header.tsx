import React from 'react';
import { PRESET_MODELS, PresetModel } from '../utils/presets';
import { Upload, Download, Sparkles, AlertTriangle, CheckCircle2, Undo2, Redo2 } from 'lucide-react';

interface HeaderProps {
  onSelectPreset: (preset: PresetModel) => void;
  currentPresetId: string;
  pointsCount: number;
  polygonsCount: number;
  nonPlanarCount: number;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectPreset,
  currentPresetId,
  pointsCount,
  polygonsCount,
  nonPlanarCount,
  onOpenImport,
  onOpenExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  return (
    <header className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 shrink-0 select-none">
      {/* Zone 1: Wordmark */}
      <div className="flex items-center gap-3">
        <a href="/" className="text-base font-bold tracking-tight text-white flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block shadow-sm"></span>
          <span>Pixelated3DPng</span>
        </a>
      </div>

      {/* Zone 2: Preset selector & Model stats (Unboxed metadata with typographic separators) */}
      <div className="hidden md:flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-slate-400">Modello:</span>
          <select
            value={currentPresetId}
            onChange={(e) => {
              const matched = PRESET_MODELS.find((p) => p.id === e.target.value);
              if (matched) onSelectPreset(matched);
            }}
            className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
          >
            {PRESET_MODELS.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <span className="tabular-nums font-mono text-slate-300 font-medium">{pointsCount} punti</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums font-mono text-slate-300 font-medium">{polygonsCount} poligoni</span>
          <span aria-hidden="true">·</span>
          {nonPlanarCount > 0 ? (
            <span className="flex items-center gap-1 text-red-400 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="tabular-nums font-mono">{nonPlanarCount} non planari</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Planarità 100%</span>
            </span>
          )}
        </div>
      </div>

      {/* Zone 3: Primary Actions + Undo/Redo */}
      <div className="flex items-center gap-2.5">
        {/* Undo / Redo buttons with keyboard shortcut badges */}
        <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
            title="Annulla ultima modifica (Ctrl+Z / Cmd+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-[11px]">Annulla</span>
          </button>
          <div className="w-[1px] h-3 bg-slate-800 my-auto" />
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
            title="Ripristina modifica (Ctrl+Y / Cmd+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-[11px]">Ripristina</span>
          </button>
        </div>

        <button
          onClick={onOpenImport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Importa Bulk</span>
        </button>

        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors shadow-sm whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Esporta OBJ</span>
        </button>
      </div>
    </header>
  );
};
