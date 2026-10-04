import React, { useState } from 'react';
import { Point3D, Polygon3D, PlanarityAnalysis } from '../types/geometry';
import { analyzePolygonPlanarity, triangulatePolygon } from '../utils/geometryMath';
import {
  Shapes,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Layers,
  ArrowUpDown,
  Info,
  Sliders,
} from 'lucide-react';

interface PolygonsEditorProps {
  polygons: Polygon3D[];
  points: Point3D[];
  selectedPolygonId: string | null;
  onSelectPolygon: (id: string | null) => void;
  onSelectPoint: (id: string | null) => void;
  onAddPolygon: (polygon: Omit<Polygon3D, 'id'>) => void;
  onDeletePolygon: (id: string) => void;
  onAutoFixPolygon: (polyId: string, method: 'triangulate' | 'project') => void;
  onUpdatePolygonVertices: (polyId: string, vertexIds: string[]) => void;
  onUpdatePolygonColor: (polyId: string, color: string) => void;
  onOpenBulkModal: () => void;
}

const PRESET_COLORS = [
  '#10b981', // Emerald / Green (Default Planar)
  '#38bdf8', // Sky Blue
  '#f59e0b', // Amber
  '#ef4444', // Rose/Red (Error)
  '#a855f7', // Purple
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#64748b', // Slate
  '#e2e8f0', // Crisp White/Silver
];

export const PolygonsEditor: React.FC<PolygonsEditorProps> = ({
  polygons,
  points,
  selectedPolygonId,
  onSelectPolygon,
  onSelectPoint,
  onAddPolygon,
  onDeletePolygon,
  onAutoFixPolygon,
  onUpdatePolygonVertices,
  onUpdatePolygonColor,
  onOpenBulkModal,
}) => {
  const [newPolyName, setNewPolyName] = useState('');
  const [newPolyColor, setNewPolyColor] = useState('#10b981');
  const [selectedVertexSequence, setSelectedVertexSequence] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const pointsMap = new Map<string, Point3D>(points.map((p) => [p.id, p]));

  const handleToggleVertexForNew = (pointId: string) => {
    if (selectedVertexSequence.includes(pointId)) {
      setSelectedVertexSequence(selectedVertexSequence.filter((id) => id !== pointId));
    } else {
      setSelectedVertexSequence([...selectedVertexSequence, pointId]);
    }
  };

  const handleCreatePolygon = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedVertexSequence.length < 3) return;

    const name = newPolyName.trim() || `Poligono ${polygons.length + 1}`;
    onAddPolygon({
      name,
      vertexIds: [...selectedVertexSequence],
      color: newPolyColor,
    });

    setNewPolyName('');
    setSelectedVertexSequence([]);
    setIsCreating(false);
  };

  // Invert winding order (flip normal)
  const handleInvertWinding = (polyId: string, currentVertexIds: string[]) => {
    onUpdatePolygonVertices(polyId, [...currentVertexIds].reverse());
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shapes className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-slate-200">Poligoni & Triangoli</h2>
          <span className="text-xs text-slate-400 tabular-nums">({polygons.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuovo</span>
          </button>
        </div>
      </div>

      {/* Creation Drawer */}
      {isCreating && (
        <form onSubmit={handleCreatePolygon} className="p-3 bg-slate-950 border-b border-slate-800 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">Crea Poligono</span>
            <span className="text-[11px] text-slate-400">
              Vertici selezionati: <strong className="text-emerald-400">{selectedVertexSequence.length}</strong> (min. 3)
            </span>
          </div>

          <input
            type="text"
            placeholder={`Nome (es. Faccia ${polygons.length + 1})`}
            value={newPolyName}
            onChange={(e) => setNewPolyName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
          />

          {/* Color Picker for New Polygon */}
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-[11px] text-slate-400">Colore:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewPolyColor(c)}
                  className={`w-4 h-4 rounded-full transition-transform ${
                    newPolyColor.toLowerCase() === c.toLowerCase()
                      ? 'ring-2 ring-white scale-110'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <label className="relative w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center cursor-pointer hover:border-white ml-1" title="Colore personalizzato">
                <input
                  type="color"
                  value={newPolyColor}
                  onChange={(e) => setNewPolyColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <span className="text-[9px] text-slate-300 font-bold">+</span>
              </label>
            </div>
          </div>

          {/* Vertex Picker Chips */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-400">Clicca i punti nell'ordine perimetrale:</span>
            <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1 bg-slate-900 rounded border border-slate-800">
              {points.map((pt) => {
                const seqIndex = selectedVertexSequence.indexOf(pt.id);
                const isSelected = seqIndex !== -1;
                return (
                  <button
                    type="button"
                    key={pt.id}
                    onClick={() => handleToggleVertexForNew(pt.id)}
                    className={`px-2 py-0.5 text-xs font-mono rounded transition-colors flex items-center gap-1 ${
                      isSelected
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>{pt.name}</span>
                    {isSelected && (
                      <span className="w-3.5 h-3.5 rounded-full bg-black/30 text-[9px] flex items-center justify-center font-bold">
                        {seqIndex + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sequence Preview */}
          {selectedVertexSequence.length > 0 && (
            <div className="text-[11px] font-mono text-slate-400 truncate">
              Sequenza: {selectedVertexSequence.map((id) => pointsMap.get(id)?.name || id).join(' → ')}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setSelectedVertexSequence([]);
              }}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={selectedVertexSequence.length < 3}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium rounded-md transition-colors"
            >
              Salva Poligono
            </button>
          </div>
        </form>
      )}

      {/* Polygon List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-2">
        {polygons.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-500">
            Nessun poligono definito. Clicca &quot;Nuovo&quot; per comporre facce o importa in blocco.
          </div>
        ) : (
          polygons.map((poly, idx) => {
            const isSelected = poly.id === selectedPolygonId;
            const analysis = analyzePolygonPlanarity(poly, pointsMap);
            const isPlanar = analysis.isPlanar;
            const isWarped = analysis.status === 'warped';

            return (
              <div
                key={poly.id}
                onClick={() => onSelectPolygon(isSelected ? null : poly.id)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-sky-950/40 border-sky-500 shadow-md ring-1 ring-sky-500/50'
                    : isWarped
                    ? 'bg-red-950/20 border-red-900/60 hover:border-red-700/80'
                    : !isPlanar
                    ? 'bg-amber-950/20 border-amber-900/60 hover:border-amber-700/80'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      F#{idx + 1}
                    </span>
                    {/* Color indicator / direct picker */}
                    <label
                      className="relative flex items-center cursor-pointer shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      title={!isPlanar ? 'Non planare (visualizzato in rosso nella scena 3D). Clicca per assegnare un colore.' : 'Colore faccia 3D'}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm inline-block"
                        style={{ backgroundColor: !isPlanar ? '#ef4444' : (poly.color || '#10b981') }}
                      />
                      <input
                        type="color"
                        value={poly.color || (!isPlanar ? '#ef4444' : '#10b981')}
                        onChange={(e) => onUpdatePolygonColor(poly.id, e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                    <span className="text-xs font-semibold text-slate-100 truncate">
                      {poly.name}
                    </span>
                  </div>

                  {/* Planarity Chip */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {analysis.isTriangle ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Triangolo Planare</span>
                      </span>
                    ) : isPlanar ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Planare (Quad)</span>
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                        isWarped
                          ? 'text-red-300 bg-red-950/90 border-red-700'
                          : 'text-amber-300 bg-amber-950/90 border-amber-700'
                      }`}>
                        <AlertTriangle className="w-3 h-3" />
                        <span>{isWarped ? 'Torsione Elevata' : 'Non Planare'}</span>
                      </span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePolygon(poly.id);
                      }}
                      className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition-colors ml-1"
                      title="Elimina poligono"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Vertices flow */}
                <div className="flex flex-wrap items-center gap-1 mb-2 text-xs font-mono">
                  {poly.vertexIds.map((vId, vIdx) => {
                    const pt = pointsMap.get(vId);
                    return (
                      <React.Fragment key={vId}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPoint(vId);
                          }}
                          className="bg-slate-800 hover:bg-sky-700 px-1.5 py-0.5 rounded text-[11px] text-slate-200 transition-colors"
                          title={pt ? `X: ${pt.x}, Y: ${pt.y}, Z: ${pt.z}` : 'Punto non trovato'}
                        >
                          {pt ? pt.name : `[${vId}]`}
                        </button>
                        {vIdx < poly.vertexIds.length - 1 && (
                          <span className="text-slate-600 text-[10px]">→</span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Quantitative Analysis & Diagnosis */}
                {!analysis.isTriangle && (
                  <div className="bg-slate-900/80 rounded p-2 text-[11px] text-slate-300 space-y-1 mb-2">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Deviazione max dal piano:</span>
                      <span className={`font-mono tabular-nums ${isPlanar ? 'text-emerald-400' : 'text-amber-400 font-semibold'}`}>
                        {analysis.maxDeviation.toFixed(4)} u
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Angolo di torsione / svergolamento:</span>
                      <span className={`font-mono tabular-nums ${isPlanar ? 'text-emerald-400' : 'text-amber-400 font-semibold'}`}>
                        {analysis.torsionAngleDeg.toFixed(1)}°
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Normale stimata (Newell):</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        [{analysis.normal.x.toFixed(2)}, {analysis.normal.y.toFixed(2)}, {analysis.normal.z.toFixed(2)}]
                      </span>
                    </div>
                  </div>
                )}

                {/* Suggestions and Resolution Actions for Non-Planar Faces */}
                {!isPlanar && poly.vertexIds.length >= 4 && (
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] font-semibold text-amber-300">
                      Suggerimenti di correzione:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => onAutoFixPolygon(poly.id, 'triangulate')}
                        className="flex items-center justify-center gap-1 bg-emerald-700/80 hover:bg-emerald-600 text-white text-[11px] py-1 px-2 rounded transition-colors"
                        title="Mantieni la forma 3D voluta spezzando il quadrilatero in triangoli rigorosamente planari"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>Mantieni (Triangola)</span>
                      </button>

                      <button
                        onClick={() => onAutoFixPolygon(poly.id, 'project')}
                        className="flex items-center justify-center gap-1 bg-sky-700/80 hover:bg-sky-600 text-white text-[11px] py-1 px-2 rounded transition-colors"
                        title="Proietta ortogonalmente i vertici sul piano medio per eliminare la torsione"
                      >
                        <Layers className="w-3 h-3" />
                        <span>Proietta su Piano</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Color Swatches Palette */}
                <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between gap-1 text-[11px]" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] text-slate-400">Colore:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onUpdatePolygonColor(poly.id, c)}
                        className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-125 ${
                          (poly.color || '').toLowerCase() === c.toLowerCase()
                            ? 'ring-2 ring-white scale-110 shadow-sm'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                    <label
                      className="relative w-3.5 h-3.5 rounded-full border border-dashed border-slate-500 flex items-center justify-center cursor-pointer hover:border-white ml-0.5"
                      title="Scegli colore personalizzato..."
                    >
                      <input
                        type="color"
                        value={poly.color || '#38bdf8'}
                        onChange={(e) => onUpdatePolygonColor(poly.id, e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <span className="text-[8px] text-slate-400 font-bold leading-none">+</span>
                    </label>
                  </div>
                </div>

                {/* Utility actions: Invert Normal */}
                <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-slate-400">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInvertWinding(poly.id, poly.vertexIds);
                    }}
                    className="flex items-center gap-1 hover:text-slate-200"
                    title="Inverti ordine dei vertici per capovolgere la normale del poligono"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    <span>Inverti Normale</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
