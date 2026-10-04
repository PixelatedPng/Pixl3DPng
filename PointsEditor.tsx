import React, { useState } from 'react';
import { Point3D } from '../types/geometry';
import { Plus, Trash2, Crosshair, ChevronDown, ChevronUp, MapPin } from 'lucide-react';

interface PointsEditorProps {
  points: Point3D[];
  selectedPointId: string | null;
  onSelectPoint: (id: string | null) => void;
  onUpdatePointCoord: (id: string, coord: 'x' | 'y' | 'z', value: number) => void;
  onAddPoint: (point: Omit<Point3D, 'id'>) => void;
  onDeletePoint: (id: string) => void;
  onOpenBulkModal: () => void;
}

export const PointsEditor: React.FC<PointsEditorProps> = ({
  points,
  selectedPointId,
  onSelectPoint,
  onUpdatePointCoord,
  onAddPoint,
  onDeletePoint,
  onOpenBulkModal,
}) => {
  const [newX, setNewX] = useState<number>(0);
  const [newY, setNewY] = useState<number>(0);
  const [newZ, setNewZ] = useState<number>(0);
  const [newName, setNewName] = useState<string>('');
  const [stepValue, setStepValue] = useState<number>(0.5);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim() || `P${points.length + 1}`;
    onAddPoint({ name, x: newX, y: newY, z: newZ });
    setNewName('');
  };

  const filteredPoints = points.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header Bar */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-slate-200">Punti nello Spazio</h2>
          <span className="text-xs text-slate-400 tabular-nums">({points.length})</span>
        </div>
        <button
          onClick={onOpenBulkModal}
          className="text-xs text-sky-400 hover:text-sky-300 font-medium hover:underline transition-colors"
        >
          Inserimento Bulk
        </button>
      </div>

      {/* Quick Add Form */}
      <form onSubmit={handleAddNew} className="p-3 bg-slate-950/60 border-b border-slate-800 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={`Nome (es. P${points.length + 1})`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            className="flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-3 py-1 rounded-md transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Aggiungi</span>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-2 py-1">
            <span className="text-[10px] font-bold text-red-400 mr-1.5">X:</span>
            <input
              type="number"
              step="0.1"
              value={newX}
              onChange={(e) => setNewX(parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent text-xs text-slate-100 focus:outline-none tabular-nums"
            />
          </div>
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-2 py-1">
            <span className="text-[10px] font-bold text-emerald-400 mr-1.5">Y:</span>
            <input
              type="number"
              step="0.1"
              value={newY}
              onChange={(e) => setNewY(parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent text-xs text-slate-100 focus:outline-none tabular-nums"
            />
          </div>
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-2 py-1">
            <span className="text-[10px] font-bold text-sky-400 mr-1.5">Z:</span>
            <input
              type="number"
              step="0.1"
              value={newZ}
              onChange={(e) => setNewZ(parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent text-xs text-slate-100 focus:outline-none tabular-nums"
            />
          </div>
        </div>
      </form>

      {/* Filter and Step Tuning */}
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <input
          type="text"
          placeholder="Cerca punto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-36 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
        />
        <div className="flex items-center gap-1.5">
          <span>Passo:</span>
          <select
            value={stepValue}
            onChange={(e) => setStepValue(parseFloat(e.target.value))}
            className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="0.1">0.1</option>
            <option value="0.5">0.5</option>
            <option value="1.0">1.0</option>
            <option value="5.0">5.0</option>
          </select>
        </div>
      </div>

      {/* Points Scrollable List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1.5">
        {filteredPoints.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            Nessun punto presente. Usa il modulo sopra o importa in blocco.
          </div>
        ) : (
          filteredPoints.map((pt, idx) => {
            const isSelected = pt.id === selectedPointId;
            return (
              <div
                key={pt.id}
                onClick={() => onSelectPoint(isSelected ? null : pt.id)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-sky-950/40 border-sky-500/70 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-100">
                      {pt.name}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] text-sky-400 font-medium bg-sky-950 px-1.5 py-0.2 rounded border border-sky-800">
                        Selezionato in 3D
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePoint(pt.id);
                    }}
                    className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition-colors"
                    title="Elimina punto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* X, Y, Z Coordinate Controls with +/- Increments for Live 3D Feedback */}
                <div className="grid grid-cols-3 gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {/* X Axis */}
                  <div className="flex flex-col bg-slate-900 rounded border border-slate-800 p-1">
                    <div className="flex items-center justify-between text-[10px] text-red-400 font-semibold mb-0.5">
                      <span>X</span>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => onUpdatePointCoord(pt.id, 'x', Number((pt.x - stepValue).toFixed(3)))}
                          className="w-4 h-4 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title={`Diminuisci di ${stepValue}`}
                        >
                          -
                        </button>
                        <button
                          onClick={() => onUpdatePointCoord(pt.id, 'x', Number((pt.x + stepValue).toFixed(3)))}
                          className="w-4 h-4 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title={`Aumenta di ${stepValue}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      step={stepValue}
                      value={pt.x}
                      onChange={(e) => onUpdatePointCoord(pt.id, 'x', parseFloat(e.target.value) || 0)}
                      className="bg-transparent text-xs font-mono text-slate-100 focus:outline-none tabular-nums"
                    />
                  </div>

                  {/* Y Axis */}
                  <div className="flex flex-col bg-slate-900 rounded border border-slate-800 p-1">
                    <div className="flex items-center justify-between text-[10px] text-emerald-400 font-semibold mb-0.5">
                      <span>Y</span>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => onUpdatePointCoord(pt.id, 'y', Number((pt.y - stepValue).toFixed(3)))}
                          className="w-4 h-4 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title={`Diminuisci di ${stepValue}`}
                        >
                          -
                        </button>
                        <button
                          onClick={() => onUpdatePointCoord(pt.id, 'y', Number((pt.y + stepValue).toFixed(3)))}
                          className="w-4 h-4 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title={`Aumenta di ${stepValue}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      step={stepValue}
                      value={pt.y}
                      onChange={(e) => onUpdatePointCoord(pt.id, 'y', parseFloat(e.target.value) || 0)}
                      className="bg-transparent text-xs font-mono text-slate-100 focus:outline-none tabular-nums"
                    />
                  </div>

                  {/* Z Axis */}
                  <div className="flex flex-col bg-slate-900 rounded border border-slate-800 p-1">
                    <div className="flex items-center justify-between text-[10px] text-sky-400 font-semibold mb-0.5">
                      <span>Z</span>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => onUpdatePointCoord(pt.id, 'z', Number((pt.z - stepValue).toFixed(3)))}
                          className="w-4 h-4 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title={`Diminuisci di ${stepValue}`}
                        >
                          -
                        </button>
                        <button
                          onClick={() => onUpdatePointCoord(pt.id, 'z', Number((pt.z + stepValue).toFixed(3)))}
                          className="w-4 h-4 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title={`Aumenta di ${stepValue}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      step={stepValue}
                      value={pt.z}
                      onChange={(e) => onUpdatePointCoord(pt.id, 'z', parseFloat(e.target.value) || 0)}
                      className="bg-transparent text-xs font-mono text-slate-100 focus:outline-none tabular-nums"
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
