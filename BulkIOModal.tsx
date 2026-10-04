import React, { useState, useMemo } from 'react';
import { Point3D, Polygon3D } from '../types/geometry';
import { parseBulkInput, exportToOBJ, downloadFile } from '../utils/objParser';
import {
  X,
  Upload,
  Download,
  Copy,
  Check,
  FileText,
  AlertCircle,
  FileCode,
} from 'lucide-react';

interface BulkIOModalProps {
  isOpen: boolean;
  onClose: () => void;
  points: Point3D[];
  polygons: Polygon3D[];
  onApplyImport: (newPoints: Point3D[], newPolygons: Polygon3D[], replaceExisting: boolean) => void;
  initialTab?: 'import' | 'export';
}

export const BulkIOModal: React.FC<BulkIOModalProps> = ({
  isOpen,
  onClose,
  points,
  polygons,
  onApplyImport,
  initialTab = 'import',
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>(initialTab);
  const [bulkInputText, setBulkInputText] = useState<string>('');
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [triangulateExport, setTriangulateExport] = useState<boolean>(false);
  const [includeNormals, setIncludeNormals] = useState<boolean>(true);
  const [modelFilename, setModelFilename] = useState<string>('pixelated3dpng_model.obj');
  const [copied, setCopied] = useState<boolean>(false);

  // Live parse feedback on import
  const parseResult = useMemo(() => {
    if (!bulkInputText.trim()) return null;
    return parseBulkInput(bulkInputText);
  }, [bulkInputText]);

  // Live OBJ export preview
  const objExportText = useMemo(() => {
    return exportToOBJ(points, polygons, {
      triangulateAll: triangulateExport,
      includeNormals,
      modelName: modelFilename.replace(/\.obj$/i, ''),
    });
  }, [points, polygons, triangulateExport, includeNormals, modelFilename]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setBulkInputText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = () => {
    if (!parseResult) return;
    onApplyImport(parseResult.points, parseResult.polygons, replaceExisting);
    onClose();
  };

  const handleCopyOBJ = () => {
    navigator.clipboard.writeText(objExportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadOBJ = () => {
    downloadFile(objExportText, modelFilename || 'modello.obj', 'text/plain');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        {/* Top Dialog Bar */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('import')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'import'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importazione Bulk</span>
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'export'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Esportazione OBJ</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'import' ? (
            /* --- IMPORT TAB --- */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-300">
                  Incolla testo con coordinate X Y Z o formato Wavefront OBJ:
                </span>
                <label className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md cursor-pointer border border-slate-700 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-sky-400" />
                  <span>Carica file .obj / .csv / .txt</span>
                  <input
                    type="file"
                    accept=".obj,.txt,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Text Area */}
              <div className="relative">
                <textarea
                  rows={10}
                  value={bulkInputText}
                  onChange={(e) => setBulkInputText(e.target.value)}
                  placeholder={`Esempi formati supportati:

1) Coordinate XYZ semplici per riga:
-1.5 0.0 -1.5
1.5 0.0 -1.5
1.5 0.0 1.5
-1.5 0.0 1.5
0.0 2.5 0.0
p 0 1 2 3
p 0 1 4

2) Formato Wavefront OBJ completo:
v -1.0 0.0 -1.0
v 1.0 0.0 -1.0
v 1.0 0.0 1.0
v -1.0 1.0 1.0
f 1 2 3 4

3) Formato CSV:
x,y,z o nome,x,y,z`}
                  className="w-full bg-slate-950 font-mono text-xs text-slate-200 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-sky-500 leading-relaxed"
                />
              </div>

              {/* Parse Feedback Status */}
              {parseResult && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-col gap-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-400">Rilevati nell&apos;input:</span>
                    <span className="text-emerald-400 font-semibold font-mono">
                      {parseResult.points.length} vertici
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-sky-400 font-semibold font-mono">
                      {parseResult.polygons.length} poligoni/facce
                    </span>
                  </div>

                  {parseResult.errors.length > 0 && (
                    <div className="text-[11px] text-amber-400 bg-amber-950/40 p-2 rounded border border-amber-800/60 max-h-24 overflow-y-auto space-y-0.5">
                      <div className="flex items-center gap-1 font-semibold mb-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Avvisi di analisi ({parseResult.errors.length}):</span>
                      </div>
                      {parseResult.errors.slice(0, 5).map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                      {parseResult.errors.length > 5 && (
                        <div>...altri {parseResult.errors.length - 5} avvisi</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Mode choice */}
              <div className="flex items-center gap-4 text-xs text-slate-300 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={replaceExisting}
                    onChange={() => setReplaceExisting(true)}
                    className="accent-sky-500"
                  />
                  <span>Sostituisci completamente la scena corrente</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={!replaceExisting}
                    onChange={() => setReplaceExisting(false)}
                    className="accent-sky-500"
                  />
                  <span>Aggiungi ai punti e poligoni esistenti</span>
                </label>
              </div>
            </div>
          ) : (
            /* --- EXPORT TAB --- */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Nome File:</label>
                  <input
                    type="text"
                    value={modelFilename}
                    onChange={(e) => setModelFilename(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="checkbox"
                      checked={triangulateExport}
                      onChange={(e) => setTriangulateExport(e.target.checked)}
                      className="accent-sky-500 rounded"
                    />
                    <span>Triangola tutte le facce (Garantisce planarità 3D)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="checkbox"
                      checked={includeNormals}
                      onChange={(e) => setIncludeNormals(e.target.checked)}
                      className="accent-sky-500 rounded"
                    />
                    <span>Includi normali di superficie (vn)</span>
                  </label>
                </div>
              </div>

              {/* OBJ Preview */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1">
                    <FileCode className="w-3.5 h-3.5 text-sky-400" />
                    <span>Anteprima Wavefront OBJ generato:</span>
                  </span>
                  <span className="font-mono text-[11px]">
                    {points.length} vertici · {polygons.length} poligoni
                  </span>
                </div>
                <pre className="w-full h-56 bg-slate-950 font-mono text-xs text-slate-300 border border-slate-800 rounded-lg p-3 overflow-y-auto leading-relaxed select-all">
                  {objExportText}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-950/70">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            Chiudi
          </button>

          {activeTab === 'import' ? (
            <button
              onClick={handleExecuteImport}
              disabled={!parseResult || parseResult.points.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Importa nel Modello 3D</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyOBJ}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiato!' : 'Copia Testo OBJ'}</span>
              </button>
              <button
                onClick={handleDownloadOBJ}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Scarica File .OBJ</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
