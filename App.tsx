/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Point3D, Polygon3D } from './types/geometry';
import { PRESET_MODELS, PresetModel } from './utils/presets';
import {
  validateMesh,
  DEFAULT_PLANARITY_TOLERANCE,
  DEFAULT_TORSION_TOLERANCE_DEG,
  triangulatePolygon,
  analyzePolygonPlanarity,
} from './utils/geometryMath';
import { useGeometryHistory } from './hooks/useHistory';
import { Header } from './components/Header';
import { Viewport3D } from './components/Viewport3D';
import { PointsEditor } from './components/PointsEditor';
import { PolygonsEditor } from './components/PolygonsEditor';
import { ValidationReport } from './components/ValidationReport';
import { BulkIOModal } from './components/BulkIOModal';
import { MapPin, Shapes, ShieldAlert } from 'lucide-react';

export default function App() {
  // Initial model preset (warped quad demo highlighting non-planarity and auto-correction)
  const [currentPresetId, setCurrentPresetId] = useState<string>(PRESET_MODELS[0].id);

  // Undo / Redo History Stack Management
  const {
    points,
    polygons,
    setGeometry,
    resetWithState,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useGeometryHistory({
    points: PRESET_MODELS[0].points,
    polygons: PRESET_MODELS[0].polygons,
  });

  // Selection state
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);

  // Sidebar active tab
  const [sidebarTab, setSidebarTab] = useState<'points' | 'polygons' | 'validation'>('points');

  // Tolerances
  const [tolerance, setTolerance] = useState<number>(DEFAULT_PLANARITY_TOLERANCE);
  const [torsionToleranceDeg, setTorsionToleranceDeg] = useState<number>(DEFAULT_TORSION_TOLERANCE_DEG);

  // Surface and Viewport Settings
  const [surfaceSize, setSurfaceSize] = useState<number>(30);
  const [labelScale, setLabelScale] = useState<number>(1.0);
  const [showSurfacePlane, setShowSurfacePlane] = useState<boolean>(false);

  // Bulk IO Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [bulkModalInitialTab, setBulkModalInitialTab] = useState<'import' | 'export'>('import');

  // Mesh validation memo
  const meshValidation = useMemo(() => {
    return validateMesh(points, polygons, tolerance, torsionToleranceDeg);
  }, [points, polygons, tolerance, torsionToleranceDeg]);

  // Points Map
  const pointsMap = useMemo(() => {
    return new Map<string, Point3D>(points.map((p) => [p.id, p]));
  }, [points]);

  // Handler: Select Preset
  const handleSelectPreset = (preset: PresetModel) => {
    setCurrentPresetId(preset.id);
    resetWithState({
      points: preset.points,
      polygons: preset.polygons,
    });
    setSelectedPointId(null);
    setSelectedPolygonId(null);
  };

  // Handler: Update Point Coordinate (records history)
  const handleUpdatePointCoord = (id: string, coord: 'x' | 'y' | 'z', value: number) => {
    setGeometry((prev) => ({
      ...prev,
      points: prev.points.map((pt) => (pt.id === id ? { ...pt, [coord]: value } : pt)),
    }));
  };

  // Handler: Add Point (records history)
  const handleAddPoint = (newPt: Omit<Point3D, 'id'>) => {
    const id = `pt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    setGeometry((prev) => ({
      ...prev,
      points: [...prev.points, { ...newPt, id }],
    }));
    setSelectedPointId(id);
  };

  // Handler: Delete Point (records history)
  const handleDeletePoint = (id: string) => {
    setGeometry((prev) => ({
      points: prev.points.filter((p) => p.id !== id),
      polygons: prev.polygons
        .map((poly) => ({
          ...poly,
          vertexIds: poly.vertexIds.filter((vId) => vId !== id),
        }))
        .filter((poly) => poly.vertexIds.length >= 3),
    }));
    if (selectedPointId === id) setSelectedPointId(null);
  };

  // Handler: Add Polygon (records history)
  const handleAddPolygon = (newPoly: Omit<Polygon3D, 'id'>) => {
    const id = `poly_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    setGeometry((prev) => ({
      ...prev,
      polygons: [...prev.polygons, { ...newPoly, id }],
    }));
    setSelectedPolygonId(id);
  };

  // Handler: Delete Polygon (records history)
  const handleDeletePolygon = (id: string) => {
    setGeometry((prev) => ({
      ...prev,
      polygons: prev.polygons.filter((poly) => poly.id !== id),
    }));
    if (selectedPolygonId === id) setSelectedPolygonId(null);
  };

  // Handler: Update Polygon Vertices (records history)
  const handleUpdatePolygonVertices = (polyId: string, vertexIds: string[]) => {
    setGeometry((prev) => ({
      ...prev,
      polygons: prev.polygons.map((poly) => (poly.id === polyId ? { ...poly, vertexIds } : poly)),
    }));
  };

  // Handler: Update Polygon Color (records history)
  const handleUpdatePolygonColor = (polyId: string, color: string) => {
    setGeometry((prev) => ({
      ...prev,
      polygons: prev.polygons.map((poly) =>
        poly.id === polyId ? { ...poly, color } : poly
      ),
    }));
  };

  // Handler: Auto-Fix Polygon (Triangulate or Project) (records history)
  const handleAutoFixPolygon = (polyId: string, method: 'triangulate' | 'project') => {
    const targetPoly = polygons.find((p) => p.id === polyId);
    if (!targetPoly) return;

    if (method === 'triangulate') {
      // Split this non-planar polygon into planar triangles
      const subTriangles = triangulatePolygon(targetPoly, pointsMap);
      setGeometry((prev) => {
        const idx = prev.polygons.findIndex((p) => p.id === polyId);
        if (idx === -1) return prev;
        const copy = [...prev.polygons];
        copy.splice(idx, 1, ...subTriangles);
        return {
          ...prev,
          polygons: copy,
        };
      });
      setSelectedPolygonId(subTriangles[0]?.id || null);
    } else if (method === 'project') {
      // Project the non-planar vertices onto the best-fit plane
      const analysis = analyzePolygonPlanarity(targetPoly, pointsMap, tolerance, torsionToleranceDeg);
      const projMap = new Map(analysis.projectedPoints.map((p) => [p.id, p]));

      setGeometry((prev) => ({
        ...prev,
        points: prev.points.map((pt) => {
          const projected = projMap.get(pt.id);
          if (projected) {
            return {
              ...pt,
              x: Number(projected.x.toFixed(4)),
              y: Number(projected.y.toFixed(4)),
              z: Number(projected.z.toFixed(4)),
            };
          }
          return pt;
        }),
      }));
    }
  };

  // Handler: Batch Fix All Non-Planar Polygons (Triangulate All) (records history)
  const handleFixAllNonPlanar = () => {
    setGeometry((prev) => {
      const newPolys: Polygon3D[] = [];
      for (const poly of prev.polygons) {
        const analysis = analyzePolygonPlanarity(poly, pointsMap, tolerance, torsionToleranceDeg);
        if (!analysis.isPlanar && poly.vertexIds.length >= 4) {
          const split = triangulatePolygon(poly, pointsMap);
          newPolys.push(...split);
        } else {
          newPolys.push(poly);
        }
      }
      return {
        ...prev,
        polygons: newPolys,
      };
    });
  };

  // Handler: Remove Orphan Points (records history)
  const handleRemoveOrphanPoints = () => {
    setGeometry((prev) => {
      const usedIds = new Set<string>();
      prev.polygons.forEach((poly) => poly.vertexIds.forEach((id) => usedIds.add(id)));
      return {
        ...prev,
        points: prev.points.filter((p) => usedIds.has(p.id)),
      };
    });
  };

  // Handler: Apply Bulk Import (records history or resets)
  const handleApplyImport = (
    newPoints: Point3D[],
    newPolygons: Polygon3D[],
    replaceExisting: boolean
  ) => {
    if (replaceExisting) {
      resetWithState({
        points: newPoints,
        polygons: newPolygons,
      });
    } else {
      setGeometry((prev) => ({
        points: [...prev.points, ...newPoints],
        polygons: [...prev.polygons, ...newPolygons],
      }));
    }
    setSelectedPointId(null);
    setSelectedPolygonId(null);
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation Bar with Undo / Redo */}
      <Header
        onSelectPreset={handleSelectPreset}
        currentPresetId={currentPresetId}
        pointsCount={points.length}
        polygonsCount={polygons.length}
        nonPlanarCount={meshValidation.nonPlanarCount}
        onOpenImport={() => {
          setBulkModalInitialTab('import');
          setIsBulkModalOpen(true);
        }}
        onOpenExport={() => {
          setBulkModalInitialTab('export');
          setIsBulkModalOpen(true);
        }}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* 3D Viewport with Single View / 3-Axes Views / CAD Quad View and 3D Point Names */}
        <div className="flex-1 h-1/2 md:h-full relative overflow-hidden bg-slate-950 border-r border-slate-800">
          <Viewport3D
            points={points}
            polygons={polygons}
            selectedPointId={selectedPointId}
            selectedPolygonId={selectedPolygonId}
            onSelectPoint={(id) => {
              setSelectedPointId(id);
              if (id) {
                setSelectedPolygonId(null);
                setSidebarTab('points');
              }
            }}
            onSelectPolygon={(id) => {
              setSelectedPolygonId(id);
              if (id) {
                setSelectedPointId(null);
                setSidebarTab('polygons');
              }
            }}
            onUpdatePointCoord={handleUpdatePointCoord}
            onAutoFixPolygon={handleAutoFixPolygon}
            surfaceSize={surfaceSize}
            onUpdateSurfaceSize={setSurfaceSize}
            labelScale={labelScale}
            onUpdateLabelScale={setLabelScale}
            showSurfacePlane={showSurfacePlane}
            onToggleSurfacePlane={() => setShowSurfacePlane((prev) => !prev)}
          />
        </div>

        {/* Right Sidebar: Editors & Diagnostics */}
        <div className="w-full md:w-[420px] lg:w-[460px] h-1/2 md:h-full bg-slate-900 flex flex-col border-t md:border-t-0 border-slate-800 shrink-0">
          {/* Segmented Control Tabs */}
          <div className="flex items-center p-2 bg-slate-950 border-b border-slate-800 gap-1 select-none">
            <button
              onClick={() => setSidebarTab('points')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                sidebarTab === 'points'
                  ? 'bg-slate-800 text-sky-400 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Punti ({points.length})</span>
            </button>

            <button
              onClick={() => setSidebarTab('polygons')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                sidebarTab === 'polygons'
                  ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Shapes className="w-3.5 h-3.5" />
              <span>Poligoni ({polygons.length})</span>
            </button>

            <button
              onClick={() => setSidebarTab('validation')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                sidebarTab === 'validation'
                  ? (meshValidation.nonPlanarCount > 0 ? 'bg-slate-800 text-red-400 font-semibold shadow-sm' : 'bg-slate-800 text-sky-400 font-semibold shadow-sm')
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Controllo ({meshValidation.errors.length})</span>
              {meshValidation.nonPlanarCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse"></span>
              )}
            </button>
          </div>

          {/* Active Tab Content */}
          <div className="flex-1 overflow-hidden">
            {sidebarTab === 'points' && (
              <PointsEditor
                points={points}
                selectedPointId={selectedPointId}
                onSelectPoint={setSelectedPointId}
                onUpdatePointCoord={handleUpdatePointCoord}
                onAddPoint={handleAddPoint}
                onDeletePoint={handleDeletePoint}
                onOpenBulkModal={() => {
                  setBulkModalInitialTab('import');
                  setIsBulkModalOpen(true);
                }}
              />
            )}

            {sidebarTab === 'polygons' && (
              <PolygonsEditor
                polygons={polygons}
                points={points}
                selectedPolygonId={selectedPolygonId}
                onSelectPolygon={setSelectedPolygonId}
                onSelectPoint={(pId) => {
                  setSelectedPointId(pId);
                  setSidebarTab('points');
                }}
                onAddPolygon={handleAddPolygon}
                onDeletePolygon={handleDeletePolygon}
                onAutoFixPolygon={handleAutoFixPolygon}
                onUpdatePolygonVertices={handleUpdatePolygonVertices}
                onUpdatePolygonColor={handleUpdatePolygonColor}
                onOpenBulkModal={() => {
                  setBulkModalInitialTab('import');
                  setIsBulkModalOpen(true);
                }}
              />
            )}

            {sidebarTab === 'validation' && (
              <ValidationReport
                errors={meshValidation.errors}
                polygonDiagnostics={meshValidation.polygonDiagnostics}
                orphanPoints={meshValidation.orphanPoints}
                nonPlanarCount={meshValidation.nonPlanarCount}
                tolerance={tolerance}
                torsionToleranceDeg={torsionToleranceDeg}
                onUpdateTolerance={(dist, deg) => {
                  setTolerance(dist);
                  setTorsionToleranceDeg(deg);
                }}
                onFixAllNonPlanar={handleFixAllNonPlanar}
                onRemoveOrphanPoints={handleRemoveOrphanPoints}
                onSelectPolygon={(id) => {
                  setSelectedPolygonId(id);
                  if (id) setSidebarTab('polygons');
                }}
                onSelectPoint={(id) => {
                  setSelectedPointId(id);
                  if (id) setSidebarTab('points');
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bulk Import / Export Modal */}
      <BulkIOModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        points={points}
        polygons={polygons}
        onApplyImport={handleApplyImport}
        initialTab={bulkModalInitialTab}
      />
    </div>
  );
}
